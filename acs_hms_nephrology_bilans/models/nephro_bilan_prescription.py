# -*- coding: utf-8 -*-
from odoo import fields, models


class AcsNephroBilanPrescription(models.Model):
    _inherit = 'acs.nephro.bilan'

    prescription_ids = fields.Many2many(
        'prescription.order',
        'nephro_bilan_prescription_rel',
        'bilan_id',
        'prescription_id',
        string='Ordonnances actives au moment du bilan',
        domain=[('is_nephro_prescription', '=', True)],
    )
