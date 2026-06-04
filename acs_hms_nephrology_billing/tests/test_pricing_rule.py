# -*- coding: utf-8 -*-
from datetime import date, timedelta
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


@tagged('post_install', '-at_install')
class TestTariffHistory(TransactionCase):

    def setUp(self):
        super().setUp()
        self.partner = self.env['res.partner'].create({'name': 'Patient Test Tarif'})
        self.patient = self.env['hms.patient'].create({
            'name': 'Patient Test Tarif',
            'partner_id': self.partner.id,
        })
        self.rule_ipres = self.env['acs.dialysis.pricing.rule'].create({
            'name': 'IPRES', 'price_unit': 25000.0,
        })
        self.rule_prive = self.env['acs.dialysis.pricing.rule'].create({
            'name': 'Privé', 'price_unit': 40000.0,
        })

    def test_get_active_rule_current(self):
        today = date.today()
        self.env['acs.dialysis.tariff.history'].create({
            'patient_id': self.patient.id,
            'pricing_rule_id': self.rule_ipres.id,
            'date_start': today - timedelta(days=30),
        })
        rule = self.env['acs.dialysis.tariff.history'].get_active_rule(
            self.patient.id, today
        )
        self.assertEqual(rule, self.rule_ipres)

    def test_get_active_rule_historical(self):
        today = date.today()
        self.env['acs.dialysis.tariff.history'].create({
            'patient_id': self.patient.id,
            'pricing_rule_id': self.rule_ipres.id,
            'date_start': today - timedelta(days=365),
            'date_end': today - timedelta(days=30),
        })
        self.env['acs.dialysis.tariff.history'].create({
            'patient_id': self.patient.id,
            'pricing_rule_id': self.rule_prive.id,
            'date_start': today - timedelta(days=29),
        })
        rule_old = self.env['acs.dialysis.tariff.history'].get_active_rule(
            self.patient.id, today - timedelta(days=60)
        )
        self.assertEqual(rule_old, self.rule_ipres)
        rule_now = self.env['acs.dialysis.tariff.history'].get_active_rule(
            self.patient.id, today
        )
        self.assertEqual(rule_now, self.rule_prive)

    def test_get_active_rule_no_history(self):
        rule = self.env['acs.dialysis.tariff.history'].get_active_rule(
            self.patient.id, date.today()
        )
        self.assertFalse(rule)

    def test_sql_constraint_date_check(self):
        today = date.today()
        from odoo.exceptions import ValidationError
        with self.assertRaises((ValidationError, Exception)):
            self.env['acs.dialysis.tariff.history'].create({
                'patient_id': self.patient.id,
                'pricing_rule_id': self.rule_ipres.id,
                'date_start': today,
                'date_end': today - timedelta(days=1),  # end < start → violates constraint
            })
