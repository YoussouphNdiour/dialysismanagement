# Vue Calendrier Visuel des Postes — Design

**Date :** 2026-06-02
**Sprint :** 2 — Section 4.3
**Module :** `acs_hms_nephrology_dashboard`
**Spec parent :** `docs/superpowers/specs/2026-05-31-dialyse-nephro-platform-design.md` § 4.3
**Stack :** Odoo 19, OWL (Odoo Web Library)

---

## 1. Contexte et objectifs

La vue calendrier est un outil de **planification visuelle** des séances de dialyse, distinct du dashboard médecin temps réel (section 6). Elle répond à la question "qui vient quand et où ?" plutôt que "que se passe-t-il maintenant ?".

**Utilisateurs :** Médecin néphrologue et Secrétaire — même vue, mêmes droits.

**Contrainte sprint :** Pas de drag & drop (réservé Sprint 3).

---

## 2. Architecture des composants

### Nouvelle page dédiée

La vue calendrier est une **page Odoo indépendante** (action client), accessible depuis le menu Néphro. Elle ne s'intègre pas dans le DoctorDashboard existant : les deux répondent à des besoins distincts (temps réel vs planification).

### Arborescence des fichiers

```
acs_hms_nephrology_dashboard/
├── static/src/components/dialysis_calendar/
│   ├── DialysisCalendar.js         ← composant racine, état + fetch
│   ├── DialysisCalendar.xml
│   ├── CalendarToolbar.js          ← sélecteur mode + navigation dates
│   ├── CalendarToolbar.xml
│   ├── CalendarDayView.js          ← colonnes postes + axe temps
│   ├── CalendarDayView.xml
│   ├── CalendarWeekView.js         ← lignes patients × colonnes jours
│   ├── CalendarWeekView.xml
│   ├── CalendarMonthView.js        ← grille jours + taux occupation
│   ├── CalendarMonthView.xml
│   └── dialysis_calendar.css
├── models/
│   └── calendar_dashboard.py       ← 3 méthodes RPC (_inherit acs.dialysis.station)
└── views/
    └── dialysis_calendar_action.xml ← action client + entrée de menu
```

**Nouveaux fichiers : 13** (10 OWL + 1 CSS + 1 Python + 1 XML)

### Flux de données

L'état est **centralisé dans `DialysisCalendar`** (composant racine) et passé en props aux vues filles :

```
DialysisCalendar (état : mode, currentDate, stations, weekData, monthData, showPanel, panelData)
├── CalendarToolbar       props : mode, currentDate, occupationRate, onModeChange, onNavigate, onToday
├── CalendarDayView       props : stations, onSelectSession          ← sessions imbriquées dans stations[]
├── CalendarWeekView      props : patients, weekDates, onSelectSession
├── CalendarMonthView     props : monthData, currentDate, onSelectDay
└── DoctorPatientPanel    props : panelData, onClose                 ← RÉUTILISÉ tel quel
```

**`DoctorPatientPanel` est réutilisé sans modification** — même composant, même RPC `get_patient_panel_data(procedure_id)` déjà existant dans `doctor_dashboard.py`.

---

## 3. Backend Python — `calendar_dashboard.py`

Classe : `_inherit = 'acs.dialysis.station'` (même pattern que `doctor_dashboard.py`).

### 3.1 Helper partagé `_get_session_color(state, alert_level)`

```
state=scheduled                          → 'blue'
state=running, alert_level=None          → 'green'
state=running, alert_level='warning'     → 'orange'
state=running, alert_level='critical'    → 'red'
state=done,    alert_level='critical'    → 'red'
state=done,    alert_level='warning'     → 'orange'
state=done,    alert_level=None          → 'gray'
```

La logique `_get_alert(proc, now)` est réutilisée depuis `doctor_dashboard.py`.

### 3.2 `get_calendar_day_data(date_str)`

**Input :** `date_str` — string ISO "YYYY-MM-DD"

**Logique :**
1. Cherche toutes les `acs.patient.procedure` néphro dont la date tombe dans `[day_start, day_end[`
2. Groupe par `station_id` via `nephrology_schedule_ids`
3. Pour chaque poste actif, retourne 0 à N séances (une station peut avoir plusieurs vacations)

**Output :**
```json
{
  "stations": [
    {
      "id": 1, "name": "Poste 1 - Salle A", "room": "Salle A",
      "station_type": "standard",
      "sessions": [
        {
          "id": 42, "patient_id": 5, "patient_name": "Aminata Diallo",
          "state": "running",
          "date": "2026-06-02 07:00:00", "date_stop": "2026-06-02 11:00:00",
          "color": "green",
          "alert_level": null, "alert_label": null,
          "ktv_calculated": 0.0, "ktv_status": false
        }
      ]
    }
  ],
  "occupation_rate": 85,
  "total_stations": 20,
  "occupied_count": 17
}
```

### 3.3 `get_calendar_week_data(date_str)`

**Input :** `date_str` — n'importe quel jour de la semaine cible

