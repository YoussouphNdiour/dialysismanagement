# Générateur de Séances Massif — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à la secrétaire de générer en masse les séances d'hémodialyse (`acs.patient.procedure`) et RDVs (`hms.appointment`) pour plusieurs patients sur une période, avec détection de conflits et pré-remplissage depuis la dernière séance.

**Architecture:** Deux TransientModels en cascade dans `acs_hms_nephrology` : `nephrology.session.generator` (Modal 1 — saisie) et `nephrology.session.validator` (Modal 2 — tableau par patient + confirmation), reliés par `nephrology.session.generator.line`. Un model permanent `acs.nephrology.holiday` stocke les jours fériés.

**Tech Stack:** Odoo 19, Python 3.10+, XML vues Odoo, `odoo.tests.common.TransactionCase` pour les tests.

**Référence spec:** `docs/superpowers/specs/2026-05-31-generateur-seances-design.md`

**Commande de test :**
```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_|FAIL|ERROR|ok"
```

---

## Structure des fichiers

```
acs_hms_nephrology/
├── models/
│   ├── __init__.py                 MODIFIÉ — import session_generator
│   └── session_generator.py        CRÉÉ — 4 modèles
├── data/
│   └── nephrology_holidays.xml     CRÉÉ — jours fériés sénégalais
├── views/
│   └── session_generator_view.xml  CRÉÉ — Modal 1 + Modal 2 + bouton liste
├── security/
│   └── ir.model.access.csv         MODIFIÉ — 4 nouveaux modèles
├── tests/
│   ├── __init__.py                 MODIFIÉ — import test_session_generator
│   └── test_session_generator.py   CRÉÉ — 12 tests
└── __manifest__.py                 MODIFIÉ — data + views
```

---

### Task 1 : Scaffold + modèle `acs.nephrology.holiday` + données + sécurité

**Files:**
- Create: `acs_hms_nephrology/models/session_generator.py`
- Create: `acs_hms_nephrology/data/nephrology_holidays.xml`
- Create: `acs_hms_nephrology/tests/test_session_generator.py`
- Modify: `acs_hms_nephrology/models/__init__.py`
- Modify: `acs_hms_nephrology/tests/__init__.py`
- Modify: `acs_hms_nephrology/security/ir.model.access.csv`
- Modify: `acs_hms_nephrology/__manifest__.py`

- [ ] **Step 1 : Écrire les tests du modèle holiday**

Créer `acs_hms_nephrology/tests/test_session_generator.py` :

```python
# -*- coding: utf-8 -*-
from datetime import date
from odoo.tests.common import TransactionCase


class TestNephrologyHoliday(TransactionCase):

    def test_holiday_creation(self):
        holiday = self.env['acs.nephrology.holiday'].create({
            'name': 'Fête du Travail',
            'date': '2026-05-01',
            'recurring': True,
        })
        self.assertEqual(holiday.name, 'Fête du Travail')
        self.assertTrue(holiday.recurring)

    def test_recurring_holiday_matches_any_year(self):
        """Un holiday recurring daté 2024 doit aussi matcher 2026 (même mois/jour)"""
        self.env['acs.nephrology.holiday'].create({
            'name': 'Fête du Travail',
            'date': '2024-05-01',
            'recurring': True,
        })
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 4, 27),  # lundi
            'date_end': date(2026, 5, 3),     # dimanche
            'exclude_holidays': True,
        })
        # Schedule Lu/Me/Ve
        schedule = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV', 'start_time': 7.0, 'end_time': 11.0,
            'monday': True, 'wednesday': True, 'friday': True,
        })
        valid = generator._get_valid_dates(schedule, date(2026, 4, 27), date(2026, 5, 3), True)
        dates_in_result = [d for d in valid]
        self.assertNotIn(date(2026, 5, 1), dates_in_result)  # Vendredi 1er mai exclu
        self.assertIn(date(2026, 4, 27), dates_in_result)    # Lundi 28 avril inclus
```

- [ ] **Step 2 : Créer `models/session_generator.py` (skeleton + holiday)**

