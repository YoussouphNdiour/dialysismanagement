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