**Logique :**
1. Calcule `week_start` (lundi) et `week_end` (dimanche) à partir de `date_str`
2. Cherche toutes les procédures néphro de la semaine
3. Groupe par `patient_id`, puis par date ISO dans `sessions_by_day`
4. Retourne uniquement les patients ayant au moins une séance cette semaine

**Output :**
```json
{
  "week_dates": ["2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08"],
  "patients": [
    {
      "patient_id": 5, "patient_name": "Aminata Diallo",
      "sessions_by_day": {
        "2026-06-02": {"id": 42, "state": "running", "color": "green", "station_name": "Poste 1", "date": "...", "date_stop": "..."},
        "2026-06-04": {"id": 44, "state": "scheduled", "color": "blue", "station_name": "Poste 1", "date": "...", "date_stop": "..."},
        "2026-06-06": null
      }
    }
  ]
}
```

### 3.4 `get_calendar_month_data(year, month)`

**Input :** `year` (int), `month` (int 1-12)

**Logique :**
1. Cherche toutes les procédures néphro du mois
2. Pour chaque jour : compte les séances, calcule `occupation_rate = (nb_sessions / (nb_stations_actifs × 2)) × 100`
3. Comptabilise `critical_count` et `warning_count` par jour via `_get_alert`

**Output :**
```json
{
  "days": [
    {
      "date": "2026-06-01",
      "session_count": 45,
      "occupation_rate": 90,
      "critical_count": 0,
      "warning_count": 2
    }
  ],
  "total_stations": 25,
  "month_avg_occupation": 84
}
```

---

## 4. Composants OWL

### 4.1 `DialysisCalendar` (racine)

**État :**
```javascript
state = useState({
    mode: 'day',          // 'day' | 'week' | 'month'
    currentDate: new Date(),
    stations: [],         // Mode Jour : [{id, name, sessions: [...]}, ...] (get_calendar_day_data)
    weekData: null,       // Mode Semaine : {week_dates, patients} (get_calendar_week_data)
    monthData: null,      // Mode Mois : {days, total_stations, month_avg_occupation} (get_calendar_month_data)
    showPanel: false,
    panelData: null,
    occupationRate: 0,
    loading: false,
})
```

**Comportement :**
- Au montage : appelle le fetch correspondant au mode actif
- Changement de mode → nouveau fetch
- Navigation date (‹ ›) → avance/recule d'1 jour / semaine / mois selon le mode
- "Aujourd'hui" → remet `currentDate` à `new Date()` + refetch
- Pas de polling automatique (contrairement au DoctorDashboard — le calendrier est du planning, pas du temps réel)
- `onSelectSession(procedureId)` → appelle `get_patient_panel_data` → ouvre `DoctorPatientPanel`
- `onSelectDay(dateStr)` (Mode Mois) → bascule `mode='day'` avec `currentDate = dateStr`

### 4.2 `CalendarToolbar`

**Props :** `mode`, `currentDate`, `occupationRate`, `onModeChange`, `onNavigate`, `onToday`

**Rendu :**
- 3 boutons mode (Jour / Semaine / Mois) avec classe `active` sur le mode courant
- Boutons ‹ › + "Aujourd'hui"
- Label date adapté : "Lundi 2 juin 2026" / "Semaine du 2 au 8 juin" / "Juin 2026"
- Badge taux occupation (vert si ≥80%, orange si 50-79%, rouge si <50%) — affiché en modes Jour et Mois

### 4.3 `CalendarDayView`

**Props :** `stations`, `onSelectSession`
(Les sessions sont imbriquées dans `station.sessions` — pas de prop `sessions` séparée.)

**Rendu :**
- Axe temps vertical : 6h → 20h, 1 ligne = 1h = 48px
- 1 colonne par poste actif, header avec nom + salle
- Poste type `isolation` : header fond jaune + pictogramme ⚠
- Poste sans séance : colonne grisée avec label "Libre"
- Cartes de séance :
  - `top = (start_hour - 6) * 48` px
  - `height = duration_hours * 48 - 6` px (6px de marge)
  - Classe CSS selon `color` : `card-blue` | `card-green` | `card-orange` | `card-red` | `card-gray`
  - Contenu : nom patient, horaire, badge état/alerte, KT/V si `done`
- Scroll horizontal si > 6 postes (overflow-x: auto)
- Clic carte → `onSelectSession(session.id)`

**Calcul `start_hour` côté OWL :**
```javascript
startHour(session) {
    const d = new Date(session.date);
    return d.getHours() + d.getMinutes() / 60;
}
durationHours(session) {
    const start = new Date(session.date);
    const stop = new Date(session.date_stop);
    return (stop - start) / 3600000; // ms → h
}
```

### 4.4 `CalendarWeekView`