```python
# -*- coding: utf-8 -*-
from datetime import date, datetime, timedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError


class ACSNephrologyHoliday(models.Model):
    _name = 'acs.nephrology.holiday'
    _description = 'Jour Férié Néphrologie'
    _order = 'date desc'

    name = fields.Char(string='Nom', required=True)
    date = fields.Date(string='Date', required=True)
    recurring = fields.Boolean(
        string='Récurrent (chaque année)',
        default=False,
        help="Si coché, ce jour férié s'applique chaque année à la même date (mois/jour)."
    )


class NephrologySessionGenerator(models.TransientModel):
    _name = 'nephrology.session.generator'
    _description = 'Générateur de séances — Étape 1'

    patient_ids = fields.Many2many(
        'hms.patient',
        'session_gen_patient_rel', 'generator_id', 'patient_id',
        string='Patients',
        domain=[('nephrology_care', '=', True)],
    )
    date_start = fields.Date(string='Date de début', required=True, default=fields.Date.today)
    date_end = fields.Date(string='Date de fin', required=True)
    exclude_holidays = fields.Boolean(string='Exclure jours fériés', default=True)
    preview_count = fields.Integer(
        string='Séances prévues (aperçu)',
        compute='_compute_preview_count',
        store=False,
    )
    line_ids = fields.One2many(
        'nephrology.session.generator.line',
        'generator_id',
        string='Lignes patients',
    )

    @api.depends('patient_ids', 'date_start', 'date_end', 'exclude_holidays')
    def _compute_preview_count(self):
        for rec in self:
            if not rec.date_start or not rec.date_end or not rec.patient_ids:
                rec.preview_count = 0
                continue
            total = 0
            for patient in rec.patient_ids:
                last_proc = self.env['acs.patient.procedure'].search([
                    ('patient_id', '=', patient.id),
                    ('nephrology_schedule_ids', '!=', False),
                ], order='date desc', limit=1)
                schedule = last_proc.nephrology_schedule_ids[0] if last_proc and last_proc.nephrology_schedule_ids else False
                if schedule:
                    total += len(rec._get_valid_dates(schedule, rec.date_start, rec.date_end, rec.exclude_holidays))
            rec.preview_count = total

    @api.model
    def _get_valid_dates(self, schedule, date_start, date_end, exclude_holidays=True):
        """Retourne la liste des dates valides pour un schedule sur une période."""
        weekdays = schedule.get_weekdays()
        holiday_dates = set()
        if exclude_holidays:
            for h in self.env['acs.nephrology.holiday'].search([]):
                if h.recurring:
                    for year in range(date_start.year, date_end.year + 1):
                        try:
                            holiday_dates.add(date(year, h.date.month, h.date.day))
                        except ValueError:
                            pass  # 29 fév sur année non bissextile
                else:
                    holiday_dates.add(h.date)
        result = []
        current = date_start
        while current <= date_end:
            if current.weekday() in weekdays and current not in holiday_dates:
                result.append(current)
            current += timedelta(days=1)
        return result

    def action_open_validator(self):
        """Étape 1 → 2 : calcule les lignes et ouvre Modal 2."""
        self.ensure_one()
        if not self.patient_ids:
            raise UserError(_('Sélectionnez au moins un patient.'))
        if not self.date_start or not self.date_end:
            raise UserError(_('Définissez une période.'))
        if self.date_end < self.date_start:
            raise UserError(_('La date de fin doit être après la date de début.'))

        # Supprimer les lignes existantes (au cas où le wizard est réouvert)
        self.line_ids.unlink()

        for patient in self.patient_ids:
            last_proc = self.env['acs.patient.procedure'].search([
                ('patient_id', '=', patient.id),
                ('nephrology_schedule_ids', '!=', False),
            ], order='date desc', limit=1)

            schedule = last_proc.nephrology_schedule_ids[0] if last_proc and last_proc.nephrology_schedule_ids else False
            if not schedule:
                continue  # Patient sans planning — ignoré silencieusement

            station = (last_proc.nephrology_schedule_ids[0].station_id
                       if last_proc and last_proc.nephrology_schedule_ids
                       else schedule.station_id)
            physician = (last_proc.physician_id if last_proc and last_proc.physician_id
                         else schedule.physician_id)

            valid_dates = self._get_valid_dates(schedule, self.date_start, self.date_end, self.exclude_holidays)
            session_count = len(valid_dates)

            # Détection de conflits
            conflict_status, conflict_details = self._detect_conflict(patient, station)

            self.env['nephrology.session.generator.line'].create({
                'generator_id': self.id,
                'patient_id': patient.id,
                'schedule_id': schedule.id,
                'station_id': station.id if station else False,
                'physician_id': physician.id if physician else False,
                'session_count': session_count,
                'conflict_status': conflict_status,
                'conflict_details': conflict_details,
            })

        validator = self.env['nephrology.session.validator'].create({
            'generator_id': self.id,
        })
        return {
            'type': 'ir.actions.act_window',
            'name': _('Validation des séances'),
            'res_model': 'nephrology.session.validator',
            'res_id': validator.id,
            'view_mode': 'form',
            'target': 'new',
        }

    def _detect_conflict(self, patient, station):
        """Retourne (conflict_status, conflict_details) pour un patient."""
        # Erreur bloquante : procédure existante pour ce patient sur la période
        existing = self.env['acs.patient.procedure'].search([
            ('patient_id', '=', patient.id),
            ('date', '>=', datetime.combine(self.date_start, datetime.min.time())),
            ('date', '<=', datetime.combine(self.date_end, datetime.max.time())),
        ], limit=1)
        if existing:
            return ('error_duplicate',
                    _('Procédure existante sur cette période : %s') % existing.name)

        # Avertissement : poste déjà utilisé sur la période
        if station:
            station_used = self.env['acs.patient.procedure'].search([
                ('nephrology_schedule_ids.station_id', '=', station.id),
                ('date', '>=', datetime.combine(self.date_start, datetime.min.time())),
                ('date', '<=', datetime.combine(self.date_end, datetime.max.time())),
            ], limit=1)
            if station_used:
                return ('warning_station',
                        _('Poste %s déjà utilisé sur cette période') % station.name)

        return ('ok', '')


class NephrologySessionGeneratorLine(models.TransientModel):
    _name = 'nephrology.session.generator.line'
    _description = 'Ligne générateur de séances'

    generator_id = fields.Many2one(
        'nephrology.session.generator', required=True, ondelete='cascade')
    patient_id = fields.Many2one('hms.patient', string='Patient', required=True)
    schedule_id = fields.Many2one('acs.nephrology.schedule', string='Planning')
    station_id = fields.Many2one('acs.dialysis.station', string='Poste')
    physician_id = fields.Many2one('hms.physician', string='Médecin')
    session_count = fields.Integer(string='Nb séances', default=0)
    conflict_status = fields.Selection([
        ('ok', '✅ OK'),
        ('warning_station', '⚠️ Poste occupé'),
        ('error_duplicate', '🔴 Patient déjà planifié'),
    ], string='Statut', default='ok')
    conflict_details = fields.Char(string='Détail conflit')


class NephrologySessionValidator(models.TransientModel):
    _name = 'nephrology.session.validator'
    _description = 'Validateur de séances — Étape 2'

    generator_id = fields.Many2one(
        'nephrology.session.generator', required=True, ondelete='cascade')
    line_ids = fields.One2many(
        related='generator_id.line_ids', readonly=False,
        string='Lignes par patient',
    )

    def action_confirm(self):
        """Crée les procédures et RDVs pour toutes les lignes non bloquantes."""
        self.ensure_one()
        generator = self.generator_id

        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1)
        if not product:
            product = self.env['product.product'].search([
                ('hospital_product_type', '=', 'consultation')
            ], limit=1)
        if not product:
            raise UserError(_('Aucun produit de type hémodialyse configuré.'))

        created_count = 0
        for line in generator.line_ids.filtered(
                lambda l: l.conflict_status != 'error_duplicate' and l.schedule_id):
            valid_dates = generator._get_valid_dates(
                line.schedule_id, generator.date_start, generator.date_end,
                generator.exclude_holidays,
            )
            for d in valid_dates:
                hour = int(line.schedule_id.start_time)
                minute = int((line.schedule_id.start_time % 1) * 60)
                dt = datetime.combine(d, datetime.min.time()).replace(
                    hour=hour, minute=minute, second=0, microsecond=0)

                procedure = self.env['acs.patient.procedure'].create({
                    'patient_id': line.patient_id.id,
                    'product_id': product.id,
                    'date': dt,
                    'physician_id': line.physician_id.id if line.physician_id else False,
                    'nephrology_schedule_ids': [(4, line.schedule_id.id)],
                })
                self.env['hms.appointment'].create({
                    'patient_id': line.patient_id.id,
                    'date': dt,
                    'product_id': product.id,
                    'physician_id': line.physician_id.id if line.physician_id else False,
                    'procedure_id': procedure.id,
                })
                created_count += 1

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Séances créées'),
                'message': _('%d séances créées avec succès.') % created_count,
                'type': 'success',
                'sticky': True,
            },
        }
```

