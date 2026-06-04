# Dialysis Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter la vue calendrier visuel des postes de dialyse (Jour/Semaine/Mois) en OWL dans `acs_hms_nephrology_dashboard`.

**Architecture:** Composant racine `DialysisCalendar` centralise l'état et les appels ORM. 3 vues filles (`CalendarDayView`, `CalendarWeekView`, `CalendarMonthView`) reçoivent leurs données en props. `DoctorPatientPanel` existant est réutilisé tel quel pour le slide panel. Backend Python ajoute 3 méthodes RPC sur `acs.dialysis.station` via `_inherit`.

**Tech Stack:** Odoo 19, OWL (`@odoo/owl`), Python (`odoo.api`, `odoo.fields`), CSS plain.

**Spec:** `docs/superpowers/specs/2026-06-02-dialysis-calendar-view-design.md`

---

## File Map

| Fichier | Action | Rôle |
|---|---|---|
| `models/calendar_dashboard.py` | Créer | 3 méthodes RPC + helpers |
| `models/__init__.py` | Modifier | import calendar_dashboard |
| `views/dialysis_calendar_action.xml` | Créer | action client Odoo + menu |
| `__manifest__.py` | Modifier | ajouter XML dans data |
| `tests/test_calendar_dashboard.py` | Créer | tests backend TDD |
| `tests/__init__.py` | Modifier | import test_calendar_dashboard |
| `static/src/components/dialysis_calendar/CalendarToolbar.js` | Créer | toolbar mode + nav dates |
| `static/src/components/dialysis_calendar/CalendarToolbar.xml` | Créer | template toolbar |
| `static/src/components/dialysis_calendar/CalendarDayView.js` | Créer | vue jour — grille postes/temps |
| `static/src/components/dialysis_calendar/CalendarDayView.xml` | Créer | template vue jour |
| `static/src/components/dialysis_calendar/CalendarWeekView.js` | Créer | vue semaine — tableau patients |
| `static/src/components/dialysis_calendar/CalendarWeekView.xml` | Créer | template vue semaine |
| `static/src/components/dialysis_calendar/CalendarMonthView.js` | Créer | vue mois — grille occupation |
| `static/src/components/dialysis_calendar/CalendarMonthView.xml` | Créer | template vue mois |
| `static/src/components/dialysis_calendar/DialysisCalendar.js` | Créer | composant racine, état, fetch |
| `static/src/components/dialysis_calendar/DialysisCalendar.xml` | Créer | template racine |
| `static/src/components/dialysis_calendar/dialysis_calendar.css` | Créer | styles dédiés |

Tous les chemins sont relatifs à `acs_hms_nephrology_dashboard/`.

---

## Task 1 : Wiring du module — stubs + action XML

**Files:**
- Modify: `models/__init__.py`
- Create: `models/calendar_dashboard.py`
- Modify: `__manifest__.py`
- Create: `views/dialysis_calendar_action.xml`

- [ ] **Step 1.1 : Ajouter l'import dans `models/__init__.py`**

```python
# models/__init__.py
# -*- coding: utf-8 -*-
from . import doctor_dashboard
from . import calendar_dashboard
```

- [ ] **Step 1.2 : Créer le stub `models/calendar_dashboard.py`**

```python
# acs_hms_nephrology_dashboard/models/calendar_dashboard.py
# -*- coding: utf-8 -*-
from odoo import api, fields, models
from datetime import datetime, timedelta
import calendar as cal_mod


class ACSDialysisStationCalendar(models.Model):
    _inherit = 'acs.dialysis.station'

    def _get_session_color(self, state, alert_level):
        """Retourne la couleur CSS d'une carte séance selon son état et son alerte."""
        if state == 'scheduled':
            return 'blue'
        if alert_level == 'critical':
            return 'red'
        if alert_level == 'warning':
            return 'orange'
        if state == 'running':
            return 'green'
        if state == 'done':
            return 'gray'
        return 'blue'

    @api.model
    def get_calendar_day_data(self, date_str):
        """Stub — retourne structure vide."""
        return {'stations': [], 'occupation_rate': 0, 'total_stations': 0, 'occupied_count': 0}

    @api.model
    def get_calendar_week_data(self, date_str):
        """Stub — retourne structure vide."""
        return {'week_dates': [], 'patients': []}

    @api.model
    def get_calendar_month_data(self, year, month):
        """Stub — retourne structure vide."""
        return {'days': [], 'total_stations': 0, 'month_avg_occupation': 0}
```

- [ ] **Step 1.3 : Créer `views/dialysis_calendar_action.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record model="ir.actions.client" id="action_dialysis_calendar">
        <field name="name">Planning Dialyse</field>
        <field name="tag">acs_dialysis_calendar</field>
    </record>

    <menuitem
        id="menu_dialysis_calendar"
        name="Planning Dialyse"
        parent="acs_hms_nephrology.nephrology_menu_root"
        action="action_dialysis_calendar"
        groups="acs_hms.group_hms_physician,acs_hms.group_hms_receptionist"
        sequence="15"/>
</odoo>
```

- [ ] **Step 1.4 : Ajouter le XML dans `__manifest__.py`**

Modifier la clé `data` pour inclure le nouveau fichier :

```python
'data': [
    'security/ir.model.access.csv',
    'views/nurse_dashboard_action.xml',
    'views/doctor_dashboard_action.xml',
    'views/dialysis_calendar_action.xml',
],
```

- [ ] **Step 1.5 : Vérifier que le module se charge sans erreur**

Dans le conteneur Odoo :
```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python odoo-bin -c /etc/odoo/odoo.conf \
  --test-tags :acs_hms_nephrology_dashboard \
  --stop-after-init 2>&1 | grep -E "ERROR|WARNING|OK|FAIL" | head -20
```

Expected : pas d'erreur `ImportError` ni `XML parse error`.

- [ ] **Step 1.6 : Commit**

```bash
git add acs_hms_nephrology_dashboard/models/__init__.py \
        acs_hms_nephrology_dashboard/models/calendar_dashboard.py \
        acs_hms_nephrology_dashboard/views/dialysis_calendar_action.xml \
        acs_hms_nephrology_dashboard/__manifest__.py
git commit -m "feat(calendar): wire module — stub backend + action XML"
```

---

## Task 2 : TDD — `get_calendar_day_data`

**Files:**
- Create: `tests/test_calendar_dashboard.py`
- Modify: `tests/__init__.py`
- Modify: `models/calendar_dashboard.py` (implémentation réelle)

- [ ] **Step 2.1 : Créer `tests/test_calendar_dashboard.py` avec les tests**

