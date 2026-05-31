# -*- coding: utf-8 -*-
import math

from odoo.tests.common import TransactionCase


class TestDialysisStation(TransactionCase):

    def test_station_creation_standard(self):
        station = self.env['acs.dialysis.station'].create({
            'name': 'Poste 1 - Salle A',
            'room': 'Salle A',
            'station_type': 'standard',
            'equipment_model': 'Fresenius 5008S',
        })
        self.assertEqual(station.name, 'Poste 1 - Salle A')
        self.assertEqual(station.station_type, 'standard')
        self.assertTrue(station.active)

    def test_station_isolation_type(self):
        station = self.env['acs.dialysis.station'].create({
            'name': 'Poste ISO-1',
            'room': 'Salle Isolement',
            'station_type': 'isolation',
        })
        self.assertEqual(station.station_type, 'isolation')

    def test_station_inactive(self):
        station = self.env['acs.dialysis.station'].create({
            'name': 'Poste 2 - Maintenance',
            'room': 'Salle B',
            'station_type': 'standard',
            'active': False,
        })
        active_stations = self.env['acs.dialysis.station'].search([])
        self.assertNotIn(station, active_stations)


class TestDryWeightHistory(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({
            'name': 'Test Patient Dialyse',
            'date_of_birth': '1965-03-15',
        })

    def test_dry_weight_history_creation(self):
        entry = self.env['acs.dry.weight.history'].create({
            'patient_id': self.patient.id,
            'weight': 70.5,
            'reason': 'Réévaluation clinique mensuelle',
        })
        self.assertEqual(entry.patient_id.id, self.patient.id)
        self.assertAlmostEqual(entry.weight, 70.5)
        self.assertTrue(entry.changed_by.id)  # doit être rempli automatiquement

    def test_dry_weight_history_ordered_by_date_desc(self):
        self.env['acs.dry.weight.history'].create({
            'patient_id': self.patient.id,
            'weight': 68.0,
            'date': '2025-01-01 10:00:00',
        })
        self.env['acs.dry.weight.history'].create({
            'patient_id': self.patient.id,
            'weight': 69.5,
            'date': '2025-06-01 10:00:00',
        })
        entries = self.env['acs.dry.weight.history'].search([
            ('patient_id', '=', self.patient.id)
        ])
        self.assertEqual(entries[0].weight, 69.5)  # le plus récent en premier


class TestVitalSignExtended(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Test Vital'})
        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1)
        if not product:
            product = self.env['product.product'].create({
                'name': 'Hémodialyse',
                'type': 'service',
                'hospital_product_type': 'nephrology_procedure',
            })
        self.procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
        })

    def test_vital_sign_has_spo2_field(self):
        vital = self.env['hemodialysis.vital.sign'].create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '120/80',
            'heart_rate': 72,
            'spo2': 98.5,
            'temperature': 36.8,
        })
        self.assertAlmostEqual(vital.spo2, 98.5)
        self.assertAlmostEqual(vital.temperature, 36.8)

    def test_vital_sign_has_glycemia_field(self):
        vital = self.env['hemodialysis.vital.sign'].create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '130/85',
            'glycemia': 1.25,
        })
        self.assertAlmostEqual(vital.glycemia, 1.25)

    def test_hypotension_alert_detected(self):
        """TA systolique < 90 = hypotension détectée"""
        vital = self.env['hemodialysis.vital.sign'].create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '85/50',
            'heart_rate': 110,
        })
        self.assertTrue(vital.is_hypotension,
                        "Doit détecter hypotension si TA systolique < 90")

    def test_no_hypotension_when_bp_normal(self):
        vital = self.env['hemodialysis.vital.sign'].create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '120/80',
        })
        self.assertFalse(vital.is_hypotension)


class TestProcedureKTV(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient KTV'})
        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1) or self.env['product.product'].create({
            'name': 'Hémodialyse', 'type': 'service',
            'hospital_product_type': 'nephrology_procedure',
        })
        self.procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
            'dry_weight': 70.0,
            'arrival_weight': 72.5,
        })

    def test_prise_interdialytique_calculated(self):
        """Prise de poids = poids arrivée - poids sec"""
        self.procedure.write({'arrival_weight': 72.5, 'dry_weight': 70.0})
        self.procedure.invalidate_recordset()
        self.assertAlmostEqual(self.procedure.interdialysis_increase, 2.5, places=1)

    def test_actual_uf_calculated(self):
        """UF réelle = (poids arrivée - poids sortie) × 1000"""
        self.procedure.write({
            'arrival_weight': 72.5,
            'departure_weight': 70.1,
        })
        self.procedure.invalidate_recordset()
        self.assertAlmostEqual(self.procedure.actual_uf, 2400.0, places=0)

    def test_ktv_adequate(self):
        """KT/V ≥ 1.2 = statut adéquat"""
        self.procedure.write({
            'arrival_weight': 72.5,
            'departure_weight': 70.1,
            'urea_pre': 25.0,
            'urea_post': 8.0,
            'actual_duration': 4.0,
        })
        self.procedure.invalidate_recordset()
        self.assertGreaterEqual(self.procedure.ktv_calculated, 1.2)
        self.assertEqual(self.procedure.ktv_status, 'adequate')

    def test_ktv_insufficient(self):
        """KT/V < 1.2 = statut insuffisant"""
        self.procedure.write({
            'arrival_weight': 72.0,
            'departure_weight': 72.0,
            'urea_pre': 25.0,
            'urea_post': 18.0,
            'actual_duration': 2.5,
        })
        self.procedure.invalidate_recordset()
        self.assertLess(self.procedure.ktv_calculated, 1.2)
        self.assertEqual(self.procedure.ktv_status, 'insufficient')

    def test_urr_calculated(self):
        """URR = (1 - urée_post/urée_pré) × 100"""
        self.procedure.write({'urea_pre': 25.0, 'urea_post': 8.0})
        self.procedure.invalidate_recordset()
        expected_urr = (1 - 8.0 / 25.0) * 100
        self.assertAlmostEqual(self.procedure.urr_calculated, expected_urr, places=1)
