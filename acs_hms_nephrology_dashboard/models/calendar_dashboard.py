# acs_hms_nephrology_dashboard/models/calendar_dashboard.py
# -*- coding: utf-8 -*-
from odoo import api, fields, models
from datetime import datetime, timedelta
import calendar as cal_mod


class ACSDialysisStationCalendar(models.Model):
    _inherit = 'acs.dialysis.station'

    def _get_session_color(self, state, alert_level):
        """Retourne la couleur CSS d'une carte séance selon son état et son alerte."""
        if state == 'scheduled':
            return 'blue'
        if alert_level == 'critical':
            return 'red'
        if alert_level == 'warning':
            return 'orange'
        if state == 'running':
            return 'green'
        if state == 'done':
            return 'gray'
        return 'blue'

    @api.model
    def get_calendar_day_data(self, date_str):
        """Sessions du jour par poste actif avec couleur et alertes calculées."""
        target = datetime.strptime(date_str, '%Y-%m-%d').date()
        day_start = datetime.combine(target, datetime.min.time())
        day_end = datetime.combine(target + timedelta(days=1), datetime.min.time())
        now = fields.Datetime.now()

        Procedure = self.env['acs.patient.procedure']
        stations = self.search([('active', '=', True)], order='name')

        all_procs = Procedure.search([
            ('nephrology_schedule_ids.station_id', 'in', stations.ids),
            ('date', '>=', fields.Datetime.to_string(day_start)),
            ('date', '<', fields.Datetime.to_string(day_end)),
            ('department_id.department_type', '=', 'nephrology'),
        ], order='date asc')

        # Group by station — déduplique si même procédure liée à plusieurs créneaux du même poste
        procs_by_station = {}
        seen_per_station = {}
        for p in all_procs:
            for sched in p.nephrology_schedule_ids:
                sid = sched.station_id.id
                if sid:
                    if p.id not in seen_per_station.get(sid, set()):
                        procs_by_station.setdefault(sid, []).append(p)
                        seen_per_station.setdefault(sid, set()).add(p.id)

        station_list = []
        occupied_count = 0

        for station in stations:
            procs = procs_by_station.get(station.id, [])
            sessions = []
            for proc in procs:
                alert_level, alert_label = self._get_alert(proc, now)
                color = self._get_session_color(proc.state, alert_level)
                sessions.append({
                    'id': proc.id,
                    'patient_id': proc.patient_id.id,
                    'patient_name': proc.patient_id.name,
                    'state': proc.state,
                    'date': fields.Datetime.to_string(proc.date) if proc.date else False,
                    'date_stop': fields.Datetime.to_string(proc.date_stop) if proc.date_stop else False,
                    'color': color,
                    'alert_level': alert_level,
                    'alert_label': alert_label,
                    'ktv_calculated': proc.ktv_calculated,
                    'ktv_status': proc.ktv_status or False,
                })
            if sessions:
                occupied_count += 1
            station_list.append({
                'id': station.id,
                'name': station.name,
                'room': station.room or '',
                'station_type': station.station_type,
                'sessions': sessions,
            })

        total_stations = len(stations)
        occupation_rate = round(occupied_count / total_stations * 100) if total_stations else 0

        return {
            'stations': station_list,
            'occupation_rate': occupation_rate,
            'total_stations': total_stations,
            'occupied_count': occupied_count,
        }

    @api.model
    def get_calendar_week_data(self, date_str):
        """Sessions de la semaine contenant date_str, groupées par patient puis par jour."""
        target = datetime.strptime(date_str, '%Y-%m-%d').date()
        # Lundi de la semaine
        week_start = target - timedelta(days=target.weekday())
        week_end = week_start + timedelta(days=7)
        week_dates = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]

        day_start = datetime.combine(week_start, datetime.min.time())
        day_end = datetime.combine(week_end, datetime.min.time())
        now = fields.Datetime.now()

        Procedure = self.env['acs.patient.procedure']
        procs = Procedure.search([
            ('date', '>=', fields.Datetime.to_string(day_start)),
            ('date', '<', fields.Datetime.to_string(day_end)),
            ('department_id.department_type', '=', 'nephrology'),
        ], order='date asc')

        patients_map = {}
        for proc in procs:
            pid = proc.patient_id.id
            if pid not in patients_map:
                patients_map[pid] = {
                    'patient_id': pid,
                    'patient_name': proc.patient_id.name,
                    'sessions_by_day': {d: None for d in week_dates},
                }
            if not proc.date:
                continue
            day_key = proc.date.date().isoformat()
            if day_key not in patients_map[pid]['sessions_by_day']:
                continue
            alert_level, alert_label = self._get_alert(proc, now)
            station_name = ''
            for sched in proc.nephrology_schedule_ids:
                if sched.station_id:
                    station_name = sched.station_id.name
                    break
            patients_map[pid]['sessions_by_day'][day_key] = {
                'id': proc.id,
                'state': proc.state,
                'color': self._get_session_color(proc.state, alert_level),
                'alert_label': alert_label,
                'station_name': station_name,
                'date': fields.Datetime.to_string(proc.date),
                'date_stop': fields.Datetime.to_string(proc.date_stop) if proc.date_stop else False,
            }

        patients_list = sorted(patients_map.values(), key=lambda p: p['patient_name'])

        return {
            'week_dates': week_dates,
            'patients': patients_list,
        }

    @api.model
    def get_calendar_month_data(self, year, month):
        """Vue synthétique mensuelle : occupation par jour + compteurs alertes."""
        first_day = datetime(year, month, 1)
        days_in_month = cal_mod.monthrange(year, month)[1]
        last_day = datetime(year, month, days_in_month, 23, 59, 59)
        now = fields.Datetime.now()

        Procedure = self.env['acs.patient.procedure']
        procs = Procedure.search([
            ('date', '>=', fields.Datetime.to_string(first_day)),
            ('date', '<=', fields.Datetime.to_string(last_day)),
            ('department_id.department_type', '=', 'nephrology'),
        ])

        total_stations = self.search_count([('active', '=', True)])
        # Base théorique : 2 vacations par poste par jour
        max_per_day = max(total_stations * 2, 1)

        daily = {}
        for proc in procs:
            if not proc.date:
                continue
            day_key = proc.date.date().isoformat()
            if day_key not in daily:
                daily[day_key] = {'session_count': 0, 'critical_count': 0, 'warning_count': 0}
            daily[day_key]['session_count'] += 1
            alert_level, _ = self._get_alert(proc, now)
            if alert_level == 'critical':
                daily[day_key]['critical_count'] += 1
            elif alert_level == 'warning':
                daily[day_key]['warning_count'] += 1

        days_list = []
        occupation_rates = []
        for i in range(days_in_month):
            day = (first_day + timedelta(days=i)).date()
            day_key = day.isoformat()
            stats = daily.get(day_key, {'session_count': 0, 'critical_count': 0, 'warning_count': 0})
            rate = min(round(stats['session_count'] / max_per_day * 100), 100)
            days_list.append({
                'date': day_key,
                'session_count': stats['session_count'],
                'occupation_rate': rate,
                'critical_count': stats['critical_count'],
                'warning_count': stats['warning_count'],
            })
            if stats['session_count'] > 0:
                occupation_rates.append(rate)

        avg = round(sum(occupation_rates) / len(occupation_rates)) if occupation_rates else 0

        return {
            'days': days_list,
            'total_stations': total_stations,
            'month_avg_occupation': avg,
        }