```python
# acs_hms_nephrology_dashboard/tests/test_calendar_dashboard.py
# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase
from odoo import fields
from datetime import datetime, timedelta


class TestCalendarDashboard(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.dept = cls.env['hr.department'].create({
            'name': 'Néphro Cal Test',
            'department_type': 'nephrology',
        })
        cls.station = cls.env['acs.dialysis.station'].create({
            'name': 'Poste Cal 1',
            'station_type': 'standard',
            'active': True,
        })
        cls.schedule = cls.env['acs.nephrology.schedule'].create({
            'name': 'Sched Cal',
            'station_id': cls.station.id,
            'monday': True, 'tuesday': True, 'wednesday': True,
            'thursday': True, 'friday': True, 'saturday': True, 'sunday': True,
        })
        cls.patient = cls.env['hms.patient'].create({'name': 'Patient Cal Test'})
        cls.product = cls.env['product.product'].search([('type', '=', 'service')], limit=1)
        if not cls.product:
            cls.product = cls.env['product.product'].create({
                'name': 'Hémo Cal Test', 'type': 'service',
            })

    def _make_procedure(self, state='scheduled', hours_ago=1, **kwargs):
        now = datetime.utcnow()
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

    # ── get_calendar_day_data ──────────────────────────────────────────────

    def test_day_data_structure(self):
        """Sans procédure : structure valide, poste présent, sessions vide."""
        today = datetime.utcnow().date().isoformat()
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)

        self.assertIn('stations', result)
        self.assertIn('occupation_rate', result)
        self.assertIn('total_stations', result)
        self.assertIn('occupied_count', result)
        self.assertIsInstance(result['stations'], list)

        entry = next((s for s in result['stations'] if s['id'] == self.station.id), None)
        self.assertIsNotNone(entry, "Le poste test doit apparaître")
        self.assertIsInstance(entry['sessions'], list)
        self.assertEqual(len(entry['sessions']), 0)

    def test_day_data_scheduled_color_blue(self):
        """Procédure scheduled → color='blue'."""
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='scheduled')
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)
        entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        self.assertEqual(len(entry['sessions']), 1)
        self.assertEqual(entry['sessions'][0]['color'], 'blue')
        self.assertEqual(entry['sessions'][0]['id'], proc.id)

    def test_day_data_running_no_alert_color_green(self):
        """Procédure running sans alerte → color='green'."""
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='running')
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)
        entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        session = next(s for s in entry['sessions'] if s['id'] == proc.id)
        self.assertEqual(session['color'], 'green')

    def test_day_data_critical_alert_color_red(self):
        """Procédure running avec hypotension → color='red'."""
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='running')
        self.env['hemodialysis.vital.sign'].create({
            'procedure_id': proc.id,
            'blood_pressure': '82/50',
            'is_hypotension': True,
            'measurement_time': fields.Datetime.to_string(datetime.utcnow()),
            'heart_rate': 95,
        })
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)
        entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        session = next(s for s in entry['sessions'] if s['id'] == proc.id)
        self.assertEqual(session['color'], 'red')
        self.assertEqual(session['alert_level'], 'critical')

    def test_day_data_done_no_alert_color_gray(self):
        """Procédure done sans alerte → color='gray'."""
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='done')
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)
        entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        session = next(s for s in entry['sessions'] if s['id'] == proc.id)
        self.assertEqual(session['color'], 'gray')

    def test_day_data_occupation_rate(self):
        """1 poste avec séance + 1 poste sans → occupation_rate = 50% (sur 2 postes)."""
        station2 = self.env['acs.dialysis.station'].create({
            'name': 'Poste Cal 2', 'station_type': 'standard', 'active': True,
        })
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='running')
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)
        # occupation = postes avec au moins 1 séance / total postes actifs
        self.assertEqual(result['occupied_count'], 1)
        expected_rate = round(1 / result['total_stations'] * 100)
        self.assertEqual(result['occupation_rate'], expected_rate)

    def test_day_data_session_fields(self):
        """Les champs id, patient_name, state, date, date_stop sont présents."""
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='scheduled')
        result = self.env['acs.dialysis.station'].get_calendar_day_data(today)
        entry = next(s for s in result['stations'] if s['id'] == self.station.id)
        s = entry['sessions'][0]
        self.assertEqual(s['id'], proc.id)
        self.assertEqual(s['patient_name'], self.patient.name)
        self.assertEqual(s['state'], 'scheduled')
        self.assertIsNotNone(s['date'])
        self.assertIsNotNone(s['date_stop'])

    # ── get_calendar_week_data ─────────────────────────────────────────────

    def test_week_data_structure(self):
        """Retourne 7 dates lundi→dimanche et liste patients."""
        today = datetime.utcnow().date().isoformat()
        result = self.env['acs.dialysis.station'].get_calendar_week_data(today)
        self.assertIn('week_dates', result)
        self.assertIn('patients', result)
        self.assertEqual(len(result['week_dates']), 7)
        # Vérifier que la semaine commence un lundi (weekday=0)
        from datetime import date
        first = date.fromisoformat(result['week_dates'][0])
        self.assertEqual(first.weekday(), 0, "La semaine doit commencer un lundi")

    def test_week_data_patient_present(self):
        """Patient avec séance cette semaine → apparaît dans patients."""
        today = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='scheduled')
        result = self.env['acs.dialysis.station'].get_calendar_week_data(today)
        patient_entry = next(
            (p for p in result['patients'] if p['patient_id'] == self.patient.id), None
        )
        self.assertIsNotNone(patient_entry, "Le patient doit apparaître cette semaine")

    def test_week_data_session_in_correct_day(self):
        """La séance apparaît dans le bon jour (sessions_by_day[today_iso])."""
        today_iso = datetime.utcnow().date().isoformat()
        proc = self._make_procedure(state='scheduled')
        result = self.env['acs.dialysis.station'].get_calendar_week_data(today_iso)
        patient_entry = next(p for p in result['patients'] if p['patient_id'] == self.patient.id)
        session = patient_entry['sessions_by_day'].get(today_iso)
        self.assertIsNotNone(session, f"La séance doit être dans sessions_by_day['{today_iso}']")
        self.assertEqual(session['id'], proc.id)
        self.assertIn('color', session)
        self.assertIn('station_name', session)

    def test_week_data_no_patient_without_session(self):
        """Patient sans séance cette semaine → absent de la liste."""
        today = datetime.utcnow().date().isoformat()
        other_patient = self.env['hms.patient'].create({'name': 'Patient Sans Séance'})
        result = self.env['acs.dialysis.station'].get_calendar_week_data(today)
        ids = [p['patient_id'] for p in result['patients']]
        self.assertNotIn(other_patient.id, ids)

    # ── get_calendar_month_data ────────────────────────────────────────────

    def test_month_data_structure(self):
        """Retourne 28-31 jours et les champs attendus."""
        import calendar as cal_mod
        now = datetime.utcnow()
        result = self.env['acs.dialysis.station'].get_calendar_month_data(now.year, now.month)
        self.assertIn('days', result)
        self.assertIn('total_stations', result)
        self.assertIn('month_avg_occupation', result)
        days_in_month = cal_mod.monthrange(now.year, now.month)[1]
        self.assertEqual(len(result['days']), days_in_month)

    def test_month_data_day_fields(self):
        """Chaque jour a date, session_count, occupation_rate, critical_count, warning_count."""
        now = datetime.utcnow()
        result = self.env['acs.dialysis.station'].get_calendar_month_data(now.year, now.month)
        for day in result['days']:
            self.assertIn('date', day)
            self.assertIn('session_count', day)
            self.assertIn('occupation_rate', day)
            self.assertIn('critical_count', day)
            self.assertIn('warning_count', day)

    def test_month_data_session_counted(self):
        """Procédure du mois → comptée dans le bon jour."""
        now = datetime.utcnow()
        proc = self._make_procedure(state='scheduled')
        today_iso = now.date().isoformat()
        result = self.env['acs.dialysis.station'].get_calendar_month_data(now.year, now.month)
        today_entry = next(d for d in result['days'] if d['date'] == today_iso)
        self.assertGreaterEqual(today_entry['session_count'], 1)
        self.assertGreater(today_entry['occupation_rate'], 0)

    def test_month_data_occupation_rate_capped_at_100(self):
        """Le taux d'occupation ne dépasse pas 100%."""
        now = datetime.utcnow()
        result = self.env['acs.dialysis.station'].get_calendar_month_data(now.year, now.month)
        for day in result['days']:
            self.assertLessEqual(day['occupation_rate'], 100)
            self.assertGreaterEqual(day['occupation_rate'], 0)
```

