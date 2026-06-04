# acs_hms_nephrology_dashboard/tests/test_dialysis_absence.py
# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase
from odoo import fields
from odoo.exceptions import ValidationError, UserError
from datetime import date, timedelta


class TestDialysisAbsence(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.dept = cls.env['hr.department'].create({
            'name': 'Néphro Absence Test',
            'department_type': 'nephrology',
        })
        cls.station = cls.env['acs.dialysis.station'].create({
            'name': 'Poste Abs 1',
            'station_type': 'standard',
            'active': True,
        })
        cls.schedule = cls.env['acs.nephrology.schedule'].create({
            'name': 'Sched Abs',
            'station_id': cls.station.id,
            'monday': True, 'tuesday': True, 'wednesday': True,
            'thursday': True, 'friday': True, 'saturday': True, 'sunday': True,
            'max_patients': 4,
        })
        cls.patient = cls.env['hms.patient'].create({'name': 'Patient Abs Test'})
        cls.product = cls.env['product.product'].search([('type', '=', 'service')], limit=1)
        if not cls.product:
            cls.product = cls.env['product.product'].create({
                'name': 'Hémo Abs Test', 'type': 'service',
            })

    def _make_procedure(self, date_val, state='scheduled'):
        """Crée une procédure à une date donnée."""
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

    def test_absence_confirm_sets_procedures_absent(self):
        """Confirmer une absence passe les séances schedulées en 'absent'."""
        today = date.today()
        p1 = self._make_procedure(today.isoformat())
        p2 = self._make_procedure((today + timedelta(days=1)).isoformat())
        absence = self.env['acs.dialysis.absence'].create({
            'patient_id': self.patient.id,
            'start_date': today,
            'end_date': today + timedelta(days=1),
            'reason': 'voyage',
        })
        absence.action_confirm()
        self.assertEqual(p1.state, 'absent')
        self.assertEqual(p2.state, 'absent')
        self.assertEqual(p1.absence_id, absence)
        self.assertEqual(p2.absence_id, absence)
        self.assertEqual(absence.state, 'confirmed')

    def test_absence_confirm_ignores_done_procedures(self):
        """Les séances 'done' ne sont pas touchées par la confirmation."""
        today = date.today()
        p_done = self._make_procedure(today.isoformat(), state='done')
        absence = self.env['acs.dialysis.absence'].create({
            'patient_id': self.patient.id,
            'start_date': today,
            'end_date': today,
            'reason': 'hospitalisation',
        })
        absence.action_confirm()
        self.assertEqual(p_done.state, 'done')

    def test_absence_confirm_only_affects_patient(self):
        """La confirmation ne touche que les séances du patient concerné."""
        other_patient = self.env['hms.patient'].create({'name': 'Autre Patient'})
        today = date.today()
        dt = fields.Datetime.to_string(
            fields.Datetime.from_string(f'{today.isoformat()} 08:00:00')
        )
        dt_stop = fields.Datetime.to_string(
            fields.Datetime.from_string(f'{today.isoformat()} 12:00:00')
        )
        p_other = self.env['acs.patient.procedure'].create({
            'patient_id': other_patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': dt,
            'date_stop': dt_stop,
            'state': 'scheduled',
            'pre_dialysis_bp': '130/80',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })
        absence = self.env['acs.dialysis.absence'].create({
            'patient_id': self.patient.id,
            'start_date': today,
            'end_date': today,
            'reason': 'refus',
        })
        absence.action_confirm()
        self.assertEqual(p_other.state, 'scheduled')

    def test_absence_cancel_restores_procedures(self):
        """Annuler une absence remet les séances en 'scheduled'."""
        today = date.today()
        p1 = self._make_procedure(today.isoformat())
        absence = self.env['acs.dialysis.absence'].create({
            'patient_id': self.patient.id,
            'start_date': today,
            'end_date': today,
            'reason': 'autre',
        })
        absence.action_confirm()
        self.assertEqual(p1.state, 'absent')
        absence.action_cancel()
        self.assertEqual(p1.state, 'scheduled')
        self.assertFalse(p1.absence_id)
        self.assertEqual(absence.state, 'draft')

    def test_end_date_before_start_raises(self):
        """Contrainte SQL : end_date >= start_date."""
        today = date.today()
        with self.assertRaises(Exception):
            self.env['acs.dialysis.absence'].create({
                'patient_id': self.patient.id,
                'start_date': today,
                'end_date': today - timedelta(days=1),
                'reason': 'voyage',
            })
