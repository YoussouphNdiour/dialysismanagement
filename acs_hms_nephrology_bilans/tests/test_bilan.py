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


class TestBilanOverdueAlert(TransactionCase):

    def setUp(self):
        super().setUp()
        from datetime import timedelta
        self.patient_ok = self.env['hms.patient'].create({'name': 'Patient avec bilan récent'})
        self.patient_overdue = self.env['hms.patient'].create({'name': 'Patient sans bilan récent'})

        # Activer le flag néphro
        self.patient_ok.write({'nephrology_care': True})
        self.patient_overdue.write({'nephrology_care': True})

        # Bilan récent pour patient_ok
        self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient_ok.id,
            'bilan_type': 'monthly',
            'exam_date': fields.Datetime.now(),
        })
        # Vieux bilan pour patient_overdue (35 jours)
        old_date = fields.Datetime.now() - timedelta(days=35)
        self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient_overdue.id,
            'bilan_type': 'monthly',
            'exam_date': old_date,
        })

    def test_overdue_patients_detected(self):
        overdue = self.env['acs.nephro.bilan']._get_overdue_patients(days=30)
        self.assertIn(self.patient_overdue.id, overdue.ids)
        self.assertNotIn(self.patient_ok.id, overdue.ids)
