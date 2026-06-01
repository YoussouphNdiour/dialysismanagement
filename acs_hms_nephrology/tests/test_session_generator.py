# -*- coding: utf-8 -*-
from datetime import date
from odoo.tests.common import TransactionCase


class TestNephrologyHoliday(TransactionCase):

    def test_holiday_creation(self):
        holiday = self.env['acs.nephrology.holiday'].create({
            'name': 'Fête du Travail',
            'date': '2026-05-01',
            'recurring': True,
        })
        self.assertEqual(holiday.name, 'Fête du Travail')
        self.assertTrue(holiday.recurring)

    def test_recurring_holiday_matches_any_year(self):
        """Un holiday recurring daté 2024 doit aussi matcher 2026 (même mois/jour)"""
        self.env['acs.nephrology.holiday'].create({
            'name': 'Fête du Travail',
            'date': '2024-05-01',
            'recurring': True,
        })
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 4, 27),  # lundi
            'date_end': date(2026, 5, 3),     # dimanche
            'exclude_holidays': True,
        })
        # Schedule Lu/Me/Ve
        schedule = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV', 'start_time': 7.0, 'end_time': 11.0,
            'monday': True, 'wednesday': True, 'friday': True,
        })
        valid = generator._get_valid_dates(schedule, date(2026, 4, 27), date(2026, 5, 3), True)
        dates_in_result = [d for d in valid]
        self.assertNotIn(date(2026, 5, 1), dates_in_result)  # Vendredi 1er mai exclu
        self.assertIn(date(2026, 4, 27), dates_in_result)    # Lundi 27 avril inclus


class TestSessionGeneratorDates(TransactionCase):

    def setUp(self):
        super().setUp()
        self.generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),  # Lundi
            'date_end': date(2026, 6, 14),   # Dimanche (2 semaines)
            'exclude_holidays': False,
        })
        self.schedule_lmv = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV Test',
            'start_time': 7.0,
            'end_time': 11.0,
            'monday': True,    # 0
            'wednesday': True, # 2
            'friday': True,    # 4
        })

    def test_schedule_days_respected(self):
        """Seuls Lu/Me/Ve sont générés pour un planning LMV"""
        dates = self.generator._get_valid_dates(
            self.schedule_lmv, date(2026, 6, 1), date(2026, 6, 7), False)
        # Semaine du 1 au 7 juin : Lu=1, Ma=2, Me=3, Je=4, Ve=5, Sa=6, Di=7
        self.assertIn(date(2026, 6, 1), dates)  # Lundi
        self.assertIn(date(2026, 6, 3), dates)  # Mercredi
        self.assertIn(date(2026, 6, 5), dates)  # Vendredi
        self.assertNotIn(date(2026, 6, 2), dates)  # Mardi
        self.assertNotIn(date(2026, 6, 6), dates)  # Samedi
        self.assertEqual(len(dates), 3)

    def test_period_boundaries_included(self):
        """start_date et end_date sont incluses si elles tombent sur un bon jour"""
        # 2026-06-01 = Lundi (dans LMV), 2026-06-05 = Vendredi (dans LMV)
        dates = self.generator._get_valid_dates(
            self.schedule_lmv, date(2026, 6, 1), date(2026, 6, 5), False)
        self.assertIn(date(2026, 6, 1), dates)
        self.assertIn(date(2026, 6, 5), dates)
        self.assertEqual(len(dates), 3)  # Lu, Me, Ve

    def test_holiday_exclusion(self):
        """Une date fériée non récurrente est exclue"""
        self.env['acs.nephrology.holiday'].create({
            'name': 'Férié test',
            'date': '2026-06-03',  # Mercredi
            'recurring': False,
        })
        dates = self.generator._get_valid_dates(
            self.schedule_lmv, date(2026, 6, 1), date(2026, 6, 7), True)
        self.assertNotIn(date(2026, 6, 3), dates)  # Mercredi exclu
        self.assertIn(date(2026, 6, 1), dates)     # Lundi inclus

    def test_holiday_not_excluded_when_flag_false(self):
        """Si exclude_holidays=False, les jours fériés sont inclus"""
        self.env['acs.nephrology.holiday'].create({
            'name': 'Férié test',
            'date': '2026-06-03',
            'recurring': False,
        })
        dates = self.generator._get_valid_dates(
            self.schedule_lmv, date(2026, 6, 1), date(2026, 6, 7), False)
        self.assertIn(date(2026, 6, 3), dates)

    def test_preview_count_with_patients(self):
        """preview_count = total séances pour tous les patients"""
        station = self.env['acs.dialysis.station'].create({
            'name': 'Poste Preview', 'station_type': 'standard',
        })
        self.schedule_lmv.station_id = station.id

        product = self.env['product.product'].search([
            ('hospital_product_type', 'in', ['nephrology_procedure', 'consultation'])
        ], limit=1) or self.env['product.product'].create({
            'name': 'Hémodialyse Test', 'type': 'service',
            'hospital_product_type': 'nephrology_procedure',
        })
        patient = self.env['hms.patient'].create({
            'name': 'Patient Preview', 'nephrology_care': True,
        })
        # Créer une procédure passée pour que le patient ait un schedule
        self.env['acs.patient.procedure'].create({
            'patient_id': patient.id,
            'product_id': product.id,
            'date': '2026-01-01 07:00:00',
            'nephrology_schedule_ids': [(4, self.schedule_lmv.id)],
        })
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),   # Lundi
            'date_end': date(2026, 6, 7),     # Dimanche
            'exclude_holidays': False,
            'patient_ids': [(4, patient.id)],
        })
        generator.invalidate_recordset()
        # 3 séances LMV du 1 au 7 juin
        self.assertEqual(generator.preview_count, 3)
