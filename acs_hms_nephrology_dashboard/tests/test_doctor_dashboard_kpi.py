# -*- coding: utf-8 -*-
from datetime import datetime, date, timedelta
from odoo.tests.common import TransactionCase


class TestDoctorDashboardKpi(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Département néphro (chercher ou créer)
        cls.nephro_dept = cls.env['hr.department'].search(
            [('department_type', '=', 'nephrology')], limit=1)
        if not cls.nephro_dept:
            cls.nephro_dept = cls.env['hr.department'].create({
                'name': 'Néphro Test KPI',
                'department_type': 'nephrology',
            })

        # Deux médecins avec utilisateur lié (hms.physician _inherits res.users)
        cls.physician1 = cls.env['hms.physician'].sudo().create({
            'name': 'Dr KPI Un',
            'login': 'dr_kpi_un@test.local',
            'email': 'dr_kpi_un@test.local',
        })
        cls.physician2 = cls.env['hms.physician'].sudo().create({
            'name': 'Dr KPI Deux',
            'login': 'dr_kpi_deux@test.local',
            'email': 'dr_kpi_deux@test.local',
        })

        # Deux patients
        cls.patient1 = cls.env['hms.patient'].create({
            'name': 'Patient KPI Un',
            'nephrology_care': True,
            'primary_physician_id': cls.physician1.id,
        })
        cls.patient2 = cls.env['hms.patient'].create({
            'name': 'Patient KPI Deux',
            'nephrology_care': True,
            'primary_physician_id': cls.physician2.id,
        })

        # Date dans le mois courant
        today = date.today()
        cls.this_month_dt = datetime.combine(
            today.replace(day=1), datetime.min.time()) + timedelta(days=1)

    @classmethod
    def _get_or_create_product(cls):
        """Retourne un produit service pour les procédures (product_id requis)."""
        product = cls.env['product.product'].search([('type', '=', 'service')], limit=1)
        if not product:
            product = cls.env['product.product'].create({
                'name': 'Hémodialyse KPI Test',
                'type': 'service',
            })
        return product

    def _make_session(self, patient, state='done'):
        """Crée une séance dialyse done dans le mois courant."""
        product = self._get_or_create_product()
        return self.env['acs.patient.procedure'].create({
            'patient_id': patient.id,
            'product_id': product.id,
            'department_id': self.nephro_dept.id,
            'date': self.this_month_dt,
            'state': state,
        })

    def test_kpi_manager_sees_all(self):
        """Manager (group_hms_manager) voit toutes les séances néphro — is_manager=True."""
        self._make_session(self.patient1)
        self._make_session(self.patient2)

        manager_group = self.env.ref('acs_hms_base.group_hms_manager')
        self.env.user.group_ids = [(4, manager_group.id)]

        result = self.env['acs.dialysis.station'].get_kpi_stats_data()

        self.assertTrue(result['is_manager'])
        self.assertGreaterEqual(result['sessions_count'], 2)
        self.assertIn('/', result['ktv_adequate_detail'])
        self.assertIn('period_label', result)

    def test_kpi_doctor_sees_own(self):
        """Médecin standard ne voit que ses patients (primary_physician_id)."""
        self._make_session(self.patient1)
        self._make_session(self.patient2)

        # Appel en tant que physician1 (non manager)
        Station = self.env['acs.dialysis.station'].with_user(self.physician1.user_id)
        result = Station.get_kpi_stats_data()

        self.assertFalse(result['is_manager'])
        self.assertEqual(result['sessions_count'], 1)

    def test_hb_in_range_no_bilan(self):
        """Patient sans bilan Hb est exclu du dénominateur hb_in_range_detail.
        On appelle en tant que physician1 (scope = ses patients uniquement).
        patient1 n'a aucun bilan → denominateur = 0."""
        # patient1 n'a aucun bilan dans le setUp — vérification via scope médecin
        Station = self.env['acs.dialysis.station'].with_user(self.physician1.user_id)
        result = Station.get_kpi_stats_data()

        detail = result['hb_in_range_detail']   # ex: "0/0"
        _, denominator = detail.split('/')
        self.assertEqual(int(denominator), 0)

    def test_complication_rate(self):
        """2 complications sur 10 séances → complication_detail = '2/10'."""
        sessions = [self._make_session(self.patient1) for _ in range(10)]

        # Ajouter 2 complications sur les 2 premières séances
        for proc in sessions[:2]:
            self.env['acs.dialysis.complication'].create({
                'procedure_id': proc.id,
                'complication_type': 'cramps',
                'action_taken': 'Test traitement',
                'resolution': 'yes',
            })

        # Appel en tant que physician1 (voit uniquement patient1)
        Station = self.env['acs.dialysis.station'].with_user(self.physician1.user_id)
        result = Station.get_kpi_stats_data()

        comp_num, comp_den = result['complication_detail'].split('/')
        self.assertEqual(int(comp_num), 2)
        self.assertEqual(int(comp_den), 10)
        self.assertEqual(result['complication_rate'], 20.0)
