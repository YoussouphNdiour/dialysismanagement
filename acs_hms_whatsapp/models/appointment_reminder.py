# -*- coding: utf-8 -*-

import logging
from datetime import datetime, timedelta
from odoo import api, fields, models, _

_logger = logging.getLogger(__name__)


class HmsAppointment(models.Model):
    _inherit = 'hms.appointment'

    whatsapp_reminder_24h_sent = fields.Boolean('Rappel 24h envoyé', default=False, copy=False)
    whatsapp_reminder_12h_sent = fields.Boolean('Rappel 12h envoyé', default=False, copy=False)

    def action_send_whatsapp_reminder(self):
        """Send WhatsApp reminder manually"""
        self.ensure_one()

        if not self.patient_id:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Error'),
                    'message': _('No patient linked to this appointment.'),
                    'type': 'danger',
                }
            }

        # Get default message
        default_message = self.env['ir.config_parameter'].sudo().get_param(
            'acs_hms_whatsapp.default_appointment_reminder_message',
            'Bonjour, ceci est un rappel pour votre rendez-vous.'
        )

        # Format message with appointment details
        appointment_date = self.date.strftime('%d/%m/%Y à %H:%M') if self.date else 'N/A'
        physician_name = self.physician_id.name if self.physician_id else 'N/A'

        message_text = _(
            "%(message)s\n\n"
            "📅 Date: %(date)s\n"
            "👨‍⚕️ Médecin: %(physician)s\n"
            "🏥 Hôpital: %(hospital)s\n\n"
            "Merci de confirmer votre présence."
        ) % {
            'message': default_message,
            'date': appointment_date,
            'physician': physician_name,
            'hospital': self.company_id.name or 'N/A',
        }

        return self._send_reminder_to_patient_and_contacts(message_text)

    def _send_reminder_to_patient_and_contacts(self, message_text):
        """Send reminder to patient and emergency contacts"""
        self.ensure_one()

        sent_to = []
        failed_to = []

        # 1. Send to patient
        if self.patient_id.phone:
            try:
                formatted_phone = self._format_phone_number(self.patient_id.phone)
                if formatted_phone:
                    whatsapp_message = self.env['whatsapp.message'].create({
                        'recipient_phone': formatted_phone,
                        'message_text': message_text,
                        'message_type': 'text',
                        'model': 'hms.appointment',
                        'res_id': self.id,
                    })
                    whatsapp_message.action_send_message()
                    sent_to.append(f"{self.patient_id.name} ({formatted_phone})")
                    _logger.info(f"Appointment reminder sent to patient: {formatted_phone}")
            except Exception as e:
                failed_to.append(f"{self.patient_id.name}: {str(e)}")
                _logger.error(f"Failed to send reminder to patient: {str(e)}", exc_info=True)

        # 2. Send to emergency contacts
        if self.patient_id.emergency_contact_ids:
            for emergency_contact in self.patient_id.emergency_contact_ids:
                try:
                    formatted_phone = self._format_phone_number(emergency_contact.phone)
                    if formatted_phone:
                        # Customize message for emergency contact
                        emergency_message = _(
                            "Rappel de rendez-vous pour %(patient_name)s (%(relationship)s)\n\n%(message)s"
                        ) % {
                            'patient_name': self.patient_id.name,
                            'relationship': emergency_contact.relationship or 'Contact d\'urgence',
                            'message': message_text
                        }

                        whatsapp_message = self.env['whatsapp.message'].create({
                            'recipient_phone': formatted_phone,
                            'message_text': emergency_message,
                            'message_type': 'text',
                            'model': 'hms.appointment',
                            'res_id': self.id,
                        })
                        whatsapp_message.action_send_message()
                        sent_to.append(f"{emergency_contact.name} - {emergency_contact.relationship} ({formatted_phone})")
                        _logger.info(f"Appointment reminder sent to emergency contact: {formatted_phone}")
                except Exception as e:
                    failed_to.append(f"{emergency_contact.name}: {str(e)}")
                    _logger.error(f"Failed to send reminder to emergency contact: {str(e)}", exc_info=True)

        # Prepare result message
        if sent_to:
            success_msg = _('Rappel de rendez-vous envoyé avec succès via WhatsApp à:\n') + '\n'.join([f"• {recipient}" for recipient in sent_to])

            if failed_to:
                success_msg += _('\n\nÉchec d\'envoi à:\n') + '\n'.join([f"• {recipient}" for recipient in failed_to])

            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Succès'),
                    'message': success_msg,
                    'type': 'success' if not failed_to else 'warning',
                    'sticky': True,
                }
            }
        else:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Erreur'),
                    'message': _('Impossible d\'envoyer le rappel à aucun destinataire. Vérifiez les numéros de téléphone.'),
                    'type': 'danger',
                }
            }

    def _format_phone_number(self, phone):
        """Format phone number to E.164 format.

        :param str phone: The phone number to format
        :return: The formatted phone number or None if invalid
        :rtype: str|None
        """
        if not phone:
            return None

        # Remove all non-digit characters
        digits = ''.join(c for c in phone if c.isdigit())

        # Senegal country code is +221, phone numbers are 9 digits
        if len(digits) == 9:
            # Assume Senegal if no country code
            return f'+221{digits}'
        elif len(digits) == 12 and digits.startswith('221'):
            return f'+{digits}'
        elif phone.startswith('+'):
            return phone

        _logger.warning("Unable to format phone number: %s", phone)
        return None

    @api.model
    def _cron_send_appointment_reminders_24h(self):
        """Cron job to send appointment reminders 24 hours before"""
        _logger.info("Running cron job: Send appointment reminders 24h before")

        # Calculate the time window (24h from now, +/- 30 minutes)
        now = datetime.now()
        start_time = now + timedelta(hours=23, minutes=30)
        end_time = now + timedelta(hours=24, minutes=30)

        # Find appointments in the next 24 hours that haven't received the 24h reminder
        appointments = self.search([
            ('date', '>=', start_time),
            ('date', '<=', end_time),
            ('whatsapp_reminder_24h_sent', '=', False),
            ('state', 'not in', ['cancel', 'done']),
        ])

        _logger.info(f"Found {len(appointments)} appointments for 24h reminder")

        for appointment in appointments:
            try:
                # Get default message
                default_message = self.env['ir.config_parameter'].sudo().get_param(
                    'acs_hms_whatsapp.default_appointment_reminder_message',
                    'Bonjour, ceci est un rappel pour votre rendez-vous dans 24 heures.'
                )

                # Format message
                appointment_date = appointment.date.strftime('%d/%m/%Y à %H:%M')
                physician_name = appointment.physician_id.name if appointment.physician_id else 'N/A'

                message_text = _(
                    "%(message)s\n\n"
                    "📅 Date: %(date)s\n"
                    "👨‍⚕️ Médecin: %(physician)s\n"
                    "🏥 Hôpital: %(hospital)s\n\n"
                    "Merci de confirmer votre présence."
                ) % {
                    'message': default_message,
                    'date': appointment_date,
                    'physician': physician_name,
                    'hospital': appointment.company_id.name or 'N/A',
                }

                # Send reminder
                appointment._send_reminder_to_patient_and_contacts(message_text)

                # Mark as sent
                appointment.whatsapp_reminder_24h_sent = True
                _logger.info(f"24h reminder sent for appointment {appointment.name}")

            except Exception as e:
                _logger.error(f"Error sending 24h reminder for appointment {appointment.name}: {str(e)}", exc_info=True)

        _logger.info("Cron job completed: 24h appointment reminders")

    @api.model
    def _cron_send_appointment_reminders_12h(self):
        """Cron job to send appointment reminders 12 hours before"""
        _logger.info("Running cron job: Send appointment reminders 12h before")

        # Calculate the time window (12h from now, +/- 30 minutes)
        now = datetime.now()
        start_time = now + timedelta(hours=11, minutes=30)
        end_time = now + timedelta(hours=12, minutes=30)

        # Find appointments in the next 12 hours that haven't received the 12h reminder
        appointments = self.search([
            ('date', '>=', start_time),
            ('date', '<=', end_time),
            ('whatsapp_reminder_12h_sent', '=', False),
            ('state', 'not in', ['cancel', 'done']),
        ])

        _logger.info(f"Found {len(appointments)} appointments for 12h reminder")

        for appointment in appointments:
            try:
                # Get default message
                default_message = self.env['ir.config_parameter'].sudo().get_param(
                    'acs_hms_whatsapp.default_appointment_reminder_message',
                    'Bonjour, ceci est un rappel pour votre rendez-vous dans 12 heures.'
                )

                # Format message
                appointment_date = appointment.date.strftime('%d/%m/%Y à %H:%M')
                physician_name = appointment.physician_id.name if appointment.physician_id else 'N/A'

                message_text = _(
                    "%(message)s\n\n"
                    "📅 Date: %(date)s\n"
                    "👨‍⚕️ Médecin: %(physician)s\n"
                    "🏥 Hôpital: %(hospital)s\n\n"
                    "Merci de confirmer votre présence."
                ) % {
                    'message': default_message,
                    'date': appointment_date,
                    'physician': physician_name,
                    'hospital': appointment.company_id.name or 'N/A',
                }

                # Send reminder
                appointment._send_reminder_to_patient_and_contacts(message_text)

                # Mark as sent
                appointment.whatsapp_reminder_12h_sent = True
                _logger.info(f"12h reminder sent for appointment {appointment.name}")

            except Exception as e:
                _logger.error(f"Error sending 12h reminder for appointment {appointment.name}: {str(e)}", exc_info=True)

        _logger.info("Cron job completed: 12h appointment reminders")
