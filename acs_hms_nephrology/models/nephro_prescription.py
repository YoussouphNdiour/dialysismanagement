# -*- coding: utf-8 -*-
from odoo import fields, models


class PrescriptionOrderNephro(models.Model):
    _inherit = 'prescription.order'

    is_nephro_prescription = fields.Boolean(
        string='Ordonnance Néphro',
        default=False,
        help='Marquer comme ordonnance spécifique néphro/dialyse',
        tracking=True,
    )
    nephro_context = fields.Selection([
        ('background', 'Traitement de fond'),
        ('dose_adjustment', 'Ajustement de dose'),
        ('inter_session', 'Consultation inter-séances'),
    ], string='Contexte néphro')
