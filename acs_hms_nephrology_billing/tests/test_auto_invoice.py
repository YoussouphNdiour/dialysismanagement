# -*- coding: utf-8 -*-
from datetime import date, timedelta

from odoo import fields
from odoo.tests import TransactionCase, tagged


@tagged('post_install', '-at_install')
class TestAutoInvoice(TransactionCase):

    def setUp(self):
        super().setUp()
        # Patient
        self.partner = self.env['res.partner'].create({'name': 'Patient Facturation Test'})
        self.patient = self.env['hms.patient'].create({
            'name': 'Patient Facturation Test',
            'partner_id': self.partner.id,
        })
        # Pricing rule
        self.rule = self.env['acs.dialysis.pricing.rule'].create({
            'name': 'Forfait Standard',
            'price_unit': 30000.0,
        })
        # Tariff history (active)
        today = date.today()
        self.env['acs.dialysis.tariff.history'].create({
            'patient_id': self.patient.id,
            'pricing_rule_id': self.rule.id,
            'date_start': today - timedelta(days=365),
        })
        # Insurer (primary, 70%)
        self.insurer = self.env['acs.dialysis.insurer'].create({
            'name': 'Test IPRES', 'code': 'TI',
        })
        self.env['acs.dialysis.patient.insurer'].create({
            'patient_id': self.patient.id,
            'insurer_id': self.insurer.id,
            'priority': 'primary',
            'coverage_rate': 70.0,
            'date_start': today - timedelta(days=365),
        })
        # Product for procedure (required field on acs.patient.procedure)
        self.product = self.env['product.product'].search([
            ('type', '=', 'service')
        ], limit=1)
        if not self.product:
            product_tmpl = self.env['product.template'].create({
                'name': 'Séance Dialyse Test',
                'type': 'service',
            })
            self.product = product_tmpl.product_variant_id
        # Procedure
        self.procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'date': fields.Datetime.now(),
        })

    def test_billing_state_initial(self):
        """Freshly created procedure has billing_state = 'not_invoiced'."""
        self.assertEqual(self.procedure.billing_state, 'not_invoiced')

    def test_resolve_pricing_rule(self):
        """_resolve_pricing_rule sets resolved_pricing_rule_id from tariff history."""
        self.procedure._resolve_pricing_rule()
        self.assertEqual(self.procedure.resolved_pricing_rule_id, self.rule)

    def test_get_insurance_coverage(self):
        """Primary insurer at 70% returns (0.7, 0.0)."""
        self.procedure._resolve_pricing_rule()
        primary_rate, secondary_rate = self.procedure._get_insurance_coverage()
        self.assertAlmostEqual(primary_rate, 0.70, places=2)
        self.assertAlmostEqual(secondary_rate, 0.0, places=2)

    def test_create_invoice_sets_billing_state(self):
        """action_create_nephro_invoice creates invoice and sets billing_state='invoiced'."""
        self.procedure._resolve_pricing_rule()
        invoice = self.procedure.action_create_nephro_invoice()
        self.assertTrue(invoice)
        self.assertEqual(self.procedure.billing_state, 'invoiced')

    def test_invoice_price_matches_rule(self):
        """Invoice line price matches the resolved pricing rule."""
        self.procedure._resolve_pricing_rule()
        invoice = self.procedure.action_create_nephro_invoice()
        non_section_lines = invoice.invoice_line_ids.filtered(
            lambda l: l.display_type not in ('line_section', 'line_note')
        )
        self.assertTrue(non_section_lines)
        self.assertAlmostEqual(non_section_lines[0].price_unit, 30000.0, places=2)

    def test_double_invoice_raises(self):
        """Calling action_create_nephro_invoice twice raises UserError."""
        self.procedure._resolve_pricing_rule()
        self.procedure.action_create_nephro_invoice()
        from odoo.exceptions import UserError
        with self.assertRaises(UserError):
            self.procedure.action_create_nephro_invoice()
