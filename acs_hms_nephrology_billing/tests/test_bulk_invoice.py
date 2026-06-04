# -*- coding: utf-8 -*-
from datetime import date, timedelta

from odoo import fields
from odoo.tests import TransactionCase, tagged


@tagged('post_install', '-at_install')
class TestBulkInvoice(TransactionCase):

    def setUp(self):
        super().setUp()
        self.partner = self.env['res.partner'].create({'name': 'Patient Bulk Test'})
        self.patient = self.env['hms.patient'].create({
            'name': 'Patient Bulk Test',
            'partner_id': self.partner.id,
        })
        self.rule = self.env['acs.dialysis.pricing.rule'].create({
            'name': 'Forfait Groupé',
            'price_unit': 25000.0,
        })
        today = date.today()
        self.env['acs.dialysis.tariff.history'].create({
            'patient_id': self.patient.id,
            'pricing_rule_id': self.rule.id,
            'date_start': today - timedelta(days=365),
        })
        # Product
        self.product = self.env['product.product'].search(
            [('type', '=', 'service')], limit=1
        )
        if not self.product:
            tmpl = self.env['product.template'].create({
                'name': 'Dialyse Bulk Test', 'type': 'service',
            })
            self.product = tmpl.product_variant_id
        # Two procedures (state=done, billing_state=not_invoiced)
        self.proc1 = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'date': fields.Datetime.now(),
            'state': 'done',
        })
        self.proc2 = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'date': fields.Datetime.now(),
            'state': 'done',
        })

    def _make_wizard(self):
        today = date.today()
        return self.env['acs.dialysis.bulk.invoice.wizard'].create({
            'date_from': today - timedelta(days=7),
            'date_to': today + timedelta(days=1),
        })

    def test_get_uninvoiced_procedures(self):
        """Wizard finds 2 done/not_invoiced procedures."""
        wizard = self._make_wizard()
        procs = wizard._get_uninvoiced_procedures()
        self.assertGreaterEqual(len(procs), 2)

    def test_create_grouped_invoice(self):
        """action_create_invoices creates one invoice per patient with dialysis_grouped type."""
        wizard = self._make_wizard()
        result = wizard.action_create_invoices()
        invoice_ids = result.get('domain', [['id', 'in', []]])[0][2]
        invoices = self.env['account.move'].browse(invoice_ids)
        self.assertEqual(len(invoices), 1)
        self.assertEqual(invoices[0].hospital_invoice_type, 'dialysis_grouped')

    def test_procedures_linked_after_bulk_invoice(self):
        """After bulk invoice, both procedures have billing_state = 'invoiced'."""
        wizard = self._make_wizard()
        wizard.action_create_invoices()
        self.assertEqual(self.proc1.billing_state, 'invoiced')
        self.assertEqual(self.proc2.billing_state, 'invoiced')