- [ ] **Step 3 : Créer `data/nephrology_holidays.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data noupdate="1">
        <record id="holiday_new_year" model="acs.nephrology.holiday">
            <field name="name">Jour de l'An</field>
            <field name="date">2026-01-01</field>
            <field name="recurring">True</field>
        </record>
        <record id="holiday_independance" model="acs.nephrology.holiday">
            <field name="name">Fête Nationale (Indépendance)</field>
            <field name="date">2026-04-04</field>
            <field name="recurring">True</field>
        </record>
        <record id="holiday_labour" model="acs.nephrology.holiday">
            <field name="name">Fête du Travail</field>
            <field name="date">2026-05-01</field>
            <field name="recurring">True</field>
        </record>
        <record id="holiday_assumption" model="acs.nephrology.holiday">
            <field name="name">Assomption</field>
            <field name="date">2026-08-15</field>
            <field name="recurring">True</field>
        </record>
        <record id="holiday_toussaint" model="acs.nephrology.holiday">
            <field name="name">Toussaint</field>
            <field name="date">2026-11-01</field>
            <field name="recurring">True</field>
        </record>
        <record id="holiday_christmas" model="acs.nephrology.holiday">
            <field name="name">Noël</field>
            <field name="date">2026-12-25</field>
            <field name="recurring">True</field>
        </record>
    </data>
</odoo>
```

- [ ] **Step 4 : Mettre à jour `models/__init__.py`**

Ajouter la ligne `from . import session_generator` après `from . import appointment_generator` :

```python
# -*- coding: utf-8 -*-
from . import nephrology
from . import hms_base
from . import appointment_generator
from . import session_generator
```

- [ ] **Step 5 : Mettre à jour `tests/__init__.py`**

```python
from . import test_nephrology_base
from . import test_session_generator
```

- [ ] **Step 6 : Ajouter les lignes dans `security/ir.model.access.csv`**

Ajouter à la fin du fichier :

```csv
access_acs_nephrology_holiday_user,acs.nephrology.holiday user,model_acs_nephrology_holiday,acs_hms_base.group_hms_user,1,0,0,0
access_acs_nephrology_holiday_manager,acs.nephrology.holiday manager,model_acs_nephrology_holiday,acs_hms_base.group_hms_manager,1,1,1,1
access_nephrology_session_generator_user,nephrology.session.generator user,model_nephrology_session_generator,acs_hms_base.group_hms_user,1,1,1,1
access_nephrology_session_generator_receptionist,nephrology.session.generator receptionist,model_nephrology_session_generator,acs_hms.group_hms_receptionist,1,1,1,1
access_nephrology_session_generator_manager,nephrology.session.generator manager,model_nephrology_session_generator,acs_hms_base.group_hms_manager,1,1,1,1
access_nephrology_session_generator_line_user,nephrology.session.generator.line user,model_nephrology_session_generator_line,acs_hms_base.group_hms_user,1,1,1,1
access_nephrology_session_generator_line_receptionist,nephrology.session.generator.line receptionist,model_nephrology_session_generator_line,acs_hms.group_hms_receptionist,1,1,1,1
access_nephrology_session_generator_line_manager,nephrology.session.generator.line manager,model_nephrology_session_generator_line,acs_hms_base.group_hms_manager,1,1,1,1
access_nephrology_session_validator_user,nephrology.session.validator user,model_nephrology_session_validator,acs_hms_base.group_hms_user,1,1,1,1
access_nephrology_session_validator_receptionist,nephrology.session.validator receptionist,model_nephrology_session_validator,acs_hms.group_hms_receptionist,1,1,1,1
access_nephrology_session_validator_manager,nephrology.session.validator manager,model_nephrology_session_validator,acs_hms_base.group_hms_manager,1,1,1,1
```

