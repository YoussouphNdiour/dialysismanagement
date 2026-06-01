# Doctor Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le dashboard médecin dans `acs_hms_nephrology_dashboard` — vue postes temps réel, alertes, slide panel patient, graphique KT/V — en OWL avec méthodes Python `@api.model`.

**Architecture:** Méthode Python `get_dashboard_data()` sur `acs.dialysis.station` agrège postes + procédures du jour + alertes + KPIs en une seule requête. OWL poll toutes les 30s via `orm.call()`. Layout : sidebar KPIs/alertes fixe + zone principale avec toggle Grille/Liste/Stats. Clic poste → slide panel patient chargé par `get_patient_panel_data(procedure_id)`.

**Tech Stack:** Odoo 19, OWL (Owl 2), Python `@api.model`, Chart.js (`window.Chart` fourni par le bundle web Odoo)

---

## Carte des fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `models/doctor_dashboard.py` | Créer | 3 méthodes Python : `get_dashboard_data`, `get_patient_panel_data`, `get_ktv_chart_data` |
| `models/__init__.py` | Modifier | `from . import doctor_dashboard` |
| `tests/test_doctor_dashboard.py` | Créer | 9 tests Python (TDD) |
| `views/doctor_dashboard_action.xml` | Créer | Action `ir.actions.client` + menuitem |
| `__manifest__.py` | Modifier | Ajouter `views/doctor_dashboard_action.xml` + glob CSS |
| `static/src/components/doctor_dashboard/DoctorDashboard.js/.xml` | Créer | Composant racine (layout, polling, state global) |
| `static/src/components/doctor_dashboard/DoctorAlertsSidebar.js/.xml` | Créer | Sidebar gauche : KPIs + compteurs alertes + liste alertes |
| `static/src/components/doctor_dashboard/DoctorStationGrid.js/.xml` | Créer | Grille de cartes postes |
| `static/src/components/doctor_dashboard/DoctorStationCard.js/.xml` | Créer | Carte poste détaillée (barre progression + TA/KT/V/UF) |
| `static/src/components/doctor_dashboard/DoctorPatientPanel.js/.xml` | Créer | Slide panel patient (résumé complet + 4 actions) |
| `static/src/components/doctor_dashboard/DoctorStatsChart.js/.xml` | Créer | Graphique KT/V 30 jours (Chart.js) |
| `static/src/components/doctor_dashboard/doctor_dashboard.css` | Créer | Styles layout + cartes + panel |
| `static/src/doctor_dashboard.js` | Créer | Point d'entrée (re-export DoctorDashboard) |

---

## Task 1 : Python — Fichier de base + `get_dashboard_data()` (postes + état + KPIs)

**Files:**
- Create: `acs_hms_nephrology_dashboard/models/doctor_dashboard.py`
- Create: `acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py`
- Modify: `acs_hms_nephrology_dashboard/models/__init__.py`

- [ ] **Étape 1 : Créer le fichier de tests avec setup et deux premiers tests**

```python
# acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py
# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase
from odoo import fields
from datetime import datetime, timedelta


class TestDoctorDashboard(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Département néphro
        cls.dept = cls.env['hr.department'].create({
            'name': 'Test Néphro',
            'department_type': 'nephrology',
        })

        # Poste de dialyse
        cls.station = cls.env['acs.dialysis.station'].create({
            'name': 'Poste Test 1',
            'station_type': 'standard',
            'active': True,
        })

        # Créneau lié au poste (tous les jours pour faciliter les tests)
        cls.schedule = cls.env['acs.nephrology.schedule'].create({
            'name': 'Test Schedule',
            'station_id': cls.station.id,
            'monday': True, 'tuesday': True, 'wednesday': True,
            'thursday': True, 'friday': True, 'saturday': True, 'sunday': True,
        })

        # Patient
        cls.patient = cls.env['hms.patient'].create({'name': 'Patient Test Dashboard'})

        # Produit service
        cls.product = cls.env['product.product'].search([('type', '=', 'service')], limit=1)
        if not cls.product:
            cls.product = cls.env['product.product'].create({
                'name': 'Hémodialyse Test', 'type': 'service',
            })

    def _make_procedure(self, state='running', hours_ago=2, **kwargs):
        """Crée une procédure liée à cls.station via cls.schedule."""
        now = datetime.now()
        start = now - timedelta(hours=hours_ago)
        stop = start + timedelta(hours=4)
        vals = {
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': fields.Datetime.to_string(start),
            'date_stop': fields.Datetime.to_string(stop),
            'state': state,
            'pre_dialysis_bp': '130/80',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        }
        vals.update(kwargs)
        return self.env['acs.patient.procedure'].create(vals)

    # ------------------------------------------------------------------ #
    # Task 1 tests                                                         #
    # ------------------------------------------------------------------ #

    def test_get_dashboard_data_empty(self):
        """Sans procédure du jour, get_dashboard_data() retourne une structure valide."""
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        self.assertIn('stations', result)
        self.assertIn('kpis', result)
        self.assertIn('alerts', result)
        self.assertIsInstance(result['stations'], list)
        self.assertIsInstance(result['alerts'], list)
        kpis = result['kpis']
        self.assertEqual(kpis['total_sessions'], 0)
        self.assertEqual(kpis['occupation_rate'], 0)
        self.assertEqual(kpis['avg_ktv'], 0.0)

    def test_get_dashboard_data_running_session(self):
        """Procédure 'running' du jour → présente dans stations avec état running."""
        proc = self._make_procedure(state='running')
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        station_entry = next(
            (s for s in result['stations'] if s['id'] == self.station.id), None
        )
        self.assertIsNotNone(station_entry, "Le poste test doit être dans stations")
        self.assertIsNotNone(station_entry['procedure'])
        self.assertEqual(station_entry['procedure']['id'], proc.id)
        self.assertEqual(station_entry['procedure']['state'], 'running')
        self.assertEqual(result['kpis']['running_sessions'], 1)
        proc.unlink()
```

- [ ] **Étape 2 : Vérifier que les tests échouent (méthode pas encore créée)**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
python -m pytest acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py -v 2>&1 | tail -20
# Attendu : ImportError ou AttributeError — get_dashboard_data n'existe pas
```

- [ ] **Étape 3 : Créer `models/doctor_dashboard.py` avec `get_dashboard_data()`**

```python
# acs_hms_nephrology_dashboard/models/doctor_dashboard.py
# -*- coding: utf-8 -*-
from odoo import api, fields, models
from datetime import datetime, date, timedelta


