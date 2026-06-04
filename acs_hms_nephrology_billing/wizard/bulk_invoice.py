# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.exceptions import UserError


class AcsDialysisBulkInvoicePreview(models.TransientModel):
    _name = 'acs.dialysis.bulk.invoice.preview'
    _description = 'Prévisualisation facturation groupée'

    wizard_id = fields.Many2one(
        'acs.dialysis.bulk.invoice.wizard', string='Wizard', ondelete='cascade'
    )
    patient_id = fields.Many2one('hms.patient', string='Patient', readonly=True)
    procedure_date = fields.Date(string='Date séance', readonly=True)
    amount_estimated = fields.Float(
        string='Montant estimé', readonly=True, digits=(10, 2)
    )
    procedure_id = fields.Many2one(
        'acs.patient.procedure', string='Séance', readonly=True
    )


class AcsDialysisBulkInvoiceWizard(models.TransientModel):
    _name = 'acs.dialysis.bulk.invoice.wizard'
    _description = 'Wizard facturation groupée dialyse'

    date_from = fields.Date(string='Du', required=True)
    date_to = fields.Date(string='Au', required=True)
    patient_ids = fields.Many2many(
        'hms.patient',
        'bulk_invoice_wizard_patient_rel',
        'wizard_id', 'patient_id',
        string='Patients (vide = tous)',
    )
    preview_line_ids = fields.One2many(
        'acs.dialysis.bulk.invoice.preview', 'wizard_id', string='Prévisualisation'
    )

    def _get_uninvoiced_procedures(self):
        """Returns done + not_invoiced procedures in the date range."""
        domain = [
            ('state', '=', 'done'),
            ('billing_state', '=', 'not_invoiced'),
            ('date', '>=', fields.Datetime.to_datetime(self.date_from)),
            ('date', '<=', fields.Datetime.to_datetime(self.date_to) if self.date_to else fields.Datetime.now()),
        ]
        if self.patient_ids:
            domain.append(('patient_id', 'in', self.patient_ids.ids))
        return self.env['acs.patient.procedure'].search(domain)

    def action_preview(self):
        """Populates preview_line_ids with estimated amounts."""
        self.ensure_one()
        procedures = self._get_uninvoiced_procedures()
        self.preview_line_ids = [(5, 0, 0)]  # clear existing
        lines = []
        for proc in procedures:
            proc._resolve_pricing_rule()
            rule = proc.resolved_pricing_rule_id
            lines.append((0, 0, {
                'wizard_id': self.id,
                'patient_id': proc.patient_id.id,
                'procedure_date': proc.date.date() if proc.date else False,
                'amount_estimated': rule.price_unit if rule else 0.0,
                'procedure_id': proc.id,
            }))
        self.preview_line_ids = lines
        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }

    def action_create_invoices(self):
        """Creates one grouped invoice per patient."""
        self.ensure_one()
        procedures = self._get_uninvoiced_procedures()
        if not procedures:
            raise UserError("Aucune séance non facturée trouvée dans la période sélectionnée.")

        invoices = self.env['account.move']
        # Group by patient
        patient_procedures = {}
        for proc in procedures:
            patient_procedures.setdefault(proc.patient_id, []).append(proc)

        for patient, procs in patient_procedures.items():
            invoice = self._create_grouped_invoice(patient, procs)
            invoices |= invoice

        return {
            'type': 'ir.actions.act_window',
            'name': 'Factures créées',
            'res_model': 'account.move',
            'view_mode': 'list,form',
            'domain': [('id', 'in', invoices.ids)],
            'target': 'current',
        }

    def _create_grouped_invoice(self, patient, procedures):
        """Creates one invoice for a patient grouping all procedure lines.

        All procedures are linked to the invoice (even those without a pricing rule).
        Procedures without a rule are noted but do not block invoice creation.
        """
        line_vals = []
        procs_with_rule = []
        for proc in procedures:
            proc._resolve_pricing_rule()
            rule = proc.resolved_pricing_rule_id
            session_date = proc.date.date() if proc.date else fields.Date.today()
            if rule:
                procs_with_rule.append(proc)
                # Section header per session
                line_vals.append((0, 0, {
                    'display_type': 'line_section',
                    'name': 'Séance du %s' % session_date,
                }))
                # Invoice line
                line_vals.append((0, 0, {
                    'name': 'Dialyse — %s' % session_date,
                    'price_unit': rule.price_unit,
                    'quantity': 1,
                    'tax_ids': [(6, 0, rule.tax_ids.ids)],
                }))

        if not line_vals:
            raise UserError(
                "Impossible de créer une facture pour %s : aucune règle tarifaire." % patient.name
            )

        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': patient.partner_id.id,
            'hospital_invoice_type': 'dialysis_grouped',
            'invoice_date': fields.Date.today(),
            'invoice_line_ids': line_vals,
        })
        # Link ALL procedures to invoice (including those without a rule)
        for proc in procedures:
            proc.invoice_id = invoice
        # Apply insurance only on procedures that contributed lines
        for proc in procs_with_rule:
            proc._apply_insurance_amounts(invoice)
        return invoice
