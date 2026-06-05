# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase
from odoo.exceptions import AccessError


class TestNurseDashboardACL(TransactionCase):

    def setUp(self):
        super().setUp()
        # Créer un utilisateur infirmier
        nurse_group = self.env.ref('acs_hms.group_hms_nurse')
        self.nurse_user = self.env['res.users'].create({
            'name': 'Infirmier Test',
            'login': 'nurse_test_dashboard@test.com',
            'group_ids': [(6, 0, [nurse_group.id])],
        })
        # Patient + produit + procédure de test
        self.patient = self.env['hms.patient'].create({'name': 'Patient ACL Test'})
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

    def test_nurse_can_write_procedure(self):
        """Infirmier peut modifier acs.patient.procedure (departure_weight, global_tolerance)"""
        proc_as_nurse = self.procedure.with_user(self.nurse_user)
        # Ne doit pas lever AccessError
        proc_as_nurse.write({'global_tolerance': 'good'})
        self.assertEqual(self.procedure.global_tolerance, 'good')

    def test_nurse_can_create_vital_sign(self):
        """Infirmier peut créer hemodialysis.vital.sign"""
        vital = self.env['hemodialysis.vital.sign'].with_user(self.nurse_user).create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '120/80',
            'heart_rate': 72,
        })
        self.assertTrue(vital.id)

    def test_nurse_can_create_complication(self):
        """Infirmier peut créer acs.dialysis.complication"""
        complication = self.env['acs.dialysis.complication'].with_user(self.nurse_user).create({
            'procedure_id': self.procedure.id,
            'complication_type': 'hypotension',
            'action_taken': 'Position Trendelenburg, sérum physiologique',
            'resolution': 'yes',
        })
        self.assertTrue(complication.id)


class TestNurseDashboardFilter(TransactionCase):
    """Vérifie que le domaine de filtre "patients du jour" fonctionne."""

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Filtre'})
        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1) or self.env['product.product'].create({
            'name': 'Hémodialyse', 'type': 'service',
            'hospital_product_type': 'nephrology_procedure',
        })
        nephro_dept = self.env['hr.department'].search([
            ('department_type', '=', 'nephrology')
        ], limit=1) or self.env['hr.department'].create({
            'name': 'Néphrologie Test',
            'department_type': 'nephrology',
        })
        from datetime import datetime, date
        today_start = datetime.combine(date.today(), datetime.min.time().replace(hour=0))
        self.procedure_today = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
            'department_id': nephro_dept.id,
            'date': today_start,
        })
        self.procedure_old = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
            'department_id': nephro_dept.id,
            'date': '2020-01-01 08:00:00',
        })

    def test_today_filter_includes_today_procedure(self):
        """La procédure d'aujourd'hui est dans le domaine du filtre"""
        from datetime import date
        today = date.today()
        today_start = f"{today} 00:00:00"
        today_end = f"{today} 23:59:59"
        results = self.env['acs.patient.procedure'].search([
            ('department_id.department_type', '=', 'nephrology'),
            ('date', '>=', today_start),
            ('date', '<=', today_end),
        ])
        self.assertIn(self.procedure_today, results)

    def test_today_filter_excludes_old_procedure(self):
        """Une ancienne procédure n'est pas dans le filtre du jour"""
        from datetime import date
        today = date.today()
        today_start = f"{today} 00:00:00"
        today_end = f"{today} 23:59:59"
        results = self.env['acs.patient.procedure'].search([
            ('department_id.department_type', '=', 'nephrology'),
            ('date', '>=', today_start),
            ('date', '<=', today_end),
        ])
        self.assertNotIn(self.procedure_old, results)

    def test_schedule_filter(self):
        """Le filtre par schedule fonctionne"""
        station = self.env['acs.dialysis.station'].create({
            'name': 'Poste Test', 'room': 'Salle Test', 'station_type': 'standard',
        })
        schedule = self.env['acs.nephrology.schedule'].create({
            'name': 'Planning Test', 'monday': True, 'start_time': 7.0, 'end_time': 11.0,
            'station_id': station.id,
        })
        self.procedure_today.write({'nephrology_schedule_ids': [(4, schedule.id)]})

        from datetime import date
        today = date.today()
        results = self.env['acs.patient.procedure'].search([
            ('department_id.department_type', '=', 'nephrology'),
            ('date', '>=', f"{today} 00:00:00"),
            ('date', '<=', f"{today} 23:59:59"),
            ('nephrology_schedule_ids', 'in', [schedule.id]),
        ])
        self.assertIn(self.procedure_today, results)
