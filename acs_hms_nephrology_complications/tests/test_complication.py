# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase


class TestDialysisComplication(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Complication'})
        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1) or self.env['product.product'].create({
            'name': 'Hémodialyse', 'type': 'service',
            'hospital_product_type': 'nephrology_procedure',
        })
        self.procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
        })

    def test_complication_creation(self):
        complication = self.env['acs.dialysis.complication'].create({
            'procedure_id': self.procedure.id,
            'complication_type': 'hypotension',
            'bp_at_occurrence': '85/50',
            'action_taken': 'Position Trendelenburg, perfusion NaCl 100ml',
            'resolution': 'yes',
        })
        self.assertEqual(complication.complication_type, 'hypotension')
        self.assertEqual(complication.resolution, 'yes')

    def test_early_stop_duration(self):
        complication = self.env['acs.dialysis.complication'].create({
            'procedure_id': self.procedure.id,
            'complication_type': 'early_stop',
            'early_stop_duration': 45,
            'action_taken': 'Arrêt sur douleur thoracique',
            'resolution': 'partial',
        })
        self.assertEqual(complication.early_stop_duration, 45)

    def test_complication_count_on_procedure(self):
        self.env['acs.dialysis.complication'].create({
            'procedure_id': self.procedure.id,
            'complication_type': 'cramps',
            'action_taken': 'Hydratation',
            'resolution': 'yes',
        })
        self.env['acs.dialysis.complication'].create({
            'procedure_id': self.procedure.id,
            'complication_type': 'nausea',
            'action_taken': 'Antiémétique',
            'resolution': 'yes',
        })
        self.procedure.invalidate_recordset()
        self.assertEqual(self.procedure.complication_count, 2)

    def test_has_complication_flag(self):
        self.assertFalse(self.procedure.has_complication)
        self.env['acs.dialysis.complication'].create({
            'procedure_id': self.procedure.id,
            'complication_type': 'hypotension',
            'action_taken': 'Traitement',
            'resolution': 'yes',
        })
        self.procedure.invalidate_recordset()
        self.assertTrue(self.procedure.has_complication)
