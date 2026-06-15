# -*- coding: utf-8 -*-
from datetime import datetime, time
from odoo import api, fields, models


class ACSDialysisStationSecretaryMixin(models.Model):
    """§4.5 — Widget résumé du jour pour la secrétaire.

    Ajout de la méthode get_secretary_day_summary() sur acs.dialysis.station
    qui renvoie un dict JSON consommé par SecretaryDayWidget.js.
    """
    _inherit = 'acs.dialysis.station'

    @api.model
    def get_secretary_day_summary(self):
        """Résumé du jour pour le widget secrétaire OWL.

        Retourne :
        {
            patients_morning   : int  — séances dont heure_début < 12h
            patients_afternoon : int  — séances dont heure_début >= 12h
            stations_occupied  : int  — postes avec séance en cours (running)
            total_stations     : int  — total postes actifs
            total_sessions     : int  — total séances planifiées aujourd'hui
            confirmed          : int  — état scheduled (non démarré)
            running            : int  — état running
            done               : int  — état done
            absent             : int  — absences du jour (acs.dialysis.absence)
            rescheduled        : int  — séances reportées (cancel + absence liée)
            pending            : int  — scheduled sans confirmation d'arrivée
            overloaded_stations: list — [{id, name}] postes au-dessus du max
        }
        """
        today = fields.Date.today()
        today_start = datetime.combine(today, time.min)
        today_end = datetime.combine(today, time.max)

        Procedure = self.env['acs.patient.procedure'].sudo()
        Station = self.env['acs.dialysis.station'].sudo()

        # Toutes les séances du jour (dialyse uniquement)
        today_procs = Procedure.search([
            ('date', '>=', fields.Datetime.to_string(today_start)),
            ('date', '<=', fields.Datetime.to_string(today_end)),
            ('hemodialysis', '=', True),
        ])

        # Matin / après-midi selon l'heure de début (start_time du planning)
        morning_count = 0
        afternoon_count = 0
        for proc in today_procs:
            schedule = proc.nephrology_schedule_ids[:1]
            start_h = schedule.start_time if schedule else 0.0
            if start_h < 12.0:
                morning_count += 1
            else:
                afternoon_count += 1

        # Répartition par état
        state_counts = {s: 0 for s in ['scheduled', 'running', 'done', 'cancel']}
        for proc in today_procs:
            state = proc.state
            if state in state_counts:
                state_counts[state] += 1

        # Absences du jour
        Absence = self.env['acs.dialysis.absence'].sudo()
        absent_count = Absence.search_count([
            ('start_date', '<=', today),
            ('end_date', '>=', today),
            ('state', 'not in', ['cancelled']),
        ])

        # Séances reportées = état cancel ET une absence liée
        rescheduled_count = Procedure.search_count([
            ('date', '>=', fields.Datetime.to_string(today_start)),
            ('date', '<=', fields.Datetime.to_string(today_end)),
            ('hemodialysis', '=', True),
            ('state', '=', 'cancel'),
            ('absence_id', '!=', False),
        ]) if hasattr(Procedure, 'absence_id') else 0

        # Postes actifs
        all_stations = Station.search([('active', '=', True)])
        total_stations = len(all_stations)

        # Postes occupés = au moins une séance "running" aujourd'hui
        running_procs = today_procs.filtered(lambda p: p.state == 'running')
        occupied_station_ids = set(
            running_procs.mapped('dialysis_station_id').ids
        )
        stations_occupied = len(occupied_station_ids)

        # Postes en surcharge (max_patients dépassé, si paramétré)
        overloaded = []
        for station in all_stations:
            if not station.max_patients:
                continue
            station_today = today_procs.filtered(
                lambda p: p.dialysis_station_id.id == station.id
                and p.state not in ['cancel']
            )
            if len(station_today) > station.max_patients:
                overloaded.append({'id': station.id, 'name': station.name})

        # Séances "pending" = scheduled sans arrivée confirmée (arrival_status absent)
        pending_count = len(today_procs.filtered(
            lambda p: p.state == 'scheduled'
            and (not hasattr(p, 'arrival_status') or not p.arrival_status)
        ))

        return {
            'patients_morning':    morning_count,
            'patients_afternoon':  afternoon_count,
            'stations_occupied':   stations_occupied,
            'total_stations':      total_stations,
            'total_sessions':      len(today_procs),
            'confirmed':           state_counts['scheduled'],
            'running':             state_counts['running'],
            'done':                state_counts['done'],
            'absent':              absent_count,
            'rescheduled':         rescheduled_count,
            'pending':             pending_count,
            'overloaded_stations': overloaded,
        }