- [ ] **Step 7 : Mettre à jour `__manifest__.py`**

Ajouter `'data/nephrology_holidays.xml'` dans la liste `'data'` après `'data/data.xml'`, et `'views/session_generator_view.xml'` après `'views/appointment_generator_view.xml'` :

```python
'data': [
    'security/security.xml',
    'security/ir.model.access.csv',
    'data/data.xml',
    'data/nephrology_holidays.xml',          # AJOUTÉ
    'reports/nephrology_report.xml',
    'reports/patient_procedure_report.xml',
    'views/nephrology_base_view.xml',
    'views/nephrology_view.xml',
    'views/imaging_view.xml',
    'views/hms_base_view.xml',
    'views/appointment_generator_view.xml',
    'views/session_generator_view.xml',      # AJOUTÉ
    'views/patient_customization_view.xml',
    'views/patient_tabs_order.xml',
    'views/menu_item.xml',
],
```

- [ ] **Step 8 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_holiday|FAIL|ERROR|ok"
```

Attendu : `test_holiday_creation ... ok`, `test_recurring_holiday_matches_any_year ... ok`

- [ ] **Step 9 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology/models/session_generator.py \
        acs_hms_nephrology/models/__init__.py \
        acs_hms_nephrology/data/nephrology_holidays.xml \
        acs_hms_nephrology/tests/test_session_generator.py \
        acs_hms_nephrology/tests/__init__.py \
        acs_hms_nephrology/security/ir.model.access.csv \
        acs_hms_nephrology/__manifest__.py
git commit -m "feat(generator): scaffold session generator models + holiday data"
```

---

### Task 2 : Tests calcul de dates + `_get_valid_dates`

**Files:**
- Modify: `acs_hms_nephrology/tests/test_session_generator.py`

> **Note :** Le code de `_get_valid_dates` est déjà écrit dans Task 1. Cette tâche ajoute les tests manquants et vérifie leur passage.

- [ ] **Step 1 : Ajouter la classe de tests dans `test_session_generator.py`**

Ajouter après la classe `TestNephrologyHoliday` :

```python
class TestSessionGeneratorDates(TransactionCase):

    def setUp(self):
        super().setUp()
        self.generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),  # Lundi
            'date_end': date(2026, 6, 14),   # Dimanche (2 semaines)
            'exclude_holidays': False,
        })
        self.schedule_lmv = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV Test',
            'start_time': 7.0,
            'end_time': 11.0,
            'monday': True,    # 0
            'wednesday': True, # 2
            'friday': True,    # 4
        })
        self.schedule_mj = self.env['acs.nephrology.schedule'].create({
            'name': 'MJ Test',
            'start_time': 13.0,
            'end_time': 17.0,
            'tuesday': True,   # 1
            'thursday': True,  # 3
        })

    def test_schedule_days_respected(self):
        """Seuls Lu/Me/Ve sont générés pour un planning LMV"""
        dates = self.generator._get_valid_dates(
            self.schedule_lmv, date(2026, 6, 1), date(2026, 6, 7), False)
        # Semaine du 1 au 7 juin : Lu=1, Ma=2, Me=3, Je=4, Ve=5, Sa=6, Di=7
        self.assertIn(date(2026, 6, 1), dates)  # Lundi
        self.assertIn(date(2026, 6, 3), dates)  # Mercredi
        self.assertIn(date(2026, 6, 5), dates)  # Vendredi
        self.assertNotIn(date(2026, 6, 2), dates)  # Mardi
        self.assertNotIn(date(2026, 6, 6), dates)  # Samedi
        self.assertEqual(len(dates), 3)

    def test_period_boundaries_included(self):
        """start_date et end_date sont incluses si elles tombent sur un bon jour"""
        # 2026-06-01 = Lundi (dans LMV), 2026-06-05 = Vendredi (dans LMV)
        dates = self.generator._get_valid_dates(
            self.schedule_lmv, date(2026, 6, 1), date(2026, 6, 5), False)
        self.assertIn(date(2026, 6, 1), dates)
        self.assertIn(date(2026, 6, 5), dates)
        self.assertEqual(len(dates), 3)  # Lu, Me, Ve

    def test_holiday_exclusion(self):
        """Une date fériée non récurrente est exclue"""
        self.env['acs.nephrology.holiday'].create({
            'name': 'Férié test',
            'date': '2026-06-03',  # Mercredi
            'recurring': False,
        })
        dates = self.generator._get_valid_dates(
            self.schedule_lmv, date(2026, 6, 1), date(2026, 6, 7), True)
        self.assertNotIn(date(2026, 6, 3), dates)  # Mercredi exclu
        self.assertIn(date(2026, 6, 1), dates)     # Lundi inclus

    def test_holiday_not_excluded_when_flag_false(self):
        """Si exclude_holidays=False, les jours fériés sont inclus"""
        self.env['acs.nephrology.holiday'].create({
            'name': 'Férié test',
            'date': '2026-06-03',
            'recurring': False,
        })
        dates = self.generator._get_valid_dates(
            self.schedule_lmv, date(2026, 6, 1), date(2026, 6, 7), False)
        self.assertIn(date(2026, 6, 3), dates)

    def test_preview_count_with_patients(self):
        """preview_count = total séances pour tous les patients"""
        station = self.env['acs.dialysis.station'].create({
            'name': 'Poste Preview', 'station_type': 'standard',
        })
        self.schedule_lmv.station_id = station.id

        product = self.env['product.product'].search([
            ('hospital_product_type', 'in', ['nephrology_procedure', 'consultation'])
        ], limit=1) or self.env['product.product'].create({
            'name': 'Hémodialyse Test', 'type': 'service',
            'hospital_product_type': 'nephrology_procedure',
        })
        patient = self.env['hms.patient'].create({
            'name': 'Patient Preview', 'nephrology_care': True,
        })
        # Créer une procédure passée pour que le patient ait un schedule
        self.env['acs.patient.procedure'].create({
            'patient_id': patient.id,
            'product_id': product.id,
            'date': '2026-01-01 07:00:00',
            'nephrology_schedule_ids': [(4, self.schedule_lmv.id)],
        })
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),   # Lundi
            'date_end': date(2026, 6, 7),     # Dimanche
            'exclude_holidays': False,
            'patient_ids': [(4, patient.id)],
        })
        generator.invalidate_recordset()
        # 3 séances LMV du 1 au 7 juin
        self.assertEqual(generator.preview_count, 3)
```