- [ ] **Step 2.2 : Ajouter l'import dans `tests/__init__.py`**

```python
# -*- coding: utf-8 -*-
from . import test_nurse_dashboard
from . import test_doctor_dashboard
from . import test_calendar_dashboard
```

- [ ] **Step 2.3 : Lancer les tests — vérifier qu'ils ÉCHOUENT**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python odoo-bin -c /etc/odoo/odoo.conf \
  --test-tags :TestCalendarDashboard \
  --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK" | head -20
```

Expected : `FAIL` sur les tests `test_day_data_scheduled_color_blue`, `test_day_data_running_no_alert_color_green`, etc. (les stubs retournent des listes vides).

- [ ] **Step 2.4 : Implémenter `get_calendar_day_data` dans `models/calendar_dashboard.py`**

Remplacer le stub par l'implémentation complète :

```python
# acs_hms_nephrology_dashboard/models/calendar_dashboard.py
# -*- coding: utf-8 -*-
from odoo import api, fields, models
from datetime import datetime, timedelta
import calendar as cal_mod


class ACSDialysisStationCalendar(models.Model):
    _inherit = 'acs.dialysis.station'

    def _get_session_color(self, state, alert_level):
        """Retourne la couleur CSS d'une carte séance selon son état et son alerte."""
        if state == 'scheduled':
            return 'blue'
        if alert_level == 'critical':
            return 'red'
        if alert_level == 'warning':
            return 'orange'
        if state == 'running':
            return 'green'
        if state == 'done':
            return 'gray'
        return 'blue'

    @api.model
    def get_calendar_day_data(self, date_str):
        """Sessions du jour par poste actif avec couleur et alertes calculées."""
        target = datetime.strptime(date_str, '%Y-%m-%d').date()
        day_start = datetime.combine(target, datetime.min.time())
        day_end = datetime.combine(target + timedelta(days=1), datetime.min.time())
        now = fields.Datetime.now()

        Procedure = self.env['acs.patient.procedure']
        stations = self.search([('active', '=', True)], order='name')

        all_procs = Procedure.search([
            ('nephrology_schedule_ids.station_id', 'in', stations.ids),
            ('date', '>=', fields.Datetime.to_string(day_start)),
            ('date', '<', fields.Datetime.to_string(day_end)),
            ('department_id.department_type', '=', 'nephrology'),
        ], order='date asc')

        # Group by station — déduplique si même procédure liée à plusieurs créneaux du même poste
        procs_by_station = {}
        seen_per_station = {}
        for p in all_procs:
            for sched in p.nephrology_schedule_ids:
                sid = sched.station_id.id
                if sid:
                    if p.id not in seen_per_station.get(sid, set()):
                        procs_by_station.setdefault(sid, []).append(p)
                        seen_per_station.setdefault(sid, set()).add(p.id)

        station_list = []
        occupied_count = 0

        for station in stations:
            procs = procs_by_station.get(station.id, [])
            sessions = []
            for proc in procs:
                alert_level, alert_label = self._get_alert(proc, now)
                color = self._get_session_color(proc.state, alert_level)
                station_name = ''
                for sched in proc.nephrology_schedule_ids:
                    if sched.station_id and sched.station_id.id == station.id:
                        station_name = sched.station_id.name
                        break
                sessions.append({
                    'id': proc.id,
                    'patient_id': proc.patient_id.id,
                    'patient_name': proc.patient_id.name,
                    'state': proc.state,
                    'date': fields.Datetime.to_string(proc.date) if proc.date else False,
                    'date_stop': fields.Datetime.to_string(proc.date_stop) if proc.date_stop else False,
                    'color': color,
                    'alert_level': alert_level,
                    'alert_label': alert_label,
                    'ktv_calculated': proc.ktv_calculated,
                    'ktv_status': proc.ktv_status or False,
                })
            if sessions:
                occupied_count += 1
            station_list.append({
                'id': station.id,
                'name': station.name,
                'room': station.room or '',
                'station_type': station.station_type,
                'sessions': sessions,
            })

        total_stations = len(stations)
        occupation_rate = round(occupied_count / total_stations * 100) if total_stations else 0

        return {
            'stations': station_list,
            'occupation_rate': occupation_rate,
            'total_stations': total_stations,
            'occupied_count': occupied_count,
        }

    @api.model
    def get_calendar_week_data(self, date_str):
        """Stub."""
        return {'week_dates': [], 'patients': []}

    @api.model
    def get_calendar_month_data(self, year, month):
        """Stub."""
        return {'days': [], 'total_stations': 0, 'month_avg_occupation': 0}
```

- [ ] **Step 2.5 : Lancer les tests `get_calendar_day_data` — vérifier qu'ils PASSENT**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python odoo-bin -c /etc/odoo/odoo.conf \
  --test-tags :TestCalendarDashboard.test_day_data \
  --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK"
```

Expected : tous les `test_day_data_*` passent à `OK`.

- [ ] **Step 2.6 : Commit**

```bash
git add acs_hms_nephrology_dashboard/models/calendar_dashboard.py \
        acs_hms_nephrology_dashboard/tests/test_calendar_dashboard.py \
        acs_hms_nephrology_dashboard/tests/__init__.py
git commit -m "feat(calendar): implement get_calendar_day_data with TDD"
```

---

## Task 3 : TDD — `get_calendar_week_data`

**Files:**
- Modify: `models/calendar_dashboard.py` (remplacer stub week)

- [ ] **Step 3.1 : Vérifier que les tests week ÉCHOUENT avec le stub actuel**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python odoo-bin -c /etc/odoo/odoo.conf \
  --test-tags :TestCalendarDashboard.test_week_data \
  --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK"
```

Expected : `FAIL` (week_dates vide, structure incorrecte).

- [ ] **Step 3.2 : Remplacer le stub `get_calendar_week_data` dans `models/calendar_dashboard.py`**

Remplacer uniquement la méthode `get_calendar_week_data` (laisser les autres inchangées) :

```python
    @api.model
    def get_calendar_week_data(self, date_str):
        """Sessions de la semaine contenant date_str, groupées par patient puis par jour."""
        target = datetime.strptime(date_str, '%Y-%m-%d').date()
        # Lundi de la semaine
        week_start = target - timedelta(days=target.weekday())
        week_end = week_start + timedelta(days=7)
        week_dates = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]

        day_start = datetime.combine(week_start, datetime.min.time())
        day_end = datetime.combine(week_end, datetime.min.time())
        now = fields.Datetime.now()

        Procedure = self.env['acs.patient.procedure']
        procs = Procedure.search([
            ('date', '>=', fields.Datetime.to_string(day_start)),
            ('date', '<', fields.Datetime.to_string(day_end)),
            ('department_id.department_type', '=', 'nephrology'),
        ], order='date asc')

        patients_map = {}
        for proc in procs:
            pid = proc.patient_id.id
            if pid not in patients_map:
                patients_map[pid] = {
                    'patient_id': pid,
                    'patient_name': proc.patient_id.name,
                    'sessions_by_day': {d: None for d in week_dates},
                }
            if not proc.date:
                continue
            day_key = proc.date.date().isoformat()
            if day_key not in patients_map[pid]['sessions_by_day']:
                continue
            alert_level, alert_label = self._get_alert(proc, now)
            station_name = ''
            for sched in proc.nephrology_schedule_ids:
                if sched.station_id:
                    station_name = sched.station_id.name
                    break
            patients_map[pid]['sessions_by_day'][day_key] = {
                'id': proc.id,
                'state': proc.state,
                'color': self._get_session_color(proc.state, alert_level),
                'alert_label': alert_label,
                'station_name': station_name,
                'date': fields.Datetime.to_string(proc.date),
                'date_stop': fields.Datetime.to_string(proc.date_stop) if proc.date_stop else False,
            }

        patients_list = sorted(patients_map.values(), key=lambda p: p['patient_name'])

        return {
            'week_dates': week_dates,
            'patients': patients_list,
        }
