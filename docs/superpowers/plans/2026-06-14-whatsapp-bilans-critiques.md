# WhatsApp Alertes Bilans Critiques — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le module `acs_hms_nephrology_whatsapp` qui envoie un WhatsApp quotidien au médecin référent quand Hb < 10 (2 bilans consécutifs), K > 5.5 (1 bilan), ou P > 1.8 (2 bilans consécutifs).

**Architecture:** Nouveau module Odoo 19 qui hérite de `acs.nephro.bilan` pour ajouter un cron quotidien. Envoie via le modèle `whatsapp.message` de `acs_hms_whatsapp` (WasenderApi, credentials dans `ir.config_parameter`). Aucun nouveau modèle — pas de migration DB. Déduplication : pas de renvoi si alerte même type envoyée dans les 7 derniers jours.

**Tech Stack:** Odoo 19, Python 3, `unittest.mock.patch`, `acs_hms_whatsapp` (WasenderApi)

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `acs_hms_nephrology_whatsapp/__init__.py` | Créer | Init module |
| `acs_hms_nephrology_whatsapp/__manifest__.py` | Créer | Manifest (depends: acs_hms_nephrology_bilans, acs_hms_whatsapp) |
| `acs_hms_nephrology_whatsapp/models/__init__.py` | Créer | Init models |
| `acs_hms_nephrology_whatsapp/models/bilan_alert.py` | Créer | `_inherit = 'acs.nephro.bilan'` + cron + helpers |
| `acs_hms_nephrology_whatsapp/data/cron_data.xml` | Créer | Cron quotidien 07h00 |
| `acs_hms_nephrology_whatsapp/tests/__init__.py` | Créer | Init tests (vide) |
| `acs_hms_nephrology_whatsapp/tests/test_bilan_whatsapp_alert.py` | Créer | 10 tests TDD |

**Important :** Ce module n'existe PAS dans le dossier vendor (`odoo-19.0.post20260601/odoo/addons/`). Il n'y a donc pas de problème de double-copie — seul `as shafi/acs_hms_nephrology_whatsapp/` sera chargé.

---

## Task 1 : Scaffold + tests qui échouent

**Files:**
- Create: `as shafi/acs_hms_nephrology_whatsapp/__init__.py`
- Create: `as shafi/acs_hms_nephrology_whatsapp/__manifest__.py`
- Create: `as shafi/acs_hms_nephrology_whatsapp/models/__init__.py`
- Create: `as shafi/acs_hms_nephrology_whatsapp/models/bilan_alert.py` (stub)
- Create: `as shafi/acs_hms_nephrology_whatsapp/tests/__init__.py`
- Create: `as shafi/acs_hms_nephrology_whatsapp/tests/test_bilan_whatsapp_alert.py`

- [ ] **Step 1 : Créer la structure de répertoires**

```bash
mkdir -p "/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology_whatsapp/models"
mkdir -p "/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology_whatsapp/data"
mkdir -p "/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology_whatsapp/tests"
echo "Directories created"
```

- [ ] **Step 2 : Créer `__init__.py`**

```python
# -*- coding: utf-8 -*-
from . import models
```

Fichier : `as shafi/acs_hms_nephrology_whatsapp/__init__.py`

- [ ] **Step 3 : Créer `__manifest__.py`**

```python
# -*- coding: utf-8 -*-
{
    'name': 'Nephrology — WhatsApp Alertes Bilans Critiques',
    'version': '1.0.0',
    'category': 'Medical',
    'summary': 'Notifications WhatsApp au médecin référent pour les bilans critiques (Hb, K, P)',
    'author': 'As-Shafi Custom',
    'license': 'LGPL-3',
    'depends': ['acs_hms_nephrology_bilans', 'acs_hms_whatsapp'],
    'data': [
        'data/cron_data.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
```

Fichier : `as shafi/acs_hms_nephrology_whatsapp/__manifest__.py`

- [ ] **Step 4 : Créer `models/__init__.py`**

```python
# -*- coding: utf-8 -*-
from . import bilan_alert
```