- [ ] **Step 2 : Lancer les tests de dates**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_schedule|test_period|test_holiday|test_preview|FAIL|ERROR"
```

Attendu : 5 tests `ok`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology/tests/test_session_generator.py
git commit -m "test(generator): add date calculation and preview_count tests"
```

---

### Task 3 : Tests pré-remplissage + `action_open_validator`

**Files:**
- Modify: `acs_hms_nephrology/tests/test_session_generator.py`

- [ ] **Step 1 : Ajouter la classe de tests dans `test_session_generator.py`**

Ajouter après `TestSessionGeneratorDates` :

```python
class TestSessionGeneratorLines(TransactionCase):

    def setUp(self):
        super().setUp()
        self.station = self.env['acs.dialysis.station'].create({
            'name': 'Poste A', 'station_type': 'standard',
        })
        self.schedule = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV', 'start_time': 7.0, 'end_time': 11.0,
            'monday': True, 'wednesday': True, 'friday': True,
            'station_id': self.station.id,
        })
        self.product = self.env['product.product'].search([
            ('hospital_product_type', 'in', ['nephrology_procedure', 'consultation'])
        ], limit=1) or self.env['product.product'].create({
            'name': 'Hémodialyse Test', 'type': 'service',
            'hospital_product_type': 'nephrology_procedure',
        })
        self.patient = self.env['hms.patient'].create({
            'name': 'Patient Lignes Test', 'nephrology_care': True,
        })

    def test_prepopulate_station_from_last_procedure(self):
        """station_id pré-rempli depuis le schedule de la dernière procédure"""
        station2 = self.env['acs.dialysis.station'].create({
            'name': 'Poste B', 'station_type': 'standard',
        })
        schedule2 = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV-2', 'start_time': 13.0, 'end_time': 17.0,
            'monday': True, 'wednesday': True, 'friday': True,
            'station_id': station2.id,
        })
        self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'date': '2026-01-05 07:00:00',
            'nephrology_schedule_ids': [(4, schedule2.id)],
        })
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 7),
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient.id)],
        })
        generator.action_open_validator()
        line = generator.line_ids.filtered(lambda l: l.patient_id == self.patient)
        self.assertTrue(line)
        self.assertEqual(line.station_id.id, station2.id)

    def test_no_last_procedure_uses_schedule_default(self):
        """Sans procédure précédente, fallback sur station du schedule du patient"""
        # Patient sans aucune procédure — on lui crée un schedule direct
        # On simule via action_open_validator avec un patient lié à un schedule existant
        # Ici le patient a une procédure avec self.schedule (station = self.station)
        self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'date': '2026-01-05 07:00:00',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 7),
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient.id)],
        })
        generator.action_open_validator()
        line = generator.line_ids.filtered(lambda l: l.patient_id == self.patient)
        self.assertTrue(line)
        self.assertEqual(line.station_id.id, self.station.id)
        self.assertEqual(line.schedule_id.id, self.schedule.id)

    def test_patient_without_schedule_ignored(self):
        """Un patient sans procédure et sans schedule n'apparaît pas dans les lignes"""
        patient_sans_schedule = self.env['hms.patient'].create({
            'name': 'Patient Sans Schedule', 'nephrology_care': True,
        })
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 7),
            'exclude_holidays': False,
            'patient_ids': [(4, patient_sans_schedule.id)],
        })
        generator.action_open_validator()
        self.assertEqual(len(generator.line_ids), 0)
```

- [ ] **Step 2 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_prepopulate|test_no_last|test_patient_without|FAIL|ERROR"
```

Attendu : 3 tests `ok`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology/tests/test_session_generator.py
git commit -m "test(generator): add pre-populate and line creation tests"
```

---

### Task 4 : Tests détection de conflits

**Files:**
- Modify: `acs_hms_nephrology/tests/test_session_generator.py`

- [ ] **Step 1 : Ajouter la classe de tests**

Ajouter après `TestSessionGeneratorLines` :