```

- [ ] **Step 3.3 : Lancer les tests week — vérifier qu'ils PASSENT**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python odoo-bin -c /etc/odoo/odoo.conf \
  --test-tags :TestCalendarDashboard.test_week_data \
  --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK"
```

Expected : tous les `test_week_data_*` passent.

- [ ] **Step 3.4 : Commit**

```bash
git add acs_hms_nephrology_dashboard/models/calendar_dashboard.py
git commit -m "feat(calendar): implement get_calendar_week_data with TDD"
```

---

## Task 4 : TDD — `get_calendar_month_data`

**Files:**
- Modify: `models/calendar_dashboard.py` (remplacer stub month)

- [ ] **Step 4.1 : Vérifier que les tests month ÉCHOUENT**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python odoo-bin -c /etc/odoo/odoo.conf \
  --test-tags :TestCalendarDashboard.test_month_data \
  --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK"
```

Expected : `FAIL` (days vide, longueur incorrecte).

- [ ] **Step 4.2 : Remplacer le stub `get_calendar_month_data` dans `models/calendar_dashboard.py`**

```python
    @api.model
    def get_calendar_month_data(self, year, month):
        """Vue synthétique mensuelle : occupation par jour + compteurs alertes."""
        first_day = datetime(year, month, 1)
        days_in_month = cal_mod.monthrange(year, month)[1]
        last_day = datetime(year, month, days_in_month, 23, 59, 59)
        now = fields.Datetime.now()

        Procedure = self.env['acs.patient.procedure']
        procs = Procedure.search([
            ('date', '>=', fields.Datetime.to_string(first_day)),
            ('date', '<=', fields.Datetime.to_string(last_day)),
            ('department_id.department_type', '=', 'nephrology'),
        ])

        total_stations = self.search_count([('active', '=', True)])
        # Base théorique : 2 vacations par poste par jour
        max_per_day = max(total_stations * 2, 1)

        daily = {}
        for proc in procs:
            if not proc.date:
                continue
            day_key = proc.date.date().isoformat()
            if day_key not in daily:
                daily[day_key] = {'session_count': 0, 'critical_count': 0, 'warning_count': 0}
            daily[day_key]['session_count'] += 1
            alert_level, _ = self._get_alert(proc, now)
            if alert_level == 'critical':
                daily[day_key]['critical_count'] += 1
            elif alert_level == 'warning':
                daily[day_key]['warning_count'] += 1

        days_list = []
        occupation_rates = []
        for i in range(days_in_month):
            day = (first_day + timedelta(days=i)).date()
            day_key = day.isoformat()
            stats = daily.get(day_key, {'session_count': 0, 'critical_count': 0, 'warning_count': 0})
            rate = min(round(stats['session_count'] / max_per_day * 100), 100)
            days_list.append({
                'date': day_key,
                'session_count': stats['session_count'],
                'occupation_rate': rate,
                'critical_count': stats['critical_count'],
                'warning_count': stats['warning_count'],
            })
            if stats['session_count'] > 0:
                occupation_rates.append(rate)

        avg = round(sum(occupation_rates) / len(occupation_rates)) if occupation_rates else 0

        return {
            'days': days_list,
            'total_stations': total_stations,
            'month_avg_occupation': avg,
        }
```

- [ ] **Step 4.3 : Lancer tous les tests du module — vérifier que tout PASSE**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python odoo-bin -c /etc/odoo/odoo.conf \
  --test-tags :TestCalendarDashboard \
  --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK"
```

Expected : tous les tests `TestCalendarDashboard` passent.

- [ ] **Step 4.4 : Commit**

```bash
git add acs_hms_nephrology_dashboard/models/calendar_dashboard.py
git commit -m "feat(calendar): implement get_calendar_month_data with TDD"
```

---

## Task 5 : OWL — `CalendarToolbar`

**Files:**
- Create: `static/src/components/dialysis_calendar/CalendarToolbar.js`
- Create: `static/src/components/dialysis_calendar/CalendarToolbar.xml`

- [ ] **Step 5.1 : Créer `CalendarToolbar.js`**

```javascript
/** @odoo-module **/
import { Component } from "@odoo/owl";

export class CalendarToolbar extends Component {
    static template = "acs_hms_nephrology_dashboard.CalendarToolbar";
    static props = {
        mode: String,
        currentDate: { type: Date },
        occupationRate: Number,
        onModeChange: Function,
        onNavigate: Function,
        onToday: Function,
    };

    get dateLabel() {
        const d = this.props.currentDate;
        const locale = "fr-FR";
        if (this.props.mode === "day") {
            return d.toLocaleDateString(locale, {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
            });
        }
        if (this.props.mode === "week") {
            const monday = this._monday(d);
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            const fmt = (dt) =>
                dt.toLocaleDateString(locale, { day: "numeric", month: "long" });
            return `Semaine du ${fmt(monday)} au ${fmt(sunday)} ${sunday.getFullYear()}`;
        }
        return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
    }

    get occBadgeClass() {
        const r = this.props.occupationRate;
        if (r >= 80) return "dc-occ-badge dc-occ-green";
        if (r >= 50) return "dc-occ-badge dc-occ-orange";
        return "dc-occ-badge dc-occ-red";
    }

    _monday(d) {
        const m = new Date(d);
        const day = m.getDay(); // 0=Sun
        m.setDate(m.getDate() + (day === 0 ? -6 : 1 - day));
        return m;
    }
}
```

- [ ] **Step 5.2 : Créer `CalendarToolbar.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<templates xml:space="preserve">
  <t t-name="acs_hms_nephrology_dashboard.CalendarToolbar">
    <div class="dc-toolbar">
      <div class="dc-mode-btns">
        <button t-att-class="'dc-mode-btn ' + (props.mode === 'day' ? 'active' : '')"
                t-on-click="() => props.onModeChange('day')">Jour</button>
        <button t-att-class="'dc-mode-btn ' + (props.mode === 'week' ? 'active' : '')"
                t-on-click="() => props.onModeChange('week')">Semaine</button>
        <button t-att-class="'dc-mode-btn ' + (props.mode === 'month' ? 'active' : '')"
                t-on-click="() => props.onModeChange('month')">Mois</button>
      </div>
      <div class="dc-nav">
        <button class="dc-nav-btn" t-on-click="() => props.onNavigate(-1)">‹</button>
        <span class="dc-date-label" t-esc="dateLabel"/>
        <button class="dc-nav-btn" t-on-click="() => props.onNavigate(1)">›</button>
        <button class="dc-nav-btn dc-today-btn" t-on-click="() => props.onToday()">Aujourd'hui</button>
      </div>
      <t t-if="props.mode !== 'week'">
        <div t-att-class="occBadgeClass">
          ● <t t-esc="props.occupationRate"/>% occupation
        </div>
      </t>
    </div>
  </t>
</templates>
```

