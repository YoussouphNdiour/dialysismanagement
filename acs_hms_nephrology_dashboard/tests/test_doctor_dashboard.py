# acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py
# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase
from odoo import fields
from datetime import datetime, timedelta


class TestDoctorDashboard(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Département néphro
        cls.dept = cls.env['hr.department'].create({
            'name': 'Test Néphro',
            'department_type': 'nephrology',
        })

        # Poste de dialyse
        cls.station = cls.env['acs.dialysis.station'].create({
            'name': 'Poste Test 1',
            'station_type': 'standard',
            'active': True,
        })

        # Créneau lié au poste (tous les jours pour faciliter les tests)
        cls.schedule = cls.env['acs.nephrology.schedule'].create({
            'name': 'Test Schedule',
            'station_id': cls.station.id,
            'monday': True, 'tuesday': True, 'wednesday': True,
            'thursday': True, 'friday': True, 'saturday': True, 'sunday': True,
        })

        # Patient
        cls.patient = cls.env['hms.patient'].create({'name': 'Patient Test Dashboard'})

        # Produit service
        cls.product = cls.env['product.product'].search([('type', '=', 'service')], limit=1)
        if not cls.product:
            cls.product = cls.env['product.product'].create({
                'name': 'Hémodialyse Test', 'type': 'service',
            })

    def _make_procedure(self, state='running', hours_ago=2, **kwargs):
        """Crée une procédure liée à cls.station via cls.schedule."""
        now = datetime.utcnow()
        start = now - timedelta(hours=hours_ago)
        stop = start + timedelta(hours=4)
        vals = {
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': fields.Datetime.to_string(start),
            'date_stop': fields.Datetime.to_string(stop),
            'state': state,
            'pre_dialysis_bp': '130/80',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        }
        vals.update(kwargs)
        return self.env['acs.patient.procedure'].create(vals)

    def test_get_dashboard_data_empty(self):
        """Sans procédure du jour, get_dashboard_data() retourne une structure valide."""
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        self.assertIn('stations', result)
        self.assertIn('kpis', result)
        self.assertIn('alerts', result)
        self.assertIsInstance(result['stations'], list)
        self.assertIsInstance(result['alerts'], list)
        # Vérifier que le poste test n'a pas de procédure (isolation)
        station_entry = next(
            (s for s in result['stations'] if s['id'] == self.station.id), None
        )
        self.assertIsNotNone(station_entry, "Le poste test doit apparaître dans la liste")
        self.assertIsNone(station_entry['procedure'], "Sans procédure créée, procedure doit être None")

    def test_get_dashboard_data_running_session(self):
        """Procédure 'running' du jour → présente dans stations avec état running."""
        proc = self._make_procedure(state='running')
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        station_entry = next(
            (s for s in result['stations'] if s['id'] == self.station.id), None
        )
        self.assertIsNotNone(station_entry, "Le poste test doit être dans stations")
        self.assertIsNotNone(station_entry['procedure'])
        self.assertEqual(station_entry['procedure']['id'], proc.id)
        self.assertEqual(station_entry['procedure']['state'], 'running')
        self.assertEqual(result['kpis']['running_sessions'], 1)

    def test_alert_hypotension_critical(self):
        """has_active_hypotension=True → alerte critique dans alerts et dans la procédure."""
        proc = self._make_procedure(state='running')
        self.env['hemodialysis.vital.sign'].create({
            'procedure_id': proc.id,
            'blood_pressure': '82/50',
            'is_hypotension': True,
            'measurement_time': fields.Datetime.to_string(datetime.utcnow()),
            'heart_rate': 95,
        })
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        station_entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        self.assertEqual(station_entry['procedure']['alert_level'], 'critical')
        self.assertEqual(station_entry['procedure']['alert_label'], 'Hypotension')
        critical_alerts = [a for a in result['alerts'] if a['level'] == 'critical']
        self.assertGreaterEqual(len(critical_alerts), 1)
        self.assertTrue(any(a['procedure_id'] == proc.id for a in critical_alerts),
            "L'alerte critique doit référencer la procédure créée dans ce test")
        self.assertEqual(result['kpis']['critical_alerts'], 1)

    def test_alert_unresolved_complication_critical(self):
        """Complication resolution='no' → alerte critique."""
        proc = self._make_procedure(state='running')
        self.env['acs.dialysis.complication'].create({
            'procedure_id': proc.id,
            'complication_type': 'cramps',
            'occurrence_time': fields.Datetime.to_string(datetime.utcnow()),
            'action_taken': 'Massage',
            'resolution': 'no',
        })
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        station_entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        self.assertEqual(station_entry['procedure']['alert_level'], 'critical')

    def test_alert_early_stop_critical(self):
        """Complication early_stop avec resolution='no' → alerte critique 'Arrêt prématuré'."""
        proc = self._make_procedure(state='running')
        self.env['acs.dialysis.complication'].create({
            'procedure_id': proc.id,
            'complication_type': 'early_stop',
            'occurrence_time': fields.Datetime.to_string(datetime.utcnow()),
            'action_taken': 'Arrêt séance',
            'resolution': 'no',
        })
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        station_entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        self.assertEqual(station_entry['procedure']['alert_level'], 'critical')
        self.assertEqual(station_entry['procedure']['alert_label'], 'Arrêt prématuré')

    def test_alert_ktv_insufficient_warning(self):
        """Séance done avec KT/V insuffisant → alerte attention."""
        proc = self._make_procedure(
            state='done',
            urea_pre=50.0, urea_post=30.0,
            arrival_weight=70.0, departure_weight=68.0,
        )
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        station_entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        # urea_pre=50, urea_post=30 → R=0.6, t≈4h, uf=2L, W=68 → KT/V≈0.62 < 1.2 (Daugirdas II)
        self.assertEqual(station_entry['procedure']['ktv_status'], 'insufficient',
            "urea_pre=50, urea_post=30 should yield KT/V≈0.62 < 1.2 → insufficient")
        self.assertEqual(station_entry['procedure']['alert_level'], 'warning')
        warning_alerts = [a for a in result['alerts'] if a['level'] == 'warning']
        self.assertGreaterEqual(len(warning_alerts), 1)

    def test_alert_late_session_warning(self):
        """Séance scheduled avec date > 30 min dans le passé → alerte attention."""
        late_start = datetime.utcnow() - timedelta(minutes=45)
        late_stop = late_start + timedelta(hours=4)
        proc = self._make_procedure(state='scheduled')
        proc.write({
            'date': fields.Datetime.to_string(late_start),
            'date_stop': fields.Datetime.to_string(late_stop),
        })
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        station_entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        self.assertEqual(station_entry['procedure']['alert_level'], 'warning')
        self.assertIn('retard', station_entry['procedure']['alert_label'])

    def test_alerts_sorted_critical_first(self):
        """Les alertes critiques apparaissent avant les alertes attention dans result['alerts']."""
        station2 = self.env['acs.dialysis.station'].create({
            'name': 'Poste Test 2', 'station_type': 'standard', 'active': True,
        })
        sched2 = self.env['acs.nephrology.schedule'].create({
            'name': 'Sched2', 'station_id': station2.id,
            'monday': True, 'tuesday': True, 'wednesday': True,
            'thursday': True, 'friday': True, 'saturday': True, 'sunday': True,
        })
        # Warning on cls.station
        proc1 = self._make_procedure(
            state='done', urea_pre=50.0, urea_post=30.0,
            arrival_weight=70.0, departure_weight=68.0,
        )
        # Critical on station2
        now_utc = datetime.utcnow()
        proc2 = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': fields.Datetime.to_string(now_utc - timedelta(hours=1)),
            'date_stop': fields.Datetime.to_string(now_utc + timedelta(hours=3)),
            'state': 'running',
            'pre_dialysis_bp': '80/50',
            'nephrology_schedule_ids': [(4, sched2.id)],
        })
        self.env['hemodialysis.vital.sign'].create({
            'procedure_id': proc2.id,
            'blood_pressure': '80/50',
            'is_hypotension': True,
            'measurement_time': fields.Datetime.to_string(datetime.utcnow()),
            'heart_rate': 100,
        })
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        levels = [a['level'] for a in result['alerts']]
        self.assertGreaterEqual(len(levels), 2,
            "Both a warning alert (ktv insufficient) and a critical alert (hypotension) should be present")
        self.assertEqual(levels[0], 'critical', "Critical alerts must appear before warnings")