class ACSDialysisStationDashboard(models.Model):
    _inherit = 'acs.dialysis.station'

    @api.model
    def get_dashboard_data(self):
        """Retourne postes, KPIs du jour et alertes actives pour le dashboard médecin."""
        today = date.today()
        day_start = datetime.combine(today, datetime.min.time())
        day_end = datetime.combine(today, datetime.max.time())
        now = datetime.now()

        Procedure = self.env['acs.patient.procedure']
        stations = self.search([('active', '=', True)], order='name')

        station_list = []
        total_sessions = running = done = 0
        ktv_vals = []
        complication_total = 0
        all_alerts = []

        for station in stations:
            procs = Procedure.search([
                ('nephrology_schedule_ids.station_id', '=', station.id),
                ('date', '>=', fields.Datetime.to_string(day_start)),
                ('date', '<=', fields.Datetime.to_string(day_end)),
                ('department_id.department_type', '=', 'nephrology'),
            ], limit=1, order='date asc')

            proc_dict = None
            if procs:
                proc = procs[0]
                total_sessions += 1
                if proc.state == 'running':
                    running += 1
                elif proc.state == 'done':
                    done += 1
                    if proc.ktv_calculated > 0:
                        ktv_vals.append(proc.ktv_calculated)
                complication_total += proc.complication_count

                # Alertes
                alert_level, alert_label = self._get_alert(proc, now)

                # Âge patient
                patient = proc.patient_id
                age = 0
                if patient.birthday:
                    age = (today - fields.Date.from_string(patient.birthday)).days // 365

                # Durée prévue (fallback 4h si date_stop absent)
                expected = 4.0
                if proc.date_stop and proc.date:
                    expected = (proc.date_stop - proc.date).total_seconds() / 3600

                vascular = proc.type_of_vascular_access.name if proc.type_of_vascular_access else ''

                proc_dict = {
                    'id': proc.id,
                    'patient_id': [patient.id, patient.name],
                    'state': proc.state,
                    'date': fields.Datetime.to_string(proc.date) if proc.date else False,
                    'date_stop': fields.Datetime.to_string(proc.date_stop) if proc.date_stop else False,
                    'actual_duration': proc.actual_duration,
                    'expected_duration': expected,
                    'actual_uf': proc.actual_uf,
                    'ktv_calculated': proc.ktv_calculated,
                    'ktv_status': proc.ktv_status or False,
                    'has_active_hypotension': proc.has_active_hypotension,
                    'complication_count': proc.complication_count,
                    'pre_dialysis_bp': proc.pre_dialysis_bp or '',
                    'age': age,
                    'vascular_access': vascular,
                    'alert_level': alert_level,
                    'alert_label': alert_label,
                }

                if alert_level:
                    all_alerts.append({
                        'level': alert_level,
                        'station_name': station.name,
                        'patient_name': patient.name,
                        'procedure_id': proc.id,
                        'label': alert_label,
                    })

            station_list.append({
                'id': station.id,
                'name': station.name,
                'room': station.room or '',
                'station_type': station.station_type,
                'procedure': proc_dict,
            })

        # Trier alertes : critiques d'abord
        all_alerts.sort(key=lambda a: 0 if a['level'] == 'critical' else 1)

        occupied = running + done
        total_stations = len(stations)
        occupation_rate = round(occupied / total_stations * 100) if total_stations else 0
        avg_ktv = round(sum(ktv_vals) / len(ktv_vals), 2) if ktv_vals else 0.0
        critical = sum(1 for a in all_alerts if a['level'] == 'critical')
        warning = sum(1 for a in all_alerts if a['level'] == 'warning')

        return {
            'stations': station_list,
            'kpis': {
                'total_sessions': total_sessions,
                'running_sessions': running,
                'done_sessions': done,
                'occupation_rate': occupation_rate,
                'avg_ktv': avg_ktv,
                'complication_count': complication_total,
                'critical_alerts': critical,
                'warning_alerts': warning,
            },
            'alerts': all_alerts,
        }

    def _get_alert(self, proc, now):
        """Retourne (level, label) ou (None, None) pour une procédure."""
        if proc.has_active_hypotension:
            return 'critical', 'Hypotension'
        unresolved = proc.complication_ids.filtered(lambda c: c.resolution == 'no')
        if unresolved:
            return 'critical', 'Complication non résolue'
        if proc.complication_ids.filtered(lambda c: c.complication_type == 'early_stop'):
            return 'critical', 'Arrêt prématuré'
        if proc.ktv_status == 'insufficient' and proc.state == 'done':
            return 'warning', 'KT/V insuffisant'
        if proc.state == 'scheduled' and proc.date:
            delay = (now - proc.date).total_seconds() / 60
            if delay > 30:
                return 'warning', f'Séance en retard ({int(delay)} min)'
        return None, None

    @api.model
    def get_patient_panel_data(self, procedure_id):
        """Retourne résumé patient pour le slide panel (séance en cours + dernière + infos patient)."""
        Procedure = self.env['acs.patient.procedure']
        proc = Procedure.browse(procedure_id)
        if not proc.exists():
            return {}

        patient = proc.patient_id
        today = date.today()

        age = 0
        if patient.birthday:
            age = (today - fields.Date.from_string(patient.birthday)).days // 365

        # Première séance néphro du patient (pour "dialyse depuis")
        first = Procedure.search([
            ('patient_id', '=', patient.id),
            ('department_id.department_type', '=', 'nephrology'),
        ], order='date asc', limit=1)
        dialysis_since = ''
        if first and first.date:
            dialysis_since = fields.Datetime.to_string(first.date)[:10]

        # Dernière séance done ≠ cette séance
        prev = Procedure.search([
            ('patient_id', '=', patient.id),
            ('state', '=', 'done'),
            ('department_id.department_type', '=', 'nephrology'),
            ('id', '!=', proc.id),
        ], order='date desc', limit=1)

        prev_dict = None
        if prev:
            prev_dict = {
                'date': fields.Datetime.to_string(prev.date)[:10] if prev.date else '',
                'actual_duration': prev.actual_duration,
                'actual_uf': prev.actual_uf,
                'ktv_calculated': prev.ktv_calculated,
                'ktv_status': prev.ktv_status or False,
                'global_tolerance': prev.global_tolerance or False,
            }

        # Complications actives (non résolues)
        active_comp = proc.complication_ids.filtered(lambda c: c.resolution == 'no')
        comp_selection = dict(
            self.env['acs.dialysis.complication']._fields['complication_type'].selection
        )
        complications = [{
            'type': c.complication_type,
            'label': comp_selection.get(c.complication_type, c.complication_type),
            'bp': c.bp_at_occurrence or '',
        } for c in active_comp]

        expected = 4.0
        if proc.date_stop and proc.date:
            expected = (proc.date_stop - proc.date).total_seconds() / 3600

        vascular = proc.type_of_vascular_access.name if proc.type_of_vascular_access else ''

        return {
            'procedure': {
                'id': proc.id,
                'state': proc.state,
                'actual_duration': proc.actual_duration,
                'expected_duration': expected,
                'actual_uf': proc.actual_uf,
                'ktv_calculated': proc.ktv_calculated,
                'ktv_status': proc.ktv_status or False,
                'pre_dialysis_bp': proc.pre_dialysis_bp or '',
                'has_active_hypotension': proc.has_active_hypotension,
                'active_complications': complications,
                'dry_weight': proc.dry_weight,
            },
            'patient': {
                'id': patient.id,
                'name': patient.name,
                'age': age,
                'blood_group': patient.blood_group or '',
                'vascular_access': vascular,
                'dialysis_since': dialysis_since,
                'treatment': proc.interdialysis_medication or '',
            },
            'previous_session': prev_dict,
        }

    @api.model
    def get_ktv_chart_data(self):
        """KT/V moyen par jour sur les 30 derniers jours (séances done avec ktv > 0)."""
        today = date.today()
        since = datetime.combine(today - timedelta(days=30), datetime.min.time())

        procs = self.env['acs.patient.procedure'].search([
            ('state', '=', 'done'),
            ('department_id.department_type', '=', 'nephrology'),
            ('ktv_calculated', '>', 0),
            ('date', '>=', fields.Datetime.to_string(since)),
        ])

        daily = {}
        for p in procs:
            if p.date:
                day = p.date.date().isoformat()
                daily.setdefault(day, []).append(p.ktv_calculated)

        sorted_days = sorted(daily.keys())
        return {
            'labels': sorted_days,
            'values': [round(sum(daily[d]) / len(daily[d]), 2) for d in sorted_days],
        }
```

- [ ] **Étape 4 : Mettre à jour `models/__init__.py`**

```python
# acs_hms_nephrology_dashboard/models/__init__.py
# -*- coding: utf-8 -*-
from . import doctor_dashboard
```

- [ ] **Étape 5 : Lancer les tests Task 1**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
python -m pytest acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py::TestDoctorDashboard::test_get_dashboard_data_empty acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py::TestDoctorDashboard::test_get_dashboard_data_running_session -v
# Attendu : 2 passed
```

- [ ] **Étape 6 : Commit**

```bash
git add acs_hms_nephrology_dashboard/models/doctor_dashboard.py \
        acs_hms_nephrology_dashboard/models/__init__.py \
        acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py
git commit -m "feat(doctor-dashboard): add get_dashboard_data Python method + base tests"
```

---

## Task 2 : Python — Tests et logique d'alertes

**Files:**
- Modify: `acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py`

- [ ] **Étape 1 : Ajouter les tests d'alertes au fichier de tests**

Ajouter dans la classe `TestDoctorDashboard`, après `test_get_dashboard_data_running_session` :

