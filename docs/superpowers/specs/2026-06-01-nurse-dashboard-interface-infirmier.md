# Interface Infirmier Tablette — Design Spec

**Date :** 2026-06-01
**Sprint :** Sprint 2 — Section 5
**Module :** `acs_hms_nephrology_dashboard` (nouveau)
**Dépendances :** `acs_hms_nephrology`, `acs_hms_nephrology_complications`

---

## 1. Contexte

L'interface infirmier tablette est la pièce cliniquement la plus urgente du Sprint 2. Les infirmiers l'utilisent pendant chaque séance d'hémodialyse pour :

- Consulter la liste des patients du jour filtrée sur leur poste
- Saisir les signes vitaux (6 mesures) avec détection automatique d'hypotension
- Signaler des complications en temps réel
- Valider la fin de séance (poids sortie, tolérance, KT/V calculé)

Elle consomme exactement ce qui a été construit en Sprint 1 (section 3.1) : champs pré/post-dialyse sur `acs.patient.procedure`, signes vitaux étendus sur `hemodialysis.vital.sign`, banner hypotension `has_active_hypotension`, et complications `acs.dialysis.complication`.

Ce module crée également `acs_hms_nephrology_dashboard`, le conteneur qui accueillera ensuite le dashboard médecin (section 6) et la vue calendrier OWL (section 4.3).

---

## 2. Architecture générale

### 2.1 Approche retenue

**OWL Client Action (`ir.actions.client`)** montée dans le shell Odoo standard. L'infirmier accède à l'interface depuis le menu Odoo → Néphrologie → Interface Infirmier. URL : `odoo/dialyse-infirmier`.

Avantages : authentification Odoo unifiée, pas de scaffolding custom, intégration naturelle avec les droits existants.

### 2.2 Structure du module

```
acs_hms_nephrology_dashboard/
├── __manifest__.py
├── __init__.py
├── models/
│   └── __init__.py
├── static/
│   └── src/
│       ├── components/
│       │   └── nurse_dashboard/
│       │       ├── NurseDashboard.js
│       │       ├── NurseDashboard.xml
│       │       ├── NursePatientList.js
│       │       ├── NursePatientList.xml
│       │       ├── NurseSessionForm.js
│       │       ├── NurseSessionForm.xml
│       │       ├── NurseComplicationPopup.js
│       │       ├── NurseComplicationPopup.xml
│       │       ├── NurseEndSession.js
│       │       └── NurseEndSession.xml
│       └── nurse_dashboard.js
└── views/
    └── nurse_dashboard_action.xml
```

### 2.3 Dépendances

```python
'depends': ['acs_hms_nephrology', 'acs_hms_nephrology_complications']
```

Pas de nouveaux modèles Python — toutes les lectures/écritures se font via RPC OWL vers les modèles existants.

---

## 3. Architecture des données

### 3.1 Modèles utilisés (lecture/écriture)

| Modèle | Opérations | Écran |
|---|---|---|
| `acs.patient.procedure` | read (liste + détail), write (fin séance) | 1, 2, 4 |
| `hemodialysis.vital.sign` | create | 2 |
| `acs.dialysis.complication` | create | 3 |
| `acs.nephrology.schedule` | read (filtre infirmier, sélecteur) | 1 |

### 3.2 Filtre "patients du jour"

Domaine de base :
```python
[
    ('department_id.department_type', '=', 'nephrology'),
    ('date', '>=', today_start),
    ('date', '<=', today_end),
]
```

Filtre infirmier (appliqué si des plannings sont trouvés pour l'utilisateur connecté aujourd'hui) :
```python
('nephrology_schedule_ids.nurse_ids', 'in', [uid])
```

Plannings "actifs aujourd'hui" = plannings dont le booléen du jour courant (monday/tuesday/…) est True.

**État vide :** Si aucun planning ne contient l'infirmier connecté → message "Aucun poste assigné aujourd'hui" + sélecteur manuel actif.

### 3.3 Champs lus sur la procédure (`PROCEDURE_FIELDS`)

```js
const PROCEDURE_FIELDS = [
    'id', 'name', 'patient_id', 'state', 'date', 'date_stop',
    'department_id', 'nephrology_schedule_ids',
    // Pré-dialyse
    'arrival_status', 'pre_dialysis_bp', 'arrival_weight', 'dry_weight',
    'interdialysis_increase',
    // Signes vitaux
    'vital_sign_ids', 'has_active_hypotension',
    // Fin de séance
    'departure_weight', 'actual_uf', 'actual_duration',
    'global_tolerance', 'end_notes',
    'urea_pre', 'urea_post',
    'ktv_calculated', 'ktv_status', 'urr_calculated',
];
```

---

## 4. Machine à états OWL

### 4.1 État racine (`NurseDashboard`)

```js
this.state = useState({
    screen: 'list',       // 'list' | 'session' | 'end'
    procedureId: null,    // id de la procédure active
    procedure: null,      // objet rechargé depuis serveur
    scheduleId: null,     // planning sélectionné manuellement
    procedures: [],       // liste patients du jour
});

this.timer = useState({
    secondsLeft: 1800,    // 30 min
    isRinging: false,     // bannière orange active
});
```

