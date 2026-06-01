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
        now = datetime.now()
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
        kpis = result['kpis']
        self.assertEqual(kpis['total_sessions'], 0)
        self.assertEqual(kpis['occupation_rate'], 0)
        self.assertEqual(kpis['avg_ktv'], 0.0)

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
        proc.unlink()
