# Spec : Onglet KPIs dans le dashboard médecin

**Date :** 2026-06-14
**Module cible :** `acs_hms_nephrology_dashboard` (modification)
**Périmètre :** 4ème onglet "KPIs" dans le dashboard médecin, grille 2×2 avec métriques mensuelles

---

## Contexte

Le dashboard médecin (`DoctorDashboard.js`) a 3 onglets : Stations (grille), Liste, Statistiques (graphique KT/V 30 jours). Il manque une vue synthétique des KPIs mensuels clés : séances réalisées, qualité de dialyse (KT/V), état de l'anémie (Hb), et taux de complications.

---

## Architecture

**Module touché :** `acs_hms_nephrology_dashboard` uniquement — aucun nouveau module.

**Fichiers modifiés :**
- `models/doctor_dashboard.py` — ajout de `get_kpi_stats_data()`
- `static/src/components/doctor_dashboard/DoctorDashboard.js` — 4ème onglet + import composant
- `static/src/components/doctor_dashboard/DoctorDashboard.xml` — bouton onglet "KPIs"

**Fichiers créés :**
- `static/src/components/doctor_dashboard/DoctorKpiStats.js` — composant OWL
- `static/src/components/doctor_dashboard/DoctorKpiStats.xml` — template OWL
- `tests/test_doctor_dashboard_kpi.py` — 4 tests unitaires

Aucun nouveau modèle Odoo, aucune migration de base de données.

---

## Métriques affichées

Grille 2×2, période = mois civil en cours.

| Carte | Source | Calcul |
|---|---|---|
| **Séances ce mois** | `acs.patient.procedure` | `state='done'` + `date` dans le mois courant + patients du périmètre. Delta vs mois précédent affiché (▲/▼). |
| **% Hb dans cible** | `acs.nephro.bilan` | Par patient : dernier bilan avec `hemoglobin > 0`. `hemoglobin_status == 'ok'` (10–12 g/dL). Ratio patients en cible / patients avec au moins un bilan. |
| **Taux complications** | `acs.dialysis.complication` | Nb complications sur séances du mois ÷ nb séances du mois × 100. Détail : "X/Y séances". |
| **% KT/V adéquat** | `acs.patient.procedure` | Séances du mois avec `ktv_status == 'adequate'` ÷ séances avec `ktv_calculated > 0` × 100. |

---

## Périmètre patients (filtrage)

```python
is_manager = self.env.user.has_group('acs_hms.group_hms_manager')
domain = [('nephrology_care', '=', True), ('active', '=', True)]
if not is_manager:
    physician = self.env['hms.physician'].search(
        [('user_id', '=', self.env.uid)], limit=1)
    domain += [('primary_physician_id', '=', physician.id)]
patients = self.env['hms.patient'].sudo().search(domain)
```

- **`group_hms_manager`** → tous les patients néphro actifs (vue globale unité)
- **Médecin standard** → uniquement ses patients (`primary_physician_id`)
- Un badge "Vue globale" est affiché dans l'onglet si `is_manager = True`

---

## Méthode Python

```python
@api.model
def get_kpi_stats_data(self):
    """Retourne les KPIs mensuels pour l'onglet KPIs du dashboard médecin."""
    # Retourne dict avec les clés suivantes :
    return {
        'sessions_count': int,       # séances done ce mois
        'sessions_delta': int,       # delta vs mois précédent (positif ou négatif)
        'hb_in_range_pct': float,    # % patients avec Hb dans cible (0–100)
        'hb_in_range_detail': str,   # ex: "17/25"
        'complication_rate': float,  # % complications/séances (0–100)
        'complication_detail': str,  # ex: "10/247"
        'ktv_adequate_pct': float,   # % séances avec KT/V adéquat (0–100)
        'ktv_adequate_detail': str,  # ex: "203/247"
        'period_label': str,         # ex: "Juin 2026"
        'is_manager': bool,          # True si vue globale
    }
```

---

## Composant OWL

**`DoctorKpiStats.js`** :
- Charge les données au montage via `this.orm.call('acs.patient.procedure', 'get_kpi_stats_data', [])`
- Pas de polling temps-réel (données mensuelles agrégées, pas besoin de rafraîchissement continu)
- État : `{ data: null, loading: true }` — affiche un spinner pendant le chargement
- Si `data === null` après chargement → message d'erreur discret

**`DoctorKpiStats.xml`** :
- Grille 2×2 avec les 4 cartes KPI
- Chaque carte : label, valeur principale (grand), détail (ex: "17/25"), couleur sémantique
- Carte "Séances ce mois" : flèche ▲ (vert) / ▼ (rouge) pour le delta mensuel
- Badge "Vue globale — tous les patients" si `is_manager`

**Intégration dans `DoctorDashboard.js/.xml`** :
- Nouvel onglet `activeTab === 'kpis'`
- Bouton ajouté après le bouton "Statistiques" dans la barre d'onglets
- Import et enregistrement de `DoctorKpiStats` dans les composants du dashboard

---

## Tests

Fichier : `tests/test_doctor_dashboard_kpi.py`, classe `TestDoctorDashboardKpi(TransactionCase)`.

| Test | Scénario | Résultat attendu |
|---|---|---|
| `test_kpi_manager_sees_all` | 2 médecins avec 3 patients chacun, user = manager | `sessions_count` totalise les 6 patients, `is_manager=True` |
| `test_kpi_doctor_sees_own` | 2 médecins avec 3 patients chacun, user = médecin 1 | `sessions_count` ne compte que les patients du médecin 1 |
| `test_hb_in_range_no_bilan` | Patient sans aucun bilan | Patient exclu du dénominateur de `hb_in_range_pct` |
| `test_complication_rate` | 2 complications sur 10 séances done ce mois | `complication_rate = 20.0`, `complication_detail = "2/10"` |

---

## Gestion d'erreurs

| Situation | Comportement |
|---|---|
| Médecin non lié à un `hms.physician` | `patients` = vide, toutes les métriques = 0 |
| Aucune séance ce mois | `sessions_count = 0`, taux = 0.0 (pas de division par zéro) |
| Aucun patient avec bilan Hb | `hb_in_range_pct = 0.0`, `hb_in_range_detail = "0/0"` |

---

## Hors périmètre

- Sélecteur de période (le mois courant est fixe — ajout possible ultérieurement)
- Export CSV/PDF des KPIs
- Alertes ou seuils configurables sur les KPIs
- KPIs pour d'autres paramètres biologiques (albumine, PTH, phosphore)
- Graphique d'évolution temporelle dans cet onglet (déjà couvert par l'onglet "Statistiques" pour KT/V)
