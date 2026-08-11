# Simplification : suppression du flux Treatment pour la néphrologie

**Date** : 2026-08-11
**Approche** : Masquage UI (pas de suppression de code)

## Contexte

Les modules ACS HMS néphrologie ont 4 flux différents pour générer des séances de dialyse. Le modèle `hms.treatment` sert d'intermédiaire entre le patient et ses séances (`acs.patient.procedure`) mais n'apporte aucune valeur en néphrologie : un patient dialysé est en dialyse de façon continue, il n'a pas un "traitement" avec début/fin.

Les 4 flux actuels :
- **A** : Wizard masse (`nephrology.session.generator`) → séances sans RDV
- **B** : Treatment → `procedure.group` → séances + RDV
- **C** : Bouton "Générer RDV récurrents" sur une séance → wizard
- **D** : Bouton "Créer RDV" inline sur une séance

## Objectif

Réduire à **2 flux clairs** :
- **Consultations** : `hms.appointment` standalone (flux classique, inchangé)
- **Séances dialyse** : wizard masse → `acs.patient.procedure` + optionnellement `hms.appointment` (1:1)

## Décisions prises

| Question | Réponse |
|---|---|
| Créer les RDV automatiquement avec les séances ? | Non, option dans le wizard (checkbox) |
| Données existantes à migrer ? | Non, environnement frais |
| `procedure.group` utilisé ailleurs ? | Non, uniquement néphro |
| Approche | Masquage UI, pas de suppression de code |

## Modifications

### 1. Masquer le menu Treatment

**Fichier** : `acs_hms_nephrology/views/menu_item.xml`
**Ligne** : 43-47

Rendre invisible le menuitem `menu_acs_treatment` qui pointe vers `hms.treatment` via `action_acs_treatment`.

Méthode : override le menuitem avec `active="0"` sur le `ir.ui.menu` (méthode standard Odoo pour masquer un menu hérité sans le supprimer).

Les éléments suivants restent en place (code mort inoffensif) :
- Action `action_acs_treatment` dans `hms_base_view.xml` (ligne 240)
- Vue d'héritage treatment form dans `hms_base_view.xml` (ligne 282)
- Vues procedure.group dans `nephrology_view.xml` (lignes 301, 313)

### 2. Ajouter l'option "Créer aussi les RDV" au wizard masse

**Fichier Python** : `acs_hms_nephrology/models/session_generator.py`

Sur le modèle `nephrology.session.generator` (TransientModel) :
- Ajouter le champ `create_appointments = fields.Boolean("Créer aussi les RDV", default=False)`

Sur le modèle `nephrology.session.validator` :
- Dans la méthode `action_confirm()`, après la création de chaque `acs.patient.procedure` :
  - Si `self.generator_id.create_appointments` est `True`, appeler `procedure.action_create_appointment_from_schedule()` (méthode existante dans `appointment_generator.py`)

**Fichier XML** : `acs_hms_nephrology/views/session_generator_view.xml`

Sur le formulaire du generator (étape 1) :
- Ajouter le champ `create_appointments` comme checkbox, après le champ `exclude_holidays`

### 3. Masquer les boutons de flux C et D

**Fichier** : `acs_hms_nephrology/views/appointment_generator_view.xml`

| Bouton | Ligne | Action |
|---|---|---|
| "Créer RDV depuis planning" | 23-28 | Ajouter `invisible="1"` |
| "Générer RDV récurrents" | 30-35 | Ajouter `invisible="1"` |
| Stat button "Rendez-vous" | 12-18 | Garder visible |
| Champ `appointment_id` | 40 | Garder visible |

Le wizard `nephrology.appointment.generator` (lignes 46-109) et son action (104-109) restent en place (code mort).

### 4. Structure des menus (aucun changement sauf masquage)

Menu final :
```
Néphrologie
  ├── Rendez-vous          (seq 10) → hms.appointment (tous, consultations + séances)
  ├── Patients             (seq 30) → hms.patient
  ├── Hémodialyses         (seq 40) → acs.patient.procedure (séances)
  ├── [MASQUÉ] Séances de Dialyse (seq 45) → hms.treatment
  ├── Ordonnances          (seq 60) → prescription.order
  ├── Générer séances      (seq 70) → wizard masse (amélioré avec checkbox RDV)
  └── Configuration        (seq 100)
```

## Flux final

```
CONSULTATIONS :
  Médecin → crée hms.appointment → consultation classique → terminé

SÉANCES DIALYSE :
  Admin → Générer séances en masse
    → choisit patients + planning + période
    → [optionnel] coche "Créer aussi les RDV"
    → validation des conflits
    → confirmer
    → crée acs.patient.procedure x N
    → si checkbox : crée hms.appointment x N (1:1, via action_create_appointment_from_schedule)

  Infirmier → ouvre la séance du jour (acs.patient.procedure)
    → remplit données cliniques
    → termine la séance
```

## Fichiers impactés

| Fichier | Type de modification |
|---|---|
| `acs_hms_nephrology/views/menu_item.xml` | Masquer 1 menuitem |
| `acs_hms_nephrology/models/session_generator.py` | Ajouter 1 champ Boolean + logique dans action_confirm |
| `acs_hms_nephrology/views/session_generator_view.xml` | Ajouter 1 champ checkbox |
| `acs_hms_nephrology/views/appointment_generator_view.xml` | Masquer 2 boutons |

## Ce qu'on ne touche PAS

- Les modèles Python (`hms.treatment`, `procedure.group`, `appointment_generator.py`) — aucune suppression de code
- Les vues d'héritage treatment/procedure.group — inoffensives
- Le modèle `acs.patient.procedure` — aucun changement structurel
- Le modèle `hms.appointment` — inchangé
- Les autres modules ACS — aucun impact
