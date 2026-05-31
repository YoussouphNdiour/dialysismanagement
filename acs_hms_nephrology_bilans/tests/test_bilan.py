# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase
from odoo import fields


class TestBilanBiologique(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Bilan'})

    def test_bilan_creation(self):
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'hemoglobin': 10.8,
            'potassium': 4.9,
            'phosphorus': 2.1,
            'albumin': 38.0,
        })
        self.assertEqual(bilan.patient_id.id, self.patient.id)
        self.assertEqual(bilan.bilan_type, 'monthly')
        self.assertAlmostEqual(bilan.hemoglobin, 10.8)

    def test_urr_computed_from_urea(self):
        """URR = (1 - urée_post/urée_pré) x 100"""
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'urea_pre': 25.0,
            'urea_post': 8.0,
        })
        bilan.invalidate_recordset()
        expected_urr = (1 - 8.0 / 25.0) * 100
        self.assertAlmostEqual(bilan.urr_calculated, expected_urr, places=1)

    def test_caxp_product_computed(self):
        """Produit CaxP = calcium x phosphore"""
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'calcium': 2.3,
            'phosphorus': 1.8,
        })
        bilan.invalidate_recordset()
        self.assertAlmostEqual(bilan.caxp_product, 2.3 * 1.8, places=2)

    def test_hemoglobin_status_ok(self):
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'hemoglobin': 11.0,
        })
        bilan.invalidate_recordset()
        self.assertEqual(bilan.hemoglobin_status, 'ok')

    def test_hemoglobin_status_low(self):
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'hemoglobin': 8.5,
        })
        bilan.invalidate_recordset()
        self.assertEqual(bilan.hemoglobin_status, 'low')

    def test_potassium_status_high(self):
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'potassium': 6.2,
        })
        bilan.invalidate_recordset()
        self.assertEqual(bilan.potassium_status, 'high')

    def test_bilan_sequence_auto(self):
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
        })
        self.assertTrue(bilan.name.startswith('BIO/'))