**Props :** `patients`, `weekDates`, `onSelectSession`
(`patients` et `weekDates` viennent directement de l'output de `get_calendar_week_data`.)

**Rendu :**
- Tableau HTML : colonne patient (sticky left) + 7 colonnes jours
- Header jours : "Lun 2", "Mar 3", …
- 1 ligne par patient (trié par nom)
- Cellule : chip colorée (classe `chip-{color}`) avec `station_name + ' · ' + état_court`
- Cellule vide : tiret gris centré
- Clic chip → `onSelectSession(session.id)`
- Scroll vertical si > 20 patients

**État court :**
```javascript
shortState(session) {
    const map = { scheduled: '7h-11h', running: 'En cours', done: '✓ Terminée' };
    if (session.alert_label) return session.alert_label;
    return map[session.state] || session.state;
}
```
(L'heure exacte est formatée depuis `session.date` pour l'état `scheduled`.)

### 4.5 `CalendarMonthView`

**Props :** `monthData`, `currentDate`, `onSelectDay`

**Rendu :**
- En-tête jours : Lun Mar Mer Jeu Ven Sam Dim
- Grille : 4-6 semaines selon le mois (cases "other-month" pour jours hors mois)
- Chaque cellule-jour :
  - Numéro du jour (en bleu si `today`)
  - Barre d'occupation colorée (hauteur fixe 6px, largeur = `occupation_rate`%)
  - Texte : "XX séances · YY%"
  - Si `critical_count > 0` : badge "🔴 N critique(s)"
  - Si pas de séances : cellule grisée
- Couleur barre : vert ≥80% / orange 50-79% / rouge <50%
- Clic cellule → `onSelectDay(day.date)` → bascule Mode Jour
- Légende en bas de grille

---

## 5. CSS — `dialysis_calendar.css`

Classes principales à définir :

| Classe | Usage |
|---|---|
| `.dc-wrap` | Conteneur principal, fond clair, border-radius |
| `.dc-toolbar` | Toolbar flex, padding, border-bottom |
| `.dc-mode-btn` / `.dc-mode-btn.active` | Boutons mode |
| `.dc-day-grid` | Flex container axe temps + colonnes |
| `.dc-time-axis` | Colonne temps (44px, fond blanc) |
| `.dc-station-col` | Colonne poste (min-width: 130px) |
| `.dc-station-header` | Header colonne poste |
| `.dc-station-body` | Corps colonne (position: relative) |
| `.dc-session-card` | Carte séance (position: absolute) |
| `.dc-card-blue/green/orange/red/gray` | Variantes couleur |
| `.dc-week-table` | Tableau mode semaine |
| `.dc-week-chip` / `.dc-chip-{color}` | Chips semaine |
| `.dc-month-grid` | Grille CSS 7 colonnes |
| `.dc-month-cell` | Cellule jour |
| `.dc-occ-bar` | Barre occupation |
| `.dc-panel-overlay` | Overlay sombre quand panel ouvert |

---

## 6. Action Odoo et menu

**Fichier :** `views/dialysis_calendar_action.xml`

```xml
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
```

**Enregistrement OWL dans `DialysisCalendar.js` :**
```javascript
registry.category("actions").add("acs_dialysis_calendar", DialysisCalendar);
```

**`__manifest__.py` :** ajouter `'views/dialysis_calendar_action.xml'` dans `data`.

---

## 7. Pas de tests unitaires additionnels pour ce sprint

Les composants OWL ne sont pas testés côté Python. Le backend Python (`calendar_dashboard.py`) suivra le pattern de test existant dans `tests/test_doctor_dashboard.py` pour les 3 nouvelles méthodes RPC (données de retour, cas vide, cas avec alertes).

---

## 8. Récapitulatif des fichiers à créer

| Fichier | Type | Notes |
|---|---|---|
| `static/src/components/dialysis_calendar/DialysisCalendar.js` | OWL JS | Racine, état, fetch |
| `static/src/components/dialysis_calendar/DialysisCalendar.xml` | OWL XML | Template racine |
| `static/src/components/dialysis_calendar/CalendarToolbar.js` | OWL JS | Toolbar modes + dates |
| `static/src/components/dialysis_calendar/CalendarToolbar.xml` | OWL XML | |
| `static/src/components/dialysis_calendar/CalendarDayView.js` | OWL JS | Grille axe temps |
| `static/src/components/dialysis_calendar/CalendarDayView.xml` | OWL XML | |
| `static/src/components/dialysis_calendar/CalendarWeekView.js` | OWL JS | Tableau patients |
| `static/src/components/dialysis_calendar/CalendarWeekView.xml` | OWL XML | |
| `static/src/components/dialysis_calendar/CalendarMonthView.js` | OWL JS | Grille mensuelle |
| `static/src/components/dialysis_calendar/CalendarMonthView.xml` | OWL XML | |
| `static/src/components/dialysis_calendar/dialysis_calendar.css` | CSS | Styles dédiés |
| `models/calendar_dashboard.py` | Python | 3 méthodes RPC |
| `views/dialysis_calendar_action.xml` | XML Odoo | Action + menu |

**Fichiers modifiés :**

| Fichier | Modification |
|---|---|
| `models/__init__.py` | Ajouter `from . import calendar_dashboard` |
| `__manifest__.py` | Ajouter `'views/dialysis_calendar_action.xml'` dans `data` |

**Fichiers réutilisés sans modification :**

| Fichier | Réutilisation |
|---|---|
| `models/doctor_dashboard.py` | `get_patient_panel_data` appelée depuis le calendrier |
| `components/doctor_dashboard/DoctorPatientPanel.js/.xml` | Panel latéral au clic sur séance |