Fichier : `as shafi/acs_hms_nephrology_whatsapp/models/__init__.py`

- [ ] **Step 5 : Créer le stub `models/bilan_alert.py`** (classe vide — les tests vont échouer car la méthode n'existe pas)

```python
# -*- coding: utf-8 -*-
from odoo import api, models

class ACSNephroBilanWhatsapp(models.Model):
    _inherit = 'acs.nephro.bilan'
```

Fichier : `as shafi/acs_hms_nephrology_whatsapp/models/bilan_alert.py`

- [ ] **Step 6 : Créer `tests/__init__.py`** (vide)

```python
# -*- coding: utf-8 -*-
```

Fichier : `as shafi/acs_hms_nephrology_whatsapp/tests/__init__.py`

- [ ] **Step 7 : Créer `data/cron_data.xml`** (requis par le manifest avant install)

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data noupdate="1">
        <!-- Cron quotidien alertes WhatsApp bilans critiques -->
        <record id="cron_whatsapp_bilans_alerts" model="ir.cron">
            <field name="name">Dialyse : Alertes WhatsApp bilans critiques (Hb/K/P)</field>
            <field name="model_id" ref="acs_hms_nephrology_bilans.model_acs_nephro_bilan"/>
            <field name="user_id" ref="base.user_root"/>
            <field name="state">code</field>
            <field name="code">model._cron_whatsapp_bilans_alerts()</field>
            <field name="nextcall">2026-06-15 07:00:00</field>
            <field name="interval_number">1</field>
            <field name="interval_type">days</field>
            <field name="active" eval="True"/>
        </record>
    </data>
</odoo>
```

Fichier : `as shafi/acs_hms_nephrology_whatsapp/data/cron_data.xml`

- [ ] **Step 8 : Écrire les tests**

```python
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
        partner = self.env['res.partner'].create({
            'name': 'Dr. Fatou Test',
            'mobile': '+221771234567',
        })
        self.physician = self.env['hms.physician'].create({
            'name': 'Dr. Fatou Test',
            'partner_id': partner.id,
        })

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
        # Simuler un message déjà envoyé il y a 3 jours
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
        self.env.invalidate_all()  # vider le cache ORM après UPDATE SQL direct
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
        self.env.invalidate_all()  # vider le cache ORM après UPDATE SQL direct
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
        """Médecin sans mobile ni phone → 0 message, pas d'exception."""
        self.physician.partner_id.write({'mobile': False, 'phone': False})
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
```

Fichier : `as shafi/acs_hms_nephrology_whatsapp/tests/test_bilan_whatsapp_alert.py`

- [ ] **Step 9 : Installer le module**

```bash
cd "/Users/yusper/Downloads/modules 19"
pkill -f "odoo.*asshafi" 2>/dev/null; sleep 2
./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --stop-after-init -i acs_hms_nephrology_whatsapp > /tmp/odoo_wa_install.log 2>&1
echo "Exit: $?"
grep -i "ERROR" /tmp/odoo_wa_install.log | head -10
```

Expected : exit 0, 0 erreurs.

- [ ] **Step 10 : Lancer les tests et vérifier qu'ils échouent**

```bash
cd "/Users/yusper/Downloads/modules 19"
./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --test-enable --stop-after-init \
  -i acs_hms_nephrology_whatsapp \
  --test-tags=TestBilanWhatsappAlert 2>&1 | grep -E "(FAIL|ERROR|OK|Ran|test_)"
```

Expected : `FAIL` — `AttributeError: 'ACSNephroBilanWhatsapp' object has no attribute '_cron_whatsapp_bilans_alerts'` (ou similaire).

---

## Task 2 : Implémenter le cron (rouge → vert)

**Files:**
- Modify: `as shafi/acs_hms_nephrology_whatsapp/models/bilan_alert.py`

- [ ] **Step 1 : Remplacer le stub par l'implémentation complète**

```python
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
            phone = physician.partner_id.mobile or physician.partner_id.phone
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

    # ── Helpers ─────────────────────────────────────────────────────────────────

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

    # ── Alertes par paramètre ────────────────────────────────────────────────────

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
        # Afficher du plus ancien au plus récent
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
```

Fichier : `as shafi/acs_hms_nephrology_whatsapp/models/bilan_alert.py`

- [ ] **Step 2 : Lancer les tests — vérifier qu'ils passent**

```bash
cd "/Users/yusper/Downloads/modules 19"
./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --test-enable --stop-after-init \
  -u acs_hms_nephrology_whatsapp \
  --test-tags=TestBilanWhatsappAlert 2>&1 | grep -E "(FAIL|ERROR|OK|Ran|test_)"
```

Expected : `Ran 10 tests in ...s` `OK`

Si un test échoue, lire le message d'erreur complet :
```bash
cd "/Users/yusper/Downloads/modules 19"
./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --test-enable --stop-after-init \
  -u acs_hms_nephrology_whatsapp \
  --test-tags=TestBilanWhatsappAlert 2>&1 | tail -60
```

- [ ] **Step 3 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_whatsapp/
git commit -m "feat(nephro-whatsapp): module alertes WhatsApp bilans critiques (Hb/K/P) — 10 tests OK"
```

---

## Task 3 : Upgrade + vérification finale

**Files:** (aucune modification de code — vérification uniquement)

- [ ] **Step 1 : Redémarrer Odoo en mode normal**

```bash
cd "/Users/yusper/Downloads/modules 19"
pkill -f "odoo.*asshafi" 2>/dev/null; sleep 2
nohup ./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 --log-level=warn \
  >> /tmp/odoo.log 2>&1 &
echo "PID: $!"
```

- [ ] **Step 2 : Attendre que le serveur soit prêt**

```bash
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8069/web/health 2>/dev/null)
  [ "$code" = "200" ] && echo "Ready in ${i}s" && break
  sleep 2
done
```

Expected : `Ready in Xs`

- [ ] **Step 3 : Vérifier que le cron est bien en DB**

```bash
psql -h localhost -p 5432 -U yusper -d asshafi -c \
  "SELECT name, active, interval_number, interval_type, nextcall FROM ir_cron WHERE name ILIKE '%WhatsApp%bilans%';"
```

Expected :
```
           name                         | active | interval_number | interval_type |      nextcall
----------------------------------------+--------+-----------------+---------------+---------------------
 Dialyse : Alertes WhatsApp bilans ...  | t      |               1 | days          | 2026-06-15 07:00:00
```

- [ ] **Step 4 : Commit final**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add -p   # vérifier qu'aucun fichier temp n'est inclus
git commit -m "chore: upgrade acs_hms_nephrology_whatsapp — cron vérifié en DB"
```

---

## Critères d'acceptance (rappel de la spec)

1. Le cron `_cron_whatsapp_bilans_alerts` tourne quotidiennement à 07h00
2. WhatsApp envoyé au médecin référent quand K > 5.5 (1 bilan)
3. WhatsApp envoyé quand Hb < 10 (2 bilans consécutifs)
4. WhatsApp envoyé quand P > 1.8 (2 bilans consécutifs)
5. Aucun doublon dans les 7 jours pour le même patient + même type d'alerte
6. Cron tolérant aux pannes (WhatsApp désactivé, médecin sans téléphone, erreur API)
7. 10 tests unitaires passent

---

## Notes d'implémentation

**`hms.physician` :** Si la création avec `name` échoue, utiliser uniquement `partner_id` :
```python
partner = self.env['res.partner'].create({'name': 'Dr. Fatou Test', 'mobile': '+221771234567'})
self.physician = self.env['hms.physician'].create({'partner_id': partner.id})
```

**Double-copie :** Ce module n'existe PAS dans `odoo-19.0.post20260601/odoo/addons/`. Aucune synchronisation nécessaire.

**`acs_hms_whatsapp.enabled` :** `get_param` retourne une chaîne `'True'`/`'False'` ou `False` (défaut). Le cron vérifie `str(enabled).lower() == 'false'` pour gérer les deux cas.
