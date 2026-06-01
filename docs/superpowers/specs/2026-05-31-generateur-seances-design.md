# Générateur de Séances en Masse — Design Spec

**Date :** 2026-05-31
**Sprint :** 2
**Module cible :** `acs_hms_nephrology` (extension, pas de nouveau module)

---

## 1. Objectif

Permettre à la secrétaire de générer en une seule opération les séances d'hémodialyse (`acs.patient.procedure`) et leurs RDVs (`hms.appointment`) pour plusieurs patients sur une période donnée, avec détection de conflits et pré-remplissage automatique depuis la dernière séance de chaque patient.

**Utilisateur principal :** Secrétaire (PC bureau)

---

## 2. Architecture

### 2.1 Modèles

#### `nephrology.session.generator` (TransientModel — Modal 1)

Saisie initiale : patients, période, options.

| Champ | Type | Description |
|---|---|---|
| `patient_ids` | Many2many → hms.patient | Patients sélectionnés. Filtrables par planning et médecin. |
| `date_start` | Date | Début de période (required) |
| `date_end` | Date | Fin de période (required) |
| `exclude_holidays` | Boolean | Exclure les jours fériés (défaut True) |
| `preview_count` | Integer (computed) | Nombre total de séances qui seront créées |

**Méthode clé :** `action_open_validator()` — calcule les lignes par patient et ouvre Modal 2.

---

#### `nephrology.session.generator.line` (TransientModel — lignes Modal 2)

Une ligne par patient sélectionné.

| Champ | Type | Description |
|---|---|---|
| `generator_id` | Many2one → nephrology.session.generator | Lien parent |
| `patient_id` | Many2one → hms.patient | Patient |
| `schedule_id` | Many2one → acs.nephrology.schedule | Planning (depuis dernière procédure) |
| `station_id` | Many2one → acs.dialysis.station | Poste (pré-rempli depuis dernière procédure) |
| `physician_id` | Many2one → hms.physician | Médecin (pré-rempli depuis dernière procédure) |
| `session_count` | Integer (computed) | Nb de dates valides pour ce patient sur la période |
| `conflict_status` | Selection | `ok` / `warning_station` / `error_duplicate` |
| `conflict_details` | Char | Description textuelle du conflit |

---

#### `nephrology.session.validator` (TransientModel — Modal 2)

Tableau de validation avec confirmation.

| Champ | Type | Description |
|---|---|---|
| `generator_id` | Many2one → nephrology.session.generator | Lien vers Modal 1 |
| `line_ids` | One2many → nephrology.session.generator.line | Lignes par patient |

**Méthode clé :** `action_confirm()` — crée les procédures et RDVs pour toutes les lignes non bloquantes.

---

#### `acs.nephrology.holiday` (Model permanent)

| Champ | Type | Description |
|---|---|---|
| `name` | Char | Nom du jour férié |
| `date` | Date | Date (required) |
| `recurring` | Boolean | Si True, se répète chaque année à la même date (jours fixes) |

Chargé par défaut avec les jours fériés sénégalais fixes. Les fêtes islamiques (Korité, Tabaski, Maouloud — dates variables) sont à ajouter manuellement chaque année par l'admin.

---

### 2.2 Flux

```
Secrétaire ouvre le wizard
    ↓
[Modal 1 — nephrology.session.generator]
  - Sélectionne patients (Many2many, filtres planning/médecin)
  - Définit période (date_start → date_end)
  - Coche "Exclure jours fériés" (défaut activé)
  - Voit aperçu : "48 séances seront créées pour 4 patients"
  - Clique [Continuer →]
    ↓
action_open_validator() :
  Pour chaque patient :
    1. Cherche sa dernière acs.patient.procedure → récupère schedule, station, médecin
    2. Génère la liste des dates valides (jours du schedule, hors jours fériés si activé)
    3. Calcule conflict_status (voir §2.3)
    4. Crée une nephrology.session.generator.line
    ↓
[Modal 2 — nephrology.session.validator]
  Tableau : Patient | Nb séances | Poste | Médecin | Statut
  - Lignes ✅ ok : fond blanc
  - Lignes ⚠️ warning_station : fond orange (confirmables)
  - Lignes 🔴 error_duplicate : fond rouge (exclues de la confirmation)
  - Secrétaire peut modifier station_id et physician_id par ligne
  - Clique [Confirmer tout]
    ↓
action_confirm() :
  Pour chaque line dont conflict_status ≠ error_duplicate :
    Pour chaque date valide calculée :
      1. Crée acs.patient.procedure (date, patient_id, station_id, physician_id, product)
      2. Crée hms.appointment lié à la procédure
  Affiche notification : "N séances créées"
```

---

### 2.3 Détection de conflits

Effectuée deux fois : à la création des lignes (`action_open_validator`) et à la confirmation (`action_confirm`).

