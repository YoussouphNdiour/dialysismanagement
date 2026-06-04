# acs_hms_nephrology_dashboard/tests/test_calendar_dashboard.py
# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase
from odoo import fields
from datetime import datetime, timedelta


class TestCalendarDashboard(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.dept = cls.env['hr.department'].create({
            'name': 'Néphro Cal Test',
            'department_type': 'nephrology',
        })
        cls.station = cls.env['acs.dialysis.station'].create({
            'name': 'Poste Cal 1',
            'station_type': 'standard',
            'active': True,
        })
        cls.schedule = cls.env['acs.nephrology.schedule'].create({
            'name': 'Sched Cal',
            'station_id': cls.station.id,
            'monday': True, 'tuesday': True, 'wednesday': True,
            'thursday': True, 'friday': True, 'saturday': True, 'sunday': True,
        })
        cls.patient = cls.env['hms.patient'].create({'name': 'Patient Cal Test'})
        cls.product = cls.env['product.product'].search([('type', '=', 'service')], limit=1)
        if not cls.product:
            cls.product = cls.env['product.product'].create({
                'name': 'Hémo Cal Test', 'type': 'service',
            })

    def _make_procedure(self, state='scheduled', hours_ago=1, **kwargs):
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

    # ── get_calendar_day_data ──────────────────────────────────────────────

    def test_day_data_structure(self):
        """Sans procédure : structure valide, poste présent, sessions vide."""
        today = datetime.utcnow().date().isoformat()
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)

        self.assertIn('stations', result)
        self.assertIn('occupation_rate', result)
        self.assertIn('total_stations', result)
        self.assertIn('occupied_count', result)
        self.assertIsInstance(result['stations'], list)

        entry = next((s for s in result['stations'] if s['id'] == self.station.id), None)
        self.assertIsNotNone(entry, "Le poste test doit apparaître")
        self.assertIsInstance(entry['sessions'], list)
        self.assertEqual(len(entry['sessions']), 0)

    def test_day_data_scheduled_color_blue(self):
        """Procédure scheduled → color='blue'."""
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='scheduled')
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)
        entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        self.assertEqual(len(entry['sessions']), 1)
        self.assertEqual(entry['sessions'][0]['color'], 'blue')
        self.assertEqual(entry['sessions'][0]['id'], proc.id)

    def test_day_data_running_no_alert_color_green(self):
        """Procédure running sans alerte → color='green'."""
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='running')
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)
        entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        session = next(s for s in entry['sessions'] if s['id'] == proc.id)
        self.assertEqual(session['color'], 'green')

    def test_day_data_critical_alert_color_red(self):
        """Procédure running avec hypotension → color='red'."""
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='running')
        self.env['hemodialysis.vital.sign'].create({
            'procedure_id': proc.id,
            'blood_pressure': '82/50',
            'is_hypotension': True,
            'measurement_time': fields.Datetime.to_string(datetime.utcnow()),
            'heart_rate': 95,
        })
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)
        entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        session = next(s for s in entry['sessions'] if s['id'] == proc.id)
        self.assertEqual(session['color'], 'red')
        self.assertEqual(session['alert_level'], 'critical')

    def test_day_data_done_no_alert_color_gray(self):
        """Procédure done sans alerte → color='gray'."""
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='done')
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)
        entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        session = next(s for s in entry['sessions'] if s['id'] == proc.id)
        self.assertEqual(session['color'], 'gray')

    def test_day_data_occupation_rate(self):
        """1 poste avec séance + 1 poste sans → occupation_rate = 50% (sur 2 postes)."""
        station2 = self.env['acs.dialysis.station'].create({
            'name': 'Poste Cal 2', 'station_type': 'standard', 'active': True,
        })
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='running')
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)
        # occupation = postes avec au moins 1 séance / total postes actifs
        self.assertEqual(result['occupied_count'], 1)
        expected_rate = round(1 / result['total_stations'] * 100)
        self.assertEqual(result['occupation_rate'], expected_rate)

    def test_day_data_session_fields(self):
        """Les champs id, patient_name, state, date, date_stop sont présents."""
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='scheduled')
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)
        entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        s = entry['sessions'][0]
        self.assertEqual(s['id'], proc.id)
        self.assertEqual(s['patient_name'], self.patient.name)
        self.assertEqual(s['state'], 'scheduled')
        self.assertIsNotNone(s['date'])
        self.assertIsNotNone(s['date_stop'])

    # ── get_calendar_week_data ─────────────────────────────────────────────

    def test_week_data_structure(self):
        """Retourne 7 dates lundi→dimanche et liste patients."""
        today = datetime.utcnow().date().isoformat()
        result = self.env['acs.dialysis.station'].get_calendar_week_data(today)
        self.assertIn('week_dates', result)
        self.assertIn('patients', result)
        self.assertEqual(len(result['week_dates']), 7)
        # Vérifier que la semaine commence un lundi (weekday=0)
        from datetime import date
        first = date.fromisoformat(result['week_dates'][0])
        self.assertEqual(first.weekday(), 0, "La semaine doit commencer un lundi")

    def test_week_data_patient_present(self):
        """Patient avec séance cette semaine → apparaît dans patients."""
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='scheduled')
        result = self.env['acs.dialysis.station'].get_calendar_week_data(today)
        patient_entry = next(
            (p for p in result['patients'] if p['patient_id'] == self.patient.id), None
        )
        self.assertIsNotNone(patient_entry, "Le patient doit apparaître cette semaine")

    def test_week_data_session_in_correct_day(self):
        """La séance apparaît dans le bon jour (sessions_by_day[today_iso])."""
        today_iso = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='scheduled')
        result = self.env['acs.dialysis.station'].get_calendar_week_data(today_iso)
        patient_entry = next(p for p in result['patients'] if p['patient_id'] == self.patient.id)
        session = patient_entry['sessions_by_day'].get(today_iso)
        self.assertIsNotNone(session, f"La séance doit être dans sessions_by_day['{today_iso}']")
        self.assertEqual(session['id'], proc.id)
        self.assertIn('color', session)
        self.assertIn('station_name', session)

    def test_week_data_no_patient_without_session(self):
        """Patient sans séance cette semaine → absent de la liste."""
        today = datetime.utcnow().date().isoformat()
        other_patient = self.env['hms.patient'].create({'name': 'Patient Sans Séance'})
        result = self.env['acs.dialysis.station'].get_calendar_week_data(today)
        ids = [p['patient_id'] for p in result['patients']]
        self.assertNotIn(other_patient.id, ids)

    # ── get_calendar_month_data ────────────────────────────────────────────

    def test_month_data_structure(self):
        """Retourne 28-31 jours et les champs attendus."""
        import calendar as cal_mod
        now = datetime.utcnow()
        result = self.env['acs.dialysis.station'].get_calendar_month_data(now.year, now.month)
        self.assertIn('days', result)
        self.assertIn('total_stations', result)
        self.assertIn('month_avg_occupation', result)
        days_in_month = cal_mod.monthrange(now.year, now.month)[1]
        self.assertEqual(len(result['days']), days_in_month)

    def test_month_data_day_fields(self):
        """Chaque jour a date, session_count, occupation_rate, critical_count, warning_count."""
        now = datetime.utcnow()
        result = self.env['acs.dialysis.station'].get_calendar_month_data(now.year, now.month)
        for day in result['days']:
            self.assertIn('date', day)
            self.assertIn('session_count', day)
            self.assertIn('occupation_rate', day)
            self.assertIn('critical_count', day)
            self.assertIn('warning_count', day)

    def test_month_data_session_counted(self):
        """Procédure du mois → comptée dans le bon jour."""
        now = datetime.utcnow()
        proc = self._make_procedure(state='scheduled')
        today_iso = now.date().isoformat()
        result = self.env['acs.dialysis.station'].get_calendar_month_data(now.year, now.month)
        today_entry = next(d for d in result['days'] if d['date'] == today_iso)
        self.assertGreaterEqual(today_entry['session_count'], 1)
        self.assertGreater(today_entry['occupation_rate'], 0)

    def test_month_data_occupation_rate_capped_at_100(self):
        """Le taux d'occupation ne dépasse pas 100%."""
        now = datetime.utcnow()
        result = self.env['acs.dialysis.station'].get_calendar_month_data(now.year, now.month)
        for day in result['days']:
            self.assertLessEqual(day['occupation_rate'], 100)
            self.assertGreaterEqual(day['occupation_rate'], 0)
