# -*- coding: utf-8 -*-
# Part of AlmightyCS. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models,_
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT, DEFAULT_SERVER_DATETIME_FORMAT


class ACSVascularAccess(models.Model):
    _name = 'acs.vascular.access'
    _description = "Vascular Access"

    name = fields.Char(string="Name", required=True)
    code = fields.Char(string="Code")
    description = fields.Char(string="Description")


class ACSDialyzer(models.Model):
    _name = 'acs.dialyzer'
    _description = "Dialyzer"

    name = fields.Char(string="Name", required=True)
    code = fields.Char(string="Code")
    description = fields.Char(string="Description")


class ACSDialysate(models.Model):
    _name = 'acs.dialysate'
    _description = "Dialysate"

    name = fields.Char(string="Name", required=True)
    code = fields.Char(string="Code")
    description = fields.Char(string="Description")


class ACSRace(models.Model):
    _name = 'acs.race'
    _description = "Race"

    name = fields.Char(string="Name", required=True)
    code = fields.Char(string="Code")
    description = fields.Char(string="Description")


class ACSNephrologySchedule(models.Model):
    _name = 'acs.nephrology.schedule'
    _description = "Nephrology Schedule"

    name = fields.Char(string="Name", required=True)
    code = fields.Char(string="Code")
    monday = fields.Boolean(string="Lundi", default=False)
    tuesday = fields.Boolean(string="Mardi", default=False)
    wednesday = fields.Boolean(string="Mercredi", default=False)
    thursday = fields.Boolean(string="Jeudi", default=False)
    friday = fields.Boolean(string="Vendredi", default=False)
    saturday = fields.Boolean(string="Samedi", default=False)
    sunday = fields.Boolean(string="Dimanche", default=False)
    start_time = fields.Float(string="Heure de début", help="Heure en format 24h (ex: 7.0 pour 7h, 13.5 pour 13h30)")
    end_time = fields.Float(string="Heure de fin", help="Heure en format 24h (ex: 11.0 pour 11h, 17.0 pour 17h)")

    def get_weekdays(self):
        """Retourne la liste des jours de la semaine actifs (0=Lundi, 6=Dimanche)"""
        self.ensure_one()
        weekdays = []
        if self.monday:
            weekdays.append(0)
        if self.tuesday:
            weekdays.append(1)
        if self.wednesday:
            weekdays.append(2)
        if self.thursday:
            weekdays.append(3)
        if self.friday:
            weekdays.append(4)
        if self.saturday:
            weekdays.append(5)
        if self.sunday:
            weekdays.append(6)
        return weekdays


class ACSDialysisStation(models.Model):
    _name = 'acs.dialysis.station'
    _description = 'Poste de Dialyse'
    _order = 'name'

    name = fields.Char(string='Nom / Numéro', required=True,
                       help="Ex: Poste 3 - Salle B")
    room = fields.Char(string='Salle / Secteur')
    station_type = fields.Selection([
        ('standard', 'Standard'),
        ('isolation', 'Isolement (HBs+, VHC+)'),
    ], string='Type', required=True, default='standard')
    active = fields.Boolean(string='Actif', default=True)
    equipment_model = fields.Char(string='Modèle du générateur',
                                   help="Ex: Fresenius 5008S")
    notes = fields.Text(string='Notes techniques')
