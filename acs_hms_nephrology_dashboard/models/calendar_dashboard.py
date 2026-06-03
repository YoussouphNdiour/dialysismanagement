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
        """Stub — retourne structure vide."""
        return {'stations': [], 'occupation_rate': 0, 'total_stations': 0, 'occupied_count': 0}

    @api.model
    def get_calendar_week_data(self, date_str):
        """Stub — retourne structure vide."""
        return {'week_dates': [], 'patients': []}

    @api.model
    def get_calendar_month_data(self, year, month):
        """Stub — retourne structure vide."""
        return {'days': [], 'total_stations': 0, 'month_avg_occupation': 0}
