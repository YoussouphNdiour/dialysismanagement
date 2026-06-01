# Dashboard Médecin — Design Spec

**Date :** 2026-06-01
**Sprint :** 2 — Section 6
**Module cible :** `acs_hms_nephrology_dashboard` (extension du module Section 5)
**Stack :** Odoo 19, OWL, Python, Chart.js

---

## 1. Contexte

Le module `acs_hms_nephrology_dashboard` contient déjà l'interface infirmier tablette (Section 5).
Ce sprint ajoute le dashboard médecin dans le même module, sans toucher aux composants infirmier existants.

**Modèles disponibles (déjà existants) :**
- `acs.patient.procedure` — séances, states : `scheduled / running / done / cancel`
- `acs.dialysis.station` — postes physiques de dialyse
- `acs.nephrology.schedule` — créneaux, lien `station_id → Many2one(acs.dialysis.station)`
- `acs.dialysis.complication` — complications par séance (`resolution`, `complication_type`)
- `hemodialysis.vital.sign` — signes vitaux (`is_hypotension`, `blood_pressure`)

**Champs clés sur `acs.patient.procedure` :**
- `has_active_hypotension` (Boolean, computed) — hypotension détectée sur les signes vitaux
- `ktv_calculated` (Float), `ktv_status` (`adequate` / `insufficient`)
- `complication_count` (Integer), `has_complication` (Boolean)
- `arrival_status`, `actual_duration`, `actual_uf`, `departure_weight`, `dry_weight`

---

## 2. Architecture générale

### Nouveaux fichiers

```
acs_hms_nephrology_dashboard/
  models/
    doctor_dashboard.py          ← NOUVEAU
    __init__.py                  ← mise à jour (import doctor_dashboard)
  static/src/components/
    doctor_dashboard/            ← NOUVEAU (6 composants)
      DoctorDashboard.js/.xml
      DoctorAlertsSidebar.js/.xml
      DoctorStationGrid.js/.xml
      DoctorStationCard.js/.xml
      DoctorPatientPanel.js/.xml
      DoctorStatsChart.js/.xml
  static/src/doctor_dashboard.js  ← NOUVEAU (point d'entrée registry)
  views/
    doctor_dashboard_action.xml   ← NOUVEAU
  tests/
    test_doctor_dashboard.py      ← NOUVEAU
```

### Fichiers existants à modifier

- `__manifest__.py` — ajouter `doctor_dashboard_action.xml` dans `data`
- `models/__init__.py` — ajouter import `doctor_dashboard`
- `static/src/**/*.js/.xml` glob déjà présent dans assets — aucun changement

### Approche architecturale

**Approche B — Méthode Python `@api.model` + requêtes ORM directes depuis OWL.**

- Agrégations (KPIs, KT/V moyen mensuel) → calculées en Python via méthodes `@api.model`
- Données temps réel des postes → `orm.call()` vers `get_dashboard_data()`
- Slide panel patient → `orm.call()` vers `get_patient_panel_data(procedure_id)`
- Graphique KT/V → `orm.call()` vers `get_ktv_chart_data()`
- Polling toutes les 30 secondes (médecin surveille de temps en temps, pas en continu)

---

## 3. Modèle Python

**Fichier :** `models/doctor_dashboard.py`
**Classe :** hérite de `acs.dialysis.station` via `_inherit`

### 3.1 `get_dashboard_data()` — appelée toutes les 30s par OWL

**Logique :**
1. Récupère tous les postes actifs (`acs.dialysis.station`, `active=True`)
2. Pour chaque poste, cherche la procédure du jour liée via `nephrology_schedule_ids → station_id`
   - Domaine : `department_type='nephrology'`, date dans la plage du jour
3. Calcule les alertes par procédure :
   - `has_active_hypotension=True` → critique
   - complication avec `resolution='no'` → critique
   - `complication_type='early_stop'` → critique
   - `ktv_status='insufficient'` → attention
   - `state='scheduled'` + date dépassée de >30 min → attention
4. Calcule les KPIs du jour
5. Retourne un dict structuré

**Structure de retour :**
```json
{
  "stations": [
    {
      "id": 1,
      "name": "Poste 1",
      "room": "Salle A",
      "station_type": "standard",
      "procedure": {
        "id": 42,
        "patient_id": [5, "Ba Fatoumata"],
        "state": "running",
        "date": "2026-06-01 10:00:00",
        "date_stop": "2026-06-01 14:00:00",
        "actual_duration": 1.67,
        "actual_uf": 900,
        "ktv_calculated": 1.18,
        "ktv_status": "insufficient",
        "has_active_hypotension": true,
        "complication_count": 1,
        "pre_dialysis_bp": "138/85",
        "age": 42,
        "vascular_access": "KTC",
        "alert_level": "critical",
        "alert_label": "Hypotension"
      }
    }
  ],
  "kpis": {
    "total_sessions": 18,
    "running_sessions": 12,
    "done_sessions": 4,
    "occupation_rate": 75,
    "avg_ktv": 1.35,
    "adequate_ktv_rate": 82,
    "complication_count": 2,
    "critical_alerts": 2,
    "warning_alerts": 5
  },
  "alerts": [
    {
      "level": "critical",
      "station_name": "Poste 2",
      "patient_name": "Ba Fatoumata",
      "procedure_id": 42,
      "label": "Hypotension TA 82/50",
      "time": "14:23"
    }
  ]
}
```