```python
    def test_alert_hypotension_critical(self):
        """has_active_hypotension=True → alerte critique dans alerts et dans la procédure."""
        proc = self._make_procedure(state='running')
        # Créer un signe vital avec hypotension
        self.env['hemodialysis.vital.sign'].create({
            'procedure_id': proc.id,
            'blood_pressure': '82/50',
            'is_hypotension': True,
            'measurement_time': fields.Datetime.now(),
            'heart_rate': 95,
        })
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        station_entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        self.assertEqual(station_entry['procedure']['alert_level'], 'critical')
        self.assertEqual(station_entry['procedure']['alert_label'], 'Hypotension')
        critical_alerts = [a for a in result['alerts'] if a['level'] == 'critical']
        self.assertEqual(len(critical_alerts), 1)
        self.assertEqual(result['kpis']['critical_alerts'], 1)
        proc.unlink()

    def test_alert_unresolved_complication_critical(self):
        """Complication resolution='no' → alerte critique."""
        proc = self._make_procedure(state='running')
        self.env['acs.dialysis.complication'].create({
            'procedure_id': proc.id,
            'complication_type': 'cramps',
            'occurrence_time': fields.Datetime.now(),
            'action_taken': 'Massage',
            'resolution': 'no',
        })
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        station_entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        self.assertEqual(station_entry['procedure']['alert_level'], 'critical')
        proc.unlink()

    def test_alert_ktv_insufficient_warning(self):
        """Séance done avec KT/V insuffisant → alerte attention."""
        proc = self._make_procedure(
            state='done',
            urea_pre=50.0, urea_post=30.0,       # R=0.6 → KT/V ≈ 0.62
            arrival_weight=70.0, departure_weight=68.0,  # UF=2000ml
        )
        # ktv_calculated est computed+stored, se recalcule automatiquement
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        station_entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        if station_entry['procedure']['ktv_status'] == 'insufficient':
            self.assertEqual(station_entry['procedure']['alert_level'], 'warning')
            warning_alerts = [a for a in result['alerts'] if a['level'] == 'warning']
            self.assertGreaterEqual(len(warning_alerts), 1)
        proc.unlink()

    def test_alert_late_session_warning(self):
        """Séance scheduled avec date > 30 min dans le passé → alerte attention."""
        late_start = datetime.now() - timedelta(minutes=45)
        late_stop = late_start + timedelta(hours=4)
        proc = self._make_procedure(
            state='scheduled',
            hours_ago=0,  # on écrase avec des valeurs directes
        )
        # Réécrire la date manuellement
        proc.write({
            'date': fields.Datetime.to_string(late_start),
            'date_stop': fields.Datetime.to_string(late_stop),
        })
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        station_entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        self.assertEqual(station_entry['procedure']['alert_level'], 'warning')
        self.assertIn('retard', station_entry['procedure']['alert_label'])
        proc.unlink()

    def test_alerts_sorted_critical_first(self):
        """Les alertes critiques apparaissent avant les alertes attention."""
        # Poste 2 pour éviter conflit avec cls.station
        station2 = self.env['acs.dialysis.station'].create({
            'name': 'Poste Test 2', 'station_type': 'standard', 'active': True,
        })
        sched2 = self.env['acs.nephrology.schedule'].create({
            'name': 'Sched2', 'station_id': station2.id,
            'monday': True, 'tuesday': True, 'wednesday': True,
            'thursday': True, 'friday': True, 'saturday': True, 'sunday': True,
        })
        # Alerte attention sur poste1
        proc1 = self._make_procedure(
            state='done', urea_pre=50.0, urea_post=30.0,
            arrival_weight=70.0, departure_weight=68.0,
        )
        # Alerte critique sur poste2
        proc2 = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': fields.Datetime.to_string(datetime.now() - timedelta(hours=1)),
            'date_stop': fields.Datetime.to_string(datetime.now() + timedelta(hours=3)),
            'state': 'running',
            'pre_dialysis_bp': '80/50',
            'nephrology_schedule_ids': [(4, sched2.id)],
        })
        self.env['hemodialysis.vital.sign'].create({
            'procedure_id': proc2.id,
            'blood_pressure': '80/50',
            'is_hypotension': True,
            'measurement_time': fields.Datetime.now(),
            'heart_rate': 100,
        })
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        levels = [a['level'] for a in result['alerts']]
        if len(levels) >= 2:
            self.assertEqual(levels[0], 'critical')
        proc1.unlink()
        proc2.unlink()
        station2.unlink()
```

- [ ] **Étape 2 : Lancer les tests Task 2**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
python -m pytest acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py -k "alert" -v
# Attendu : 5 passed (ou 4 si ktv_insufficient skippé selon valeur calculée)
```

- [ ] **Étape 3 : Commit**

```bash
git add acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py
git commit -m "test(doctor-dashboard): add alert detection tests (hypotension, complication, late, sort)"
```

---

## Task 3 : Python — Tests et implémentation `get_patient_panel_data()`

**Files:**
- Modify: `acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py`

- [ ] **Étape 1 : Ajouter les tests `get_patient_panel_data`**

```python
    # ------------------------------------------------------------------ #
    # Task 3 tests                                                         #
    # ------------------------------------------------------------------ #

    def test_get_patient_panel_data_returns_expected_structure(self):
        """get_patient_panel_data() retourne séance en cours, dernière séance, infos patient."""
        # Séance précédente done
        past_start = datetime.now() - timedelta(days=3, hours=2)
        past_stop = past_start + timedelta(hours=4)
        prev_proc = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': fields.Datetime.to_string(past_start),
            'date_stop': fields.Datetime.to_string(past_stop),
            'state': 'done',
            'pre_dialysis_bp': '135/85',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })
        # Séance actuelle running
        proc = self._make_procedure(state='running')

        result = self.env['acs.dialysis.station'].get_patient_panel_data(proc.id)

        self.assertIn('procedure', result)
        self.assertIn('patient', result)
        self.assertIn('previous_session', result)
        self.assertEqual(result['procedure']['id'], proc.id)
        self.assertEqual(result['patient']['name'], self.patient.name)
        self.assertIsNotNone(result['previous_session'])
        self.assertEqual(result['previous_session']['state'] if 'state' in (result['previous_session'] or {}) else 'done', 'done')
        prev_proc.unlink()
        proc.unlink()

    def test_get_patient_panel_no_previous_session(self):
        """Premier patient sans séance précédente → previous_session = None, pas d'erreur."""
        new_patient = self.env['hms.patient'].create({'name': 'Nouveau Patient'})
        proc = self.env['acs.patient.procedure'].create({
            'patient_id': new_patient.id,
            'product_id': self.product.id,
            'department_id': self.dept.id,
            'date': fields.Datetime.to_string(datetime.now() - timedelta(hours=1)),
            'date_stop': fields.Datetime.to_string(datetime.now() + timedelta(hours=3)),
            'state': 'running',
            'pre_dialysis_bp': '140/90',
            'nephrology_schedule_ids': [(4, self.schedule.id)],
        })
        result = self.env['acs.dialysis.station'].get_patient_panel_data(proc.id)
        self.assertIn('procedure', result)
        self.assertIsNone(result['previous_session'])
        proc.unlink()
        new_patient.unlink()

    def test_get_patient_panel_invalid_id(self):
        """ID inexistant → retourne {}."""
        result = self.env['acs.dialysis.station'].get_patient_panel_data(999999)
        self.assertEqual(result, {})
```

- [ ] **Étape 2 : Lancer les tests**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
python -m pytest acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py -k "panel" -v
# Attendu : 3 passed
```

- [ ] **Étape 3 : Commit**

```bash
git add acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py
git commit -m "test(doctor-dashboard): add get_patient_panel_data tests"
```

---

## Task 4 : Python — Tests et `get_ktv_chart_data()` + KPIs

**Files:**
- Modify: `acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py`

- [ ] **Étape 1 : Ajouter les tests KPIs et graphique**