| Situation | `conflict_status` | Comportement |
|---|---|---|
| Poste déjà occupé sur au moins une date de la période | `warning_station` ⚠️ orange | Confirmable. La secrétaire peut changer le poste ou ignorer. |
| Patient a déjà une `acs.patient.procedure` sur la même période | `error_duplicate` 🔴 rouge | **Bloquant.** Ligne exclue de `action_confirm`. |
| Aucun conflit | `ok` ✅ | Confirmé normalement. |

Un patient peut avoir `warning_station` ET `error_duplicate` simultanément — dans ce cas `error_duplicate` prend le dessus.

---

### 2.4 Calcul des dates valides

```python
def _compute_valid_dates(patient_line):
    """Retourne la liste des dates valides pour un patient sur la période"""
    weekdays = patient_line.schedule_id.get_weekdays()  # [0,2,4] pour Lu/Me/Ve
    holidays = env['acs.nephrology.holiday'].search([]).mapped('date')

    dates = []
    current = date_start
    while current <= date_end:
        if current.weekday() in weekdays:
            if not (exclude_holidays and current in holidays):
                dates.append(current)
        current += timedelta(days=1)
    return dates
```

---

### 2.5 Jours fériés sénégalais — données initiales

Chargés dans `data/nephrology_holidays.xml` avec `noupdate="1"` :

| Fête | Date | Récurrente |
|---|---|---|
| Jour de l'An | 01/01 | Oui |
| Fête du Travail | 01/05 | Oui |
| Fête Nationale (Indépendance) | 04/04 | Oui |
| Assomption | 15/08 | Oui |
| Toussaint | 01/11 | Oui |
| Noël | 25/12 | Oui |
| Korité (2025) | à saisir manuellement | Non |
| Tabaski (2025) | à saisir manuellement | Non |
| Maouloud (2025) | à saisir manuellement | Non |

---

## 3. Vues XML

### Modal 1 (`view_nephrology_session_generator_form`)
- Champ `patient_ids` en widget many2many_tags avec domain `[('nephrology_care', '=', True)]`
- `date_start`, `date_end` sur la même ligne
- Checkbox `exclude_holidays`
- Badge `preview_count` (widget statinfo ou simple char readonly)
- Boutons : [Annuler] [Continuer →]

### Modal 2 (`view_nephrology_session_validator_form`)
- Liste `line_ids` avec colonnes : Patient | Nb séances | Poste | Médecin | Statut
- `decoration-warning="conflict_status == 'warning_station'"`
- `decoration-danger="conflict_status == 'error_duplicate'"`
- Colonnes `station_id` et `physician_id` éditables inline
- Boutons : [← Retour] [Confirmer tout]

### Menu / Bouton d'accès
- Bouton "Générer séances en masse" dans la vue liste de `acs.patient.procedure` (menu Néphrologie → Séances)
- Action `ir.actions.act_window` ouvrant `nephrology.session.generator` en mode `new`

---

## 4. Tests

Fichier : `acs_hms_nephrology/tests/test_session_generator.py`

| Test | Vérifie |
|---|---|
| `test_holiday_exclusion` | Une date férié n'apparaît pas dans les dates générées |
| `test_schedule_days_respected` | Seuls Lu/Me/Ve (selon schedule) sont générés |
| `test_period_boundaries` | start_date et end_date sont incluses si elles tombent sur un bon jour |
| `test_prepopulate_from_last_procedure` | station_id et physician_id pré-remplis depuis dernière procédure du patient |
| `test_no_last_procedure_fallback` | Si aucune procédure précédente, station = station du schedule, physician = physician du schedule |
| `test_conflict_station_warning` | Procédure existante sur même poste même date → `warning_station` |
| `test_conflict_duplicate_error` | Procédure existante pour même patient sur la période → `error_duplicate` |
| `test_confirm_creates_procedures_and_appointments` | action_confirm() crée N procédures + N hms.appointment |
| `test_red_lines_excluded_from_confirm` | Les lignes `error_duplicate` ne génèrent rien |
| `test_recurring_holidays_apply_each_year` | Un holiday `recurring=True` daté 2024 exclut aussi la même date en 2025 |

---

## 5. Ce qui est hors scope (Sprint 2)

- Gestion des absences patients (report de séance)
- Vue calendrier visuelle des postes (Sprint 2 — dashboard)
- Notifications WhatsApp au patient après génération
- Facturation automatique au moment de la génération

---

## 6. Fichiers à créer / modifier

```
acs_hms_nephrology/
├── models/
│   └── session_generator.py        CRÉÉ — 3 TransientModels + acs.nephrology.holiday
├── views/
│   └── session_generator_view.xml  CRÉÉ — Modal 1 + Modal 2 + menu button
├── data/
│   └── nephrology_holidays.xml     CRÉÉ — jours fériés sénégalais
├── security/
│   └── ir.model.access.csv         MODIFIÉ — accès aux 4 nouveaux modèles
├── tests/
│   └── test_session_generator.py   CRÉÉ — 10 tests
└── __manifest__.py                 MODIFIÉ — nouveaux fichiers data + views
```