### 4.2 Graphe de transitions

```
[list]
  → sélectionner procédure → [session]
    (state.procedureId = id, démarre timer)

[session]
  → [Terminer la séance]  → [end]
  → [← Retour liste]      → [list]    (timer continue, procedureId conservé)
  → [Signaler complication] → popup overlay (reste sur [session])

[end]
  → [VALIDER LA SÉANCE] → write() → reload → [list]
    (procedureId = null, timer reset à 1800)
  → [← Retour]          → [session]
```

### 4.3 Timer 30 min

Monté dans `NurseDashboard.setup()` via `useEffect` réactif sur `screen` :

```js
useEffect(() => {
    if (this.state.screen !== 'session') return;
    const id = setInterval(() => {
        if (this.timer.secondsLeft > 0) {
            this.timer.secondsLeft -= 1;
        } else {
            this.timer.isRinging = true;
        }
    }, 1000);
    return () => clearInterval(id);
}, () => [this.state.screen]);
```

Reset manuel : bouton "✓ Compris" dans la bannière → `timer.secondsLeft = 1800; timer.isRinging = false`.

Le timer ne s'arrête pas si l'infirmier revient à la liste. La bannière orange n'est rendue que dans `NurseSessionForm`.

### 4.4 Rechargement procédure

Après chaque write serveur, `NurseDashboard` relit la procédure via :

```js
async _reloadProcedure() {
    const [rec] = await this.orm.read(
        'acs.patient.procedure',
        [this.state.procedureId],
        PROCEDURE_FIELDS
    );
    this.state.procedure = rec;
}
```

---

## 5. Écrans — Design détaillé

### 5.1 Écran 1 — Liste patients du jour (`NursePatientList`)

**Props reçus :** `procedures`, `scheduleId`, `onSelectProcedure(id)`, `onScheduleChange(id)`, `schedules`

**Header :**
- Titre : "Patients du jour — [date formatée]"
- Sélecteur planning : `<select>` listant `acs.nephrology.schedule` actifs aujourd'hui (trié par `name`). Valeur initiale = planning de l'infirmier si trouvé, sinon vide.
- Badge : "[N] patients"

**Tableau :**

| Colonne | Source |
|---|---|
| Poste | `procedure.nephrology_schedule_ids[0].station_id.name` |
| Patient | `procedure.patient_id[1]` |
| Heure prévue | `procedure.date` (heure seulement) |
| Statut | badge coloré dérivé de `procedure.state` |
| Actions | boutons contextuels |

**Statuts et couleurs :**
- `draft` → "En attente" (gris) → bouton `[Démarrer]`
- `in_progress` → "En cours" (vert) → bouton `[Reprendre]`
- `done` → "Terminé" (bleu) → bouton `[Voir]` (lecture seule)
- `cancel` → "Absent" (rouge) → pas de bouton

**Action `[Absent]`** : inline dans chaque ligne → `write({state: 'cancel'})` directement, recharge la liste.

**État vide (aucun planning assigné) :**
```
Aucun poste assigné aujourd'hui.
Sélectionnez un planning manuellement ci-dessus pour voir les patients.
```

---

### 5.2 Écran 2 — Séance en cours (`NurseSessionForm`)

**Props reçus :** `procedure`, `timer`, `onTimerReset()`, `onSaveVitals(vals)`, `onOpenComplication()`, `onEndSession()`, `onBack()`

**Header sticky :**
- Nom patient (grand, lisible à distance)
- Poste
- Chronomètre : `MM:SS` en décompte. Fond orange + animation pulse si `timer.isRinging`.

**Bannière HYPOTENSION** (rouge, pleine largeur) :
- Visible si `procedure.has_active_hypotension`
- Texte : "⚠ HYPOTENSION DÉTECTÉE — TA systolique < 90 mmHg"
- Rechargée après chaque save de signes vitaux

**Bannière RAPPEL VITAUX** (orange, pleine largeur) :
- Visible si `timer.isRinging`
- Texte : "⏰ Rappel : saisir les signes vitaux"
- Bouton `[✓ Compris]` → `onTimerReset()`

**Bloc informations pré-dialyse (lecture seule) :**
- TA pré : `pre_dialysis_bp` | Statut arrivée : `arrival_status`
- Poids arrivée : `arrival_weight` kg | Prise interdialytique : `interdialysis_increase` kg

**Bloc saisie signes vitaux (formulaire inline) :**
- `blood_pressure` (Char, placeholder "120/80")
- `heart_rate` (Integer, placeholder "bpm")
- `respiratory_rate` (Integer, placeholder "/min")
- `spo2` (Float, placeholder "%")
- `temperature` (Float, placeholder "°C")
- `glycemia` (Float, placeholder "g/L", optionnel)
- Bouton `[Enregistrer les signes vitaux]` → create `hemodialysis.vital.sign` → `_reloadProcedure()`

**Historique signes vitaux** (tableau lecture seule, sous le formulaire) :
Colonnes : Heure / TA / FC / SpO2 / Temp / Glycémie / Hypotension (badge rouge si vrai)