- [ ] **Step 5.3 : Commit**

```bash
git add acs_hms_nephrology_dashboard/static/src/components/dialysis_calendar/CalendarToolbar.js \
        acs_hms_nephrology_dashboard/static/src/components/dialysis_calendar/CalendarToolbar.xml
git commit -m "feat(calendar): add CalendarToolbar OWL component"
```

---

## Task 6 : OWL — `CalendarDayView`

**Files:**
- Create: `static/src/components/dialysis_calendar/CalendarDayView.js`
- Create: `static/src/components/dialysis_calendar/CalendarDayView.xml`

- [ ] **Step 6.1 : Créer `CalendarDayView.js`**

```javascript
/** @odoo-module **/
import { Component } from "@odoo/owl";

export class CalendarDayView extends Component {
    static template = "acs_hms_nephrology_dashboard.CalendarDayView";
    static props = {
        stations: Array,
        onSelectSession: Function,
    };

    /** Heures affichées sur l'axe temps : 6h → 19h. */
    get timeSlots() {
        const slots = [];
        for (let h = 6; h <= 19; h++) slots.push(h);
        return slots;
    }

    /** Style CSS positionné pour une carte séance (top + height en px). */
    cardStyle(session) {
        const SLOT_PX = 48;
        const startH = this._startHour(session);
        const durH = this._durationHours(session);
        const top = Math.max(0, (startH - 6) * SLOT_PX);
        const height = Math.max(durH * SLOT_PX - 6, 24);
        return `top:${top}px;height:${height}px;`;
    }

    /** Classe CSS de couleur pour une carte séance. */
    cardClass(session) {
        const map = {
            blue: "dc-card-blue", green: "dc-card-green",
            orange: "dc-card-orange", red: "dc-card-red", gray: "dc-card-gray",
        };
        return "dc-session-card " + (map[session.color] || "dc-card-blue");
    }

    /** Label du badge d'état/alerte affiché sur la carte. */
    badgeLabel(session) {
        if (session.alert_label) return session.alert_label;
        const map = { scheduled: "🔵 Planifiée", running: "🟢 En cours", done: "✓ Terminée" };
        return map[session.state] || session.state;
    }

    /** Formate "YYYY-MM-DD HH:MM:SS" en "HHhMM". */
    fmtTime(dateStr) {
        if (!dateStr) return "—";
        const d = new Date(dateStr.replace(" ", "T") + "Z");
        return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
    }

    _startHour(session) {
        if (!session.date) return 6;
        const d = new Date(session.date.replace(" ", "T") + "Z");
        return d.getHours() + d.getMinutes() / 60;
    }

    _durationHours(session) {
        if (!session.date || !session.date_stop) return 4;
        const start = new Date(session.date.replace(" ", "T") + "Z");
        const stop = new Date(session.date_stop.replace(" ", "T") + "Z");
        return Math.max(0.5, (stop - start) / 3600000);
    }
}
```

- [ ] **Step 6.2 : Créer `CalendarDayView.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<templates xml:space="preserve">
  <t t-name="acs_hms_nephrology_dashboard.CalendarDayView">
    <div class="dc-day-outer">
      <div class="dc-day-grid">
        <!-- Axe temps -->
        <div class="dc-time-axis">
          <div class="dc-time-header"/>
          <t t-foreach="timeSlots" t-as="h" t-key="h">
            <div class="dc-time-slot"><t t-esc="h"/>h</div>
          </t>
        </div>
        <!-- Colonnes postes -->
        <div class="dc-stations-area">
          <t t-foreach="props.stations" t-as="station" t-key="station.id">
            <div class="dc-station-col">
              <div t-att-class="'dc-station-header ' + (station.station_type === 'isolation' ? 'dc-header-isolation' : '')">
                <t t-if="station.station_type === 'isolation'">⚠ </t>
                <span t-esc="station.name"/>
                <t t-if="station.room">
                  <br/><small t-esc="station.room"/>
                </t>
              </div>
              <div class="dc-station-body">
                <t t-if="station.sessions.length === 0">
                  <div class="dc-station-libre">Libre</div>
                </t>
                <t t-foreach="station.sessions" t-as="session" t-key="session.id">
                  <div t-att-class="cardClass(session)"
                       t-att-style="cardStyle(session)"
                       t-on-click="() => props.onSelectSession(session.id)">
                    <div class="dc-card-name" t-esc="session.patient_name"/>
                    <div class="dc-card-time">
                      <t t-esc="fmtTime(session.date)"/> – <t t-esc="fmtTime(session.date_stop)"/>
                    </div>
                    <div class="dc-card-badge" t-esc="badgeLabel(session)"/>
                    <t t-if="session.state === 'done' and session.ktv_calculated">
                      <div class="dc-card-ktv">KT/V : <t t-esc="session.ktv_calculated.toFixed(2)"/></div>
                    </t>
                  </div>
                </t>
              </div>
            </div>
          </t>
        </div>
      </div>
      <!-- Légende -->
      <div class="dc-legend">
        <span class="dc-legend-item"><span class="dc-legend-dot dc-dot-blue"/>Planifiée</span>
        <span class="dc-legend-item"><span class="dc-legend-dot dc-dot-green"/>En cours</span>
        <span class="dc-legend-item"><span class="dc-legend-dot dc-dot-orange"/>Attention</span>
        <span class="dc-legend-item"><span class="dc-legend-dot dc-dot-red"/>Critique</span>
        <span class="dc-legend-item"><span class="dc-legend-dot dc-dot-gray"/>Terminée</span>
      </div>
    </div>
  </t>
</templates>
```

- [ ] **Step 6.3 : Commit**

```bash
git add acs_hms_nephrology_dashboard/static/src/components/dialysis_calendar/CalendarDayView.js \
        acs_hms_nephrology_dashboard/static/src/components/dialysis_calendar/CalendarDayView.xml
git commit -m "feat(calendar): add CalendarDayView OWL component"
```

---

## Task 7 : OWL — `CalendarWeekView`

**Files:**
- Create: `static/src/components/dialysis_calendar/CalendarWeekView.js`
- Create: `static/src/components/dialysis_calendar/CalendarWeekView.xml`

- [ ] **Step 7.1 : Créer `CalendarWeekView.js`**

```javascript
/** @odoo-module **/
import { Component } from "@odoo/owl";

export class CalendarWeekView extends Component {
    static template = "acs_hms_nephrology_dashboard.CalendarWeekView";
    static props = {
        patients: Array,
        weekDates: Array,
        onSelectSession: Function,
    };

    /** Formate "2026-06-02" → "Lun 2". */
    dayHeader(dateStr) {
        const d = new Date(dateStr + "T00:00:00");
        return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
    }

    /** Classe CSS du chip selon la couleur de la session. */
    chipClass(session) {
        const map = {
            blue: "dc-chip-blue", green: "dc-chip-green",
            orange: "dc-chip-orange", red: "dc-chip-red", gray: "dc-chip-gray",
        };
        return "dc-week-chip " + (map[session.color] || "dc-chip-blue");
    }

    /** Texte affiché dans le chip. */
    chipLabel(session) {
        if (session.alert_label) return `${session.station_name} · ${session.alert_label}`;
        if (session.state === "done") return `${session.station_name} · ✓`;
        if (session.state === "running") return `${session.station_name} · En cours`;
        // scheduled: affiche heure
        const h = this._fmtTime(session.date);
        return `${session.station_name} · ${h}`;
    }

    _fmtTime(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr.replace(" ", "T") + "Z");
        return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
    }
}
```

