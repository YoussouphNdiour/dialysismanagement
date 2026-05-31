# -*- coding: utf-8 -*-
from odoo import fields, models


class ACSNephroBilanThreshold(models.Model):
    """Seuils paramétrables (valeurs par défaut = KDIGO)"""
    _name = 'acs.nephro.bilan.threshold'
    _description = 'Seuils biologiques paramétrables'

    name = fields.Char(string='Paramètre', required=True)
    code = fields.Char(string='Code', required=True)
    unit = fields.Char(string='Unité')
    min_normal = fields.Float(string='Min normal', digits=(7, 2))
    max_normal = fields.Float(string='Max normal', digits=(7, 2))
    min_target = fields.Float(string='Min cible dialyse', digits=(7, 2))
    max_target = fields.Float(string='Max cible dialyse', digits=(7, 2))
    notes = fields.Text(string='Notes / Guidelines')
    active = fields.Boolean(default=True)
