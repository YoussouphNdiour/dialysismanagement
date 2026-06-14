# -*- coding: utf-8 -*-
from datetime import timedelta
from unittest.mock import patch

from odoo import fields
from odoo.tests.common import TransactionCase


class TestBilanWhatsappAlert(TransactionCase):
    """Tests TDD pour _cron_whatsapp_bilans_alerts."""

    def setUp(self):
        super().setUp()
        # Activer WhatsApp
        ICP = self.env['ir.config_parameter'].sudo()
        ICP.set_param('acs_hms_whatsapp.enabled', 'True')
        ICP.set_param('acs_hms_whatsapp.api_key', 'test_key_123')

        # Médecin avec téléphone
        # hms.physician uses _inherits on res.users → create via hms.physician with email
        self.physician = self.env['hms.physician'].sudo().create({
            'name': 'Dr. Fatou Test',
            'login': 'dr_fatou_test_wa@test.local',
            'email': 'dr_fatou_test_wa@test.local',
        })
        # Set phone on the partner linked to the physician's user
        self.physician.partner_id.write({'phone': '+221771234567'})

        # Patient néphro actif
        self.patient = self.env['hms.patient'].create({
            'name': 'Patient WhatsApp Test',
            'nephrology_care': True,
            'primary_physician_id': self.physician.id,
        })

    def _make_bilan(self, date_str, hb=0.0, k=0.0, p=0.0):
        """Crée un bilan minimal avec les valeurs données."""
        return self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'exam_date': fields.Datetime.from_string(date_str),
            'hemoglobin': hb,
            'potassium': k,
            'phosphorus': p,
        })

    def _run_cron(self):
        return self.env['acs.nephro.bilan']._cron_whatsapp_bilans_alerts()

    def _count_messages(self, tag):
        return self.env['whatsapp.message'].sudo().search_count([
            ('model', '=', 'hms.patient'),
            ('res_id', '=', self.patient.id),
            ('message_text', 'ilike', tag),
        ])

    def _mock_send(self):
        """Context manager : patch action_send_message pour ne pas appeler l'API."""
        return patch.object(
            type(self.env['whatsapp.message']),
            'action_send_message',
            lambda self: self.write({'state': 'sent'}),
        )

    # ── K alerts ────────────────────────────────────────────────────────────────

    def test_k_alert_single_bilan(self):
        """K > 5.5 sur le dernier bilan → 1 message [ALERTE_K]."""
        self._make_bilan('2026-06-10 08:00:00', k=5.8)
        with self._mock_send():
            result = self._run_cron()
        self.assertEqual(result, 1)
        self.assertEqual(self._count_messages('[ALERTE_K]'), 1)

    def test_k_no_alert_normal(self):
        """K = 4.5 (normal) → 0 message."""
        self._make_bilan('2026-06-10 08:00:00', k=4.5)
        with self._mock_send():
            result = self._run_cron()
        self.assertEqual(result, 0)

    # ── Hb alerts ───────────────────────────────────────────────────────────────

    def test_hb_alert_two_consecutive(self):
        """2 bilans Hb < 10 consécutifs → 1 message [ALERTE_Hb]."""
        self._make_bilan('2026-05-01 08:00:00', hb=9.5)
        self._make_bilan('2026-06-01 08:00:00', hb=9.8)
        with self._mock_send():
            result = self._run_cron()
        self.assertEqual(result, 1)
        self.assertEqual(self._count_messages('[ALERTE_Hb]'), 1)

    def test_hb_no_alert_one_low_one_normal(self):
        """1 bilan Hb < 10 + 1 bilan Hb = 11 → 0 message."""
        self._make_bilan('2026-05-01 08:00:00', hb=9.5)
        self._make_bilan('2026-06-01 08:00:00', hb=11.0)
        with self._mock_send():
            result = self._run_cron()
        self.assertEqual(result, 0)

    def test_hb_no_alert_only_one_bilan(self):
        """1 seul bilan Hb < 10 → 0 message (2 consécutifs requis)."""
        self._make_bilan('2026-06-01 08:00:00', hb=9.0)
        with self._mock_send():
            result = self._run_cron()
        self.assertEqual(result, 0)

    # ── P alerts ────────────────────────────────────────────────────────────────

    def test_p_alert_two_consecutive(self):
        """2 bilans P > 1.8 consécutifs → 1 message [ALERTE_P]."""
        self._make_bilan('2026-05-01 08:00:00', p=1.9)
        self._make_bilan('2026-06-01 08:00:00', p=2.1)
        with self._mock_send():
            result = self._run_cron()
        self.assertEqual(result, 1)
        self.assertEqual(self._count_messages('[ALERTE_P]'), 1)

    # ── Déduplication ───────────────────────────────────────────────────────────

    def test_dedup_no_resend_within_7_days(self):
        """Alerte K déjà envoyée il y a 3 jours → 0 nouveau message."""
        self._make_bilan('2026-06-10 08:00:00', k=5.8)
        msg = self.env['whatsapp.message'].sudo().create({
            'recipient_phone': '+221771234567',
            'message_type': 'text',
            'message_text': 'Alerte [ALERTE_K]',
            'model': 'hms.patient',
            'res_id': self.patient.id,
            'state': 'sent',
        })
        three_days_ago = fields.Datetime.now() - timedelta(days=3)
        self.env.cr.execute(
            "UPDATE whatsapp_message SET create_date = %s WHERE id = %s",
            (three_days_ago, msg.id),
        )
        self.env.invalidate_all()
        with self._mock_send():
            result = self._run_cron()
        self.assertEqual(result, 0)

    def test_dedup_resend_after_7_days(self):
        """Alerte K envoyée il y a 8 jours → 1 nouveau message (fenêtre expirée)."""
        self._make_bilan('2026-06-10 08:00:00', k=5.8)
        msg = self.env['whatsapp.message'].sudo().create({
            'recipient_phone': '+221771234567',
            'message_type': 'text',
            'message_text': 'Alerte [ALERTE_K]',
            'model': 'hms.patient',
            'res_id': self.patient.id,
            'state': 'sent',
        })
        eight_days_ago = fields.Datetime.now() - timedelta(days=8)
        self.env.cr.execute(
            "UPDATE whatsapp_message SET create_date = %s WHERE id = %s",
            (eight_days_ago, msg.id),
        )
        self.env.invalidate_all()
        with self._mock_send():
            result = self._run_cron()
        self.assertEqual(result, 1)

    # ── Conditions préalables ────────────────────────────────────────────────────

    def test_no_physician_skip(self):
        """Patient sans primary_physician_id → 0 message, pas d'exception."""
        self.patient.write({'primary_physician_id': False})
        self._make_bilan('2026-06-10 08:00:00', k=5.8)
        with self._mock_send():
            result = self._run_cron()
        self.assertEqual(result, 0)

    def test_no_phone_skip(self):
        """Médecin sans phone → 0 message, pas d'exception."""
        self.physician.partner_id.write({'phone': False})
        self._make_bilan('2026-06-10 08:00:00', k=5.8)
        with self._mock_send():
            result = self._run_cron()
        self.assertEqual(result, 0)

    def test_whatsapp_disabled_returns_zero(self):
        """acs_hms_whatsapp.enabled=False → cron retourne 0, aucune exception."""
        ICP = self.env['ir.config_parameter'].sudo()
        ICP.set_param('acs_hms_whatsapp.enabled', 'False')
        self._make_bilan('2026-06-10 08:00:00', k=5.8)
        result = self._run_cron()
        self.assertEqual(result, 0)
        self.assertEqual(self._count_messages('[ALERTE_K]'), 0)