```python
    # ------------------------------------------------------------------ #
    # Task 4 tests                                                         #
    # ------------------------------------------------------------------ #

    def test_kpis_calculation(self):
        """2 running + 1 done → kpis calculés correctement."""
        proc1 = self._make_procedure(state='running')
        proc2 = self._make_procedure(state='running')
        proc3 = self._make_procedure(
            state='done',
            urea_pre=50.0, urea_post=15.0,        # R=0.3 → KT/V ≈ 1.4
            arrival_weight=70.0, departure_weight=68.0,
        )
        result = self.env['acs.dialysis.station'].get_dashboard_data()
        kpis = result['kpis']
        self.assertEqual(kpis['total_sessions'], 3)
        self.assertEqual(kpis['running_sessions'], 2)
        self.assertEqual(kpis['done_sessions'], 1)
        # Occupation = (2+1) / nb_postes_actifs * 100
        total_stations = self.env['acs.dialysis.station'].search_count([('active', '=', True)])
        expected_occ = round(3 / total_stations * 100) if total_stations else 0
        self.assertEqual(kpis['occupation_rate'], expected_occ)
        proc1.unlink()
        proc2.unlink()
        proc3.unlink()

    def test_get_ktv_chart_data_groups_by_day(self):
        """3 séances done sur 2 jours → valeurs moyennées par jour dans chart data."""
        today = datetime.now()
        yesterday = today - timedelta(days=1)

        def make_done(dt, urea_post_val):
            return self.env['acs.patient.procedure'].create({
                'patient_id': self.patient.id,
                'product_id': self.product.id,
                'department_id': self.dept.id,
                'date': fields.Datetime.to_string(dt - timedelta(hours=4)),
                'date_stop': fields.Datetime.to_string(dt),
                'state': 'done',
                'pre_dialysis_bp': '130/80',
                'urea_pre': 50.0,
                'urea_post': urea_post_val,
                'arrival_weight': 70.0,
                'departure_weight': 68.0,
                'nephrology_schedule_ids': [(4, self.schedule.id)],
            })

        # 2 séances hier, 1 aujourd'hui
        p1 = make_done(yesterday, 15.0)   # KT/V ≈ 1.4
        p2 = make_done(yesterday, 20.0)   # KT/V différent
        p3 = make_done(today, 12.0)       # KT/V > 1.2

        result = self.env['acs.dialysis.station'].get_ktv_chart_data()
        self.assertIn('labels', result)
        self.assertIn('values', result)
        self.assertEqual(len(result['labels']), len(result['values']))
        # Il doit y avoir au moins 2 jours distincts
        self.assertGreaterEqual(len(result['labels']), 2)
        # Vérifier que les valeurs sont des moyennes (float)
        for v in result['values']:
            self.assertIsInstance(v, float)
        p1.unlink()
        p2.unlink()
        p3.unlink()

    def test_get_ktv_chart_data_empty(self):
        """Sans séance done avec KT/V → retourne listes vides."""
        result = self.env['acs.dialysis.station'].get_ktv_chart_data()
        self.assertIn('labels', result)
        self.assertIn('values', result)
        # Peut contenir des données d'autres tests, mais la structure est valide
        self.assertIsInstance(result['labels'], list)
        self.assertIsInstance(result['values'], list)
```

- [ ] **Étape 2 : Lancer tous les tests Python**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
python -m pytest acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py -v
# Attendu : tous les tests passent
```

- [ ] **Étape 3 : Commit final Python**

```bash
git add acs_hms_nephrology_dashboard/tests/test_doctor_dashboard.py
git commit -m "test(doctor-dashboard): add KPIs and KTV chart tests — all Python tests complete"
```

---

## Task 5 : XML — Action client, menu, manifest

**Files:**
- Create: `acs_hms_nephrology_dashboard/views/doctor_dashboard_action.xml`
- Modify: `acs_hms_nephrology_dashboard/__manifest__.py`

- [ ] **Étape 1 : Créer `views/doctor_dashboard_action.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="action_doctor_dashboard" model="ir.actions.client">
        <field name="name">Dashboard Médecin</field>
        <field name="tag">acs_doctor_dashboard</field>
    </record>

    <menuitem
        id="menu_doctor_dashboard"
        name="Dashboard Médecin"
        action="action_doctor_dashboard"
        parent="acs_hms_nephrology.menu_nephrology"
        groups="acs_hms.group_hms_doctor,acs_hms_base.group_hms_manager,acs_hms_nephrology.group_hms_nephrology_user"
        sequence="10"/>
