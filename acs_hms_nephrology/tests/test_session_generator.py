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


class TestSessionGeneratorLines(TransactionCase):

    def setUp(self):
        super().setUp()
        self.station = self.env['acs.dialysis.station'].create({
            'name': 'Poste A',
        })
        self.schedule = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV', 'start_time': 7.0, 'end_time': 11.0,
            'monday': True, 'wednesday': True, 'friday': True,
            'station_id': self.station.id,
        })
        self.product = self.env['product.product'].search([
            ('hospital_product_type', 'in', ['nephrology_procedure', 'consultation'])
        ], limit=1)
        if not self.product:
            self.product = self.env['product.product'].create({
                'name': 'Hémodialyse Test', 'type': 'service',
            })
        self.patient = self.env['hms.patient'].create({
            'name': 'Patient Lignes Test', 'nephrology_care': True,
        })

    def test_prepopulate_station_from_last_procedure(self):
        """station_id pré-rempli depuis le schedule de la dernière procédure"""
        station2 = self.env['acs.dialysis.station'].create({
            'name': 'Poste B',
        })
        schedule2 = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV-2', 'start_time': 13.0, 'end_time': 17.0,
            'monday': True, 'wednesday': True, 'friday': True,
            'station_id': station2.id,
        })
        self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'date': '2026-01-05 07:00:00',
            'nephrology_schedule_ids': [(4, schedule2.id)],
        })
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 7),
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient.id)],
        })
        generator.action_open_validator()
        line = generator.line_ids.filtered(lambda l: l.patient_id == self.patient)
        self.assertTrue(line)
        self.assertEqual(line.station_id.id, station2.id)

    def test_no_last_procedure_uses_schedule_default(self):
        """Sans procédure précédente, fallback sur station du schedule du patient"""
        self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'date': '2026-01-05 07:00:00',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 7),
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient.id)],
        })
        generator.action_open_validator()
        line = generator.line_ids.filtered(lambda l: l.patient_id == self.patient)
        self.assertTrue(line)
        self.assertEqual(line.station_id.id, self.station.id)
        self.assertEqual(line.schedule_id.id, self.schedule.id)

    def test_patient_without_schedule_ignored(self):
        """Un patient sans procédure et sans schedule n'apparaît pas dans les lignes"""
        patient_sans_schedule = self.env['hms.patient'].create({
            'name': 'Patient Sans Schedule', 'nephrology_care': True,
        })
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 7),
            'exclude_holidays': False,
            'patient_ids': [(4, patient_sans_schedule.id)],
        })
        generator.action_open_validator()
        self.assertEqual(len(generator.line_ids), 0)


class TestSessionGeneratorConflicts(TransactionCase):

    def setUp(self):
        super().setUp()
        self.station = self.env['acs.dialysis.station'].create({
            'name': 'Poste Conflit',
        })
        self.schedule = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV Conflit', 'start_time': 7.0, 'end_time': 11.0,
            'monday': True, 'wednesday': True, 'friday': True,
            'station_id': self.station.id,
        })
        self.product = self.env['product.product'].search([
            ('hospital_product_type', 'in', ['nephrology_procedure', 'consultation'])
        ], limit=1)
        if not self.product:
            self.product = self.env['product.product'].create({
                'name': 'Hémodialyse Conflit', 'type': 'service',
            })
        self.patient_a = self.env['hms.patient'].create({
            'name': 'Patient A Conflit', 'nephrology_care': True,
        })
        self.patient_b = self.env['hms.patient'].create({
            'name': 'Patient B Conflit', 'nephrology_care': True,
        })

    def _make_procedure(self, patient, schedule, date_str):
        return self.env['acs.patient.procedure'].create({
            'patient_id': patient.id,
            'product_id': self.product.id,
            'date': date_str,
            'nephrology_schedule_ids': [(4, schedule.id)],
        })

    def test_conflict_station_warning(self):
        """Poste déjà utilisé → warning_station (pas bloquant)"""
        # Patient B a déjà une procédure sur le même poste sur la période
        self._make_procedure(self.patient_b, self.schedule, '2026-06-03 07:00:00')

        # Patient A a une procédure passée (pour avoir un schedule) mais pas sur la période
        self._make_procedure(self.patient_a, self.schedule, '2026-01-05 07:00:00')

        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 7),
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient_a.id)],
        })
        generator.action_open_validator()
        line = generator.line_ids.filtered(lambda l: l.patient_id == self.patient_a)
        self.assertEqual(line.conflict_status, 'warning_station')

    def test_conflict_duplicate_error(self):
        """Patient déjà planifié sur la période → error_duplicate (bloquant)"""
        # Patient A a déjà une procédure sur la période
        self._make_procedure(self.patient_a, self.schedule, '2026-06-03 07:00:00')

        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 7),
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient_a.id)],
        })
        generator.action_open_validator()
        line = generator.line_ids.filtered(lambda l: l.patient_id == self.patient_a)
        self.assertEqual(line.conflict_status, 'error_duplicate')

    def test_no_conflict_ok(self):
        """Aucun conflit → statut ok"""
        # Patient A has a past procedure (not on the period) to get a schedule
        self._make_procedure(self.patient_a, self.schedule, '2026-01-05 07:00:00')

        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 7),
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient_a.id)],
        })
        generator.action_open_validator()
        line = generator.line_ids.filtered(lambda l: l.patient_id == self.patient_a)
        self.assertEqual(line.conflict_status, 'ok')


