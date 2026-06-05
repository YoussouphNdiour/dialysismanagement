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
        string='# Ordonnances Néphro',
    )

    @api.depends('nephro_prescription_ids.is_nephro_prescription')
    def _compute_nephro_prescription_count(self):
        PrescriptionOrder = self.env['prescription.order']
        for rec in self:
            rec.nephro_prescription_count = PrescriptionOrder.search_count([
                ('procedure_id', '=', rec.id),
                ('is_nephro_prescription', '=', True),
            ])

    def action_nephro_prescription(self):
        action = self.env['ir.actions.actions']._for_xml_id(
            'acs_hms.act_open_hms_prescription_order_view'
        )
        action['domain'] = [
            ('procedure_id', '=', self.id),
            ('is_nephro_prescription', '=', True),
        ]
        action['context'] = {
            'default_patient_id': self.patient_id.id,
            'default_physician_id': self.physician_id.id,
            'default_procedure_id': self.id,
            'default_is_nephro_prescription': True,
        }
        return action
