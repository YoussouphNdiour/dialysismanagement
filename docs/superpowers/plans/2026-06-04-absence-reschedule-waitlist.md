# Sprint 3 — Section 4.4 : Absences, Reports, Liste d'attente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter la gestion des absences patients, le report guidé de séances avec vérification de disponibilité du poste, la liste d'attente par créneau, et les notifications WhatsApp automatiques de reprise dans `acs_hms_nephrology_dashboard`.

**Architecture:** Trois nouveaux modèles Python (`acs.dialysis.absence`, `acs.dialysis.waitlist`, wizard `dialysis.session.reschedule`) + extension de `acs.patient.procedure` (statut `absent`). Tout vit dans `acs_hms_nephrology_dashboard` qui dépend déjà de `acs_hms_nephrology` et `acs_hms_whatsapp`. Le WhatsApp de reprise est déclenché via cron quotidien (J-1) et bouton manuel.

**Tech Stack:** Odoo 19, Python 3.12, `TransactionCase` pour tests, WasenderAPI via `whatsapp.message` existant.

**Spec :** `docs/superpowers/specs/2026-06-04-absence-reschedule-waitlist-design.md`

---

## Fichiers à créer / modifier

| Action | Fichier | Responsabilité |
|---|---|---|
| Créer | `acs_hms_nephrology_dashboard/models/dialysis_absence.py` | `acs.dialysis.absence` + extension `acs.patient.procedure` |
| Créer | `acs_hms_nephrology_dashboard/models/dialysis_waitlist.py` | `acs.dialysis.waitlist` |
| Créer | `acs_hms_nephrology_dashboard/models/dialysis_reschedule.py` | wizard `dialysis.session.reschedule` |
| Créer | `acs_hms_nephrology_dashboard/tests/test_dialysis_absence.py` | tests absence + extension procedure |
| Créer | `acs_hms_nephrology_dashboard/tests/test_dialysis_reschedule.py` | tests wizard report |
| Créer | `acs_hms_nephrology_dashboard/views/dialysis_absence_views.xml` | form + tree absence |
| Créer | `acs_hms_nephrology_dashboard/views/dialysis_waitlist_views.xml` | tree liste d'attente |
| Créer | `acs_hms_nephrology_dashboard/views/dialysis_reschedule_views.xml` | wizard report |
| Créer | `acs_hms_nephrology_dashboard/views/procedure_views_ext.xml` | bouton [Reporter] sur `acs.patient.procedure` |
| Créer | `acs_hms_nephrology_dashboard/data/cron_reprise_whatsapp.xml` | `ir.cron` quotidien |
| Modifier | `acs_hms_nephrology_dashboard/models/__init__.py` | importer les 3 nouveaux modèles |
| Modifier | `acs_hms_nephrology_dashboard/tests/__init__.py` | importer les 2 nouveaux tests |
| Modifier | `acs_hms_nephrology_dashboard/security/ir.model.access.csv` | droits sur nouveaux modèles |
| Modifier | `acs_hms_nephrology_dashboard/__manifest__.py` | ajouter depends whatsapp + data/views |

---

## Task 1 : Modèle `acs.dialysis.absence` + extension `acs.patient.procedure`

**Files:**
- Create: `acs_hms_nephrology_dashboard/models/dialysis_absence.py`
- Create: `acs_hms_nephrology_dashboard/tests/test_dialysis_absence.py`

- [ ] **Step 1.1 : Écrire les tests en échec**

Créer `acs_hms_nephrology_dashboard/tests/test_dialysis_absence.py` :