- [ ] **Step 7.2 : Créer `CalendarWeekView.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<templates xml:space="preserve">
  <t t-name="acs_hms_nephrology_dashboard.CalendarWeekView">
    <div class="dc-week-wrap">
      <table class="dc-week-table">
        <thead>
          <tr>
            <th class="dc-week-patient-col">Patient</th>
            <t t-foreach="props.weekDates" t-as="d" t-key="d">
              <th t-esc="dayHeader(d)"/>
            </t>
          </tr>
        </thead>
        <tbody>
          <t t-foreach="props.patients" t-as="patient" t-key="patient.patient_id">
            <tr>
              <td class="dc-week-patient-name" t-esc="patient.patient_name"/>
              <t t-foreach="props.weekDates" t-as="d" t-key="d">
                <td class="dc-week-cell">
                  <t t-set="session" t-value="patient.sessions_by_day[d]"/>
                  <t t-if="session">
                    <span t-att-class="chipClass(session)"
                          t-on-click="() => props.onSelectSession(session.id)"
                          t-esc="chipLabel(session)"/>
                  </t>
                  <t t-else="">
                    <span class="dc-week-empty">—</span>
                  </t>
                </td>
              </t>
            </tr>
          </t>
          <t t-if="props.patients.length === 0">
            <tr>
              <td t-att-colspan="props.weekDates.length + 1" class="dc-week-empty-msg">
                Aucun patient cette semaine
              </td>
            </tr>
          </t>
        </tbody>
      </table>
    </div>
  </t>
</templates>
```

- [ ] **Step 7.3 : Commit**

```bash
git add acs_hms_nephrology_dashboard/static/src/components/dialysis_calendar/CalendarWeekView.js \
        acs_hms_nephrology_dashboard/static/src/components/dialysis_calendar/CalendarWeekView.xml
git commit -m "feat(calendar): add CalendarWeekView OWL component"
```

---

## Task 8 : OWL — `CalendarMonthView`

**Files:**
- Create: `static/src/components/dialysis_calendar/CalendarMonthView.js`
- Create: `static/src/components/dialysis_calendar/CalendarMonthView.xml`

- [ ] **Step 8.1 : Créer `CalendarMonthView.js`**

```javascript
/** @odoo-module **/
import { Component } from "@odoo/owl";

export class CalendarMonthView extends Component {
    static template = "acs_hms_nephrology_dashboard.CalendarMonthView";
    static props = {
        monthData: Object,
        currentDate: { type: Date },
        onSelectDay: Function,
    };

    /**
     * Retourne un tableau de 42 cellules (6 semaines × 7 jours) pour la grille du mois.
     * Chaque cellule : { date: "YYYY-MM-DD", otherMonth: Boolean }
     */
    get calendarGrid() {
        const d = this.props.currentDate;
        const year = d.getFullYear();
        const month = d.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        // Lundi=0 … Dimanche=6
        const firstDow = (firstDay.getDay() + 6) % 7;

        const cells = [];
        for (let i = 0; i < firstDow; i++) {
            const prev = new Date(firstDay);
            prev.setDate(prev.getDate() - (firstDow - i));
            cells.push({ date: prev.toISOString().slice(0, 10), otherMonth: true });
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const dt = new Date(year, month, i);
            cells.push({ date: dt.toISOString().slice(0, 10), otherMonth: false });
        }
        const remaining = 42 - cells.length;
        for (let i = 1; i <= remaining; i++) {
            const next = new Date(lastDay);
            next.setDate(next.getDate() + i);
            cells.push({ date: next.toISOString().slice(0, 10), otherMonth: true });
        }
        return cells;
    }

    /** Retourne les stats du jour depuis monthData.days, ou des zéros si absent. */
    dayStats(dateStr) {
        const days = this.props.monthData?.days || [];
        return days.find(d => d.date === dateStr) || {
            session_count: 0, occupation_rate: 0, critical_count: 0, warning_count: 0,
        };
    }

    isToday(dateStr) {
        return dateStr === new Date().toISOString().slice(0, 10);
    }

    barClass(rate) {
        if (rate >= 80) return "dc-bar-green";
        if (rate >= 50) return "dc-bar-orange";
        return "dc-bar-red";
    }

    dayNum(dateStr) {
        return parseInt(dateStr.split("-")[2], 10);
    }
}
```

- [ ] **Step 8.2 : Créer `CalendarMonthView.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<templates xml:space="preserve">
  <t t-name="acs_hms_nephrology_dashboard.CalendarMonthView">
    <div class="dc-month-wrap">
      <div class="dc-month-header-row">
        <div class="dc-month-day-name">Lun</div><div class="dc-month-day-name">Mar</div>
        <div class="dc-month-day-name">Mer</div><div class="dc-month-day-name">Jeu</div>
        <div class="dc-month-day-name">Ven</div><div class="dc-month-day-name">Sam</div>
        <div class="dc-month-day-name">Dim</div>
      </div>
      <div class="dc-month-grid">
        <t t-foreach="calendarGrid" t-as="cell" t-key="cell.date">
          <t t-set="stats" t-value="dayStats(cell.date)"/>
          <div t-att-class="'dc-month-cell ' + (cell.otherMonth ? 'dc-other-month' : '') + (isToday(cell.date) ? ' dc-today' : '')"
               t-on-click="() => !cell.otherMonth and props.onSelectDay(cell.date)">
            <div t-att-class="'dc-day-num ' + (isToday(cell.date) ? 'dc-day-today' : '')"
                 t-esc="dayNum(cell.date)"/>
            <t t-if="!cell.otherMonth and stats.session_count > 0">
              <div class="dc-occ-bar-wrap">
                <div t-att-class="'dc-occ-bar ' + barClass(stats.occupation_rate)"
                     t-att-style="'width:' + stats.occupation_rate + '%'"/>
              </div>
              <div class="dc-occ-text">
                <t t-esc="stats.session_count"/> séances · <t t-esc="stats.occupation_rate"/>%
              </div>
              <t t-if="stats.critical_count > 0">
                <div class="dc-alert-row">🔴 <t t-esc="stats.critical_count"/> critique(s)</div>
              </t>
            </t>
          </div>
        </t>
      </div>
      <div class="dc-month-legend">
        <span>Taux occupation :</span>
        <span class="dc-legend-item"><span class="dc-legend-dot dc-dot-green"/>≥ 80% Optimal</span>
        <span class="dc-legend-item"><span class="dc-legend-dot dc-dot-orange"/>50–79% Correct</span>
        <span class="dc-legend-item"><span class="dc-legend-dot dc-dot-red"/>&#60; 50% Faible</span>
        <span class="dc-month-legend-tip">Clic sur un jour → Mode Jour</span>
      </div>
    </div>
  </t>
</templates>
```

- [ ] **Step 8.3 : Commit**