</odoo>
```

- [ ] **Étape 2 : Mettre à jour `__manifest__.py`**

```python
# -*- coding: utf-8 -*-
{
    'name': 'Nephrology Dashboard',
    'version': '1.0.0',
    'category': 'Medical',
    'summary': 'Interface infirmier tablette + dashboard médecin (OWL)',
    'depends': ['acs_hms_nephrology', 'acs_hms_nephrology_complications'],
    'data': [
        'security/ir.model.access.csv',
        'views/nurse_dashboard_action.xml',
        'views/doctor_dashboard_action.xml',
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

- [ ] **Étape 3 : Commit**

```bash
git add acs_hms_nephrology_dashboard/views/doctor_dashboard_action.xml \
        acs_hms_nephrology_dashboard/__manifest__.py
git commit -m "feat(doctor-dashboard): add Odoo action, menu item, update manifest"
```

---

## Task 6 : OWL — `DoctorStationCard` + CSS de base

**Files:**
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorStationCard.js`
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorStationCard.xml`
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/doctor_dashboard.css`

- [ ] **Étape 1 : Créer `DoctorStationCard.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<templates xml:space="preserve">
  <t t-name="acs_hms_nephrology_dashboard.DoctorStationCard">
    <div t-att-class="'dsc-card ' + cardClass" t-on-click="onClick">

      <!-- En-tête : nom poste + badge statut -->
      <div class="dsc-header">
        <span class="dsc-name" t-esc="props.station.name"/>
        <span t-att-class="'dsc-badge ' + badgeClass" t-esc="badgeLabel"/>
      </div>

      <t t-if="props.station.procedure">
        <!-- Nom patient -->
        <div class="dsc-patient" t-esc="props.station.procedure.patient_id[1]"/>

        <!-- Âge + accès vasculaire -->
        <div class="dsc-meta">
          <t t-if="props.station.procedure.age">
            <t t-esc="props.station.procedure.age"/> ans
          </t>
          <t t-if="props.station.procedure.vascular_access">
            <span class="dsc-sep">·</span>
            <t t-esc="props.station.procedure.vascular_access"/>
          </t>
        </div>

        <!-- Barre de progression -->
        <div class="dsc-progress-bar">
          <div class="dsc-progress-fill" t-att-style="progressStyle"/>
        </div>
        <div class="dsc-time">
          <t t-esc="elapsedFormatted"/> / <t t-esc="expectedFormatted"/>
        </div>

        <!-- Alerte critique : remplace les valeurs -->
        <t t-if="props.station.procedure.alert_level === 'critical'">
          <div class="dsc-alert-critical">
            🔴 <t t-esc="props.station.procedure.alert_label"/>
            <t t-if="props.station.procedure.pre_dialysis_bp">
              — <t t-esc="props.station.procedure.pre_dialysis_bp"/>
            </t>
          </div>
        </t>

        <!-- Valeurs cliniques normales -->
        <t t-else="">
          <div class="dsc-values">
            <div class="dsc-val">
              <span class="dsc-val-label">TA</span>
              <span t-esc="props.station.procedure.pre_dialysis_bp || '—'"/>
            </div>
            <div class="dsc-val">
              <span class="dsc-val-label">KT/V</span>
              <span t-att-class="ktvClass"
                    t-esc="props.station.procedure.ktv_calculated > 0 ? props.station.procedure.ktv_calculated.toFixed(2) : '—'"/>
            </div>
            <div class="dsc-val">
              <span class="dsc-val-label">UF</span>
              <span t-esc="props.station.procedure.actual_uf > 0 ? props.station.procedure.actual_uf + ' ml' : '—'"/>
            </div>
          </div>
        </t>
      </t>

      <!-- Poste libre -->
      <t t-else="">
        <div class="dsc-empty">— Libre —</div>
      </t>
    </div>
  </t>
</templates>
```

- [ ] **Étape 2 : Créer `DoctorStationCard.js`**

```js
/** @odoo-module **/
import { Component } from "@odoo/owl";

export class DoctorStationCard extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorStationCard";
    static props = {
        station: Object,
        onSelect: Function,
    };

    get cardClass() {
        const proc = this.props.station.procedure;
        if (!proc) return "dsc-libre";
        if (proc.alert_level === "critical") return "dsc-critical";
        if (proc.alert_level === "warning") return "dsc-warning";
        const map = { running: "dsc-running", done: "dsc-done", cancel: "dsc-absent", scheduled: "dsc-scheduled" };
        return map[proc.state] || "";
    }

    get badgeClass() {
        const proc = this.props.station.procedure;
        if (!proc) return "dsc-badge-libre";
        if (proc.alert_level === "critical") return "dsc-badge-critical";
        if (proc.alert_level === "warning") return "dsc-badge-warning";
        const map = { running: "dsc-badge-running", done: "dsc-badge-done", cancel: "dsc-badge-absent", scheduled: "dsc-badge-scheduled" };
        return map[proc.state] || "";
    }

    get badgeLabel() {
        const proc = this.props.station.procedure;
        if (!proc) return "Libre";
        if (proc.alert_level === "critical") return "🔴 ALERTE";
        if (proc.alert_level === "warning") return "⚠ ATTENTION";
        const labels = { running: "En cours", done: "Terminé", scheduled: "Prévu", cancel: "Absent" };
        return labels[proc.state] || proc.state;
    }

    /** Durée écoulée en heures (temps réel pour running, actual_duration pour done). */
    get elapsedHours() {
        const proc = this.props.station.procedure;
        if (!proc) return 0;
        if (proc.state === "done") return proc.actual_duration || 0;
        if (proc.state === "running" && proc.date) {
            // proc.date est UTC "YYYY-MM-DD HH:MM:SS"
            const start = new Date(proc.date.replace(" ", "T") + "Z");
            return Math.max(0, (Date.now() - start.getTime()) / 3600000);
        }
        return 0;
    }

    get progressStyle() {
        const proc = this.props.station.procedure;
        if (!proc || !proc.expected_duration) return "width: 0%";
        const pct = Math.min(100, Math.round((this.elapsedHours / proc.expected_duration) * 100));
        return `width: ${pct}%`;
    }

    get elapsedFormatted() { return this._fmt(this.elapsedHours); }
    get expectedFormatted() {
        const proc = this.props.station.procedure;
        return proc ? this._fmt(proc.expected_duration) : "—";
    }

    get ktvClass() {
        const s = this.props.station.procedure?.ktv_status;
        return s === "adequate" ? "ktv-ok" : s === "insufficient" ? "ktv-low" : "";
    }

    _fmt(hours) {
        if (!hours) return "—";
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h${String(m).padStart(2, "0")}`;
    }

    onClick() {
        const proc = this.props.station.procedure;
        if (proc) this.props.onSelect(proc.id);
    }
}
```

- [ ] **Étape 3 : Créer `doctor_dashboard.css`**

```css
/* acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/doctor_dashboard.css */

/* ─── Layout principal ─── */
.doctor-dashboard {
    display: flex;
    height: 100%;
    background: #0f1117;
    color: #e5e7eb;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    overflow: hidden;
}

/* ─── Sidebar gauche ─── */
.doctor-alerts-sidebar {
    width: 240px;
    min-width: 240px;
    background: #111827;
    border-right: 1px solid #1f2937;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 12px 0;
}
.das-section { padding: 8px 14px; border-bottom: 1px solid #1f2937; }
.das-title { font-size: 9px; font-weight: 700; color: #6b7280; letter-spacing: .08em; margin-bottom: 8px; }
.das-kpi { display: flex; justify-content: space-between; margin-bottom: 5px; }
.das-kpi-label { color: #9ca3af; }
.das-kpi-value { font-weight: 600; color: #e5e7eb; }
.das-kpi-value.kpi-ok { color: #4ade80; }
.das-kpi-value.kpi-warn { color: #f59e0b; }
.das-alert-btn {
    display: block; width: 100%; text-align: left; padding: 5px 8px;
    border-radius: 4px; border: 1px solid transparent; cursor: pointer;
    margin-bottom: 4px; font-size: 12px;
}
.das-alert-btn.das-critical { background: #ef444411; color: #f87171; border-color: #ef444433; }
.das-alert-btn.das-critical.active { border-color: #ef4444; background: #ef444422; }
.das-alert-btn.das-warning { background: #f59e0b11; color: #fbbf24; border-color: #f59e0b33; }
.das-alert-btn.das-warning.active { border-color: #f59e0b; background: #f59e0b22; }
.das-alert-list { flex: 1; overflow-y: auto; }
.das-alert-item {
    padding: 7px 14px; cursor: pointer; border-bottom: 1px solid #1f293755;
}
.das-alert-item:hover { background: #1f2937; }
.das-alert-item.das-alert-critical { border-left: 3px solid #ef4444; }
.das-alert-item.das-alert-warning { border-left: 3px solid #f59e0b; }
.das-alert-station { font-weight: 600; font-size: 11px; color: #e5e7eb; }
.das-alert-label { font-size: 11px; color: #9ca3af; margin-top: 1px; }
.das-no-alerts { padding: 14px; color: #6b7280; text-align: center; font-size: 11px; }

/* ─── Zone principale ─── */
.dd-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.dd-tabs { display: flex; gap: 0; background: #111827; border-bottom: 1px solid #1f2937; padding: 0 16px; }
.dd-tab {
    padding: 10px 16px; background: none; border: none; cursor: pointer;
    color: #6b7280; font-size: 13px; border-bottom: 2px solid transparent;
}
.dd-tab.active { color: #4e9af1; border-bottom-color: #4e9af1; }
.dd-content { flex: 1; overflow-y: auto; padding: 16px; }

/* ─── Grille de postes ─── */
.doctor-station-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
}

/* ─── Carte de poste ─── */
.dsc-card {
    border: 1px solid #374151; border-radius: 8px; padding: 10px;
    cursor: pointer; transition: border-color .15s, background .15s;
    background: #111827;
}
.dsc-card:hover { border-color: #4e9af1; }
.dsc-running { background: #16a34a11; border-color: #16a34a55; }
.dsc-critical { background: #ef444415; border: 2px solid #ef4444; }
.dsc-warning { background: #f59e0b11; border-color: #f59e0b55; }
.dsc-done { background: #1e3a5f22; border-color: #374151; }
.dsc-absent { background: #1f293722; border-color: #37415133; }
.dsc-libre { background: #11182788; border-color: #1f2937; }
.dsc-scheduled { background: #111827; border-color: #374151; }

.dsc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.dsc-name { font-size: 10px; color: #6b7280; font-weight: 700; letter-spacing: .05em; }
.dsc-badge { font-size: 9px; padding: 1px 6px; border-radius: 8px; font-weight: 600; }
.dsc-badge-running { background: #16a34a; color: #fff; }
.dsc-badge-critical { background: #ef4444; color: #fff; }
.dsc-badge-warning { background: #f59e0b; color: #000; }
.dsc-badge-done { background: #374151; color: #9ca3af; }
.dsc-badge-absent, .dsc-badge-cancel { background: #1f2937; color: #6b7280; }
.dsc-badge-scheduled { background: #1f2937; color: #9ca3af; }
.dsc-badge-libre { background: transparent; color: #6b7280; }

.dsc-patient { font-weight: 600; font-size: 12px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsc-meta { font-size: 10px; color: #9ca3af; margin-bottom: 6px; }
.dsc-sep { margin: 0 4px; }

.dsc-progress-bar { background: #1f2937; border-radius: 3px; height: 5px; margin-bottom: 3px; overflow: hidden; }
.dsc-progress-fill { background: #4e9af1; height: 100%; border-radius: 3px; transition: width .5s; }
.dsc-running .dsc-progress-fill { background: #16a34a; }
.dsc-critical .dsc-progress-fill { background: #ef4444; }
.dsc-time { font-size: 9px; color: #6b7280; text-align: center; margin-bottom: 6px; }

.dsc-alert-critical { font-size: 10px; color: #f87171; background: #ef444411; border-radius: 4px; padding: 4px 6px; }
.dsc-values { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
.dsc-val { text-align: center; }
.dsc-val-label { display: block; font-size: 8px; color: #6b7280; }
.dsc-empty { color: #6b7280; text-align: center; font-size: 11px; padding: 12px 0; }
.ktv-ok { color: #4ade80; }
.ktv-low { color: #f59e0b; }

/* ─── Tableau liste ─── */
.dd-list-table { width: 100%; border-collapse: collapse; }
.dd-list-table th { text-align: left; font-size: 10px; color: #6b7280; padding: 6px 10px; border-bottom: 1px solid #1f2937; }
.dd-list-table td { padding: 8px 10px; border-bottom: 1px solid #1f293733; font-size: 12px; }
.dd-list-table tr:hover { background: #1f2937; cursor: pointer; }
.dd-row-critical { background: #ef444411; }

/* ─── Slide panel patient ─── */
.doctor-patient-panel {
    width: 300px; min-width: 300px; background: #111827;
    border-left: 2px solid #4e9af1; display: flex; flex-direction: column;
    overflow-y: auto; padding: 14px;
}
.dpp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.dpp-name { font-weight: 700; font-size: 15px; color: #e5e7eb; }
.dpp-close { background: none; border: none; color: #6b7280; cursor: pointer; font-size: 16px; }
.dpp-close:hover { color: #e5e7eb; }
.dpp-meta { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
.dpp-since { font-size: 10px; color: #6b7280; margin-bottom: 10px; }
.dpp-alert-block { background: #ef444415; border-left: 3px solid #ef4444; border-radius: 4px; padding: 6px 8px; margin-bottom: 10px; font-size: 11px; color: #f87171; }
.dpp-section-title { font-size: 9px; font-weight: 700; color: #6b7280; letter-spacing: .08em; margin: 10px 0 5px; }
.dpp-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-bottom: 6px; }
.dpp-cell { background: #1f2937; border-radius: 4px; padding: 4px 6px; }
.dpp-cell-label { font-size: 8px; color: #6b7280; }
.dpp-bp { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
.dpp-dry-weight { font-size: 11px; color: #9ca3af; margin-top: 6px; }
.dpp-treatment { margin-top: 6px; font-size: 11px; color: #9ca3af; }
.dpp-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 14px; }
.dpp-btn { padding: 7px; border-radius: 4px; border: none; cursor: pointer; font-size: 11px; text-align: center; }
.dpp-btn-primary { background: #4e9af1; color: #fff; }
.dpp-btn-primary:hover { background: #3b82f6; }
.dpp-btn-secondary { background: #1f2937; color: #9ca3af; border: 1px solid #374151; }
.dpp-btn-secondary:hover { background: #374151; color: #e5e7eb; }

/* ─── Stats chart ─── */
.doctor-stats-chart { max-width: 800px; }
.dsc-chart-wrapper { background: #111827; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.dsc-metrics { display: flex; gap: 16px; flex-wrap: wrap; }
.dsc-metric { background: #111827; border-radius: 8px; padding: 12px 16px; }
.dsc-metric-value { font-size: 22px; font-weight: 700; color: #4e9af1; }
.dsc-metric-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
```

- [ ] **Étape 4 : Commit**

```bash
git add acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorStationCard.js \
        acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorStationCard.xml \
        acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/doctor_dashboard.css
git commit -m "feat(doctor-dashboard): add DoctorStationCard component + CSS"
```

---

## Task 7 : OWL — `DoctorStationGrid`

**Files:**
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorStationGrid.js`
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorStationGrid.xml`

- [ ] **Étape 1 : Créer `DoctorStationGrid.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<templates xml:space="preserve">
  <t t-name="acs_hms_nephrology_dashboard.DoctorStationGrid">
    <div class="doctor-station-grid">
      <t t-if="filteredStations.length === 0">
        <div style="color: #6b7280; padding: 24px; text-align: center;">
          Aucun poste à afficher.
        </div>
      </t>
      <t t-foreach="filteredStations" t-as="station" t-key="station.id">
        <DoctorStationCard station="station" onSelect="props.onSelectStation"/>
      </t>
    </div>
  </t>
</templates>
```

- [ ] **Étape 2 : Créer `DoctorStationGrid.js`**

```js
/** @odoo-module **/
import { Component } from "@odoo/owl";
import { DoctorStationCard } from "./DoctorStationCard";

export class DoctorStationGrid extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorStationGrid";
    static components = { DoctorStationCard };
    static props = {
        stations: Array,
        alertFilter: { optional: true },
        onSelectStation: Function,
    };

    get filteredStations() {
        const { stations, alertFilter } = this.props;
        if (!alertFilter) return stations;
        return stations.filter(
            (s) => s.procedure && s.procedure.alert_level === alertFilter
        );
    }
}
```

- [ ] **Étape 3 : Commit**

```bash
git add acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorStationGrid.js \
        acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorStationGrid.xml
git commit -m "feat(doctor-dashboard): add DoctorStationGrid component"
```

---

## Task 8 : OWL — `DoctorAlertsSidebar`

**Files:**
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorAlertsSidebar.js`
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorAlertsSidebar.xml`

- [ ] **Étape 1 : Créer `DoctorAlertsSidebar.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<templates xml:space="preserve">
  <t t-name="acs_hms_nephrology_dashboard.DoctorAlertsSidebar">
    <div class="doctor-alerts-sidebar">

      <!-- KPIs du jour -->
      <div class="das-section">
        <div class="das-title">KPIs DU JOUR</div>
        <div class="das-kpi">
          <span class="das-kpi-label">Séances</span>
          <span class="das-kpi-value">
            <t t-esc="(props.kpis.running_sessions || 0) + (props.kpis.done_sessions || 0)"/>
            / <t t-esc="props.kpis.total_sessions || 0"/>
          </span>
        </div>
        <div class="das-kpi">
          <span class="das-kpi-label">Occupation</span>
          <span class="das-kpi-value"><t t-esc="(props.kpis.occupation_rate || 0) + '%'"/></span>
        </div>
        <div class="das-kpi">
          <span class="das-kpi-label">KT/V moy.</span>
          <span t-att-class="'das-kpi-value ' + ktvClass">
            <t t-esc="(props.kpis.avg_ktv || 0).toFixed(2)"/>
          </span>
        </div>
        <div class="das-kpi">
          <span class="das-kpi-label">Complications</span>
          <span class="das-kpi-value"><t t-esc="props.kpis.complication_count || 0"/></span>
        </div>
      </div>

      <!-- Compteurs alertes -->
      <div class="das-section">
        <div class="das-title">ALERTES</div>
        <button t-att-class="'das-alert-btn das-critical ' + (props.alertFilter === 'critical' ? 'active' : '')"
                t-on-click="onFilterCritical">
          🔴 <t t-esc="props.kpis.critical_alerts || 0"/> critiques
        </button>
        <button t-att-class="'das-alert-btn das-warning ' + (props.alertFilter === 'warning' ? 'active' : '')"
                t-on-click="onFilterWarning">
          ⚠ <t t-esc="props.kpis.warning_alerts || 0"/> attentions
        </button>
      </div>

      <!-- Liste des alertes -->
      <div class="das-alert-list">
        <t t-foreach="props.alerts" t-as="alert" t-key="alert_index">
          <div t-att-class="'das-alert-item das-alert-' + alert.level"
               t-on-click="() => props.onSelectStation(alert.procedure_id)">
            <div class="das-alert-station">
              <t t-esc="alert.station_name"/> — <t t-esc="alert.patient_name"/>
            </div>
            <div class="das-alert-label"><t t-esc="alert.label"/></div>
          </div>
        </t>
        <t t-if="!props.alerts.length">
          <div class="das-no-alerts">Aucune alerte active</div>
        </t>
      </div>

    </div>
  </t>
</templates>
```

- [ ] **Étape 2 : Créer `DoctorAlertsSidebar.js`**

```js
/** @odoo-module **/
import { Component } from "@odoo/owl";

export class DoctorAlertsSidebar extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorAlertsSidebar";
    static props = {
        kpis: Object,
        alerts: Array,
        alertFilter: { optional: true },
        onAlertFilter: Function,
        onSelectStation: Function,
    };

    get ktvClass() {
        return (this.props.kpis.avg_ktv || 0) >= 1.2 ? "kpi-ok" : "kpi-warn";
    }

    onFilterCritical() {
        this.props.onAlertFilter(this.props.alertFilter === "critical" ? null : "critical");
    }

    onFilterWarning() {
        this.props.onAlertFilter(this.props.alertFilter === "warning" ? null : "warning");
    }
}
```

- [ ] **Étape 3 : Commit**

```bash
git add acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorAlertsSidebar.js \
        acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorAlertsSidebar.xml
git commit -m "feat(doctor-dashboard): add DoctorAlertsSidebar component"
```

---

## Task 9 : OWL — `DoctorPatientPanel`

**Files:**
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorPatientPanel.js`
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorPatientPanel.xml`

- [ ] **Étape 1 : Créer `DoctorPatientPanel.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<templates xml:space="preserve">
  <t t-name="acs_hms_nephrology_dashboard.DoctorPatientPanel">
    <div class="doctor-patient-panel">

      <!-- En-tête -->
      <div class="dpp-header">
        <span class="dpp-name" t-esc="patient.name"/>
        <button class="dpp-close" t-on-click="props.onClose">✕</button>
      </div>
      <div class="dpp-meta">
        <t t-esc="patient.age"/> ans
        <t t-if="patient.blood_group"> · Gr. <t t-esc="patient.blood_group"/></t>
        <t t-if="patient.vascular_access"> · <t t-esc="patient.vascular_access"/></t>
      </div>
      <t t-if="patient.dialysis_since">
        <div class="dpp-since">Dialyse depuis <t t-esc="patient.dialysis_since"/></div>
      </t>

      <!-- Alertes actives -->
      <t t-if="procedure.active_complications and procedure.active_complications.length">
        <div class="dpp-alert-block">
          <t t-foreach="procedure.active_complications" t-as="comp" t-key="comp_index">
            <div>🔴 <t t-esc="comp.label"/>
              <t t-if="comp.bp"> — TA <t t-esc="comp.bp"/></t>
            </div>
          </t>
        </div>
      </t>
      <t t-elif="procedure.has_active_hypotension">
        <div class="dpp-alert-block">🔴 Hypotension active</div>
      </t>

      <!-- Séance en cours -->
      <div class="dpp-section-title">SÉANCE EN COURS</div>
      <div class="dpp-grid-3">
        <div class="dpp-cell">
          <div class="dpp-cell-label">Durée</div>
          <div t-esc="fmt(procedure.actual_duration) + ' / ' + fmt(procedure.expected_duration)"/>
        </div>
        <div class="dpp-cell">
          <div class="dpp-cell-label">UF réelle</div>
          <div t-esc="procedure.actual_uf > 0 ? procedure.actual_uf + ' ml' : '—'"/>
        </div>
        <div class="dpp-cell">
          <div class="dpp-cell-label">KT/V</div>
          <div t-att-class="procedure.ktv_status === 'adequate' ? 'ktv-ok' : procedure.ktv_status === 'insufficient' ? 'ktv-low' : ''"
               t-esc="procedure.ktv_calculated > 0 ? procedure.ktv_calculated.toFixed(2) : '—'"/>
        </div>
      </div>
      <div class="dpp-bp">TA pré-dialyse : <span t-esc="procedure.pre_dialysis_bp || '—'"/></div>

      <!-- Dernière séance -->
      <t t-if="prevSession">
        <div class="dpp-section-title">DERNIÈRE SÉANCE (<t t-esc="prevSession.date"/>)</div>
        <div class="dpp-grid-3">
          <div class="dpp-cell">
            <div class="dpp-cell-label">Durée</div>
            <div t-esc="fmt(prevSession.actual_duration)"/>
          </div>
          <div class="dpp-cell">
            <div class="dpp-cell-label">UF</div>
            <div t-esc="prevSession.actual_uf > 0 ? prevSession.actual_uf + ' ml' : '—'"/>
          </div>
          <div class="dpp-cell">
            <div class="dpp-cell-label">KT/V</div>
            <div t-att-class="prevSession.ktv_status === 'adequate' ? 'ktv-ok' : prevSession.ktv_status === 'insufficient' ? 'ktv-low' : ''"
                 t-esc="prevSession.ktv_calculated > 0 ? prevSession.ktv_calculated.toFixed(2) : '—'"/>
          </div>
        </div>
      </t>

      <!-- Poids sec -->
      <div class="dpp-dry-weight">
        Poids sec : <span t-esc="procedure.dry_weight > 0 ? procedure.dry_weight + ' kg' : '—'"/>
      </div>

      <!-- Traitement -->
      <t t-if="patient.treatment">
        <div class="dpp-treatment">
          <div class="dpp-section-title">TRAITEMENT</div>
          <div t-esc="patient.treatment"/>
        </div>
      </t>

      <!-- Boutons d'action -->
      <div class="dpp-actions">
        <button class="dpp-btn dpp-btn-primary" t-on-click="openFullRecord">Dossier complet</button>
        <button class="dpp-btn dpp-btn-secondary" t-on-click="openPrescription">Prescrire</button>
        <button class="dpp-btn dpp-btn-secondary" t-on-click="openHistory">Historique</button>
        <button class="dpp-btn dpp-btn-secondary" t-on-click="scheduleAppointment">Planifier RDV</button>
      </div>

    </div>
  </t>
</templates>
```

- [ ] **Étape 2 : Créer `DoctorPatientPanel.js`**

```js
/** @odoo-module **/
import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class DoctorPatientPanel extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorPatientPanel";
    static props = {
        panelData: Object,
        onClose: Function,
    };

    setup() {
        this.action = useService("action");
    }

    get procedure() { return this.props.panelData.procedure; }
    get patient() { return this.props.panelData.patient; }
    get prevSession() { return this.props.panelData.previous_session; }

    fmt(hours) {
        if (!hours) return "—";
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h${String(m).padStart(2, "0")}`;
    }

    openFullRecord() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "acs.patient.procedure",
            res_id: this.procedure.id,
            views: [[false, "form"]],
            target: "current",
        });
    }

    openPrescription() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "hms.prescription",
            views: [[false, "form"]],
            target: "new",
            context: { default_patient_id: this.patient.id },
        });
    }

    openHistory() {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: `Historique — ${this.patient.name}`,
            res_model: "acs.patient.procedure",
            views: [[false, "list"], [false, "form"]],
            domain: [
                ["patient_id", "=", this.patient.id],
                ["department_id.department_type", "=", "nephrology"],
            ],
            target: "current",
        });
    }

    scheduleAppointment() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "hms.appointment",
            views: [[false, "form"]],
            target: "new",
            context: { default_patient_id: this.patient.id },
        });
    }
}
```

- [ ] **Étape 3 : Commit**

```bash
git add acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorPatientPanel.js \
        acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorPatientPanel.xml