class TestSessionGeneratorConfirm(TransactionCase):

    def setUp(self):
        super().setUp()
        self.station = self.env['acs.dialysis.station'].create({
            'name': 'Poste Confirm',
        })
        self.schedule = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV Confirm', 'start_time': 7.0, 'end_time': 11.0,
            'monday': True, 'wednesday': True, 'friday': True,
            'station_id': self.station.id,
        })
        self.product = self.env['product.product'].search([
            ('hospital_product_type', 'in', ['nephrology_procedure', 'consultation'])
        ], limit=1)
        if not self.product:
            self.product = self.env['product.product'].create({
                'name': 'Hémodialyse Confirm', 'type': 'service',
            })
        self.patient = self.env['hms.patient'].create({
            'name': 'Patient Confirm', 'nephrology_care': True,
        })
        # Procédure passée pour que le patient ait un schedule
        self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'date': '2026-01-05 07:00:00',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })

    def test_confirm_creates_procedures_and_appointments(self):
        """action_confirm crée les procédures et RDVs pour toutes les lignes OK"""
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),   # Lundi
            'date_end': date(2026, 6, 5),     # Vendredi
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient.id)],
        })
        result = generator.action_open_validator()
        validator_id = result['res_id']
        validator = self.env['nephrology.session.validator'].browse(validator_id)

        proc_before = self.env['acs.patient.procedure'].search_count([
            ('patient_id', '=', self.patient.id),
        ])
        validator.action_confirm()
        proc_after = self.env['acs.patient.procedure'].search_count([
            ('patient_id', '=', self.patient.id),
        ])
        # 3 séances LMV du 1 au 5 juin (Lu=1, Me=3, Ve=5)
        self.assertEqual(proc_after - proc_before, 3)

        # Vérifier que les RDVs ont aussi été créés
        appts = self.env['hms.appointment'].search([
            ('patient_id', '=', self.patient.id),
            ('date', '>=', '2026-06-01 00:00:00'),
        ])
        self.assertEqual(len(appts), 3)

    def test_red_lines_excluded_from_confirm(self):
        """Les lignes error_duplicate ne génèrent aucune procédure"""
        # Patient a déjà une procédure sur la période → error_duplicate
        self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'date': '2026-06-03 07:00:00',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 5),
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient.id)],
        })
        result = generator.action_open_validator()
        validator = self.env['nephrology.session.validator'].browse(result['res_id'])

        line = generator.line_ids[0]
        self.assertEqual(line.conflict_status, 'error_duplicate')

        proc_before = self.env['acs.patient.procedure'].search_count([
            ('patient_id', '=', self.patient.id),
            ('date', '>=', '2026-06-01 00:00:00'),
        ])
        validator.action_confirm()
        proc_after = self.env['acs.patient.procedure'].search_count([
            ('patient_id', '=', self.patient.id),
            ('date', '>=', '2026-06-01 00:00:00'),
        ])
        self.assertEqual(proc_after - proc_before, 0)  # Rien créé