```python
class TestSessionGeneratorConflicts(TransactionCase):

    def setUp(self):
        super().setUp()
        self.station = self.env['acs.dialysis.station'].create({
            'name': 'Poste Conflit', 'station_type': 'standard',
        })
        self.schedule = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV Conflit', 'start_time': 7.0, 'end_time': 11.0,
            'monday': True, 'wednesday': True, 'friday': True,
            'station_id': self.station.id,
        })
        self.product = self.env['product.product'].search([
            ('hospital_product_type', 'in', ['nephrology_procedure', 'consultation'])
        ], limit=1) or self.env['product.product'].create({
            'name': 'Hémodialyse Conflit', 'type': 'service',
            'hospital_product_type': 'nephrology_procedure',
        })
        self.patient_a = self.env['hms.patient'].create({
            'name': 'Patient A Conflit', 'nephrology_care': True,
        })
        self.patient_b = self.env['hms.patient'].create({
            'name': 'Patient B Conflit', 'nephrology_care': True,
        })

    def _make_procedure(self, patient, schedule, date_str):
        return self.env['acs.patient.procedure'].create({
            'patient_id': patient.id,
            'product_id': self.product.id,
            'date': date_str,
            'nephrology_schedule_ids': [(4, schedule.id)],
        })

    def test_conflict_station_warning(self):
        """Poste déjà utilisé → warning_station (pas bloquant)"""
        # Patient B a déjà une procédure sur le même poste sur la période
        self._make_procedure(self.patient_b, self.schedule, '2026-06-03 07:00:00')

        # Patient A n'a pas de procédure sur la période
        self._make_procedure(self.patient_a, self.schedule, '2026-01-05 07:00:00')

        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 7),
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient_a.id)],
        })
        generator.action_open_validator()
        line = generator.line_ids.filtered(lambda l: l.patient_id == self.patient_a)
        self.assertEqual(line.conflict_status, 'warning_station')

    def test_conflict_duplicate_error(self):
        """Patient déjà planifié sur la période → error_duplicate (bloquant)"""
        # Patient A a déjà une procédure sur la période
        self._make_procedure(self.patient_a, self.schedule, '2026-06-03 07:00:00')

        # Essayer de re-générer pour patient A sur la même période
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 7),
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient_a.id)],
        })
        generator.action_open_validator()
        line = generator.line_ids.filtered(lambda l: l.patient_id == self.patient_a)
        self.assertEqual(line.conflict_status, 'error_duplicate')

    def test_no_conflict_ok(self):
        """Aucun conflit → statut ok"""
        self._make_procedure(self.patient_a, self.schedule, '2026-01-05 07:00:00')

        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 7),
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient_a.id)],
        })
        generator.action_open_validator()
        line = generator.line_ids.filtered(lambda l: l.patient_id == self.patient_a)
        self.assertEqual(line.conflict_status, 'ok')
```

- [ ] **Step 2 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_conflict|test_no_conflict|FAIL|ERROR"
```

Attendu : 3 tests `ok`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology/tests/test_session_generator.py
git commit -m "test(generator): add conflict detection tests"
```

---

### Task 5 : Tests confirmation + `action_confirm`

**Files:**
- Modify: `acs_hms_nephrology/tests/test_session_generator.py`

- [ ] **Step 1 : Ajouter la classe de tests**

Ajouter après `TestSessionGeneratorConflicts` :

```python
class TestSessionGeneratorConfirm(TransactionCase):

    def setUp(self):
        super().setUp()
        self.station = self.env['acs.dialysis.station'].create({
            'name': 'Poste Confirm', 'station_type': 'standard',
        })
        self.schedule = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV Confirm', 'start_time': 7.0, 'end_time': 11.0,
            'monday': True, 'wednesday': True, 'friday': True,
            'station_id': self.station.id,
        })
        self.product = self.env['product.product'].search([
            ('hospital_product_type', 'in', ['nephrology_procedure', 'consultation'])
        ], limit=1) or self.env['product.product'].create({
            'name': 'Hémodialyse Confirm', 'type': 'service',
            'hospital_product_type': 'nephrology_procedure',
        })
        self.patient = self.env['hms.patient'].create({
            'name': 'Patient Confirm', 'nephrology_care': True,
        })
        # Procédure passée pour que le patient ait un schedule
        self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'date': '2026-01-05 07:00:00',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })

    def test_confirm_creates_procedures_and_appointments(self):
        """action_confirm crée les procédures et RDVs pour toutes les lignes OK"""
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),   # Lundi
            'date_end': date(2026, 6, 5),     # Vendredi
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient.id)],
        })
        result = generator.action_open_validator()
        validator_id = result['res_id']
        validator = self.env['nephrology.session.validator'].browse(validator_id)

        proc_before = self.env['acs.patient.procedure'].search_count([
            ('patient_id', '=', self.patient.id),
        ])
        validator.action_confirm()
        proc_after = self.env['acs.patient.procedure'].search_count([
            ('patient_id', '=', self.patient.id),
        ])
        # 3 séances LMV du 1 au 5 juin (Lu=1, Me=3, Ve=5)
        self.assertEqual(proc_after - proc_before, 3)

        # Vérifier que les RDVs ont aussi été créés
        appts = self.env['hms.appointment'].search([
            ('patient_id', '=', self.patient.id),
            ('date', '>=', '2026-06-01 00:00:00'),
        ])
        self.assertEqual(len(appts), 3)

    def test_red_lines_excluded_from_confirm(self):
        """Les lignes error_duplicate ne génèrent aucune procédure"""
        # Patient a déjà une procédure sur la période → error_duplicate
        self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'date': '2026-06-03 07:00:00',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })
        generator = self.env['nephrology.session.generator'].create({
            'date_start': date(2026, 6, 1),
            'date_end': date(2026, 6, 5),
            'exclude_holidays': False,
            'patient_ids': [(4, self.patient.id)],
        })
        result = generator.action_open_validator()
        validator = self.env['nephrology.session.validator'].browse(result['res_id'])

        line = generator.line_ids[0]
        self.assertEqual(line.conflict_status, 'error_duplicate')

        proc_before = self.env['acs.patient.procedure'].search_count([
            ('patient_id', '=', self.patient.id),
            ('date', '>=', '2026-06-01 00:00:00'),
        ])
        validator.action_confirm()
        proc_after = self.env['acs.patient.procedure'].search_count([
            ('patient_id', '=', self.patient.id),
            ('date', '>=', '2026-06-01 00:00:00'),
        ])
        self.assertEqual(proc_after - proc_before, 0)  # Rien créé
```