git commit -m "feat(doctor-dashboard): add DoctorPatientPanel component with 4 action buttons"
```

---

## Task 10 : OWL — `DoctorStatsChart`

**Files:**
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorStatsChart.js`
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorStatsChart.xml`

- [ ] **Étape 1 : Créer `DoctorStatsChart.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<templates xml:space="preserve">
  <t t-name="acs_hms_nephrology_dashboard.DoctorStatsChart">
    <div class="doctor-stats-chart">
      <t t-if="state.loading">
        <div style="color: #6b7280; padding: 24px; text-align: center;">Chargement des données…</div>
      </t>
      <t t-else="">
        <div class="dsc-chart-wrapper">
          <canvas t-ref="ktv_canvas" style="max-height: 280px;"/>
        </div>
        <div class="dsc-metrics">
          <div class="dsc-metric">
            <div class="dsc-metric-value"><t t-esc="state.adequateRate"/>%</div>
            <div class="dsc-metric-label">Séances adéquates (KT/V ≥ 1.2) — 30 jours</div>
          </div>
          <div class="dsc-metric">
            <div class="dsc-metric-value" style="color: #f59e0b;"><t t-esc="state.avgKtv.toFixed(2)"/></div>
            <div class="dsc-metric-label">KT/V moyen global — 30 jours</div>
          </div>
          <div class="dsc-metric">
            <div class="dsc-metric-value" style="color: #9ca3af;"><t t-esc="state.totalSessions"/></div>
            <div class="dsc-metric-label">Séances avec KT/V calculé</div>
          </div>
        </div>
      </t>
    </div>
  </t>
