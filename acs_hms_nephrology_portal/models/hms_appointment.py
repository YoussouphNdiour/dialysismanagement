# -*- coding: utf-8 -*-
from odoo import api, fields, models


class HmsAppointmentPortal(models.Model):
    _inherit = 'hms.appointment'

    patient_cancelled = fields.Boolean(
        string='Annule par le patient',
        default=False,
        copy=False,
    )
    cancel_reason = fields.Text(
        string='Motif annulation patient',
        copy=False,
    )
    cancel_date = fields.Datetime(
        string='Date annulation patient',
        readonly=True,
        copy=False,
    )

    def _notify_cancel_to_secretary(self):
        """Notifie la secretaire d'une annulation via email (+ WhatsApp optionnel).

        Le template mail est defini dans data/mail_template.xml.
        raise_if_not_found=False : si absent, on tombe en fallback chatter.
        """
        self.ensure_one()
        # --- Email via template ---
        template = self.env.ref(
            'acs_hms_nephrology_portal.mail_template_rdv_cancel',
            raise_if_not_found=False,
        )
        if template:
            template.send_mail(self.id, force_send=False)
        else:
            # Fallback : note dans le chatter du RDV
            self.message_post(
                body=f"Annulation patient. Motif : {self.cancel_reason or '(non precise)'}",
                subtype_xmlid='mail.mt_note',
            )
        # --- WhatsApp optionnel ---
        if 'acs_hms_whatsapp' in self.env.registry:
            patient_name = self.patient_id.name or 'Patient'
            date_str = self.date.strftime('%d/%m/%Y %H:%M') if self.date else ''
            msg = (
                f"[PORTAIL] {patient_name} a annule sa seance du {date_str}."
                f"\nMotif : {self.cancel_reason or '(non precise)'}"
            )
            try:
                self.env['acs.whatsapp'].sudo().send_whatsapp_message(
                    partner_id=self.physician_id.partner_id.id if self.physician_id else False,
                    message=msg,
                )
            except Exception:
                pass  # WhatsApp optionnel, ne bloque pas


class HmsPatientPortal(models.Model):
    _inherit = 'hms.patient'

    def action_invite_portal(self):
        """Ouvre le wizard Odoo natif portal.wizard pre-rempli."""
        self.ensure_one()
        wizard = self.env['portal.wizard'].create({
            'user_ids': [(0, 0, {
                'partner_id': self.partner_id.id,
                'email': self.partner_id.email or '',
            })]
        })
        # WhatsApp optionnel
        if 'acs_hms_whatsapp' in self.env.registry:
            self._send_portal_invite_whatsapp()
        return wizard._action_open_modal()

    def _send_portal_invite_whatsapp(self):
        """Envoie un message WhatsApp d'invitation au portail. Optionnel."""
        try:
            company = self.env.company
            msg = (
                f"Bonjour {self.name},\n"
                f"Votre acces au portail patient de {company.name} est pret.\n"
                f"Connectez-vous sur : {self.env['ir.config_parameter'].sudo().get_param('web.base.url')}/web/login"
            )
            self.env['acs.whatsapp'].sudo().send_whatsapp_message(
                partner_id=self.partner_id.id,
                message=msg,
            )
        except Exception:
            pass  # Ne bloque jamais l'invitation
