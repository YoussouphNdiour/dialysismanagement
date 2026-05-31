# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ACSDialysisComplication(models.Model):
    _name = 'acs.dialysis.complication'
    _description = "Complication per-séance d'hémodialyse"
    _order = 'occurrence_time'

    procedure_id = fields.Many2one(
        'acs.patient.procedure',
        string="Séance d'hémodialyse",
        required=True,
        ondelete='cascade'
    )
    patient_id = fields.Many2one(
        related='procedure_id.patient_id',
        string='Patient',
        store=True,
        readonly=True
    )
    complication_type = fields.Selection([
        ('hypotension', 'Hypotension'),
        ('cramps', 'Crampes'),
        ('nausea', 'Nausées / Vomissements'),
        ('chest_pain', 'Douleur thoracique'),
        ('fever', 'Fièvre'),
        ('pruritus', 'Prurit'),
        ('early_stop', 'Arrêt prématuré'),
        ('other', 'Autre'),
    ], string='Type de complication', required=True)
    occurrence_time = fields.Datetime(
        string='Heure de survenue',
        default=fields.Datetime.now,
        required=True
    )
    bp_at_occurrence = fields.Char(
        string='TA au moment de la complication',
        help='Ex: 85/50'
    )
    action_taken = fields.Text(string='Action prise', required=True)
    resolution = fields.Selection([
        ('yes', 'Résolue'),
        ('partial', 'Partiellement résolue'),
        ('no', 'Non résolue'),
    ], string='Résolution', required=True)
    early_stop_duration = fields.Integer(
        string="Durée d'arrêt (minutes)",
        help="Durée d'arrêt prématuré de la séance en minutes"
    )
    notes = fields.Text(string='Notes complémentaires')


class AcsPatientProcedureComplication(models.Model):
    _inherit = 'acs.patient.procedure'

    complication_ids = fields.One2many(
        'acs.dialysis.complication',
        'procedure_id',
        string='Complications'
    )
    complication_count = fields.Integer(
        string='Nb complications',
        compute='_compute_complication_count',
        store=True
    )
    has_complication = fields.Boolean(
        string='A des complications',
        compute='_compute_complication_count',
        store=True
    )

    @api.depends('complication_ids')
    def _compute_complication_count(self):
        for rec in self:
            count = len(rec.complication_ids)
            rec.complication_count = count
            rec.has_complication = count > 0