### 3.2 `get_patient_panel_data(procedure_id)` — appelée au clic sur un poste

**Logique :**
1. Lit la procédure en cours : durée, UF réelle, KT/V, TA, complications actives (resolution != 'yes')
2. Cherche la dernière procédure `done` du même patient (hors séance en cours), triée par date desc
3. Lit les données patient : âge, groupe sanguin, poids sec + date modif, durée dialyse, traitement actif (EPO, Fer IV depuis `interdialysis_medication`)
4. Retourne un dict consolidé (une seule requête pour le panel)

### 3.3 `get_ktv_chart_data()` — appelée à l'ouverture de l'onglet Stats

**Logique :**
1. Récupère toutes les procédures `done` des 30 derniers jours, département néphro, `ktv_calculated > 0`
2. Groupe par date (jour) → moyenne KT/V par jour
3. Retourne `{ labels: ["2026-05-02", ...], values: [1.35, ...] }`

### 3.4 Alertes — table de criticité

| Niveau | Condition sur `acs.patient.procedure` |
|---|---|
| 🔴 Critique | `has_active_hypotension = True` |
| 🔴 Critique | Complication avec `resolution = 'no'` |
| 🔴 Critique | Complication avec `complication_type = 'early_stop'` |
| ⚠ Attention | `ktv_status = 'insufficient'` (séances terminées) |
| ⚠ Attention | `state = 'scheduled'` et date dépassée de > 30 min (séance en retard) |

---

## 4. Composants OWL

### 4.1 `DoctorDashboard` — composant racine

**Layout C :** sidebar gauche fixe 240px + zone principale avec toggle d'onglets.

**State :**
```js
{
  tab: 'grid',            // 'grid' | 'list' | 'stats'
  stations: [],           // données de get_dashboard_data
  kpis: {},
  alerts: [],
  selectedProcedureId: null,
  panelData: null,        // données de get_patient_panel_data
  showPanel: false,
  loading: false,
  alertFilter: null,      // 'critical' | 'warning' | null
}
```

**Comportement :**
- `setup()` → appelle `_loadDashboard()` + démarre polling `setInterval(30000)`
- `useEffect` nettoie l'intervalle au unmount
- `onSelectStation(procedureId)` → appelle `get_patient_panel_data`, ouvre le panel
- `onClosePanel()` → ferme le panel
- `onAlertFilter(level)` → filtre la grille sur les postes alertes

**Sous-composants :** `DoctorAlertsSidebar`, `DoctorStationGrid`, `DoctorPatientPanel`, `DoctorStatsChart`

---

### 4.2 `DoctorAlertsSidebar`

**Props :** `kpis`, `alerts`, `alertFilter`, `onAlertFilter`

**Sections :**
1. **KPIs du jour** — 4 badges :
   - Séances : `running + done / total` 
   - Occupation : `occupation_rate %`
   - KT/V moy : `avg_ktv` (vert si ≥ 1.2, orange sinon)
   - Complications : `complication_count`
2. **Compteurs alertes** — 2 boutons cliquables qui filtrent la grille :
   - `🔴 N critiques`
   - `⚠ N attentions`
3. **Liste des alertes** — triée critiques d'abord, chaque item cliquable → ouvre le panel du poste

---

### 4.3 `DoctorStationGrid`

**Props :** `stations`, `alertFilter`, `onSelectStation`

- Grille CSS : `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))`
- Si `alertFilter` actif → affiche seulement les postes au niveau correspondant
- Rend un `DoctorStationCard` par poste

---

### 4.4 `DoctorStationCard` — carte détaillée (niveau C)

**Props :** `station`, `onSelect`

**Contenu :**
```
┌─────────────────────────────────┐
│ POSTE 1              [EN COURS] │  ← badge statut coloré
│ Diallo Mamadou                  │  ← nom patient (grisé si libre)
│ ♂ 58 ans · Fistule AVF          │  ← âge + accès vasculaire
│ ████████████░░░░░░░░ 56%        │  ← barre progression séance
│ 2h15 / 4h00                     │  ← durée prévue = date_stop - date, fallback 4h si null
│ TA: 138/85  KT/V: 1.42  UF:1200 │  ← 3 valeurs OU alerte si critique
└─────────────────────────────────┘
```

