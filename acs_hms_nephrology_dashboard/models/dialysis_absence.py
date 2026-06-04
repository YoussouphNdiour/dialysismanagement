# acs_hms_nephrology_dashboard/models/dialysis_absence.py
# -*- coding: utf-8 -*-
import logging
from datetime import date, timedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class ACSDialysisAbsence(models.Model):
    _name = 'acs.dialysis.absence'
    _description = 'Absence patient — dialyse'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'start_date desc'

    patient_id = fields.Many2one(
        'hms.patient', string='Patient', required=True, index=True,
        tracking=True,
    )
    start_date = fields.Date(string='Début', required=True, tracking=True)
    end_date = fields.Date(string='Fin', required=True, tracking=True)
    reason = fields.Selection([
        ('hospitalisation', 'Hospitalisation'),
        ('voyage',          'Voyage'),
        ('refus',           'Refus'),
        ('deces',           'Décès'),
        ('autre',           'Autre'),
    ], string='Motif', required=True, tracking=True)
    state = fields.Selection([
        ('draft',     'Brouillon'),
        ('confirmed', 'Confirmée'),
        ('closed',    'Clôturée'),
    ], string='Statut', default='draft', tracking=True)
    notes = fields.Text(string='Notes')
    procedure_ids = fields.One2many(
        'acs.patient.procedure', 'absence_id',
        string='Séances concernées',
    )
    whatsapp_reprise_sent = fields.Boolean(
        default=False, copy=False,
        help="Anti-doublon cron WhatsApp reprise",
    )

    _sql_constraints = [
        ('date_order_check', 'CHECK(end_date >= start_date)',
         'La date de fin doit être postérieure ou égale à la date de début.'),
    ]

    def action_confirm(self):
        """Passe l'absence en Confirmée et marque les séances concernées en Absent."""
        self.ensure_one()
        procedures = self.env['acs.patient.procedure'].search([
            ('patient_id', '=', self.patient_id.id),
            ('date', '>=', fields.Datetime.to_string(
                fields.Datetime.from_string(f'{self.start_date} 00:00:00')
            )),
            ('date', '<=', fields.Datetime.to_string(
                fields.Datetime.from_string(f'{self.end_date} 23:59:59')
            )),
            ('state', '=', 'scheduled'),
        ])
        procedures.write({'state': 'absent', 'absence_id': self.id})
        self.state = 'confirmed'
        count = len(procedures)
        self.message_post(
            body=_('%d séance(s) passée(s) en "Absence justifiée".') % count
        )
        # Notifier la liste d'attente pour les créneaux libérés
        if procedures:
            procedures._check_waitlist_notification()

    def action_cancel(self):
        """Repasse les séances en 'scheduled' et l'absence en brouillon."""
        self.ensure_one()
        if self.state not in ('draft', 'confirmed'):
            raise UserError(_('Seules les absences en brouillon ou confirmées peuvent être annulées.'))
        self.procedure_ids.filtered(lambda p: p.state == 'absent').write({
            'state': 'scheduled',
            'absence_id': False,
        })
        self.state = 'draft'

    def action_close_and_notify(self):
        """Clôture l'absence et envoie le WhatsApp de reprise immédiatement."""
        self.ensure_one()
        self._send_whatsapp_reprise()
        self.write({'state': 'closed', 'whatsapp_reprise_sent': True})

    def _send_whatsapp_reprise(self):
        """Envoie un message WhatsApp de reprise au patient."""
        self.ensure_one()
        patient = self.patient_id
        phone = patient.phone or patient.mobile
        if not phone:
            _logger.warning(
                "Absence %s: patient %s sans téléphone, WhatsApp reprise non envoyé.",
                self.id, patient.name,
            )
            return

        formatted_phone = self._format_phone(phone)
        if not formatted_phone:
            _logger.warning(
                "Absence %s: numéro '%s' non formatable.", self.id, phone
            )
            return

        next_proc = self.env['acs.patient.procedure'].search([
            ('patient_id', '=', patient.id),
            ('state', '=', 'scheduled'),
            ('date', '>', fields.Datetime.now()),
        ], order='date asc', limit=1)

        if next_proc:
            next_date = fields.Datetime.from_string(next_proc.date)
            date_str = next_date.strftime('%d/%m/%Y à %H:%M')
            message = _(
                "Bonjour %(name)s,\n\n"
                "Votre période d'absence se termine bientôt.\n"
                "Votre prochaine séance de dialyse est prévue le %(date)s.\n\n"
                "À bientôt,\nClinique As-Shafi"
            ) % {'name': patient.name.split()[0], 'date': date_str}
        else:
            message = _(
                "Bonjour %(name)s,\n\n"
                "Votre période d'absence se termine bientôt.\n"
                "Veuillez contacter la clinique pour planifier votre reprise.\n\n"
                "Clinique As-Shafi"
            ) % {'name': patient.name.split()[0]}

        self.env['whatsapp.message'].create({
            'recipient_phone': formatted_phone,
            'message_text': message,
            'message_type': 'text',
            'model': 'acs.dialysis.absence',
            'res_id': self.id,
        }).action_send_message()

    @api.model
    def _cron_send_reprise_whatsapp(self):
        """Cron quotidien : envoie les WhatsApp de reprise pour les absences se terminant demain."""
        tomorrow = date.today() + timedelta(days=1)
        absences = self.search([
            ('state', '=', 'confirmed'),
            ('end_date', '=', tomorrow),
            ('whatsapp_reprise_sent', '=', False),
        ])
        for absence in absences:
            try:
                absence._send_whatsapp_reprise()
                absence.whatsapp_reprise_sent = True
            except Exception as e:
                _logger.error(
                    "Cron reprise WhatsApp — échec pour absence %s: %s",
                    absence.id, str(e), exc_info=True,
                )

    @staticmethod
    def _format_phone(phone):
        """Formate le numéro en E.164 (logique Sénégal identique à appointment_reminder.py)."""
        if not phone:
            return None
        digits = ''.join(c for c in phone if c.isdigit())
        if len(digits) == 9:
            return f'+221{digits}'
        if len(digits) == 12 and digits.startswith('221'):
            return f'+{digits}'
        if phone.startswith('+'):
            return phone
        return None


class ACSPatientProcedureAbsence(models.Model):
    """Extension de acs.patient.procedure : statut 'absent' + lien absence."""
    _inherit = 'acs.patient.procedure'

    state = fields.Selection(
        selection_add=[('absent', 'Absence justifiée')],
        ondelete={'absent': 'set default'},
    )
    absence_id = fields.Many2one(
        'acs.dialysis.absence',
        string='Absence liée',
        ondelete='set null',
        index=True,
    )

    def _check_waitlist_notification(self):
        """Pour chaque créneau libéré, notifie le premier patient en attente."""
        if 'acs.dialysis.waitlist' not in self.env:
            return
        schedule_ids = set()
        for proc in self:
            for sched in proc.nephrology_schedule_ids:
                schedule_ids.add(sched.id)
        for schedule_id in schedule_ids:
            waiting = self.env['acs.dialysis.waitlist'].search([
                ('schedule_id', '=', schedule_id),
                ('state', '=', 'waiting'),
            ], order='request_date asc', limit=1)
            if waiting:
                waiting.action_notify_manually()
