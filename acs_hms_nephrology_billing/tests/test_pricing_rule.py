# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase, tagged


@tagged('post_install', '-at_install')
class TestPricingRule(TransactionCase):

    def test_create_pricing_rule(self):
        rule = self.env['acs.dialysis.pricing.rule'].create({
            'name': 'Forfait IPRES',
            'price_unit': 25000.0,
        })
        self.assertEqual(rule.name, 'Forfait IPRES')
        self.assertEqual(rule.price_unit, 25000.0)
        self.assertTrue(rule.active)

    def test_archive_rule(self):
        rule = self.env['acs.dialysis.pricing.rule'].create({
            'name': 'Ancien Forfait',
            'price_unit': 20000.0,
        })
        rule.active = False
        active_rules = self.env['acs.dialysis.pricing.rule'].search([('name', '=', 'Ancien Forfait')])
        self.assertFalse(active_rules)  # archivé = invisible sans context
