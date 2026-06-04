# -*- coding: utf-8 -*-
from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    portal_simplified_language = fields.Boolean(
        related='company_id.portal_simplified_language',
        readonly=False,
        string='Langage simplifie (KT/V -> texte patient)',
    )
    portal_show_raw_values = fields.Boolean(
        related='company_id.portal_show_raw_values',
        readonly=False,
        string='Afficher aussi la valeur brute KT/V',
    )
