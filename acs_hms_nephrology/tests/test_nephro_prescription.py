# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase


class TestNephroPrescription(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Test Dialyse Patient'})

    def test_prescription_has_nephro_flag(self):
        """prescription.order doit avoir is_nephro_prescription et nephro_context"""
        prescription = self.env['prescription.order'].create({
            'patient_id': self.patient.id,
            'is_nephro_prescription': True,
            'nephro_context': 'background',
        })
        self.assertTrue(prescription.is_nephro_prescription)
        self.assertEqual(prescription.nephro_context, 'background')

    def test_standard_prescription_has_no_nephro_flag(self):
        """is_nephro_prescription vaut False par défaut"""
        prescription = self.env['prescription.order'].create({
            'patient_id': self.patient.id,
        })
        self.assertFalse(prescription.is_nephro_prescription)
        self.assertFalse(prescription.nephro_context)

    def test_procedure_nephro_prescription_count(self):
        """acs.patient.procedure doit exposer nephro_prescription_count"""
        product = self.env['product.product'].create({
            'name': 'Hémodialyse',
            'hospital_product_type': 'procedure',
        })
        procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
        })
        self.assertEqual(procedure.nephro_prescription_count, 0)

        self.env['prescription.order'].create({
            'patient_id': self.patient.id,
            'procedure_id': procedure.id,
            'is_nephro_prescription': True,
        })
        procedure.invalidate_recordset()
        self.assertEqual(procedure.nephro_prescription_count, 1)

    def test_non_nephro_prescription_not_counted(self):
        """Une ordonnance standard ne doit pas augmenter nephro_prescription_count"""
        product = self.env['product.product'].create({
            'name': 'Hémodialyse 2',
            'hospital_product_type': 'procedure',
        })
        procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
        })
        self.env['prescription.order'].create({
            'patient_id': self.patient.id,
            'procedure_id': procedure.id,
            'is_nephro_prescription': False,
        })
        procedure.invalidate_recordset()
        self.assertEqual(procedure.nephro_prescription_count, 0)
