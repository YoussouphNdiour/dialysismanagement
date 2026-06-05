# -*- coding: utf-8 -*-
from odoo import api, fields, models


class AcsPatientProcedureNephro(models.Model):
    _inherit = 'acs.patient.procedure'

    nephro_prescription_ids = fields.One2many(
        'prescription.order',
        'procedure_id',
        string='Ordonnances Néphro',
        domain=[('is_nephro_prescription', '=', True)],
    )
    nephro_prescription_count = fields.Integer(
        compute='_compute_nephro_prescription_count',
        string='Ordonnances Néphro',
    )

    @api.depends('nephro_prescription_ids')
    def _compute_nephro_prescription_count(self):
        for rec in self:
            rec.nephro_prescription_count = len(
                rec.nephro_prescription_ids
            )
