# acs_hms_nephrology_dashboard/models/dialysis_reschedule.py
# -*- coding: utf-8 -*-
from datetime import datetime, timedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError


class DialysisSessionReschedule(models.TransientModel):
    _name = 'dialysis.session.reschedule'
    _description = 'Reporter une séance de dialyse'

    procedure_id = fields.Many2one(
        'acs.patient.procedure', string='Séance', required=True, ondelete='cascade',
    )
    original_date = fields.Date(
        string='Date actuelle', compute='_compute_original_date', store=False,
    )
    new_date = fields.Date(string='Nouvelle date', required=True)
    station_id = fields.Many2one(
        'acs.dialysis.station', string='Poste',
        compute='_compute_station_id', store=False, readonly=False,
    )
    slots_available = fields.Integer(
        string='Places disponibles', compute='_compute_slots_available', store=False,
    )
    add_to_waitlist = fields.Boolean(
        string="Si poste saturé, mettre en liste d'attente", default=False,
    )

    @api.depends('procedure_id')
    def _compute_original_date(self):
        for rec in self:
            if rec.procedure_id and rec.procedure_id.date:
                rec.original_date = fields.Datetime.from_string(rec.procedure_id.date).date()
            else:
                rec.original_date = False

    @api.depends('procedure_id')
    def _compute_station_id(self):
        for rec in self:
            if rec.procedure_id and rec.procedure_id.nephrology_schedule_ids:
                rec.station_id = rec.procedure_id.nephrology_schedule_ids[0].station_id
            else:
                rec.station_id = False

    @api.depends('new_date', 'station_id')
    def _compute_slots_available(self):
        Procedure = self.env['acs.patient.procedure']
        for rec in self:
            if not rec.new_date or not rec.station_id:
                rec.slots_available = 0
                continue
            # Récupère le planning lié à ce poste
            schedule = self.env['acs.nephrology.schedule'].search([
                ('station_id', '=', rec.station_id.id),
            ], limit=1)
            max_p = schedule.max_patients if schedule else 0
            if max_p == 0:
                rec.slots_available = 999
                continue
            day_start = fields.Datetime.to_string(
                datetime.combine(rec.new_date, datetime.min.time())
            )
            day_end = fields.Datetime.to_string(
                datetime.combine(rec.new_date, datetime.max.time().replace(microsecond=0))
            )
            occupied = Procedure.search_count([
                ('nephrology_schedule_ids.station_id', '=', rec.station_id.id),
                ('date', '>=', day_start),
                ('date', '<=', day_end),
                ('state', 'in', ['scheduled', 'running']),
                ('id', '!=', rec.procedure_id.id),
            ])
            rec.slots_available = max(0, max_p - occupied)

    def action_confirm(self):
        """Confirme le report ou inscrit en liste d'attente si saturé."""
        self.ensure_one()
        proc = self.procedure_id

        if self.slots_available > 0:
            # Report effectif — décale date de début, date_stop = début + 4h
            original_date = proc.date
            new_start = datetime.combine(self.new_date, datetime.min.time()).replace(hour=8)
            new_stop = new_start + timedelta(hours=4)
            new_dt = fields.Datetime.to_string(new_start)
            new_dt_stop = fields.Datetime.to_string(new_stop)
            proc.write({'date': new_dt, 'date_stop': new_dt_stop})
            if proc.appointment_id:
                proc.appointment_id.write({'date': new_dt})
            orig_str = (
                fields.Datetime.from_string(original_date).strftime('%d/%m/%Y')
                if original_date else '?'
            )
            proc.message_post(
                body=_('Séance reportée du %s au %s.') % (
                    orig_str,
                    self.new_date.strftime('%d/%m/%Y'),
                )
            )
            return {'type': 'ir.actions.act_window_close'}

        # Poste saturé
        if not self.add_to_waitlist:
            raise UserError(_(
                'Poste saturé pour le %s. Choisissez une autre date ou activez '
                '"Mettre en liste d\'attente".'
            ) % self.new_date.strftime('%d/%m/%Y'))

        # Créer entrée liste d'attente
        schedule = self.env['acs.nephrology.schedule'].search([
            ('station_id', '=', self.station_id.id),
        ], limit=1)
        self.env['acs.dialysis.waitlist'].create({
            'patient_id': proc.patient_id.id,
            'schedule_id': schedule.id if schedule else False,
            'request_date': fields.Date.today(),
        })
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Poste saturé'),
                'message': _('Le patient a été ajouté en liste d\'attente pour ce créneau.'),
                'type': 'warning',
                'sticky': False,
            },
        }