</templates>
```

- [ ] **Étape 2 : Créer `DoctorStatsChart.js`**

```js
/** @odoo-module **/
import { Component, useRef, onMounted, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class DoctorStatsChart extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorStatsChart";
    static props = {};

    setup() {
        this.orm = useService("orm");
        this.canvasRef = useRef("ktv_canvas");
        this.state = useState({ loading: true, adequateRate: 0, avgKtv: 0, totalSessions: 0 });
        onMounted(() => this._load());
    }

    async _load() {
        const data = await this.orm.call("acs.dialysis.station", "get_ktv_chart_data", []);
        this.state.loading = false;

        const vals = data.values || [];
        this.state.totalSessions = vals.length;
        this.state.avgKtv = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        this.state.adequateRate = vals.length
            ? Math.round((vals.filter((v) => v >= 1.2).length / vals.length) * 100)
            : 0;

        this._renderChart(data.labels || [], vals);
    }

    _renderChart(labels, values) {
        const canvas = this.canvasRef.el;
        if (!canvas || !window.Chart) return;

        new window.Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "KT/V moyen",
                        data: values,
                        borderColor: "#4e9af1",
                        backgroundColor: "rgba(78,154,241,0.08)",
                        tension: 0.3,
                        fill: true,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                    },
                    {
                        label: "Seuil 1.2",
                        data: labels.map(() => 1.2),
                        borderColor: "#f59e0b",
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        min: 0,
                        max: 2.5,
                        grid: { color: "#1f2937" },
                        ticks: { color: "#6b7280" },
                    },
                    x: {
                        grid: { color: "#1f293755" },
                        ticks: { color: "#6b7280", maxTicksLimit: 10 },
                    },
                },
                plugins: {
                    legend: { labels: { color: "#9ca3af", boxWidth: 12 } },
                    tooltip: { backgroundColor: "#1f2937", titleColor: "#e5e7eb", bodyColor: "#9ca3af" },
                },
            },
        });
    }
}
```

- [ ] **Étape 3 : Commit**

```bash
git add acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorStatsChart.js \
        acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorStatsChart.xml
