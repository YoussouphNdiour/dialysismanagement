# acs_hms_nephrology_dashboard/models/dialysis_waitlist.py
# -*- coding: utf-8 -*-
import logging
from odoo import api, fields, models, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class ACSDialysisWaitlist(models.Model):
    _name = 'acs.dialysis.waitlist'
    _description = 'Liste d\'attente — dialyse'
    _order = 'request_date asc'

    patient_id = fields.Many2one(
        'hms.patient', string='Patient', required=True, index=True,
    )
    schedule_id = fields.Many2one(
        'acs.nephrology.schedule', string='Créneau souhaité', required=True,
    )
    request_date = fields.Date(
        string='Date de demande', required=True, default=fields.Date.today,
    )
    state = fields.Selection([
        ('waiting',   'En attente'),
        ('notified',  'Notifié'),
        ('fulfilled', 'Satisfait'),
        ('cancelled', 'Annulé'),
    ], string='Statut', default='waiting', tracking=True)
    whatsapp_sent = fields.Boolean(default=False)
    notes = fields.Text(string='Notes')

    def action_notify_manually(self):
        """Envoie la notification WhatsApp au patient et passe en 'notified'."""
        self.ensure_one()
        patient = self.patient_id
        phone = patient.phone or patient.mobile
        if not phone:
            raise UserError(_(
                "Le patient %s n'a pas de numéro de téléphone. "
                "Veuillez le renseigner avant d'envoyer la notification."
            ) % patient.name)

        # local import to avoid circular dependency at module load time
        from .dialysis_absence import ACSDialysisAbsence
        formatted_phone = ACSDialysisAbsence._format_phone(phone)
        if not formatted_phone:
            raise UserError(_(
                "Le numéro '%s' n'est pas dans un format reconnu (attendu : 9 chiffres Sénégal ou E.164)."
            ) % phone)

        schedule = self.schedule_id
        days = [
            ('Lundi'     if schedule.monday    else ''),
            ('Mardi'     if schedule.tuesday   else ''),
            ('Mercredi'  if schedule.wednesday else ''),
            ('Jeudi'     if schedule.thursday  else ''),
            ('Vendredi'  if schedule.friday    else ''),
            ('Samedi'    if schedule.saturday  else ''),
            ('Dimanche'  if schedule.sunday    else ''),
        ]
        days_str = ', '.join(d for d in days if d) or schedule.name

        message = _(
            "Bonjour %(name)s,\n\n"
            "Un créneau vient de se libérer sur le planning %(schedule)s (%(days)s).\n"
            "Contactez la clinique pour confirmer votre place.\n\n"
            "Clinique As-Shafi"
        ) % {
            'name': (patient.name or '').split()[0] if patient.name else '',
            'schedule': schedule.name,
            'days': days_str,
        }

        self.env['whatsapp.message'].create({
            'recipient_phone': formatted_phone,
            'message_text': message,
            'message_type': 'text',
            'model': 'acs.dialysis.waitlist',
            'res_id': self.id,
        }).action_send_message()

        self.write({'state': 'notified', 'whatsapp_sent': True})