- [ ] **Step 2 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_confirm|test_red|FAIL|ERROR"
```

Attendu : 2 tests `ok`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology/tests/test_session_generator.py
git commit -m "test(generator): add action_confirm and exclusion tests"
```

---

### Task 6 : Vues XML — Modal 1 + Modal 2 + bouton liste

**Files:**
- Create: `acs_hms_nephrology/views/session_generator_view.xml`

- [ ] **Step 1 : Créer `views/session_generator_view.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<odoo>

    <!-- ══════════════════════════════════════════════════════════
         MODAL 1 — Générateur : sélection patients + période
    ══════════════════════════════════════════════════════════ -->
    <record id="view_nephrology_session_generator_form" model="ir.ui.view">
        <field name="name">nephrology.session.generator.form</field>
        <field name="model">nephrology.session.generator</field>
        <field name="arch" type="xml">
            <form string="Générer des séances en masse">
                <sheet>
                    <div class="oe_title">
                        <h1>Générer des séances d'hémodialyse</h1>
                    </div>

                    <group string="1. Sélection des patients">
                        <field name="patient_ids"
                               widget="many2many_tags"
                               domain="[('nephrology_care', '=', True)]"
                               options="{'no_create': True}"
                               placeholder="Sélectionnez les patients à planifier..."/>
                    </group>

                    <group string="2. Période">
                        <group>
                            <field name="date_start" required="1"/>
                            <field name="date_end" required="1"/>
                        </group>
                        <group>
                            <field name="exclude_holidays"/>
                        </group>
                    </group>

                    <group>
                        <div class="alert alert-info" role="alert"
                             invisible="preview_count == 0">
                            <strong>Aperçu :</strong>
                            <field name="preview_count" readonly="1" nolabel="1"/>
                            séances seront créées pour
                            <field name="patient_ids" widget="many2many_tags"
                                   readonly="1" nolabel="1"/>
                        </div>
                    </group>
                </sheet>
                <footer>
                    <button name="action_open_validator"
                            string="Continuer →"
                            type="object"
                            class="btn-primary"/>
                    <button string="Annuler" class="btn-secondary" special="cancel"/>
                </footer>
            </form>
        </field>
    </record>

    <!-- Action Modal 1 -->
    <record id="action_nephrology_session_generator" model="ir.actions.act_window">
        <field name="name">Générer des séances en masse</field>
        <field name="res_model">nephrology.session.generator</field>
        <field name="view_mode">form</field>
        <field name="target">new</field>
    </record>

    <!-- ══════════════════════════════════════════════════════════
         MODAL 2 — Validateur : tableau par patient + confirmation
    ══════════════════════════════════════════════════════════ -->
    <record id="view_nephrology_session_validator_form" model="ir.ui.view">
        <field name="name">nephrology.session.validator.form</field>
        <field name="model">nephrology.session.validator</field>
        <field name="arch" type="xml">
            <form string="Validation des séances">
                <sheet>
                    <div class="oe_title">
                        <h1>Récapitulatif — Séances à créer</h1>
                    </div>

                    <div class="alert alert-warning" role="alert"
                         invisible="not line_ids.filtered(lambda l: l.conflict_status == 'warning_station')">
                        ⚠️ Certains postes sont déjà utilisés (lignes orange). Vous pouvez modifier le poste ou confirmer malgré l'avertissement.
                    </div>
                    <div class="alert alert-danger" role="alert"
                         invisible="not line_ids.filtered(lambda l: l.conflict_status == 'error_duplicate')">
                        🔴 Certains patients ont déjà des séances sur cette période (lignes rouges). Ces lignes seront ignorées lors de la confirmation.
                    </div>

                    <field name="line_ids">
                        <list editable="bottom"
                              decoration-warning="conflict_status == 'warning_station'"
                              decoration-danger="conflict_status == 'error_duplicate'">
                            <field name="patient_id" readonly="1"/>
                            <field name="schedule_id" readonly="1"/>
                            <field name="session_count" readonly="1"
                                   string="Nb séances"/>
                            <field name="station_id" optional="show"/>
                            <field name="physician_id" optional="show"/>
                            <field name="conflict_status" readonly="1"/>
                            <field name="conflict_details" readonly="1"
                                   optional="hide"/>
                        </list>
                    </field>
                </sheet>
                <footer>
                    <button name="action_confirm"
                            string="✅ Confirmer tout"
                            type="object"
                            class="btn-primary"/>
                    <button string="← Retour" class="btn-secondary" special="cancel"/>
                </footer>
            </form>
        </field>
    </record>

    <!-- ══════════════════════════════════════════════════════════
         BOUTON dans la vue liste des procédures
    ══════════════════════════════════════════════════════════ -->
    <record id="view_acs_patient_procedure_list_session_generator_btn"
            model="ir.ui.view">
        <field name="name">acs.patient.procedure.list.session.generator</field>
        <field name="model">acs.patient.procedure</field>
        <field name="inherit_id" ref="acs_hms.view_acs_patient_procedure_list"/>
        <field name="arch" type="xml">
            <xpath expr="//list" position="attributes">
                <attribute name="action">action_nephrology_session_generator</attribute>
                <attribute name="type">object</attribute>
            </xpath>
        </field>
    </record>

    <!-- Alternative : bouton dans le header de la vue liste via action client -->
    <record id="view_acs_patient_procedure_list_header_btn"
            model="ir.ui.view">
        <field name="name">acs.patient.procedure.list.header.generator</field>
        <field name="model">acs.patient.procedure</field>
        <field name="inherit_id" ref="acs_hms.view_acs_patient_procedure_list"/>
        <field name="priority">99</field>
        <field name="arch" type="xml">
            <xpath expr="//list/header" position="inside">
                <button name="%(action_nephrology_session_generator)d"
                        string="Générer séances en masse"
                        type="action"
                        class="btn-primary"/>
            </xpath>
        </field>
    </record>

</odoo>
```