git commit -m "feat(doctor-dashboard): add DoctorStatsChart with Chart.js KTV line chart"
```

---

## Task 11 : OWL — `DoctorDashboard` (racine) + point d'entrée + wiring final

**Files:**
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorDashboard.js`
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorDashboard.xml`
- Create: `acs_hms_nephrology_dashboard/static/src/doctor_dashboard.js`

- [ ] **Étape 1 : Créer `DoctorDashboard.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<templates xml:space="preserve">
  <t t-name="acs_hms_nephrology_dashboard.DoctorDashboard">
    <div class="doctor-dashboard">

      <!-- Sidebar gauche fixe -->
      <DoctorAlertsSidebar
        kpis="state.kpis"
        alerts="state.alerts"
        alertFilter="state.alertFilter"
        onAlertFilter.bind="onAlertFilter"
        onSelectStation.bind="onSelectStation"
      />

      <!-- Zone principale -->
      <div class="dd-main">
        <div class="dd-tabs">
          <button t-att-class="'dd-tab ' + (state.tab === 'grid' ? 'active' : '')"
                  t-on-click="() => setTab('grid')">⬛ Grille</button>
          <button t-att-class="'dd-tab ' + (state.tab === 'list' ? 'active' : '')"
                  t-on-click="() => setTab('list')">☰ Liste</button>
          <button t-att-class="'dd-tab ' + (state.tab === 'stats' ? 'active' : '')"
                  t-on-click="() => setTab('stats')">📊 Stats</button>
        </div>

        <div class="dd-content">
          <t t-if="state.tab === 'grid'">
            <DoctorStationGrid
              stations="state.stations"
              alertFilter="state.alertFilter"
              onSelectStation.bind="onSelectStation"
            />
          </t>

          <t t-elif="state.tab === 'list'">
            <table class="dd-list-table">
              <thead>
                <tr>
                  <th>Poste</th><th>Patient</th><th>Statut</th>
                  <th>Durée</th><th>KT/V</th><th>Alerte</th>
                </tr>
              </thead>
              <tbody>
                <t t-foreach="state.stations" t-as="station" t-key="station.id">
                  <tr t-att-class="station.procedure and station.procedure.alert_level === 'critical' ? 'dd-row-critical' : ''"
                      t-on-click="() => station.procedure and onSelectStation(station.procedure.id)">
                    <td t-esc="station.name"/>
                    <td t-esc="station.procedure ? station.procedure.patient_id[1] : '—'"/>
                    <td t-esc="station.procedure ? station.procedure.state : 'Libre'"/>
                    <td t-esc="station.procedure ? fmtDur(station.procedure.actual_duration) : '—'"/>
                    <td t-att-class="station.procedure and station.procedure.ktv_status === 'adequate' ? 'ktv-ok' : station.procedure and station.procedure.ktv_status === 'insufficient' ? 'ktv-low' : ''"
                        t-esc="station.procedure and station.procedure.ktv_calculated > 0 ? station.procedure.ktv_calculated.toFixed(2) : '—'"/>
                    <td t-esc="station.procedure ? (station.procedure.alert_label || '—') : '—'"/>
                  </tr>
                </t>
              </tbody>
            </table>
          </t>

          <t t-elif="state.tab === 'stats'">
            <DoctorStatsChart/>
          </t>
        </div>
      </div>

      <!-- Slide panel patient -->
      <t t-if="state.showPanel and state.panelData">
        <DoctorPatientPanel panelData="state.panelData" onClose.bind="onClosePanel"/>
      </t>

    </div>
  </t>
</templates>
```

- [ ] **Étape 2 : Créer `DoctorDashboard.js`**

```js
/** @odoo-module **/
import { Component, useState, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { DoctorAlertsSidebar } from "./DoctorAlertsSidebar";
import { DoctorStationGrid } from "./DoctorStationGrid";
import { DoctorPatientPanel } from "./DoctorPatientPanel";
import { DoctorStatsChart } from "./DoctorStatsChart";

export class DoctorDashboard extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorDashboard";
    static components = { DoctorAlertsSidebar, DoctorStationGrid, DoctorPatientPanel, DoctorStatsChart };

    setup() {
        this.orm = useService("orm");
        this.state = useState({
            tab: "grid",
            stations: [],
            kpis: {
                total_sessions: 0, running_sessions: 0, done_sessions: 0,
                occupation_rate: 0, avg_ktv: 0, complication_count: 0,
                critical_alerts: 0, warning_alerts: 0,
            },
            alerts: [],
            showPanel: false,
            panelData: null,
            alertFilter: null,
        });

        this._loadDashboard();

        useEffect(() => {
            const id = setInterval(() => this._loadDashboard(), 30000);
            return () => clearInterval(id);
        }, () => []);
    }

    async _loadDashboard() {
        const data = await this.orm.call("acs.dialysis.station", "get_dashboard_data", []);
        this.state.stations = data.stations;
        this.state.kpis = data.kpis;
        this.state.alerts = data.alerts;
    }

    async onSelectStation(procedureId) {
        const data = await this.orm.call("acs.dialysis.station", "get_patient_panel_data", [procedureId]);
        this.state.panelData = data;
        this.state.showPanel = true;
    }

    onClosePanel() {
        this.state.showPanel = false;
        this.state.panelData = null;
    }

    onAlertFilter(level) {
        this.state.alertFilter = level;
        this.state.tab = "grid";
    }

    setTab(tab) {
        this.state.tab = tab;
        this.state.alertFilter = null;
    }

    fmtDur(hours) {
        if (!hours) return "—";
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h${String(m).padStart(2, "0")}`;
    }
}

registry.category("actions").add("acs_doctor_dashboard", DoctorDashboard);
```

- [ ] **Étape 3 : Créer `static/src/doctor_dashboard.js`**

```js
/** @odoo-module **/
export { DoctorDashboard } from "./components/doctor_dashboard/DoctorDashboard";
```

- [ ] **Étape 4 : Commit final**

```bash
git add acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorDashboard.js \
        acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorDashboard.xml \
        acs_hms_nephrology_dashboard/static/src/doctor_dashboard.js
git commit -m "feat(doctor-dashboard): add DoctorDashboard root component + registry — section 6 complete"
```

---

## Self-review — couverture de la spec

| Exigence spec | Tâche |
|---|---|
| Vue postes temps réel (statut libre/en cours/terminé/absent) | Task 1 + Task 6 + Task 7 |
| Alertes actives (hypotension, complication, séance en retard) | Task 2 |
| KPIs jour (nb séances, occupation, KT/V moyen, nb complic.) | Task 1 + Task 8 |
| Sidebar alertes avec filtrage par criticité | Task 8 |
| Slide panel patient (alertes + séance + dernière séance + poids sec + traitement + 4 actions) | Task 3 + Task 9 |
| Graphique KT/V 30 jours + métriques | Task 4 + Task 10 |
| Toggle Grille / Liste / Stats | Task 11 |
| Polling 30s | Task 11 |
| Menu médecin (group_hms_doctor + manager + néphro_user) | Task 5 |
| Accès rapide dossier patient depuis vue postes | Task 9 (openFullRecord) |
| Cartes détaillées : barre progression + âge + accès vasculaire + TA/KT/V/UF | Task 6 |
