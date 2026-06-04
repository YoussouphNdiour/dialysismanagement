# -*- coding: utf-8 -*-
from odoo import api, fields, models


class HmsPatient(models.Model):
    _inherit = 'hms.patient'

    # --- Billing fields added by nephrology billing module ---

    tariff_history_ids = fields.One2many(
        'acs.dialysis.tariff.history',
        'patient_id',
        string='Historique tarifaire',
    )
    patient_insurer_ids = fields.One2many(
        'acs.dialysis.patient.insurer',
        'patient_id',
        string='Assureurs',
    )

    # Computed balance fields — not stored (50-150 patients, computed on read)
    balance_due = fields.Float(
        string='Solde impayé',
        compute='_compute_balance',
        digits=(10, 2),
        help='Somme des montants en attente sur les factures dialyse non réglées.',
    )
    last_payment_date = fields.Date(
        string='Dernier paiement',
        compute='_compute_balance',
    )
    overdue_days = fields.Integer(
        string='Jours de retard',
        compute='_compute_balance',
        help='Nombre de jours depuis la facture la plus ancienne non réglée.',
    )
    payment_status = fields.Selection(
        [('ok', 'À jour'), ('warning', 'En attente'), ('overdue', 'En retard')],
        string='Statut paiement',
        compute='_compute_balance',
        help='ok = aucun impayé, warning = impayé < seuil société, overdue = impayé dépassé.',
    )

    @api.depends_context('company')
    def _compute_balance(self):
        overdue_threshold = (
            self.env.company.nephro_overdue_days
            if hasattr(self.env.company, 'nephro_overdue_days')
            else 30
        )
        today = fields.Date.today()
        for patient in self:
            invoices = self.env['account.move'].search([
                ('partner_id', '=', patient.partner_id.id),
                ('move_type', '=', 'out_invoice'),
                ('hospital_invoice_type', 'in', ['dialysis_session', 'dialysis_grouped']),
                ('payment_state', 'not in', ['paid', 'reversed']),
                ('state', '=', 'posted'),
            ])
            total_due = sum(invoices.mapped('amount_residual'))
            oldest_date = min(invoices.mapped('invoice_date'), default=None)
            days = (today - oldest_date).days if oldest_date else 0
            last_pay = self.env['account.payment'].search([
                ('partner_id', '=', patient.partner_id.id),
                ('payment_type', '=', 'inbound'),
                ('state', '=', 'posted'),
            ], order='date desc', limit=1)
            patient.balance_due = total_due
            patient.last_payment_date = last_pay.date if last_pay else False
            patient.overdue_days = days
            if total_due <= 0:
                patient.payment_status = 'ok'
            elif days < overdue_threshold:
                patient.payment_status = 'warning'
            else:
                patient.payment_status = 'overdue'