**Actions footer :**
- `[Signaler une complication]` (orange) → ouvre `NurseComplicationPopup`
- `[Terminer la séance]` (vert) → transition vers Écran 4
- `[← Retour liste]` (lien texte) → transition vers Écran 1

---

### 5.3 Écran 3 — Popup complication (`NurseComplicationPopup`)

**Rendu :** overlay modale par-dessus `NurseSessionForm` (z-index élevé, backdrop semi-transparent).

**Props reçus :** `procedureId`, `onSave(vals)`, `onCancel()`

**Sélection type** (boutons tactiles larges, grille 2 colonnes) :
- Hypotension / Crampes / Nausées-Vomissements / Douleur thoracique
- Fièvre / Prurit / Arrêt prématuré / Autre

**Champs :**
- `occurrence_time` : DateTime, pré-rempli `Date.now()`, éditable
- `bp_at_occurrence` : Char (placeholder "120/80")
- `action_taken` : Textarea (placeholder "Action prise...")
- `resolution` : 3 boutons radio visuels — Oui / Non / Partielle

**Actions :**
- `[Enregistrer]` → create `acs.dialysis.complication` → `onSave()` → ferme popup
- `[Annuler]` → `onCancel()` → ferme sans sauvegarder

Validation : `complication_type` requis avant enregistrement.

---

### 5.4 Écran 4 — Fin de séance (`NurseEndSession`)

**Props reçus :** `procedure`, `onValidate(vals)`, `onBack()`

**Résumé lecture seule (haut de page) :**
- Durée calculée (depuis `date`/`date_stop`)
- UF prévue (depuis `uf_habituelle`)
- Complications enregistrées : liste des types, ou "Aucune"

**Champs à saisir :**
- `departure_weight` (Float, requis) → affichage temps réel de `actual_uf` calculé localement : `(arrival_weight - departure_weight) * 1000` ml
- `actual_duration` (Float, optionnel — override si différent de la durée calculée)
- `global_tolerance` : 3 boutons visuels — Bonne (vert) / Moyenne (orange) / Mauvaise (rouge)
- `end_notes` : Textarea

**KT/V et URR :** affichés après `[VALIDER LA SÉANCE]` (computed serveur relus). Badge vert "Adéquat ≥ 1.2" ou rouge "Insuffisant < 1.2".

**Actions :**
- `[VALIDER LA SÉANCE]` (grand bouton) → write procédure → `_reloadProcedure()` → affiche résumé KT/V 2 secondes → transition vers Écran 1, timer reset
- `[← Retour séance]` → retour Écran 2

---

## 6. Sécurité

### 6.1 Groupes autorisés

Accès menu et action client restreints à :
- `acs_hms.group_hms_nurse`
- `acs_hms_base.group_hms_manager`
- `acs_hms_nephrology.group_hms_nephrology_user`

### 6.2 ACL — vérifications préalables à l'implémentation

Avant de démarrer, vérifier dans `acs_hms` que `group_hms_nurse` a `perm_write=1` sur `acs.patient.procedure`. Si manquant, ajouter dans `ir.model.access.csv` du module dashboard :

```
access_acs_patient_procedure_nurse_dashboard,acs.patient.procedure nurse dashboard,model_acs_patient_procedure,acs_hms.group_hms_nurse,1,1,0,0
```

`hemodialysis.vital.sign` : déjà couvert (`access_hemodialysis_vital_sign_nurse` ✅ dans `acs_hms_nephrology`).

`acs.dialysis.complication` : vérifier dans `acs_hms_nephrology_complications`.

### 6.3 Menu item XML

```xml
<menuitem
    id="menu_nurse_dashboard"
    name="Interface Infirmier"
    action="action_nurse_dashboard"
    parent="acs_hms_nephrology.menu_nephrology"
    groups="acs_hms.group_hms_nurse,acs_hms_base.group_hms_manager"
    sequence="5"/>
```

---

## 7. Hors scope (v1)

- Son et vibration natifs sur tablette (remplacés par timer visuel + bannière clignotante)
- Persistance du timer après rechargement de page (état purement client)
- Modification/suppression des signes vitaux depuis l'interface infirmier (lecture seule une fois sauvegardés)
- Alertes temps réel vers le dashboard médecin (Bus Odoo — réservé section 6)
- Vue calendrier OWL (réservé section 4.3)

---

## 8. Ordre d'implémentation recommandé

1. Scaffolding module (`__manifest__.py`, `__init__.py`, bundle JS, action XML, menu)
2. `NurseDashboard` racine — machine à états + timer + `_reloadProcedure()`
3. `NursePatientList` — liste filtrée + sélecteur planning
4. `NurseSessionForm` — saisie signes vitaux + bannières
5. `NurseComplicationPopup` — popup overlay
6. `NurseEndSession` — fin de séance + validation KT/V
7. ACL vérification/ajout `ir.model.access.csv`
8. Tests (chaque composant OWL via `QUnit` ou `hoot`, logique Python via `TransactionCase`)