```bash
git add acs_hms_nephrology_dashboard/static/src/components/dialysis_calendar/CalendarMonthView.js \
        acs_hms_nephrology_dashboard/static/src/components/dialysis_calendar/CalendarMonthView.xml
git commit -m "feat(calendar): add CalendarMonthView OWL component"
```

---

## Task 9 : OWL — `DialysisCalendar` racine + CSS

**Files:**
- Create: `static/src/components/dialysis_calendar/DialysisCalendar.js`
- Create: `static/src/components/dialysis_calendar/DialysisCalendar.xml`
- Create: `static/src/components/dialysis_calendar/dialysis_calendar.css`

- [ ] **Step 9.1 : Créer `DialysisCalendar.js`**

```javascript
/** @odoo-module **/
import { Component, useState, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { CalendarToolbar } from "./CalendarToolbar";
import { CalendarDayView } from "./CalendarDayView";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarMonthView } from "./CalendarMonthView";
import { DoctorPatientPanel } from "../doctor_dashboard/DoctorPatientPanel";

export class DialysisCalendar extends Component {
    static template = "acs_hms_nephrology_dashboard.DialysisCalendar";
    static components = {
        CalendarToolbar, CalendarDayView, CalendarWeekView, CalendarMonthView, DoctorPatientPanel,
    };

    setup() {
        this.orm = useService("orm");
        this.state = useState({
            mode: "day",
            currentDate: new Date(),
            stations: [],       // Mode Jour : [{id, name, sessions:[...]}, ...]
            weekData: null,     // Mode Semaine : {week_dates, patients}
            monthData: null,    // Mode Mois : {days, total_stations, month_avg_occupation}
            showPanel: false,
            panelData: null,
            occupationRate: 0,
            loading: false,
        });

        useEffect(() => {
            this._fetchData();
        }, () => [this.state.mode, this._dateStr()]);
    }

    /** Date ISO "YYYY-MM-DD" du jour courant. */
    _dateStr() {
        return this.state.currentDate.toISOString().slice(0, 10);
    }

    async _fetchData() {
        this.state.loading = true;
        try {
            const { mode } = this.state;
            if (mode === "day") {
                const data = await this.orm.call(
                    "acs.dialysis.station", "get_calendar_day_data", [this._dateStr()]
                );
                this.state.stations = data.stations;
                this.state.occupationRate = data.occupation_rate;
            } else if (mode === "week") {
                const data = await this.orm.call(
                    "acs.dialysis.station", "get_calendar_week_data", [this._dateStr()]
                );
                this.state.weekData = data;
                this.state.occupationRate = 0;
            } else {
                const d = this.state.currentDate;
                const data = await this.orm.call(
                    "acs.dialysis.station", "get_calendar_month_data",
                    [d.getFullYear(), d.getMonth() + 1]
                );
                this.state.monthData = data;
                this.state.occupationRate = data.month_avg_occupation;
            }
        } finally {
            this.state.loading = false;
        }
    }

    onModeChange(mode) {
        this.state.mode = mode;
    }

    onNavigate(dir) {
        const d = new Date(this.state.currentDate);
        if (this.state.mode === "day") d.setDate(d.getDate() + dir);
        else if (this.state.mode === "week") d.setDate(d.getDate() + dir * 7);
        else d.setMonth(d.getMonth() + dir);
        this.state.currentDate = d;
    }

    onToday() {
        this.state.currentDate = new Date();
    }

    async onSelectSession(procedureId) {
        const data = await this.orm.call(
            "acs.dialysis.station", "get_patient_panel_data", [procedureId]
        );
        this.state.panelData = data;
        this.state.showPanel = true;
    }

    onClosePanel() {
        this.state.showPanel = false;
        this.state.panelData = null;
    }

    onSelectDay(dateStr) {
        this.state.currentDate = new Date(dateStr + "T00:00:00");
        this.state.mode = "day";
    }
}

registry.category("actions").add("acs_dialysis_calendar", DialysisCalendar);
```

- [ ] **Step 9.2 : Créer `DialysisCalendar.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<templates xml:space="preserve">
  <t t-name="acs_hms_nephrology_dashboard.DialysisCalendar">
    <div class="dc-wrap">
      <CalendarToolbar
        mode="state.mode"
        currentDate="state.currentDate"
        occupationRate="state.occupationRate"
        onModeChange.bind="onModeChange"
        onNavigate.bind="onNavigate"
        onToday.bind="onToday"
      />
      <div class="dc-content">
        <t t-if="state.loading">
          <div class="dc-loading">Chargement…</div>
        </t>
        <t t-elif="state.mode === 'day'">
          <CalendarDayView
            stations="state.stations"
            onSelectSession.bind="onSelectSession"
          />
        </t>
        <t t-elif="state.mode === 'week' and state.weekData">
          <CalendarWeekView
            patients="state.weekData.patients"
            weekDates="state.weekData.week_dates"
            onSelectSession.bind="onSelectSession"
          />
        </t>
        <t t-elif="state.mode === 'month' and state.monthData">
          <CalendarMonthView
            monthData="state.monthData"
            currentDate="state.currentDate"
            onSelectDay.bind="onSelectDay"
          />
        </t>
      </div>
      <t t-if="state.showPanel and state.panelData">
        <DoctorPatientPanel panelData="state.panelData" onClose.bind="onClosePanel"/>
      </t>
    </div>
  </t>
</templates>
```

- [ ] **Step 9.3 : Créer `dialysis_calendar.css`**

