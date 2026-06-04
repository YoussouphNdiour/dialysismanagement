# Sprint 3 — Section 4.4 : Gestion des absences et reports de séance

**Date :** 2026-06-04
**Sprint :** 3
**Section spec master :** 4.4 (docs/superpowers/specs/2026-05-31-dialyse-nephro-platform-design.md)
**Module cible :** `acs_hms_nephrology_dashboard`
**Dépend de :** `acs_hms_nephrology`, `acs_hms_whatsapp`

---

## 1. Périmètre

Ce sprint couvre :

1. **Modèle `acs.dialysis.absence`** : enregistrement d'une période d'absence patient, passage automatique des séances concernées au statut "Absence justifiée"
2. **Extension `acs.patient.procedure`** : ajout du statut `absent` + champ `absence_id`
3. **Wizard `dialysis.session.reschedule`** : report guidé d'une séance avec vérification de disponibilité du poste
4. **Modèle `acs.dialysis.waitlist`** : file d'attente par créneau planning, notification automatique à la libération
5. **WhatsApp reprise** : cron quotidien J-1 + bouton manuel de clôture

---

## 2. Modèles de données

### 2.1 `acs.dialysis.absence`

```python
_name = 'acs.dialysis.absence'
_description = 'Absence patient — dialyse'
_inherit = ['mail.thread', 'mail.activity.mixin']
_order = 'start_date desc'
```

| Champ | Type | Contrainte | Description |
|---|---|---|---|
| `patient_id` | Many2one → `hms.patient` | required | Patient concerné |
| `start_date` | Date | required | Début de l'absence |
| `end_date` | Date | required | Fin de l'absence |
| `reason` | Selection | required | Voir valeurs ci-dessous |
| `state` | Selection | default=draft | draft / confirmed / closed |
| `notes` | Text | — | Commentaire libre |
| `procedure_ids` | One2many → `acs.patient.procedure` via `absence_id` | — | Séances affectées (readonly) |
| `whatsapp_reprise_sent` | Boolean | default=False, copy=False | Anti-doublon cron |

**Valeurs `reason` :**
```python
[
    ('hospitalisation', 'Hospitalisation'),
    ('voyage',          'Voyage'),
    ('refus',           'Refus'),
    ('deces',           'Décès'),
    ('autre',           'Autre'),
]
```

**Contrainte :** `end_date >= start_date` (SQL constraint).

**Méthodes :**

- `action_confirm()` : passe `state → confirmed`, recherche toutes `acs.patient.procedure` du patient avec `date ∈ [start_date, end_date]` et `state = 'scheduled'`, les passe à `state = 'absent'` et renseigne `absence_id = self`. Log chatter.
- `action_close_and_notify()` : envoie WhatsApp de reprise (voir §5), passe `state → closed`, met `whatsapp_reprise_sent = True`.
- `action_cancel()` : depuis `confirmed`, repasse les procédures liées de `absent` → `scheduled`, réinitialise `absence_id`, passe l'absence en `draft`.

---

### 2.2 Extension `acs.patient.procedure`

Via `_inherit` dans `acs_hms_nephrology_dashboard` :

```python
state = fields.Selection(selection_add=[
    ('absent', 'Absence justifiée'),
], ondelete={'absent': 'set default'})

absence_id = fields.Many2one(
    'acs.dialysis.absence',
    string='Absence liée',
    ondelete='set null',
    index=True,
)
```

Le statut `absent` s'insère visuellement après `cancel` dans la barre de statut et dans les filtres.

---

### 2.3 `acs.dialysis.waitlist`

```python
_name = 'acs.dialysis.waitlist'
_description = 'Liste d\'attente — dialyse'
_order = 'request_date asc'
```

| Champ | Type | Description |
|---|---|---|
| `patient_id` | Many2one → `hms.patient` | required |
| `schedule_id` | Many2one → `acs.nephrology.schedule` | Créneau souhaité |
| `request_date` | Date | default=today |
| `state` | Selection | waiting / notified / fulfilled / cancelled |
| `whatsapp_sent` | Boolean | default=False |
| `notes` | Text | — |

