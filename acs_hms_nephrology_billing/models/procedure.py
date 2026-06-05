# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.exceptions import UserError


class AcsPatientProcedure(models.Model):
    _inherit = 'acs.patient.procedure'

    resolved_pricing_rule_id = fields.Many2one(
        'acs.dialysis.pricing.rule',
        string='Règle tarifaire appliquée',
        help='Règle tarifaire active à la date de la séance.',
    )
    billing_state = fields.Selection(
        [
            ('not_invoiced', 'Non facturé'),
            ('invoiced', 'Facturé'),
            ('paid', 'Payé'),
        ],
        string='État facturation',
        compute='_compute_billing_state',
        store=True,
        default='not_invoiced',
    )

    @api.depends('invoice_id', 'invoice_id.payment_state')
    def _compute_billing_state(self):
        for procedure in self:
            if not procedure.invoice_id:
                procedure.billing_state = 'not_invoiced'
            elif procedure.invoice_id.payment_state in ('paid', 'in_payment'):
                procedure.billing_state = 'paid'
            else:
                procedure.billing_state = 'invoiced'

    def _resolve_pricing_rule(self):
        """Resolves and sets the active pricing rule for the procedure's date."""
        self.ensure_one()
        session_date = self.date or fields.Date.today()
        rule = self.env['acs.dialysis.tariff.history'].get_active_rule(
            self.patient_id.id, session_date
        )
        if rule:
            self.resolved_pricing_rule_id = rule

    def _get_insurance_coverage(self, session_date=None):
        """Returns (primary_rate, secondary_rate) as decimals (0-1).

        Primary covers X% of total, secondary covers Y% of the remaining balance.
        """
        self.ensure_one()
        if session_date is None:
            session_date = self.date or fields.Date.today()
        # Normalize to date for comparison with Date fields
        if hasattr(session_date, 'date'):
            session_date = session_date.date()
        patient = self.patient_id
        insurers = patient.patient_insurer_ids.filtered(
            lambda i: (
                i.date_start <= session_date
                and (not i.date_end or i.date_end >= session_date)
            )
        )
        primary = insurers.filtered(lambda i: i.priority == 'primary')
        secondary = insurers.filtered(lambda i: i.priority == 'secondary')
        primary_rate = (primary[0].coverage_rate / 100.0) if primary else 0.0
        secondary_rate = (secondary[0].coverage_rate / 100.0) if secondary else 0.0
        return primary_rate, secondary_rate

    def _apply_insurance_amounts(self, invoice, session_date=None):
        """Writes insurance coverage amounts on invoice lines."""
        self.ensure_one()
        primary_rate, secondary_rate = self._get_insurance_coverage(session_date)
        for line in invoice.invoice_line_ids.filtered(
            lambda l: l.display_type not in ('line_section', 'line_note')
        ):
            total = line.price_subtotal
            insurance_amount = total * primary_rate
            remaining = total - insurance_amount
            insurance_amount += remaining * secondary_rate
            patient_amount = total - insurance_amount
            line.write({
                'acs_insurance_amount': insurance_amount,
                'acs_patient_amount': patient_amount,
            })

    def action_done(self):
        """Override: resolve pricing rule and optionally auto-create invoice."""
        res = super().action_done()
        for procedure in self:
            procedure._resolve_pricing_rule()
            if procedure.env.company.nephro_auto_invoice:
                try:
                    procedure.action_create_nephro_invoice()
                except Exception:
                    pass  # Don't block session completion if invoice fails
        return res

    def action_create_nephro_invoice(self):
        """Create a dialysis invoice for this procedure."""
        self.ensure_one()
        if self.billing_state != 'not_invoiced':
            raise UserError(
                "Cette séance est déjà facturée (état: %s)." % self.billing_state
            )
        rule = self.resolved_pricing_rule_id
        if not rule:
            raise UserError(
                "Aucune règle tarifaire résolue pour cette séance. "
                "Vérifiez l'historique tarifaire du patient."
            )
        # Build product line for invoice (always a date, not datetime)
        raw_date = self.date or fields.Date.today()
        session_date = raw_date.date() if hasattr(raw_date, 'date') else raw_date
        patient_partner = self.patient_id.partner_id
        # acs.patient.procedure always inherits acs.hms.mixin (has acs_create_invoice + product_id).
        # Use mixin when a product is set (handles tax mapping); fall back to direct create otherwise.
        if self.product_id:
            invoice = self.acs_create_invoice(
                partner=patient_partner,
                patient=self.patient_id,
                product_data=[{
                    'product_id': self.product_id,
                    'name': 'Séance de dialyse — %s' % (session_date,),
                    'price_unit': rule.price_unit,
                    'tax_ids': rule.tax_ids,
                    'quantity': 1,
                }],
                inv_data={'hospital_invoice_type': 'dialysis_session'},
            )
            self.invoice_id = invoice
        else:
            invoice = self.env['account.move'].create({
                'move_type': 'out_invoice',
                'partner_id': patient_partner.id,
                'hospital_invoice_type': 'dialysis_session',
                'invoice_date': session_date,
                'invoice_line_ids': [(0, 0, {
                    'name': 'Séance de dialyse — %s' % (session_date,),
                    'price_unit': rule.price_unit,
                    'quantity': 1,
                    'tax_ids': [(6, 0, rule.tax_ids.ids)],
                })],
            })
            self.invoice_id = invoice
        self._apply_insurance_amounts(invoice, session_date)
        return invoice

    def view_invoice(self):
        """Smart button: navigate to the linked invoice."""
        self.ensure_one()
        if not self.invoice_id:
            raise UserError("Aucune facture liée à cette séance.")
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'account.move',
            'res_id': self.invoice_id.id,
            'view_mode': 'form',
            'target': 'current',
        }
