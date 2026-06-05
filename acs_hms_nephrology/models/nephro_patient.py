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
