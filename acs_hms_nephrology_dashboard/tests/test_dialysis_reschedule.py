# acs_hms_nephrology_dashboard/tests/test_dialysis_reschedule.py
# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase
from odoo import fields
from odoo.exceptions import UserError
from datetime import date, timedelta


class TestDialysisReschedule(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.dept = cls.env['hr.department'].create({
            'name': 'Néphro Reschedule Test',
            'department_type': 'nephrology',
        })
        cls.station = cls.env['acs.dialysis.station'].create({
            'name': 'Poste Reschedule 1',
            'station_type': 'standard',
            'active': True,
        })
        cls.schedule = cls.env['acs.nephrology.schedule'].create({
            'name': 'Sched Reschedule',
            'station_id': cls.station.id,
            'monday': True, 'tuesday': True, 'wednesday': True,
            'thursday': True, 'friday': True, 'saturday': True, 'sunday': True,
            'max_patients': 2,
        })
        cls.patient = cls.env['hms.patient'].create({'name': 'Patient Reschedule'})
        cls.product = cls.env['product.product'].search([('type', '=', 'service')], limit=1)
        if not cls.product:
            cls.product = cls.env['product.product'].create({
                'name': 'Hémo Reschedule', 'type': 'service',
            })

    def _make_procedure(self, date_val, state='scheduled'):
        dt = fields.Datetime.to_string(
            fields.Datetime.from_string(f'{date_val} 08:00:00')
        )
        dt_stop = fields.Datetime.to_string(
            fields.Datetime.from_string(f'{date_val} 12:00:00')
        )
        return self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': dt,
            'date_stop': dt_stop,
            'state': state,
            'pre_dialysis_bp': '130/80',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })

    def test_reschedule_updates_procedure_date(self):
        """Report valide : la date de la procédure est mise à jour."""
        today = date.today()
        tomorrow = today + timedelta(days=1)
        proc = self._make_procedure(today.isoformat())
        wizard = self.env['dialysis.session.reschedule'].create({
            'procedure_id': proc.id,
            'new_date': tomorrow,
            'station_id': self.station.id,
        })
        wizard.action_confirm()
        self.assertEqual(
            fields.Datetime.from_string(proc.date).date(), tomorrow
        )

    def test_reschedule_blocked_when_station_full(self):
        """Poste saturé sans liste d'attente : UserError levée."""
        today = date.today()
        tomorrow = today + timedelta(days=1)
        proc = self._make_procedure(today.isoformat())
        # Saturer le poste le lendemain (max_patients=2)
        self._make_procedure(tomorrow.isoformat())
        self._make_procedure(tomorrow.isoformat())
        wizard = self.env['dialysis.session.reschedule'].create({
            'procedure_id': proc.id,
            'new_date': tomorrow,
            'station_id': self.station.id,
            'add_to_waitlist': False,
        })
        with self.assertRaises(UserError):
            wizard.action_confirm()

    def test_reschedule_creates_waitlist_when_full(self):
        """Poste saturé avec add_to_waitlist=True : crée une entrée waitlist."""
        today = date.today()
        tomorrow = today + timedelta(days=1)
        proc = self._make_procedure(today.isoformat())
        self._make_procedure(tomorrow.isoformat())
        self._make_procedure(tomorrow.isoformat())
        wizard = self.env['dialysis.session.reschedule'].create({
            'procedure_id': proc.id,
            'new_date': tomorrow,
            'station_id': self.station.id,
            'add_to_waitlist': True,
        })
        wizard.action_confirm()
        waitlist = self.env['acs.dialysis.waitlist'].search([
            ('patient_id', '=', self.patient.id),
            ('state', '=', 'waiting'),
        ])
        self.assertTrue(waitlist)

    def test_slots_available_computed(self):
        """slots_available reflète le nombre de créneaux libres."""
        today = date.today()
        proc = self._make_procedure(today.isoformat())
        # 0 procédures demain → 2 places libres (max=2)
        tomorrow = today + timedelta(days=1)
        wizard = self.env['dialysis.session.reschedule'].create({
            'procedure_id': proc.id,
            'new_date': tomorrow,
            'station_id': self.station.id,
        })
        self.assertEqual(wizard.slots_available, 2)