```python
# acs_hms_nephrology_dashboard/tests/test_dialysis_absence.py
# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase
from odoo import fields
from odoo.exceptions import ValidationError, UserError
from datetime import date, timedelta


class TestDialysisAbsence(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.dept = cls.env['hr.department'].create({
            'name': 'Néphro Absence Test',
            'department_type': 'nephrology',
        })
        cls.station = cls.env['acs.dialysis.station'].create({
            'name': 'Poste Abs 1',
            'station_type': 'standard',
            'active': True,
        })
        cls.schedule = cls.env['acs.nephrology.schedule'].create({
            'name': 'Sched Abs',
            'station_id': cls.station.id,
            'monday': True, 'tuesday': True, 'wednesday': True,
            'thursday': True, 'friday': True, 'saturday': True, 'sunday': True,
            'max_patients': 4,
        })
        cls.patient = cls.env['hms.patient'].create({'name': 'Patient Abs Test'})
        cls.product = cls.env['product.product'].search([('type', '=', 'service')], limit=1)
        if not cls.product:
            cls.product = cls.env['product.product'].create({
                'name': 'Hémo Abs Test', 'type': 'service',
            })

    def _make_procedure(self, date_val, state='scheduled'):
        """Crée une procédure à une date donnée."""
        dt = fields.Datetime.to_string(
            fields.Datetime.from_string(f'{date_val} 08:00:00')
        )
        dt_stop = fields.Datetime.to_string(
            fields.Datetime.from_string(f'{date_val} 12:00:00')
        )
        return self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': dt,
            'date_stop': dt_stop,
            'state': state,
            'pre_dialysis_bp': '130/80',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })

    def test_absence_confirm_sets_procedures_absent(self):
        """Confirmer une absence passe les séances schedulées en 'absent'."""
        today = date.today()
        p1 = self._make_procedure(today.isoformat())
        p2 = self._make_procedure((today + timedelta(days=1)).isoformat())
        absence = self.env['acs.dialysis.absence'].create({
            'patient_id': self.patient.id,
            'start_date': today,
            'end_date': today + timedelta(days=1),
            'reason': 'voyage',
        })
        absence.action_confirm()
        self.assertEqual(p1.state, 'absent')
        self.assertEqual(p2.state, 'absent')
        self.assertEqual(p1.absence_id, absence)
        self.assertEqual(p2.absence_id, absence)
        self.assertEqual(absence.state, 'confirmed')

    def test_absence_confirm_ignores_done_procedures(self):
        """Les séances 'done' ne sont pas touchées par la confirmation."""
        today = date.today()
        p_done = self._make_procedure(today.isoformat(), state='done')
        absence = self.env['acs.dialysis.absence'].create({
            'patient_id': self.patient.id,
            'start_date': today,
            'end_date': today,
            'reason': 'hospitalisation',
        })
        absence.action_confirm()
        self.assertEqual(p_done.state, 'done')

    def test_absence_confirm_only_affects_patient(self):
        """La confirmation ne touche que les séances du patient concerné."""
        other_patient = self.env['hms.patient'].create({'name': 'Autre Patient'})
        today = date.today()
        dt = fields.Datetime.to_string(
            fields.Datetime.from_string(f'{today.isoformat()} 08:00:00')
        )
        dt_stop = fields.Datetime.to_string(
            fields.Datetime.from_string(f'{today.isoformat()} 12:00:00')
        )
        p_other = self.env['acs.patient.procedure'].create({
            'patient_id': other_patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': dt,
            'date_stop': dt_stop,
            'state': 'scheduled',
            'pre_dialysis_bp': '130/80',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })
        absence = self.env['acs.dialysis.absence'].create({
            'patient_id': self.patient.id,
            'start_date': today,
            'end_date': today,
            'reason': 'refus',
        })
        absence.action_confirm()
        self.assertEqual(p_other.state, 'scheduled')

    def test_absence_cancel_restores_procedures(self):
        """Annuler une absence remet les séances en 'scheduled'."""
        today = date.today()
        p1 = self._make_procedure(today.isoformat())
        absence = self.env['acs.dialysis.absence'].create({
            'patient_id': self.patient.id,
            'start_date': today,
            'end_date': today,
            'reason': 'autre',
        })
        absence.action_confirm()
        self.assertEqual(p1.state, 'absent')
        absence.action_cancel()
        self.assertEqual(p1.state, 'scheduled')
        self.assertFalse(p1.absence_id)
        self.assertEqual(absence.state, 'draft')

    def test_end_date_before_start_raises(self):
        """Contrainte SQL : end_date >= start_date."""
        today = date.today()
        with self.assertRaises(Exception):
            self.env['acs.dialysis.absence'].create({
                'patient_id': self.patient.id,
                'start_date': today,
                'end_date': today - timedelta(days=1),
                'reason': 'voyage',
            })
```

