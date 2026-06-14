# acs_hms_nephrology_dashboard/models/doctor_dashboard.py
# -*- coding: utf-8 -*-
from odoo import api, fields, models
from datetime import datetime, timedelta


class ACSDialysisStationDashboard(models.Model):
    _inherit = 'acs.dialysis.station'

    @api.model
    def get_dashboard_data(self):
        """Retourne postes, KPIs du jour et alertes actives pour le dashboard médecin."""
        now = fields.Datetime.now()
        today = now.date()
        day_start = datetime.combine(today, datetime.min.time())
        day_end = datetime.combine(today + timedelta(days=1), datetime.min.time())

        Procedure = self.env['acs.patient.procedure']
        stations = self.search([('active', '=', True)], order='name')

        station_list = []
        total_sessions = running = done = 0
        ktv_vals = []
        complication_total = 0
        all_alerts = []

        station_ids = stations.mapped('id')
        all_today_procs = Procedure.search([
            ('nephrology_schedule_ids.station_id', 'in', station_ids),
            ('date', '>=', fields.Datetime.to_string(day_start)),
            ('date', '<', fields.Datetime.to_string(day_end)),
            ('department_id.department_type', '=', 'nephrology'),
        ], order='date asc')

        # Map station_id → first procedure (asc date = earliest)
        # sid guard: schedules with no station_id set return False — skip them.
        # Inactive-station sids simply won't be looked up in the stations loop below.
        proc_by_station = {}
        for p in all_today_procs:
            for sched in p.nephrology_schedule_ids:
                sid = sched.station_id.id
                if sid and sid not in proc_by_station:
                    proc_by_station[sid] = p

        for station in stations:
            proc = proc_by_station.get(station.id)

            proc_dict = None
            if proc:
                total_sessions += 1
                if proc.state == 'running':
                    running += 1
                elif proc.state == 'done':
                    done += 1
                    if proc.ktv_calculated > 0:
                        ktv_vals.append(proc.ktv_calculated)
                complication_total += proc.complication_count

                # Alertes
                alert_level, alert_label = self._get_alert(proc, now)

                # Âge patient
                patient = proc.patient_id
                age = 0
                if patient.birthday:
                    age = (today - patient.birthday).days // 365

                # Durée prévue (fallback 4h si date_stop absent)
                expected = 4.0
                if proc.date_stop and proc.date:
                    expected = (proc.date_stop - proc.date).total_seconds() / 3600

                vascular = proc.type_of_vascular_access.name if proc.type_of_vascular_access else ''

                proc_dict = {
                    'id': proc.id,
                    'patient_id': [patient.id, patient.name],
                    'state': proc.state,
                    'date': fields.Datetime.to_string(proc.date) if proc.date else False,
                    'date_stop': fields.Datetime.to_string(proc.date_stop) if proc.date_stop else False,
                    'actual_duration': proc.actual_duration,
                    'expected_duration': expected,
                    'actual_uf': proc.actual_uf,
                    'ktv_calculated': proc.ktv_calculated,
                    'ktv_status': proc.ktv_status or False,
                    'has_active_hypotension': proc.has_active_hypotension,
                    'complication_count': proc.complication_count,
                    'pre_dialysis_bp': proc.pre_dialysis_bp or '',
                    'age': age,
                    'vascular_access': vascular,
                    'alert_level': alert_level,
                    'alert_label': alert_label,
                }

                if alert_level:
                    all_alerts.append({
                        'level': alert_level,
                        'station_name': station.name,
                        'patient_name': patient.name,
                        'procedure_id': proc.id,
                        'label': alert_label,
                    })

            station_list.append({
                'id': station.id,
                'name': station.name,
                'room': station.room or '',
                'station_type': station.station_type,
                'procedure': proc_dict,
            })

        # Trier alertes : critiques d'abord
        all_alerts.sort(key=lambda a: 0 if a['level'] == 'critical' else 1)

        occupied = running + done
        total_stations = len(stations)
        occupation_rate = round(occupied / total_stations * 100) if total_stations else 0
        avg_ktv = round(sum(ktv_vals) / len(ktv_vals), 2) if ktv_vals else 0.0
        critical = sum(1 for a in all_alerts if a['level'] == 'critical')
        warning = sum(1 for a in all_alerts if a['level'] == 'warning')

        return {
            'stations': station_list,
            'kpis': {
                'total_sessions': total_sessions,
                'running_sessions': running,
                'done_sessions': done,
                'occupation_rate': occupation_rate,
                'avg_ktv': avg_ktv,
                'complication_count': complication_total,
                'critical_alerts': critical,
                'warning_alerts': warning,
            },
            'alerts': all_alerts,
        }

    def _get_alert(self, proc, now):
        """Retourne (level, label) ou (None, None) pour une procédure."""
        if proc.has_active_hypotension:
            return 'critical', 'Hypotension'
        for c in proc.complication_ids:
            if c.resolution == 'no':
                if c.complication_type == 'early_stop':
                    return 'critical', 'Arrêt prématuré'
                return 'critical', 'Complication non résolue'
        if proc.ktv_status == 'insufficient' and proc.state == 'done':
            return 'warning', 'KT/V insuffisant'
        if proc.state == 'scheduled' and proc.date:
            delay = (now - proc.date).total_seconds() / 60
            if delay > 30:
                return 'warning', f'Séance en retard ({int(delay)} min)'
        return None, None

    @api.model
    def get_patient_panel_data(self, procedure_id):
        """Retourne résumé patient pour le slide panel (séance en cours + dernière + infos patient)."""
        Procedure = self.env['acs.patient.procedure']
        proc = Procedure.browse(procedure_id)
        if not proc.exists():
            return {}
        if proc.department_id.department_type != 'nephrology':
            return {}

        patient = proc.patient_id
        today = fields.Datetime.now().date()

        age = 0
        if patient.birthday:
            age = (today - patient.birthday).days // 365

        # Première séance néphro du patient (pour "dialyse depuis")
        first = Procedure.search([
            ('patient_id', '=', patient.id),
            ('department_id.department_type', '=', 'nephrology'),
        ], order='date asc', limit=1)
        dialysis_since = ''
        if first and first.date:
            dialysis_since = fields.Datetime.to_string(first.date)[:10]

        # Dernière séance done ≠ cette séance
        prev = Procedure.search([
            ('patient_id', '=', patient.id),
            ('state', '=', 'done'),
            ('department_id.department_type', '=', 'nephrology'),
            ('id', '!=', proc.id),
        ], order='date desc', limit=1)

        prev_dict = None
        if prev:
            prev_dict = {
                'date': fields.Datetime.to_string(prev.date)[:10] if prev.date else '',
                'actual_duration': prev.actual_duration,
                'actual_uf': prev.actual_uf,
                'ktv_calculated': prev.ktv_calculated,
                'ktv_status': prev.ktv_status or False,
                'global_tolerance': prev.global_tolerance or False,
            }

        # Complications actives (non résolues)
        active_comp = proc.complication_ids.filtered(lambda c: c.resolution == 'no')
        comp_selection = dict(
            self.env['acs.dialysis.complication']._fields['complication_type'].selection
        )
        complications = [{
            'type': c.complication_type,
            'label': comp_selection.get(c.complication_type, c.complication_type),
            'bp': c.bp_at_occurrence or '',
        } for c in active_comp]

        expected = 4.0
        if proc.date_stop and proc.date:
            expected = (proc.date_stop - proc.date).total_seconds() / 3600

        vascular = proc.type_of_vascular_access.name if proc.type_of_vascular_access else ''

        return {
            'procedure': {
                'id': proc.id,
                'state': proc.state,
                'actual_duration': proc.actual_duration,
                'expected_duration': expected,
                'actual_uf': proc.actual_uf,
                'ktv_calculated': proc.ktv_calculated,
                'ktv_status': proc.ktv_status or False,
                'pre_dialysis_bp': proc.pre_dialysis_bp or '',
                'has_active_hypotension': proc.has_active_hypotension,
                'active_complications': complications,
                'dry_weight': proc.dry_weight,
            },
            'patient': {
                'id': patient.id,
                'name': patient.name,
                'age': age,
                'blood_group': patient.blood_group or '',
                'vascular_access': vascular,
                'dialysis_since': dialysis_since,
                'treatment': proc.interdialysis_medication or '',
            },
            'previous_session': prev_dict,
        }

    @api.model
    def get_ktv_chart_data(self):
        """KT/V moyen par jour sur les 30 derniers jours (séances done avec ktv > 0)."""
        today = fields.Datetime.now().date()
        since = datetime.combine(today - timedelta(days=30), datetime.min.time())

        procs = self.env['acs.patient.procedure'].search([
            ('state', '=', 'done'),
            ('department_id.department_type', '=', 'nephrology'),
            ('ktv_calculated', '>', 0),
            ('date', '>=', fields.Datetime.to_string(since)),
        ])

        daily = {}
        for p in procs:
            if p.date:
                day = p.date.date().isoformat()
                daily.setdefault(day, []).append(p.ktv_calculated)

        sorted_days = sorted(daily.keys())
        return {
            'labels': sorted_days,
            'values': [round(sum(daily[d]) / len(daily[d]), 2) for d in sorted_days],
        }

    @api.model
    def get_kpi_stats_data(self):
        """KPIs mensuels pour l'onglet KPIs du dashboard médecin.
        Périmètre : group_hms_manager → tous ; médecin standard → ses patients."""
        import calendar as _cal

        today = fields.Datetime.now().date()

        # Bornes du mois courant
        month_start = today.replace(day=1)
        last_day = _cal.monthrange(today.year, today.month)[1]
        month_start_dt = datetime.combine(month_start, datetime.min.time())
        month_end_dt = datetime.combine(
            today.replace(day=last_day) + timedelta(days=1), datetime.min.time())

        # Mois précédent (pour delta séances)
        if month_start.month == 1:
            prev_start = month_start.replace(year=month_start.year - 1, month=12)
        else:
            prev_start = month_start.replace(month=month_start.month - 1)
        prev_start_dt = datetime.combine(prev_start, datetime.min.time())

        # Périmètre patients
        is_manager = self.env.user.has_group('acs_hms_base.group_hms_manager')
        patient_domain = [('nephrology_care', '=', True), ('active', '=', True)]
        if not is_manager:
            physician = self.env['hms.physician'].search(
                [('user_id', '=', self.env.uid)], limit=1)
            if not physician:
                return self._kpi_empty_result(is_manager, today)
            patient_domain += [('primary_physician_id', '=', physician.id)]

        patients = self.env['hms.patient'].sudo().search(patient_domain)
        if not patients:
            return self._kpi_empty_result(is_manager, today)

        patient_ids = patients.ids
        Procedure = self.env['acs.patient.procedure'].sudo()
        dt = fields.Datetime.to_string

        # Séances done ce mois
        sessions = Procedure.search([
            ('patient_id', 'in', patient_ids),
            ('state', '=', 'done'),
            ('department_id.department_type', '=', 'nephrology'),
            ('date', '>=', dt(month_start_dt)),
            ('date', '<', dt(month_end_dt)),
        ])
        sessions_count = len(sessions)

        # Delta vs mois précédent
        prev_count = Procedure.search_count([
            ('patient_id', 'in', patient_ids),
            ('state', '=', 'done'),
            ('department_id.department_type', '=', 'nephrology'),
            ('date', '>=', dt(prev_start_dt)),
            ('date', '<', dt(month_start_dt)),
        ])
        sessions_delta = sessions_count - prev_count

        # % Hb dans cible — dernier bilan par patient avec hemoglobin > 0
        Bilan = self.env['acs.nephro.bilan'].sudo()
        hb_ok = hb_total = 0
        for patient in patients:
            last = Bilan.search([
                ('patient_id', '=', patient.id),
                ('hemoglobin', '>', 0),
            ], order='exam_date desc', limit=1)
            if last:
                hb_total += 1
                if last.hemoglobin_status == 'ok':
                    hb_ok += 1
        hb_pct = round(hb_ok / hb_total * 100, 1) if hb_total else 0.0

        # Taux complications
        comp_total = sum(p.complication_count for p in sessions)
        comp_rate = round(comp_total / sessions_count * 100, 1) if sessions_count else 0.0

        # % KT/V adéquat
        ktv_sessions = sessions.filtered(lambda p: p.ktv_calculated > 0)
        ktv_ok = ktv_sessions.filtered(lambda p: p.ktv_status == 'adequate')
        ktv_pct = round(len(ktv_ok) / len(ktv_sessions) * 100, 1) if ktv_sessions else 0.0

        _MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                   'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
        return {
            'sessions_count': sessions_count,
            'sessions_delta': sessions_delta,
            'hb_in_range_pct': hb_pct,
            'hb_in_range_detail': f'{hb_ok}/{hb_total}',
            'complication_rate': comp_rate,
            'complication_detail': f'{comp_total}/{sessions_count}',
            'ktv_adequate_pct': ktv_pct,
            'ktv_adequate_detail': f'{len(ktv_ok)}/{len(ktv_sessions)}',
            'period_label': f'{_MONTHS[today.month - 1]} {today.year}',
            'is_manager': is_manager,
        }

    @api.model
    def _kpi_empty_result(self, is_manager, today):
        _MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                   'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
        return {
            'sessions_count': 0, 'sessions_delta': 0,
            'hb_in_range_pct': 0.0, 'hb_in_range_detail': '0/0',
            'complication_rate': 0.0, 'complication_detail': '0/0',
            'ktv_adequate_pct': 0.0, 'ktv_adequate_detail': '0/0',
            'period_label': f'{_MONTHS[today.month - 1]} {today.year}',
            'is_manager': is_manager,
        }
