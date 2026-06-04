# -*- coding: utf-8 -*-
from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    portal_simplified_language = fields.Boolean(
        string='Langage simplifie seances',
        default=True,
        help='Affiche "Seance efficace" au lieu de la valeur brute KT/V',
    )
    portal_show_raw_values = fields.Boolean(
        string='Afficher aussi la valeur brute',
        default=False,
        help='Si active, montre KT/V numerique en plus du texte simplifie',
    )