**Méthode `action_notify_manually()`** : envoie WhatsApp au patient + `state → notified` + `whatsapp_sent = True`.

---

### 2.4 Wizard `dialysis.session.reschedule`

```python
_name = 'dialysis.session.reschedule'
_description = 'Reporter une séance de dialyse'
```

| Champ | Type | Description |
|---|---|---|
| `procedure_id` | Many2one → `acs.patient.procedure` | Séance à reporter |
| `original_date` | Date (readonly) | Date actuelle de la séance |
| `new_date` | Date | required — Nouvelle date souhaitée |
| `station_id` | Many2one → `acs.dialysis.station` | Pré-rempli depuis la procédure, modifiable |
| `slots_available` | Integer (computed, store=False) | Places libres sur le poste à new_date |
| `add_to_waitlist` | Boolean | Si saturé : inscrire en liste d'attente |

**`_compute_slots_available()`** :
```
schedule = station_id.schedule lié à new_date (jour de semaine)
occupés = count(acs.patient.procedure où station=station_id, date=new_date, state in scheduled/running)
max = schedule.max_patients (0 = illimité)
slots_available = max - occupés si max > 0 else 999
```

**`action_confirm()`** :
1. Si `slots_available > 0` :
   - `procedure.date = new_date`
   - Si `procedure.appointment_id` : `appointment.date = new_date`
   - Log chatter sur la procédure : "Séance reportée du [original_date] au [new_date]"
   - Déclenche `_check_waitlist_notification(station_id, original_date)` pour notifier la file sur le créneau libéré
2. Si saturé + `add_to_waitlist = True` :
   - Crée `acs.dialysis.waitlist` (patient, schedule_id déduit, request_date=today)
   - Affiche notification info : "Poste saturé. Patient ajouté en liste d'attente."
3. Si saturé + `add_to_waitlist = False` :
   - `raise UserError("Poste saturé pour cette date. Veuillez choisir une autre date ou activer la liste d'attente.")`

---

## 3. Logique de notification liste d'attente

**Méthode `_check_waitlist_notification(station_id, freed_date)` sur `acs.patient.procedure` :**

```
Trouver le schedule_id lié à station_id pour le jour de semaine de freed_date
Chercher acs.dialysis.waitlist :
    schedule_id = schedule trouvé
    state = 'waiting'
    order = request_date asc
Premier résultat → action_notify_manually()
```

Déclencheurs :
- Report de séance (wizard `action_confirm`)
- Passage d'une procédure à `absent` (via `action_confirm` sur l'absence)

---

## 4. WhatsApp de reprise

### 4.1 Cron quotidien

- **Nom :** `Dialyse — Rappel reprise après absence`
- **Heure :** 23h00 chaque jour
- **Modèle :** `acs.dialysis.absence`
- **Méthode :** `_cron_send_reprise_whatsapp()`

**Logique :**
```
absences = search([
    ('state', '=', 'confirmed'),
    ('end_date', '=', today + 1),
    ('whatsapp_reprise_sent', '=', False),
])
Pour chaque absence :
    prochaine_seance = acs.patient.procedure.search([
        ('patient_id', '=', absence.patient_id.id),
        ('state', '=', 'scheduled'),
        ('date', '>', today),
    ], order='date asc', limit=1)
    
    message = construire_message(absence.patient_id, prochaine_seance)
    envoyer via whatsapp.message (même pattern que appointment_reminder.py)
    absence.whatsapp_reprise_sent = True
```

### 4.2 Message WhatsApp

```
Bonjour {prénom},

Votre période d'absence se termine demain.
Votre prochaine séance de dialyse est prévue le {date} à {heure}.

À bientôt,
Clinique As-Shafi
```

Si aucune séance planifiée trouvée : message sans date de séance + log warning.

