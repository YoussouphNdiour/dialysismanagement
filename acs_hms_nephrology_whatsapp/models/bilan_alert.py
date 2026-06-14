# -*- coding: utf-8 -*-
from datetime import timedelta
import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class ACSNephroBilanWhatsapp(models.Model):
    _inherit = 'acs.nephro.bilan'

    @api.model
    def _cron_whatsapp_bilans_alerts(self):
        """
        Cron quotidien : WhatsApp au médecin référent pour bilans critiques.
        - K > 5.5 : 1 seul bilan suffit
        - Hb < 10 : 2 bilans consécutifs requis
        - P > 1.8 : 2 bilans consécutifs requis
        Déduplication : pas de renvoi si alerte même type < 7 jours.
        Retourne le nombre total de messages envoyés.
        """
        ICP = self.env['ir.config_parameter'].sudo()
        enabled = ICP.get_param('acs_hms_whatsapp.enabled', False)
        if not enabled or str(enabled).lower() == 'false':
            _logger.warning(
                'WhatsApp désactivé (acs_hms_whatsapp.enabled=%s) — alertes bilans ignorées',
                enabled,
            )
            return 0

        nephro_patients = self.env['hms.patient'].search([
            ('nephrology_care', '=', True),
            ('active', '=', True),
        ])

        count = 0
        for patient in nephro_patients:
            physician = patient.primary_physician_id
            if not physician:
                continue
            phone = physician.partner_id.phone
            if not phone:
                _logger.debug(
                    'Patient %s : médecin %s sans téléphone, alerte WhatsApp ignorée',
                    patient.name, physician.name,
                )
                continue
            count += self._check_and_send_k_alert(patient, physician, phone)
            count += self._check_and_send_hb_alert(patient, physician, phone)
            count += self._check_and_send_p_alert(patient, physician, phone)

        _logger.info('_cron_whatsapp_bilans_alerts : %d alertes envoyées', count)
        return count

    def _whatsapp_already_sent(self, patient, tag):
        """Retourne True si un WhatsApp avec ce tag a été envoyé dans les 7 derniers jours."""
        cutoff = fields.Datetime.now() - timedelta(days=7)
        return bool(self.env['whatsapp.message'].sudo().search([
            ('model', '=', 'hms.patient'),
            ('res_id', '=', patient.id),
            ('message_text', 'ilike', tag),
            ('state', 'in', ['sent', 'sending']),
            ('create_date', '>=', cutoff),
        ], limit=1))

    def _send_whatsapp(self, patient, phone, text):
        """Crée et envoie un whatsapp.message. Retourne 1 si succès, 0 sinon."""
        msg = self.env['whatsapp.message'].sudo().create({
            'recipient_phone': phone,
            'message_type': 'text',
            'message_text': text,
            'model': 'hms.patient',
            'res_id': patient.id,
        })
        try:
            msg.action_send_message()
            return 1
        except Exception as e:
            _logger.warning(
                'WhatsApp alerte patient %s : échec envoi — %s',
                patient.name, e,
            )
            return 0

    def _check_and_send_k_alert(self, patient, physician, phone):
        """Alerte K > 5.5 — 1 seul bilan."""
        tag = '[ALERTE_K]'
        if self._whatsapp_already_sent(patient, tag):
            return 0
        last = self.search(
            [('patient_id', '=', patient.id), ('potassium', '>', 0)],
            order='exam_date desc', limit=1,
        )
        if not last or last.potassium_status != 'high':
            return 0
        date_str = last.exam_date.strftime('%d/%m/%y') if last.exam_date else '?'
        text = (
            f'⚠️ ALERTE BIOLOGIQUE — As-Shafi Medical\n\n'
            f'Patient : {patient.name}\n'
            f'Médecin : Dr. {physician.name}\n\n'
            f'🔴 Potassium élevé\n'
            f'  Bilan {last.name} ({date_str}) : K = {last.potassium:.2f} mmol/L\n'
            f'  Seuil : > 5.5 mmol/L\n\n'
            f'Veuillez vérifier et ajuster le traitement.\n\n'
            f'{tag}'
        )
        return self._send_whatsapp(patient, phone, text)

    def _check_and_send_hb_alert(self, patient, physician, phone):
        """Alerte Hb < 10 — 2 bilans consécutifs."""
        tag = '[ALERTE_Hb]'
        if self._whatsapp_already_sent(patient, tag):
            return 0
        last_two = self.search(
            [('patient_id', '=', patient.id), ('hemoglobin', '>', 0)],
            order='exam_date desc', limit=2,
        )
        if len(last_two) < 2:
            return 0
        if not all(b.hemoglobin_status == 'low' for b in last_two):
            return 0
        b_old, b_new = last_two[1], last_two[0]
        d_old = b_old.exam_date.strftime('%d/%m/%y') if b_old.exam_date else '?'
        d_new = b_new.exam_date.strftime('%d/%m/%y') if b_new.exam_date else '?'
        text = (
            f'⚠️ ALERTE BIOLOGIQUE — As-Shafi Medical\n\n'
            f'Patient : {patient.name}\n'
            f'Médecin : Dr. {physician.name}\n\n'
            f'🔴 Hémoglobine basse (2 bilans consécutifs)\n'
            f'  Bilan {b_old.name} ({d_old}) : Hb = {b_old.hemoglobin:.1f} g/dL\n'
            f'  Bilan {b_new.name} ({d_new}) : Hb = {b_new.hemoglobin:.1f} g/dL\n'
            f'  Seuil KDIGO : 10–12 g/dL\n\n'
            f'Veuillez vérifier et ajuster le traitement.\n\n'
            f'{tag}'
        )
        return self._send_whatsapp(patient, phone, text)

    def _check_and_send_p_alert(self, patient, physician, phone):
        """Alerte P > 1.8 — 2 bilans consécutifs."""
        tag = '[ALERTE_P]'
        if self._whatsapp_already_sent(patient, tag):
            return 0
        last_two = self.search(
            [('patient_id', '=', patient.id), ('phosphorus', '>', 0)],
            order='exam_date desc', limit=2,
        )
        if len(last_two) < 2:
            return 0
        if not all(b.phosphorus_status == 'high' for b in last_two):
            return 0
        b_old, b_new = last_two[1], last_two[0]
        d_old = b_old.exam_date.strftime('%d/%m/%y') if b_old.exam_date else '?'
        d_new = b_new.exam_date.strftime('%d/%m/%y') if b_new.exam_date else '?'
        text = (
            f'⚠️ ALERTE BIOLOGIQUE — As-Shafi Medical\n\n'
            f'Patient : {patient.name}\n'
            f'Médecin : Dr. {physician.name}\n\n'
            f'🔴 Phosphore élevé (2 bilans consécutifs)\n'
            f'  Bilan {b_old.name} ({d_old}) : P = {b_old.phosphorus:.2f} mmol/L\n'
            f'  Bilan {b_new.name} ({d_new}) : P = {b_new.phosphorus:.2f} mmol/L\n'
            f'  Seuil : ≤ 1.8 mmol/L\n\n'
            f'Veuillez vérifier et ajuster le traitement.\n\n'
            f'{tag}'
        )
        return self._send_whatsapp(patient, phone, text)