- [ ] **Step 1.2 : Vérifier que les tests échouent**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
python -m pytest acs_hms_nephrology_dashboard/tests/test_dialysis_absence.py -v 2>&1 | head -30
```

Attendu : erreurs d'import (modèle inexistant).

- [ ] **Step 1.3 : Implémenter `acs.dialysis.absence` + extension `acs.patient.procedure`**

Créer `acs_hms_nephrology_dashboard/models/dialysis_absence.py` :

```python
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
```

- [ ] **Step 1.4 : Ajouter l'import dans `models/__init__.py`**

Éditer `acs_hms_nephrology_dashboard/models/__init__.py` :

```python
# -*- coding: utf-8 -*-
from . import doctor_dashboard
from . import calendar_dashboard
from . import dialysis_absence
from . import dialysis_waitlist
from . import dialysis_reschedule
```

*(Les imports `dialysis_waitlist` et `dialysis_reschedule` seront ajoutés dans leurs tâches respectives — les ajouter tous maintenant évite les allers-retours.)*

- [ ] **Step 1.5 : Ajouter l'import du test dans `tests/__init__.py`**

Éditer `acs_hms_nephrology_dashboard/tests/__init__.py` :

```python
# -*- coding: utf-8 -*-
from . import test_nurse_dashboard
from . import test_doctor_dashboard
from . import test_calendar_dashboard
from . import test_dialysis_absence
from . import test_dialysis_reschedule
```

- [ ] **Step 1.6 : Lancer les tests**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
python -m pytest acs_hms_nephrology_dashboard/tests/test_dialysis_absence.py -v 2>&1 | tail -20
```

Attendu : 5 tests PASS.

- [ ] **Step 1.7 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/models/dialysis_absence.py \
        acs_hms_nephrology_dashboard/models/__init__.py \
        acs_hms_nephrology_dashboard/tests/test_dialysis_absence.py \
        acs_hms_nephrology_dashboard/tests/__init__.py
git commit -m "feat(nephrology): acs.dialysis.absence + statut absent sur acs.patient.procedure"
```

---

## Task 2 : Modèle `acs.dialysis.waitlist`

**Files:**
- Create: `acs_hms_nephrology_dashboard/models/dialysis_waitlist.py`

*(Les tests de la waitlist sont intégrés à `test_dialysis_reschedule.py` — Task 3 — car la liste d'attente est déclenchée depuis le wizard.)*

- [ ] **Step 2.1 : Implémenter `acs.dialysis.waitlist`**

Créer `acs_hms_nephrology_dashboard/models/dialysis_waitlist.py` :

```python
# acs_hms_nephrology_dashboard/models/dialysis_waitlist.py
# -*- coding: utf-8 -*-
import logging
from odoo import api, fields, models, _

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
            _logger.warning(
                "Waitlist %s: patient %s sans téléphone.", self.id, patient.name
            )
            return

        from .dialysis_absence import ACSDialysisAbsence
        formatted_phone = ACSDialysisAbsence._format_phone(phone)
        if not formatted_phone:
            return

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
            'name': patient.name.split()[0],
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
```

- [ ] **Step 2.2 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/models/dialysis_waitlist.py
git commit -m "feat(nephrology): acs.dialysis.waitlist — file d'attente par créneau"
```

---

## Task 3 : Wizard `dialysis.session.reschedule`

**Files:**
- Create: `acs_hms_nephrology_dashboard/models/dialysis_reschedule.py`
- Create: `acs_hms_nephrology_dashboard/tests/test_dialysis_reschedule.py`

- [ ] **Step 3.1 : Écrire les tests en échec**

Créer `acs_hms_nephrology_dashboard/tests/test_dialysis_reschedule.py` :