### 4.3 Bouton manuel

`action_close_and_notify()` sur `acs.dialysis.absence` (état `confirmed`) :
- Même envoi WhatsApp immédiat
- `state → closed`
- `whatsapp_reprise_sent = True`

---

## 5. Vues

### 5.1 Fiche `acs.dialysis.absence`

- Header : barre de statut `Brouillon | Confirmée | Clôturée`
- Boutons contextuels :
  - `draft` → `[Confirmer]`
  - `confirmed` → `[Clôturer + Notifier reprise]` + `[Annuler]`
- Onglet **Général** : patient, start_date, end_date, reason, notes
- Onglet **Séances concernées** : liste readonly `procedure_ids` (colonnes : date, poste, statut)

### 5.2 Liste absences (tree view)

Colonnes : Patient | Début | Fin | Raison | Statut | Nb séances

Filtres : `En cours` | `Clôturées` | `Décès` | `Ce mois`
Group by : Raison | Patient | Mois

### 5.3 Wizard de report

```
┌─────────────────────────────────────────────┐
│  Reporter la séance                          │
├──────────────────────┬──────────────────────┤
│ Date actuelle        │ Nouvelle date        │
│ [05/06/2026]         │ [__________]         │
├──────────────────────┼──────────────────────┤
│ Poste                │ Places disponibles   │
│ [Poste 3 - Salle B▼] │ [ 2 / 4 ]            │
└──────────────────────┴──────────────────────┘
  ☐ Si poste saturé, mettre en liste d'attente
  
              [Annuler]   [Confirmer le report]
└─────────────────────────────────────────────┘
```

`slots_available` se rafraîchit via `onchange('new_date', 'station_id')`.

### 5.4 Liste d'attente (tree view)

Colonnes : Patient | Planning | Créneau | Date demande | Statut

Bouton `[Notifier]` par ligne sur `state = 'waiting'`.

### 5.5 Menus

```
Dialyse (menu existant)
  └── Plannings
        ├── Absences patients       → acs.dialysis.absence (list + form)
        └── Liste d'attente         → acs.dialysis.waitlist (list)
```

Bouton `[Reporter]` ajouté sur vue form `acs.patient.procedure` (via `_inherit` de la vue).

---

## 6. Fichiers à créer / modifier

```
acs_hms_nephrology_dashboard/
├── models/
│   ├── dialysis_absence.py          ← nouveau : acs.dialysis.absence + extension procedure
│   ├── dialysis_waitlist.py         ← nouveau : acs.dialysis.waitlist
│   ├── dialysis_reschedule.py       ← nouveau : wizard dialysis.session.reschedule
│   └── __init__.py                  ← ajouter imports
├── views/
│   ├── dialysis_absence_views.xml   ← nouveau
│   ├── dialysis_waitlist_views.xml  ← nouveau
│   ├── dialysis_reschedule_views.xml ← nouveau (wizard)
│   └── procedure_views_ext.xml      ← nouveau : bouton [Reporter] sur acs.patient.procedure
├── data/
│   └── cron_reprise_whatsapp.xml    ← nouveau : ir.cron
└── __manifest__.py                  ← ajouter depends whatsapp + fichiers data/views
```

---

## 7. Décisions de design

| Décision | Choix | Raison |
|---|---|---|
| Statut séances absentes | Nouveau statut `absent` (option A) | Distinction clinique absent ≠ annulé, filtres dashboard |
| Report | Wizard dédié (option A) | UX guidée, validation poste avant confirmation |
| Granularité liste d'attente | Par `acs.nephrology.schedule` (option A) | Cohérent avec structure existante, évite notifications horaire incompatible |
| WhatsApp reprise | Cron J-1 + bouton manuel (option C) | Robustesse cron + flexibilité pour fins d'hospitalisation anticipées |
| Module cible | `acs_hms_nephrology_dashboard` (option C) | Co-localisation avec calendrier visuel 4.3 |