```css
/* acs_hms_nephrology_dashboard/static/src/components/dialysis_calendar/dialysis_calendar.css */

/* ── Wrapper ── */
.dc-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f8f9fa;
    position: relative;
}

/* ── Toolbar ── */
.dc-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: #fff;
    border-bottom: 1px solid #dee2e6;
    flex-wrap: wrap;
    font-size: 13px;
    flex-shrink: 0;
}
.dc-mode-btns { display: flex; gap: 4px; }
.dc-mode-btn {
    padding: 5px 14px;
    border-radius: 4px;
    border: 1px solid #dee2e6;
    background: #fff;
    cursor: pointer;
    font-size: 12px;
}
.dc-mode-btn.active { background: #0d6efd; color: #fff; border-color: #0d6efd; }
.dc-nav { display: flex; align-items: center; gap: 6px; }
.dc-nav-btn {
    padding: 4px 10px;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
}
.dc-today-btn { font-size: 11px; }
.dc-date-label { font-weight: 600; min-width: 200px; text-align: center; }
.dc-occ-badge {
    margin-left: auto;
    border-radius: 12px;
    padding: 3px 12px;
    font-size: 11px;
    font-weight: 600;
}
.dc-occ-green { background: #d1e7dd; color: #0a3622; }
.dc-occ-orange { background: #fff3cd; color: #664d03; }
.dc-occ-red { background: #f8d7da; color: #58151c; }

/* ── Content zone ── */
.dc-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.dc-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: #888;
    font-size: 14px;
}

/* ── Day view ── */
.dc-day-outer { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.dc-day-grid {
    display: flex;
    flex: 1;
    overflow: auto;
}
.dc-time-axis {
    min-width: 44px;
    background: #fff;
    border-right: 1px solid #dee2e6;
    flex-shrink: 0;
}
.dc-time-header { height: 36px; border-bottom: 1px solid #dee2e6; }
.dc-time-slot {
    height: 48px;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding-right: 6px;
    padding-top: 2px;
    color: #888;
    font-size: 10px;
    border-bottom: 1px solid #f0f0f0;
    box-sizing: border-box;
}
.dc-stations-area { display: flex; flex: 1; }
.dc-station-col { min-width: 130px; border-right: 1px solid #dee2e6; flex-shrink: 0; }
.dc-station-header {
    height: 36px;
    padding: 0 8px;
    background: #e9ecef;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 11px;
    border-bottom: 1px solid #dee2e6;
    text-align: center;
    box-sizing: border-box;
}
.dc-header-isolation { background: #fff3cd; }
.dc-station-body {
    position: relative;
    height: 672px; /* 14h × 48px */
    background: repeating-linear-gradient(
        to bottom, transparent, transparent 47px, #f0f0f0 47px, #f0f0f0 48px
    );
}
.dc-station-libre {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #ccc;
    font-size: 11px;
}
.dc-session-card {
    position: absolute;
    left: 4px;
    right: 4px;
    border-radius: 5px;
    padding: 5px 7px;
    font-size: 10px;
    overflow: hidden;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    transition: opacity 0.15s;
    box-sizing: border-box;
}
.dc-session-card:hover { opacity: 0.85; }
.dc-card-name { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dc-card-time { font-size: 9px; margin-top: 2px; opacity: 0.7; }
.dc-card-badge { font-size: 9px; margin-top: 3px; font-weight: 600; }
.dc-card-ktv { font-size: 9px; margin-top: 2px; }
.dc-card-blue   { background: #cfe2ff; border-left: 3px solid #0d6efd; color: #073fba; }
.dc-card-green  { background: #d1e7dd; border-left: 3px solid #198754; color: #0a3622; }
.dc-card-orange { background: #fff3cd; border-left: 3px solid #ffc107; color: #664d03; }
.dc-card-red    { background: #f8d7da; border-left: 3px solid #dc3545; color: #58151c; }
.dc-card-gray   { background: #e9ecef; border-left: 3px solid #6c757d; color: #343a40; }

/* ── Legend ── */
.dc-legend {
    display: flex;
    gap: 12px;
    padding: 8px 16px;
    background: #fff;
    border-top: 1px solid #dee2e6;
    flex-wrap: wrap;
    font-size: 11px;
    flex-shrink: 0;
}
.dc-legend-item { display: flex; align-items: center; gap: 5px; }
.dc-legend-dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.dc-dot-blue   { background: #0d6efd; }
.dc-dot-green  { background: #198754; }
.dc-dot-orange { background: #ffc107; }
.dc-dot-red    { background: #dc3545; }
.dc-dot-gray   { background: #6c757d; }

/* ── Week view ── */
.dc-week-wrap { flex: 1; overflow: auto; background: #fff; }
.dc-week-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.dc-week-table th {
    padding: 7px 6px;
    background: #e9ecef;
    border: 1px solid #dee2e6;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 1;
}
.dc-week-patient-col { text-align: left !important; min-width: 140px; }
.dc-week-table td {
    padding: 4px 5px;
    border: 1px solid #f0f0f0;
    vertical-align: middle;
    text-align: center;
    height: 38px;
}
.dc-week-patient-name {
    text-align: left !important;
    font-weight: 600;
    color: #333;
    padding-left: 10px !important;
    background: #fafafa;
    position: sticky;
    left: 0;
    z-index: 1;
    border-right: 1px solid #dee2e6 !important;
}
.dc-week-chip {
    display: inline-block;
    padding: 3px 7px;
    border-radius: 4px;
    font-size: 10px;
    cursor: pointer;
    white-space: nowrap;
    font-weight: 500;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    border-left: 2px solid transparent;
}
.dc-chip-blue   { background: #cfe2ff; color: #073fba; border-left-color: #0d6efd; }
.dc-chip-green  { background: #d1e7dd; color: #0a3622; border-left-color: #198754; }
.dc-chip-orange { background: #fff3cd; color: #664d03; border-left-color: #ffc107; }
.dc-chip-red    { background: #f8d7da; color: #58151c; border-left-color: #dc3545; }
.dc-chip-gray   { background: #e9ecef; color: #343a40; border-left-color: #6c757d; }
.dc-week-empty { color: #ccc; font-size: 10px; }
.dc-week-cell { min-width: 90px; }
.dc-week-empty-msg { text-align: center; color: #888; padding: 20px; }

/* ── Month view ── */
.dc-month-wrap { flex: 1; overflow: auto; padding: 12px 16px; background: #fff; }
.dc-month-header-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    margin-bottom: 6px;
}
.dc-month-day-name {
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    padding: 4px 0;
}
.dc-month-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
}
.dc-month-cell {
    border: 1px solid #dee2e6;
    border-radius: 5px;
    min-height: 70px;
    padding: 5px;
    cursor: pointer;
    transition: box-shadow 0.15s;
    box-sizing: border-box;
}
.dc-month-cell:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.dc-other-month { opacity: 0.35; cursor: default; }
.dc-today { border-color: #0d6efd !important; background: #f0f5ff; }
.dc-day-num { font-size: 12px; font-weight: 600; color: #333; margin-bottom: 4px; }
.dc-day-today { color: #0d6efd !important; }
.dc-occ-bar-wrap {
    height: 6px;
    background: #e9ecef;
    border-radius: 3px;
    margin-bottom: 4px;
    overflow: hidden;
}
.dc-occ-bar { height: 100%; border-radius: 3px; }
.dc-bar-green  { background: #198754; }
.dc-bar-orange { background: #ffc107; }
.dc-bar-red    { background: #dc3545; }
.dc-occ-text { font-size: 10px; color: #555; }
.dc-alert-row { margin-top: 4px; font-size: 10px; }
.dc-month-legend {
    margin-top: 12px;
    display: flex;
    gap: 16px;
    font-size: 11px;
    color: #666;
    flex-wrap: wrap;
    align-items: center;
}
.dc-month-legend-tip { margin-left: auto; font-style: italic; }
```

- [ ] **Step 9.4 : Lancer tous les tests backend pour vérifier aucune régression**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python odoo-bin -c /etc/odoo/odoo.conf \
  --test-tags :acs_hms_nephrology_dashboard \
  --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK"
```

Expected : 0 FAIL, 0 ERROR.

- [ ] **Step 9.5 : Commit final**

```bash
git add acs_hms_nephrology_dashboard/static/src/components/dialysis_calendar/DialysisCalendar.js \
        acs_hms_nephrology_dashboard/static/src/components/dialysis_calendar/DialysisCalendar.xml \
        acs_hms_nephrology_dashboard/static/src/components/dialysis_calendar/dialysis_calendar.css
git commit -m "feat(calendar): add DialysisCalendar root component + CSS — section 4.3 complete"
```

---

## Vérification manuelle finale

Après déploiement (redémarrage du service Odoo dans Docker) :

1. Se connecter à l'interface Odoo → menu Néphro → **Planning Dialyse** doit apparaître
2. Mode Jour : colonnes postes visibles, cartes colorées si séances existent
3. Clic sur une carte → slide panel `DoctorPatientPanel` s'ouvre avec les infos patient
4. Mode Semaine : tableau patient × jours avec chips
5. Mode Mois : grille calendrier avec barres d'occupation
6. Clic sur un jour (Mode Mois) → bascule en Mode Jour pour ce jour
7. Navigation ‹ › fonctionne dans les 3 modes
8. "Aujourd'hui" ramène à la date du jour