```python
# acs_hms_nephrology_dashboard/tests/test_dialysis_reschedule.py
# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase
from odoo import fields
from odoo.exceptions import UserError
from datetime import date, timedelta


class TestDialysisReschedule(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.dept = cls.env['hr.department'].create({
            'name': 'Néphro Reschedule Test',
            'department_type': 'nephrology',
        })
        cls.station = cls.env['acs.dialysis.station'].create({
            'name': 'Poste Reschedule 1',
            'station_type': 'standard',
            'active': True,
        })
        cls.schedule = cls.env['acs.nephrology.schedule'].create({
            'name': 'Sched Reschedule',
            'station_id': cls.station.id,
            'monday': True, 'tuesday': True, 'wednesday': True,
            'thursday': True, 'friday': True, 'saturday': True, 'sunday': True,
            'max_patients': 2,
        })
        cls.patient = cls.env['hms.patient'].create({'name': 'Patient Reschedule'})
        cls.product = cls.env['product.product'].search([('type', '=', 'service')], limit=1)
        if not cls.product:
            cls.product = cls.env['product.product'].create({
                'name': 'Hémo Reschedule', 'type': 'service',
            })

    def _make_procedure(self, date_val, state='scheduled'):
        dt = fields.Datetime.to_string(
            fields.Datetime.from_string(f'{date_val} 08:00:00')
        )
        dt_stop = fields.Datetime.to_string(
            fields.Datetime.from_string(f'{date_val} 12:00:00')
        )
        return self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': dt,
            'date_stop': dt_stop,
            'state': state,
            'pre_dialysis_bp': '130/80',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })

    def test_reschedule_updates_procedure_date(self):
        """Report valide : la date de la procédure est mise à jour."""
        today = date.today()
        tomorrow = today + timedelta(days=1)
        proc = self._make_procedure(today.isoformat())
        wizard = self.env['dialysis.session.reschedule'].create({
            'procedure_id': proc.id,
            'new_date': tomorrow,
            'station_id': self.station.id,
        })
        wizard.action_confirm()
        self.assertEqual(
            fields.Datetime.from_string(proc.date).date(), tomorrow
        )

    def test_reschedule_blocked_when_station_full(self):
        """Poste saturé sans liste d'attente : UserError levée."""
        today = date.today()
        tomorrow = today + timedelta(days=1)
        proc = self._make_procedure(today.isoformat())
        # Saturer le poste le lendemain (max_patients=2)
        self._make_procedure(tomorrow.isoformat())
        self._make_procedure(tomorrow.isoformat())
        wizard = self.env['dialysis.session.reschedule'].create({
            'procedure_id': proc.id,
            'new_date': tomorrow,
            'station_id': self.station.id,
            'add_to_waitlist': False,
        })
        with self.assertRaises(UserError):
            wizard.action_confirm()

    def test_reschedule_creates_waitlist_when_full(self):
        """Poste saturé avec add_to_waitlist=True : crée une entrée waitlist."""
        today = date.today()
        tomorrow = today + timedelta(days=1)
        proc = self._make_procedure(today.isoformat())
        self._make_procedure(tomorrow.isoformat())
        self._make_procedure(tomorrow.isoformat())
        wizard = self.env['dialysis.session.reschedule'].create({
            'procedure_id': proc.id,
            'new_date': tomorrow,
            'station_id': self.station.id,
            'add_to_waitlist': True,
        })
        wizard.action_confirm()
        waitlist = self.env['acs.dialysis.waitlist'].search([
            ('patient_id', '=', self.patient.id),
            ('state', '=', 'waiting'),
        ])
        self.assertTrue(waitlist)

    def test_slots_available_computed(self):
        """slots_available reflète le nombre de créneaux libres."""
        today = date.today()
        proc = self._make_procedure(today.isoformat())
        # 0 procédures demain → 2 places libres (max=2)
        tomorrow = today + timedelta(days=1)
        wizard = self.env['dialysis.session.reschedule'].create({
            'procedure_id': proc.id,
            'new_date': tomorrow,
            'station_id': self.station.id,
        })
        self.assertEqual(wizard.slots_available, 2)
```

