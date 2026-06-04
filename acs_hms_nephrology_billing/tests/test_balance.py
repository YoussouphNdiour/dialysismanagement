# -*- coding: utf-8 -*-
from datetime import date, timedelta

from odoo import fields
from odoo.tests import TransactionCase, tagged


@tagged('post_install', '-at_install')
class TestPatientBalance(TransactionCase):

    def setUp(self):
        super().setUp()
        self.partner = self.env['res.partner'].create({'name': 'Patient Balance Test'})
        self.patient = self.env['hms.patient'].create({
            'name': 'Patient Balance Test',
            'partner_id': self.partner.id,
        })

    def test_balance_due_no_invoices(self):
        """Patient with no invoices has balance_due = 0."""
        self.assertEqual(self.patient.balance_due, 0.0)

    def test_payment_status_ok(self):
        """Patient with no overdue invoices has status 'ok'."""
        self.assertEqual(self.patient.payment_status, 'ok')

    def test_payment_status_computed(self):
        """payment_status is 'ok', 'warning', or 'overdue'."""
        self.assertIn(self.patient.payment_status, ['ok', 'warning', 'overdue'])