**Couleurs de bordure :**
- `running` sans alerte → vert (`#16a34a`)
- `running` avec alerte critique → rouge (`#ef4444`) + badge `🔴 ALERTE`
- `running` avec alerte attention → orange (`#f59e0b`)
- `done` → bleu-gris atténué
- `scheduled` → gris neutre
- `cancel` (absent) → gris foncé, texte "Absent"
- libre (pas de procédure) → gris très atténué, texte "— Libre —"

**Alerte critique :** remplace les 3 valeurs par `label alerte + valeur TA`

---

### 4.5 `DoctorPatientPanel` — slide panel droit 300px

**Props :** `panelData`, `onClose`

**Sections :**
1. **En-tête** : nom patient, croix de fermeture
2. **Info patient** : sexe + âge, groupe sanguin, accès vasculaire, dialyse depuis (date)
3. **Alerte active** (si présente) : bloc rouge avec type + valeurs
4. **Séance en cours** : durée écoulée / durée totale, UF réelle, KT/V calculé, TA pré-dialyse
5. **Dernière séance** : date, durée, UF, KT/V, tolérance globale
6. **Poids sec** : valeur + date dernière modification
7. **Traitement** : texte `interdialysis_medication` (EPO, Fer IV, etc.)
8. **4 boutons d'action** :
   - Dossier complet → `action_open_patient_record` (form view Odoo natif)
   - Prescrire → `action_new_prescription`
   - Historique → `action_patient_history`
   - Planifier RDV → `action_schedule_appointment`

---

### 4.6 `DoctorStatsChart`

**Chargement :** appelle `get_ktv_chart_data()` à l'ouverture de l'onglet (pas au polling)

**Graphique :** Chart.js line chart
- Axe X : 30 derniers jours (labels dates)
- Axe Y : KT/V moyen (0.0 → 2.0)
- Ligne de référence horizontale à 1.2 (annotation)
- Tooltip : date + KT/V moyen + nb séances ce jour

**Métriques texte sous le graphique :**
- Taux séances adéquates (KT/V ≥ 1.2) sur 30 jours : `82%`
- Nb complications / semaine (moyenne 4 semaines) : `2.5`
- Taux occupation moyen : `75%`

---

## 5. Menu & sécurité

**Action client OWL :**
```xml
<record id="action_doctor_dashboard" model="ir.actions.client">
    <field name="name">Dashboard Médecin</field>
    <field name="tag">acs_doctor_dashboard</field>
</record>
```

**Menu item :**
```xml
<menuitem id="menu_doctor_dashboard"
    name="Dashboard Médecin"
    action="action_doctor_dashboard"
    parent="acs_hms_nephrology.menu_nephrology"
    groups="acs_hms.group_hms_doctor,
            acs_hms_base.group_hms_manager,
            acs_hms_nephrology.group_hms_nephrology_user"
    sequence="10"/>
```

**Sécurité des méthodes Python :**
- Méthodes `@api.model` — accessibles via JSON-RPC standard Odoo
- Pas de nouveaux `ir.model.access.csv` nécessaires (modèles déjà couverts par les modules dépendants)
- Pas de route HTTP custom

---

## 6. Tests Python

**Fichier :** `tests/test_doctor_dashboard.py`

| Test | Scénario |
|---|---|
| `test_get_dashboard_data_empty` | Aucun poste actif → retourne structure vide valide (pas d'erreur) |
| `test_get_dashboard_data_running_session` | Procédure `running` aujourd'hui → apparaît dans `stations` avec bon statut |
| `test_alert_hypotension_critical` | `has_active_hypotension=True` → dans `alerts` avec `level='critical'` |
| `test_alert_ktv_insufficient_warning` | `ktv_status='insufficient'` → dans `alerts` avec `level='warning'` |
| `test_alert_late_session` | `state='scheduled'`, date dépassée de 45 min → dans `alerts` niveau attention |
| `test_kpis_calculation` | 3 procédures (2 running, 1 done) → KPIs calculés correctement |
| `test_get_ktv_chart_data` | 3 procédures done sur 2 jours → valeurs moyennées par jour |
| `test_get_patient_panel_data` | Retourne séance en cours + dernière séance + données patient |
| `test_get_patient_panel_no_previous` | Premier patient → dernière séance = `None`, pas d'erreur |

---

## 7. Hors périmètre de ce sprint

- Graphiques complets (taux occupation par jour, complications 6 mois) → sprint ultérieur
- Dashboard secrétaire (planning jour, facturation en attente) → section 7 (billing)
- Notifications temps réel via WebSocket / Odoo bus → sprint ultérieur
- Export PDF / rapport médecin → sprint ultérieur