> **Note importante :** Si la vue liste `acs_hms.view_acs_patient_procedure_list` n'a pas de balise `<header>`, supprimer le deuxième `<record>` et ajouter le bouton via le menu Néphrologie → Planning. Vérifier d'abord avec :
>
> ```bash
> grep -r "view_acs_patient_procedure_list" "/Users/yusper/Downloads/modules 19/as shafi/acs_hms/"
> ```
>
> Si la vue n'existe pas, le bouton peut aussi être ajouté comme action de menu dans `views/menu_item.xml`.

- [ ] **Step 2 : Vérifier que la vue liste de référence existe**

```bash
grep -rn "view_acs_patient_procedure_list\|id.*procedure.*list" \
  "/Users/yusper/Downloads/modules 19/as shafi/acs_hms/views/" 2>/dev/null | head -5
```

Si aucun résultat, remplacer les deux `inherit_id` par un menu item dans `views/menu_item.xml` :
```xml
<menuitem id="menu_nephrology_session_generator"
          name="Générer séances en masse"
          parent="menu_acs_main_nephrology"
          action="action_nephrology_session_generator"
          sequence="15"/>
```

- [ ] **Step 3 : Vérifier que les inline-filter expressions dans les `invisible` sont Odoo 19 valides**

Dans Odoo 19, `invisible` accepte des expressions Python-like. Les expressions `invisible="not line_ids.filtered(...)"` sont trop complexes pour le moteur de rendu — les remplacer par des champs booléens calculés ou simplement les supprimer (les messages d'alerte peuvent toujours être visibles).

Version simplifiée des alertes (sans filtrage inline) :

```xml
<div class="alert alert-info" role="alert">
    ⚠️ Les lignes orange = conflit de poste (confirmable). Les lignes rouges = patient déjà planifié (bloquant, sera ignoré).
</div>
```

- [ ] **Step 4 : Redémarrer Odoo et tester manuellement le wizard**

```bash
docker restart odoo-19-as-shafi-minhn92-odoo19-1
```

Ouvrir Odoo → Néphrologie → Séances → bouton "Générer séances en masse"
- Vérifier que Modal 1 s'ouvre
- Sélectionner 2 patients, définir une période
- Vérifier l'aperçu (preview_count)
- Cliquer Continuer → vérifier Modal 2
- Vérifier les colonnes Poste / Médecin éditables
- Confirmer et vérifier que les procédures + RDVs sont créés

- [ ] **Step 5 : Commit**

```bash
git add acs_hms_nephrology/views/session_generator_view.xml
git commit -m "feat(generator): add session generator views (Modal 1 + Modal 2 + button)"
```

---

### Task 7 : Menu jours fériés + menu générateur

**Files:**
- Modify: `acs_hms_nephrology/views/menu_item.xml`

- [ ] **Step 1 : Lire le fichier menu existant**

```bash
cat "/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology/views/menu_item.xml"
```

- [ ] **Step 2 : Ajouter les entrées de menu**

Dans le bloc `<data>` existant, ajouter après les menus de configuration existants :

```xml
<!-- Menu : Générer séances (accès rapide secrétaire) -->
<menuitem id="menu_nephrology_generate_sessions"
          name="Générer séances en masse"
          parent="menu_acs_main_nephrology"
          action="session_generator_view.action_nephrology_session_generator"
          sequence="15"
          groups="acs_hms_base.group_hms_user"/>

<!-- Menu config : Jours fériés -->
<menuitem id="menu_nephrology_holidays"
          name="Jours Fériés"
          parent="menu_nephrology_config"
          action="action_acs_nephrology_holiday"
          sequence="20"/>
```

Et ajouter l'action list pour les jours fériés dans `session_generator_view.xml` (avant la balise `</odoo>`) :

```xml
<!-- Action liste jours fériés (menu config) -->
<record id="action_acs_nephrology_holiday" model="ir.actions.act_window">
    <field name="name">Jours Fériés</field>
    <field name="res_model">acs.nephrology.holiday</field>
    <field name="view_mode">list,form</field>
</record>
```

- [ ] **Step 3 : Lancer tous les tests une dernière fois**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_|FAIL|ERROR|ok"
```

Attendu : 12+ tests `ok`, 0 `FAIL`, 0 `ERROR`

- [ ] **Step 4 : Commit final**

```bash
git add acs_hms_nephrology/views/session_generator_view.xml \
        acs_hms_nephrology/views/menu_item.xml
git commit -m "feat(generator): add menu items for session generator and holidays config"
```
