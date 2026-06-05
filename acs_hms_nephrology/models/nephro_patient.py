# -*- coding: utf-8 -*-
from odoo import fields, models


class HmsPatientNephro(models.Model):
    _inherit = 'hms.patient'

    nephro_prescription_ids = fields.One2many(
        'prescription.order',
        'patient_id',
        string='Ordonnances Néphro',
        domain=[('is_nephro_prescription', '=', True)],
    )

    def action_nephro_prescription(self):
        """Ouvre la liste des ordonnances néphro avec defaults pré-remplis."""
        action = self.env['ir.actions.actions']._for_xml_id(
            'acs_hms.act_open_hms_prescription_order_view'
        )
        action['domain'] = [
            ('patient_id', '=', self.id),
            ('is_nephro_prescription', '=', True),
        ]
        action['context'] = {
            'default_patient_id': self.id,
            'default_is_nephro_prescription': True,
            'default_nephro_context': 'inter_session',
        }
        return action
