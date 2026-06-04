# -*- coding: utf-8 -*-
from odoo import fields, models


class AcsDialysisPricingRule(models.Model):
    _name = 'acs.dialysis.pricing.rule'
    _description = 'Règle tarifaire dialyse'
    _order = 'name'

    name = fields.Char(string='Nom', required=True)
    price_unit = fields.Float(string='Prix HT par séance', required=True, digits=(10, 2))
    tax_ids = fields.Many2many('account.tax', string='TVA')
    active = fields.Boolean(string='Actif', default=True)
    notes = fields.Text(string='Notes internes')