- [ ] **Step 3.2 : Vérifier que les tests échouent**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
python -m pytest acs_hms_nephrology_dashboard/tests/test_dialysis_reschedule.py -v 2>&1 | head -20
```

Attendu : erreurs d'import (modèle inexistant).

- [ ] **Step 3.3 : Implémenter le wizard**

Créer `acs_hms_nephrology_dashboard/models/dialysis_reschedule.py` :

```python
# acs_hms_nephrology_dashboard/models/dialysis_reschedule.py
# -*- coding: utf-8 -*-
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
        string='Si poste saturé, mettre en liste d\'attente', default=False,
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
                fields.Datetime.from_string(f'{rec.new_date} 00:00:00')
            )
            day_end = fields.Datetime.to_string(
                fields.Datetime.from_string(f'{rec.new_date} 23:59:59')
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
            # Report effectif
            original_date = proc.date
            new_dt = fields.Datetime.to_string(
                fields.Datetime.from_string(f'{self.new_date} 08:00:00')
            )
            new_dt_stop = fields.Datetime.to_string(
                fields.Datetime.from_string(f'{self.new_date} 12:00:00')
            )
            proc.write({'date': new_dt, 'date_stop': new_dt_stop})
            if proc.appointment_id:
                proc.appointment_id.write({'date': new_dt})
            proc.message_post(
                body=_('Séance reportée du %s au %s.') % (
                    fields.Datetime.from_string(original_date).strftime('%d/%m/%Y') if original_date else '?',
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
```

- [ ] **Step 3.4 : Lancer les tests**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
python -m pytest acs_hms_nephrology_dashboard/tests/test_dialysis_reschedule.py -v 2>&1 | tail -20
```

Attendu : 4 tests PASS.

- [ ] **Step 3.5 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/models/dialysis_reschedule.py \
        acs_hms_nephrology_dashboard/tests/test_dialysis_reschedule.py
git commit -m "feat(nephrology): wizard dialysis.session.reschedule — report + liste d'attente"
```

---

## Task 4 : Cron WhatsApp reprise

**Files:**
- Create: `acs_hms_nephrology_dashboard/data/cron_reprise_whatsapp.xml`

*(La méthode `_cron_send_reprise_whatsapp` est déjà dans `dialysis_absence.py` — Task 1. Seul le fichier XML `ir.cron` reste à créer.)*

- [ ] **Step 4.1 : Créer le dossier `data/` et le fichier cron**

```bash
mkdir -p "/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology_dashboard/data"
```

Créer `acs_hms_nephrology_dashboard/data/cron_reprise_whatsapp.xml` :

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data noupdate="1">
        <record id="cron_dialysis_reprise_whatsapp" model="ir.cron">
            <field name="name">Dialyse — Rappel reprise après absence (WhatsApp)</field>
            <field name="model_id" ref="model_acs_dialysis_absence"/>
            <field name="state">code</field>
            <field name="code">model._cron_send_reprise_whatsapp()</field>
            <field name="interval_number">1</field>
            <field name="interval_type">days</field>
            <field name="numbercall">-1</field>
            <field name="active">True</field>
            <field name="nextcall" eval="(DateTime.now() + timedelta(days=1)).replace(hour=23, minute=0, second=0)"/>
        </record>
    </data>
</odoo>
```

- [ ] **Step 4.2 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/data/cron_reprise_whatsapp.xml
git commit -m "feat(nephrology): cron ir.cron WhatsApp reprise absences J-1"
```

---

## Task 5 : Vues XML

**Files:**
- Create: `acs_hms_nephrology_dashboard/views/dialysis_absence_views.xml`
- Create: `acs_hms_nephrology_dashboard/views/dialysis_waitlist_views.xml`
- Create: `acs_hms_nephrology_dashboard/views/dialysis_reschedule_views.xml`
- Create: `acs_hms_nephrology_dashboard/views/procedure_views_ext.xml`

- [ ] **Step 5.1 : Vue absence (form + tree + action + menus)**

Créer `acs_hms_nephrology_dashboard/views/dialysis_absence_views.xml` :

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>

    <!-- ── Tree view ───────────────────────────────────────────────────── -->
    <record id="view_dialysis_absence_tree" model="ir.ui.view">
        <field name="name">acs.dialysis.absence.tree</field>
        <field name="model">acs.dialysis.absence</field>
        <field name="arch" type="xml">
            <list string="Absences patients" decoration-danger="reason == 'deces'"
                  decoration-warning="state == 'confirmed'">
                <field name="patient_id"/>
                <field name="start_date"/>
                <field name="end_date"/>
                <field name="reason"/>
                <field name="state" widget="badge"
                       decoration-info="state == 'draft'"
                       decoration-warning="state == 'confirmed'"
                       decoration-success="state == 'closed'"/>
                <field name="procedure_ids" string="Nb séances" widget="many2many_tags" optional="hide"/>
            </list>
        </field>
    </record>

    <!-- ── Form view ───────────────────────────────────────────────────── -->
    <record id="view_dialysis_absence_form" model="ir.ui.view">
        <field name="name">acs.dialysis.absence.form</field>
        <field name="model">acs.dialysis.absence</field>
        <field name="arch" type="xml">
            <form string="Absence patient">
                <header>
                    <button name="action_confirm" string="Confirmer" type="object"
                            class="btn-primary" invisible="state != 'draft'"/>
                    <button name="action_close_and_notify" string="Clôturer + Notifier reprise"
                            type="object" class="btn-primary"
                            invisible="state != 'confirmed'"
                            confirm="Envoyer le WhatsApp de reprise et clôturer l'absence ?"/>
                    <button name="action_cancel" string="Annuler" type="object"
                            invisible="state not in ('draft', 'confirmed')"/>
                    <field name="state" widget="statusbar"
                           statusbar_visible="draft,confirmed,closed"/>
                </header>
                <sheet>
                    <group>
                        <group>
                            <field name="patient_id"/>
                            <field name="reason"/>
                        </group>
                        <group>
                            <field name="start_date"/>
                            <field name="end_date"/>
                        </group>
                    </group>
                    <field name="notes" placeholder="Notes éventuelles…"/>
                    <notebook>
                        <page string="Séances concernées">
                            <field name="procedure_ids" readonly="1">
                                <list>
                                    <field name="date"/>
                                    <field name="nephrology_schedule_ids" widget="many2many_tags"/>
                                    <field name="state" widget="badge"/>
                                </list>
                            </field>
                        </page>
                    </notebook>
                </sheet>
                <div class="oe_chatter">
                    <field name="message_follower_ids"/>
                    <field name="activity_ids"/>
                    <field name="message_ids"/>
                </div>
            </form>
        </field>
    </record>

    <!-- ── Filtres ────────────────────────────────────────────────────── -->
    <record id="view_dialysis_absence_search" model="ir.ui.view">
        <field name="name">acs.dialysis.absence.search</field>
        <field name="model">acs.dialysis.absence</field>
        <field name="arch" type="xml">
            <search>
                <field name="patient_id"/>
                <filter string="En cours" name="confirmed" domain="[('state','=','confirmed')]"/>
                <filter string="Clôturées" name="closed" domain="[('state','=','closed')]"/>
                <filter string="Décès" name="deces" domain="[('reason','=','deces')]"/>
                <filter string="Ce mois" name="this_month"
                        domain="[('start_date','&gt;=', (context_today()).strftime('%Y-%m-01'))]"/>
                <group expand="0" string="Regrouper par">
                    <filter string="Motif" name="group_reason" context="{'group_by': 'reason'}"/>
                    <filter string="Patient" name="group_patient" context="{'group_by': 'patient_id'}"/>
                    <filter string="Mois" name="group_month" context="{'group_by': 'start_date:month'}"/>
                </group>
            </search>
        </field>
    </record>

    <!-- ── Action ─────────────────────────────────────────────────────── -->
    <record id="action_dialysis_absence" model="ir.actions.act_window">
        <field name="name">Absences patients</field>
        <field name="res_model">acs.dialysis.absence</field>
        <field name="view_mode">list,form</field>
        <field name="search_view_id" ref="view_dialysis_absence_search"/>
    </record>

    <!-- ── Menus ──────────────────────────────────────────────────────── -->
    <menuitem
        id="menu_dialysis_absences"
        name="Absences patients"
        parent="acs_hms_nephrology.nephrology_menu_root"
        action="action_dialysis_absence"
        groups="acs_hms.group_hms_receptionist,acs_hms.group_hms_physician"
        sequence="20"/>

</odoo>
```

- [ ] **Step 5.2 : Vue liste d'attente**

Créer `acs_hms_nephrology_dashboard/views/dialysis_waitlist_views.xml` :

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>

    <record id="view_dialysis_waitlist_tree" model="ir.ui.view">
        <field name="name">acs.dialysis.waitlist.tree</field>
        <field name="model">acs.dialysis.waitlist</field>
        <field name="arch" type="xml">
            <list string="Liste d'attente dialyse">
                <field name="patient_id"/>
                <field name="schedule_id"/>
                <field name="request_date"/>
                <field name="state" widget="badge"
                       decoration-warning="state == 'waiting'"
                       decoration-info="state == 'notified'"
                       decoration-success="state == 'fulfilled'"/>
                <button name="action_notify_manually" string="Notifier"
                        type="object" class="btn-sm btn-warning"
                        invisible="state != 'waiting'"/>
            </list>
        </field>
    </record>

    <record id="view_dialysis_waitlist_search" model="ir.ui.view">
        <field name="name">acs.dialysis.waitlist.search</field>
        <field name="model">acs.dialysis.waitlist</field>
        <field name="arch" type="xml">
            <search>
                <field name="patient_id"/>
                <field name="schedule_id"/>
                <filter string="En attente" name="waiting" domain="[('state','=','waiting')]"/>
                <filter string="Notifiés" name="notified" domain="[('state','=','notified')]"/>
            </search>
        </field>
    </record>

    <record id="action_dialysis_waitlist" model="ir.actions.act_window">
        <field name="name">Liste d'attente</field>
        <field name="res_model">acs.dialysis.waitlist</field>
        <field name="view_mode">list</field>
        <field name="search_view_id" ref="view_dialysis_waitlist_search"/>
    </record>

    <menuitem
        id="menu_dialysis_waitlist"
        name="Liste d'attente"
        parent="acs_hms_nephrology.nephrology_menu_root"
        action="action_dialysis_waitlist"
        groups="acs_hms.group_hms_receptionist,acs_hms.group_hms_physician"
        sequence="21"/>

</odoo>
```

- [ ] **Step 5.3 : Vue wizard de report**

Créer `acs_hms_nephrology_dashboard/views/dialysis_reschedule_views.xml` :

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>

    <record id="view_dialysis_reschedule_form" model="ir.ui.view">
        <field name="name">dialysis.session.reschedule.form</field>
        <field name="model">dialysis.session.reschedule</field>
        <field name="arch" type="xml">
            <form string="Reporter la séance">
                <group>
                    <group string="Date">
                        <field name="original_date" string="Date actuelle" readonly="1"/>
                        <field name="new_date"/>
                    </group>
                    <group string="Poste">
                        <field name="station_id"/>
                        <field name="slots_available" string="Places disponibles" readonly="1"/>
                    </group>
                </group>
                <group>
                    <field name="add_to_waitlist"
                           invisible="slots_available &gt; 0"/>
                </group>
                <footer>
                    <button name="action_confirm" string="Confirmer le report"
                            type="object" class="btn-primary"/>
                    <button string="Annuler" class="btn-secondary" special="cancel"/>
                </footer>
            </form>
        </field>
    </record>

    <record id="action_dialysis_reschedule_wizard" model="ir.actions.act_window">
        <field name="name">Reporter la séance</field>
        <field name="res_model">dialysis.session.reschedule</field>
        <field name="view_mode">form</field>
        <field name="target">new</field>
        <field name="context">{'default_procedure_id': active_id}</field>
    </record>

</odoo>
```

- [ ] **Step 5.4 : Extension vue `acs.patient.procedure` — bouton Reporter**

Créer `acs_hms_nephrology_dashboard/views/procedure_views_ext.xml` :

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>

    <record id="view_patient_procedure_form_reporter" model="ir.ui.view">
        <field name="name">acs.patient.procedure.form.reporter</field>
        <field name="model">acs.patient.procedure</field>
        <field name="inherit_id" ref="acs_hms.view_patient_procedure_form"/>
        <field name="arch" type="xml">
            <xpath expr="//header" position="inside">
                <button name="%(action_dialysis_reschedule_wizard)d"
                        string="Reporter"
                        type="action"
                        invisible="state not in ('scheduled',)"
                        class="btn-secondary"/>
            </xpath>
        </field>
    </record>

</odoo>
```

- [ ] **Step 5.5 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/views/dialysis_absence_views.xml \
        acs_hms_nephrology_dashboard/views/dialysis_waitlist_views.xml \
        acs_hms_nephrology_dashboard/views/dialysis_reschedule_views.xml \
        acs_hms_nephrology_dashboard/views/procedure_views_ext.xml
git commit -m "feat(nephrology): vues XML absences, liste d'attente, wizard report"
```

---

## Task 6 : Sécurité + manifest

**Files:**
- Modify: `acs_hms_nephrology_dashboard/security/ir.model.access.csv`
- Modify: `acs_hms_nephrology_dashboard/__manifest__.py`

- [ ] **Step 6.1 : Ajouter les droits d'accès**

Ajouter à `acs_hms_nephrology_dashboard/security/ir.model.access.csv` :

```csv
access_acs_dialysis_absence_receptionist,acs.dialysis.absence receptionist,acs_hms_nephrology_dashboard.model_acs_dialysis_absence,acs_hms.group_hms_receptionist,1,1,1,1
access_acs_dialysis_absence_physician,acs.dialysis.absence physician,acs_hms_nephrology_dashboard.model_acs_dialysis_absence,acs_hms.group_hms_physician,1,1,0,0
access_acs_dialysis_waitlist_receptionist,acs.dialysis.waitlist receptionist,acs_hms_nephrology_dashboard.model_acs_dialysis_waitlist,acs_hms.group_hms_receptionist,1,1,1,1
access_acs_dialysis_waitlist_physician,acs.dialysis.waitlist physician,acs_hms_nephrology_dashboard.model_acs_dialysis_waitlist,acs_hms.group_hms_physician,1,1,0,0
access_dialysis_session_reschedule_receptionist,dialysis.session.reschedule receptionist,acs_hms_nephrology_dashboard.model_dialysis_session_reschedule,acs_hms.group_hms_receptionist,1,1,1,1
access_dialysis_session_reschedule_nurse,dialysis.session.reschedule nurse,acs_hms_nephrology_dashboard.model_dialysis_session_reschedule,acs_hms.group_hms_nurse,1,1,1,1
```

- [ ] **Step 6.2 : Mettre à jour `__manifest__.py`**

Remplacer le contenu de `acs_hms_nephrology_dashboard/__manifest__.py` :

```python
# -*- coding: utf-8 -*-
{
    'name': 'Nephrology Dashboard',
    'version': '1.0.0',
    'category': 'Medical',
    'summary': 'Interface infirmier tablette + dashboard médecin + gestion absences (OWL)',
    'depends': [
        'acs_hms_nephrology',
        'acs_hms_nephrology_complications',
        'acs_hms_whatsapp',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/cron_reprise_whatsapp.xml',
        'views/nurse_dashboard_action.xml',
        'views/doctor_dashboard_action.xml',
        'views/dialysis_calendar_action.xml',
        'views/dialysis_absence_views.xml',
        'views/dialysis_waitlist_views.xml',
        'views/dialysis_reschedule_views.xml',
        'views/procedure_views_ext.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'acs_hms_nephrology_dashboard/static/src/**/*.js',
            'acs_hms_nephrology_dashboard/static/src/**/*.xml',
            'acs_hms_nephrology_dashboard/static/src/**/*.css',
        ],
    },
    'application': False,
    'installable': True,
    'license': 'OPL-1',
}
```

- [ ] **Step 6.3 : Lancer la suite de tests complète du module**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
python -m pytest acs_hms_nephrology_dashboard/tests/ -v 2>&1 | tail -30
```

Attendu : tous les tests PASS (absence, reschedule, calendar, nurse, doctor).

- [ ] **Step 6.4 : Commit final**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/security/ir.model.access.csv \
        acs_hms_nephrology_dashboard/__manifest__.py
git commit -m "feat(nephrology): sécurité + manifest — section 4.4 complète"
```

---

## Self-Review — Couverture spec

| Exigence spec (§4.4) | Tâche | Status |
|---|---|---|
| Modèle `acs.dialysis.absence` avec patient, dates, reason | Task 1 | ✓ |
| Statut "Absence justifiée" sur `acs.patient.procedure` | Task 1 | ✓ |
| Séances concernées → state = 'absent' à la confirmation | Task 1 | ✓ |
| Report de séance : ancienne date → nouvelle date | Task 3 | ✓ |
| Vérification poste disponible | Task 3 (`slots_available`) | ✓ |
| Mise à jour `hms.appointment` lors du report | Task 3 (`action_confirm`) | ✓ |
| Liste d'attente si poste saturé | Task 2 + Task 3 | ✓ |
| Notification automatique si libération | Task 1 (`_check_waitlist_notification`) | ✓ |
| WhatsApp automatique à la reprise (cron J-1) | Task 1 + Task 4 | ✓ |
| Bouton manuel clôture + WhatsApp | Task 1 (`action_close_and_notify`) | ✓ |
| Menus Absences + Liste d'attente | Task 5 | ✓ |
| Droits receptionist + physician + nurse | Task 6 | ✓ |
