# -*- coding: utf-8 -*-
from odoo import api, fields, models


class AcsDialysisInsurer(models.Model):
    _name = 'acs.dialysis.insurer'
    _description = 'Assureur dialyse'
    _order = 'name'

    name = fields.Char(string='Nom', required=True)
    code = fields.Char(string='Code')
    phone = fields.Char(string='Téléphone')
    email = fields.Char(string='Email')
    address = fields.Text(string='Adresse')
    active = fields.Boolean(string='Actif', default=True)
    notes = fields.Text(string='Notes')


class AcsDialysisPatientInsurer(models.Model):
    _name = 'acs.dialysis.patient.insurer'
    _description = "Couverture assurance d'un patient"
    _order = 'priority, date_start desc'

    patient_id = fields.Many2one(
        'hms.patient', string='Patient', required=True, ondelete='cascade', index=True
    )
    insurer_id = fields.Many2one(
        'acs.dialysis.insurer', string='Assureur', required=True
    )
    priority = fields.Selection(
        [('primary', 'Primaire'), ('secondary', 'Secondaire')],
        string='Priorité',
        required=True,
        default='primary',
    )
    coverage_rate = fields.Float(
        string='Taux de prise en charge (%)',
        required=True,
        digits=(5, 2),
        help='Pourcentage pris en charge par cet assureur (0-100)',
    )
    policy_number = fields.Char(string='N° Police / Immatriculation')
    date_start = fields.Date(string='Date de début', required=True)
    date_end = fields.Date(string='Date de fin')
    notes = fields.Text(string='Notes')

    _sql_constraints = [
        (
            'coverage_rate_check',
            'CHECK(coverage_rate >= 0 AND coverage_rate <= 100)',
            'Le taux de prise en charge doit être compris entre 0 et 100.',
        )
    ]


class AcsDialysisInsurerClaim(models.Model):
    _name = 'acs.dialysis.insurer.claim'
    _description = 'Dossier de remboursement assureur'
    _inherit = ['mail.thread']
    _order = 'name desc'

    name = fields.Char(
        string='Référence', readonly=True, default='/', copy=False, index=True
    )
    patient_id = fields.Many2one(
        'hms.patient', string='Patient', required=True, index=True
    )
    insurer_id = fields.Many2one(
        'acs.dialysis.insurer', string='Assureur', required=True
    )
    invoice_ids = fields.Many2many(
        'account.move',
        'dialysis_claim_invoice_rel',
        'claim_id', 'invoice_id',
        string='Factures concernées',
        domain=[('move_type', '=', 'out_invoice')],
    )
    amount_claimed = fields.Float(
        string='Montant réclamé', digits=(10, 2), required=True
    )
    amount_reimbursed = fields.Float(
        string='Montant remboursé', digits=(10, 2)
    )
    state = fields.Selection(
        [
            ('draft', 'Brouillon'),
            ('submitted', 'Soumis'),
            ('reimbursed', 'Remboursé'),
            ('rejected', 'Rejeté'),
        ],
        string='État',
        default='draft',
        tracking=True,
    )
    date_submitted = fields.Date(string='Date de soumission')
    date_reimbursed = fields.Date(string='Date de remboursement')
    notes = fields.Text(string='Notes')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', '/') == '/':
                vals['name'] = self.env['ir.sequence'].next_by_code(
                    'acs.dialysis.insurer.claim'
                ) or '/'
        return super().create(vals_list)

    def action_submit(self):
        self.write({'state': 'submitted', 'date_submitted': fields.Date.today()})

    def action_reimburse(self):
        self.write({'state': 'reimbursed', 'date_reimbursed': fields.Date.today()})

    def action_reject(self):
        self.write({'state': 'rejected'})
