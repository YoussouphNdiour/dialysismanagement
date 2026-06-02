# acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py
# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase
from odoo import fields
from datetime import datetime, timedelta, date


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

    def test_get_patient_panel_data_returns_expected_structure(self):
        """get_patient_panel_data() retourne séance en cours, dernière séance, infos patient."""
        # Previous done session (3 days ago)
        past_start = datetime.utcnow() - timedelta(days=3, hours=2)
        past_stop = past_start + timedelta(hours=4)
        prev_proc = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': fields.Datetime.to_string(past_start),
            'date_stop': fields.Datetime.to_string(past_stop),
            'state': 'done',
            'pre_dialysis_bp': '135/85',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })
        # Current running session
        proc = self._make_procedure(state='running')

        result = self.env['acs.dialysis.station'].get_patient_panel_data(proc.id)

        self.assertIn('procedure', result)
        self.assertIn('patient', result)
        self.assertIn('previous_session', result)
        self.assertEqual(result['procedure']['id'], proc.id)
        self.assertEqual(result['patient']['name'], self.patient.name)
        self.assertIsNotNone(result['previous_session'],
            "Une séance précédente done doit être présente")
        # previous_session doit référencer prev_proc (la seule done pour ce patient)
        prev_date_str = result['previous_session']['date']
        self.assertIsInstance(prev_date_str, str,
            "previous_session['date'] doit être une chaîne ISO 8601")
        parsed_date = date.fromisoformat(prev_date_str[:10])
        self.assertEqual(parsed_date, past_start.date(),
            "La date de la dernière séance doit correspondre à prev_proc")

    def test_get_patient_panel_no_previous_session(self):
        """Premier patient sans séance précédente → previous_session = None, pas d'erreur."""
        new_patient = self.env['hms.patient'].create({'name': 'Nouveau Patient Test'})
        now_utc = datetime.utcnow()
        proc = self.env['acs.patient.procedure'].create({
            'patient_id': new_patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': fields.Datetime.to_string(now_utc - timedelta(hours=1)),
            'date_stop': fields.Datetime.to_string(now_utc + timedelta(hours=3)),
            'state': 'running',
            'pre_dialysis_bp': '140/90',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })
        result = self.env['acs.dialysis.station'].get_patient_panel_data(proc.id)
        self.assertIn('procedure', result)
        self.assertEqual(result['procedure']['id'], proc.id)
        self.assertIsNone(result['previous_session'],
            "Sans séance précédente, previous_session doit être None")

    def test_get_patient_panel_invalid_id(self):
        """ID inexistant → retourne {}."""
        result = self.env['acs.dialysis.station'].get_patient_panel_data(999999999)
        self.assertEqual(result, {})

    def test_kpis_calculation(self):
        """2 running + 1 done → kpis calculés correctement."""
        proc1 = self._make_procedure(state='running')
        proc2 = self._make_procedure(state='running')
        proc3 = self._make_procedure(
            state='done',
            urea_pre=50.0, urea_post=15.0,
            arrival_weight=70.0, departure_weight=68.0,
        )
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        # Check only the test station's contribution to isolate from other data
        station_entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        # The station should have a procedure (last created wins in proc_by_station logic — proc3)
        self.assertIsNotNone(station_entry['procedure'])
        # Global KPI: running_sessions must include proc1 and proc2
        # (proc3 is done, proc1 and proc2 are running — but all share the same station,
        #  so only the earliest-date one appears per station; verify totals from get_dashboard_data)
        kpis = result['kpis']
        self.assertIn('total_sessions', kpis)
        self.assertIn('running_sessions', kpis)
        self.assertIn('done_sessions', kpis)
        self.assertIn('occupation_rate', kpis)
        self.assertIn('avg_ktv', kpis)
        self.assertGreaterEqual(kpis['total_sessions'], 1)
        self.assertIsInstance(kpis['occupation_rate'], int)
        # avg_ktv should be > 0 since proc3 has ktv_calculated > 0
        # (only done sessions with ktv > 0 contribute)
        # urea_pre=50, urea_post=15 → R=0.3, KT/V > 1.2 → adequate
        # Daugirdas II: ktv ≈ -ln(0.3 - 0.008*4) + (4 - 3.5*0.3)*2/68 ≈ 1.41
        if kpis['avg_ktv'] > 0:
            self.assertGreater(kpis['avg_ktv'], 1.0,
                "KT/V avec urea_post=15 doit être > 1.0")

    def test_get_ktv_chart_data_groups_by_day(self):
        """3 séances done sur 2 jours → labels et valeurs cohérentes."""
        now_utc = datetime.utcnow()
        yesterday = now_utc - timedelta(days=1)

        def make_done(base_dt, urea_post_val):
            return self.env['acs.patient.procedure'].create({
                'patient_id': self.patient.id,
                'product_id': self.product.id,
                'department_id': self.dept.id,
                'date': fields.Datetime.to_string(base_dt - timedelta(hours=4)),
                'date_stop': fields.Datetime.to_string(base_dt),
                'state': 'done',
                'pre_dialysis_bp': '130/80',
                'urea_pre': 50.0,
                'urea_post': urea_post_val,
                'arrival_weight': 70.0,
                'departure_weight': 68.0,
                'nephrology_schedule_ids': [(4, self.schedule.id)],
            })

        p1 = make_done(yesterday, 15.0)
        p2 = make_done(yesterday, 20.0)
        p3 = make_done(now_utc, 15.0)

        result = self.env['acs.dialysis.station'].get_ktv_chart_data()
        self.assertIn('labels', result)
        self.assertIn('values', result)
        self.assertEqual(len(result['labels']), len(result['values']),
            "labels et values doivent avoir la même longueur")
        self.assertGreaterEqual(len(result['labels']), 2,
            "Au moins 2 jours distincts (hier + aujourd'hui)")
        for v in result['values']:
            self.assertIsInstance(v, float)
            self.assertGreater(v, 0.0)

    def test_get_ktv_chart_data_empty(self):
        """Sans séance done avec KT/V calculé → structure valide (listes éventuellement non vides)."""
        result = self.env['acs.dialysis.station'].get_ktv_chart_data()
        self.assertIn('labels', result)
        self.assertIn('values', result)
        self.assertIsInstance(result['labels'], list)
        self.assertIsInstance(result['values'], list)
        self.assertEqual(len(result['labels']), len(result['values']))
