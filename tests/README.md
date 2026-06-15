# Tests E2E — Modules Néphro Odoo 19

Suite de tests end-to-end Playwright pour les modules de néphrologie Odoo 19 (base de données : **asshafi**).
Les tests couvrent l'intégralité du parcours patient, de l'inscription jusqu'au paiement de la facture,
en passant par la consultation portail.

---

## Structure

```
tests/
  playwright.config.js          — Configuration Playwright (1 worker, séquentiel)
  state.json                    — État partagé entre les tests (IDs créés)
  README.md                     — Ce fichier
  helpers/
    api.js                      — Appels JSON-RPC Odoo (loginApi, rpcCall, apiCreate…)
    auth.js                     — Login/logout UI (loginUI, logoutUI)
    state.js                    — Lecture/écriture state.json (readState, updateState)
    screenshot.js               — Captures d'écran automatiques (snap)
  setup/
    00_setup.spec.js            — Création des utilisateurs et données de base
  process/
    01_inscription.spec.js      — Secrétaire : inscription patient
    02_liste_attente.spec.js    — Secrétaire : ajout liste d'attente
    03_rendez_vous.spec.js      — Secrétaire : création rendez-vous
    04_dossier_medical.spec.js  — Médecin : compléter le dossier
    05_hemodialyse.spec.js      — Médecin : prescription hémodialyse
    06_ordonnance.spec.js       — Médecin : ordonnance médicamenteuse
    07_bilan_pre.spec.js        — Médecin : bilan biologique pré-dialyse
    08_generation_seances.spec.js — Admin : génération des séances
    09_seance_dialyse.spec.js   — Infirmière : gestion complète de la séance
    10_dashboard_medecin.spec.js — Médecin : vérification KT/V sur dashboard
    11_bilan_post.spec.js       — Médecin : bilan post-dialyse
    12_facturation.spec.js      — Facturation : facture, validation, paiement
    13_portail_patient.spec.js  — Patient portail : consultation en ligne
  roles/
    secretaire.spec.js          — Toutes les actions de la secrétaire (tests 1-3)
    medecin.spec.js             — Toutes les actions du médecin (tests 4-7, 10-11)
    infirmiere.spec.js          — Toutes les actions de l'infirmière (test 9)
    facturation.spec.js         — Toutes les actions de facturation (test 12)
    patient_portail.spec.js     — Toutes les actions du patient portail (test 13)
  screenshots/                  — Captures automatiques (générées à l'exécution)
playwright-report/              — Rapport HTML interactif (généré après exécution)
```

---

## Prérequis

| Élément | Valeur |
|---------|--------|
| Node.js | >= 18 |
| Odoo 19 | Actif sur http://localhost:8069 |
| Base de données | asshafi |
| Compte admin | admin / admin |
| Modules installés | acs_hms_nephrology, acs_hms_nephrology_dashboard, acs_hms_nephrology_bilans, acs_hms_nephrology_billing, acs_hms_nephrology_portal |

---

## Installation

```bash
# Depuis le répertoire contenant les tests
cd "as shafi/tests"

# Initialiser le projet Node.js
npm init -y

# Installer Playwright
npm install @playwright/test

# Installer le navigateur Chromium
npx playwright install chromium
```

---

## Exécution

### Processus complet (dans l'ordre recommandé)

```bash
# 1. Setup : création des utilisateurs et de la config de base
npx playwright test setup/00_setup.spec.js

# 2. Processus complet, étape par étape
npx playwright test process/01_inscription.spec.js
npx playwright test process/02_liste_attente.spec.js
npx playwright test process/03_rendez_vous.spec.js
npx playwright test process/04_dossier_medical.spec.js
npx playwright test process/05_hemodialyse.spec.js
npx playwright test process/06_ordonnance.spec.js
npx playwright test process/07_bilan_pre.spec.js
npx playwright test process/08_generation_seances.spec.js
npx playwright test process/09_seance_dialyse.spec.js
npx playwright test process/10_dashboard_medecin.spec.js
npx playwright test process/11_bilan_post.spec.js
npx playwright test process/12_facturation.spec.js
npx playwright test process/13_portail_patient.spec.js

# Ou en une seule commande (setup puis processus)
npx playwright test setup/ process/ --reporter=html
```

### Par rôle (fichiers standalone)

Ces fichiers peuvent être exécutés indépendamment tant que `state.json` contient
les données de configuration (peuplé par `00_setup.spec.js`).

```bash
# Rôle secrétaire : inscription, liste d'attente, rendez-vous
npx playwright test roles/secretaire.spec.js

# Rôle médecin : dossier, hémodialyse, ordonnance, bilans, dashboard
npx playwright test roles/medecin.spec.js

# Rôle infirmière : gestion complète de la séance de dialyse
npx playwright test roles/infirmiere.spec.js

# Rôle facturation : création, validation et paiement de la facture
npx playwright test roles/facturation.spec.js

# Rôle patient portail : consultation des résultats en ligne
npx playwright test roles/patient_portail.spec.js

# Tous les rôles d'un coup
npx playwright test roles/ --reporter=html
```

### Voir le rapport HTML

```bash
npx playwright show-report ../playwright-report
```

### Mode débogage (interface visible, pause sur erreur)

```bash
npx playwright test roles/infirmiere.spec.js --headed --debug
```

### Mode trace (pour analyse post-mortem)

```bash
npx playwright test roles/ --trace on
npx playwright show-trace test-results/*/trace.zip
```

---

## Utilisateurs créés par le setup

| Rôle | Login | Mot de passe | Groupes Odoo |
|------|-------|-------------|--------------|
| Secrétaire | secretaire@nephro.test | Nephro2024! | group_hms_receptionist |
| Médecin | medecin@nephro.test | Nephro2024! | group_hms_doctor |
| Infirmière | infirmiere@nephro.test | Nephro2024! | group_hms_nurse |
| Facturation | facturation@nephro.test | Nephro2024! | account.group_account_invoice |
| Patient portail | patient@nephro.test | Nephro2024! | base.group_portal |

---

## Données créées par le setup

| Donnée | Valeur dans les tests |
|--------|-----------------------|
| Station de dialyse | Poste E2E-01 |
| Planning | Planning E2E (tous les jours) |
| Accès vasculaire | FAV (Fistule artério-veineuse) |
| Dialyseur | Fresenius FX80 |
| Dialysat | Dialysat Bicarbonate Standard |
| Règle tarifaire | Tarif Standard E2E (15 000 FCFA) |
| Patient test | Khadija Diallo Rôle |

---

## Structure de state.json

Le fichier `state.json` est le bus de données entre tous les tests. Il est créé
par `00_setup.spec.js` et enrichi progressivement par chaque spec.

```json
{
  "users": {
    "secretary":      42,
    "doctor":         43,
    "nurse":          44,
    "billing":        45,
    "patient_portal": 46
  },
  "config": {
    "station_id":          10,
    "schedule_id":         5,
    "vascular_access_id":  3,
    "dialyzer_id":         7,
    "dialysate_id":        4,
    "pricing_rule_id":     2,
    "department_id":       8,
    "product_id":          120,
    "appointment_type_id": null
  },
  "patient_id":             100,
  "partner_id":             200,
  "appointment_id":         15,
  "waiting_list_entry_id":  6,
  "procedure_id":           300,
  "prescription_id":        50,
  "bilan_pre_id":           25,
  "bilan_post_id":          26,
  "complication_id":        12,
  "invoice_id":             75,
  "payment_id":             30
}
```

Pour repartir de zéro (nouvelle exécution complète) :

```bash
rm tests/state.json
npx playwright test setup/ process/ --reporter=html
```

---

## Notes importantes

### Idempotence

Les tests sont conçus pour être idempotents : si un enregistrement existe déjà
dans Odoo (détecté via API), le test le réutilise au lieu d'en créer un nouveau.
Cela permet de relancer un test échoué sans polluer la base de données.

### Pas de nettoyage automatique

Les tests ne suppriment **pas** les données après exécution. Cela est intentionnel :
les données créées reflètent un vrai parcours patient et peuvent être inspectées
dans l'interface Odoo après les tests.

### Captures d'écran

Toutes les captures sont dans `tests/screenshots/`. Elles sont nommées avec un
compteur auto-incrémenté (`NNN_nom_etape.png`) pour garantir l'ordre chronologique.

Les screenshots de la suite `roles/` utilisent des préfixes identiques aux
specs `process/` pour faciliter la comparaison :

| Spec rôle | Préfixe screenshot |
|-----------|--------------------|
| secretaire.spec.js | 01_, 02_, 03_ |
| medecin.spec.js | 04_, 05_, 06_, 07_, 10_, 11_ |
| infirmiere.spec.js | 09_ |
| facturation.spec.js | 12_ |
| patient_portail.spec.js | 13_ |

### Gestion des erreurs

Les tests utilisent des stratégies défensives :
- Tentative via URL directe, puis fallback via le menu Odoo
- Création via API si l'UI ne répond pas
- `console.warn` pour les problèmes non bloquants
- `test.skip` si les prérequis (IDs dans state.json) sont absents

### Timeouts configurés

| Type | Valeur |
|------|--------|
| Timeout global par test | 90 secondes |
| Timeout action UI | 20 secondes |
| Timeout navigation | 45 secondes |

### Workers

L'exécution est **séquentielle** (`workers: 1`) car les tests partagent un état
via `state.json` et la même base de données Odoo. L'exécution parallèle
provoquerait des conflits d'IDs et des états incohérents.

---

## Dépannage

### Le test échoue avec "patient_id absent du state.json"

Exécuter d'abord `00_setup.spec.js` puis `secretaire.spec.js` (ou
`roles/secretaire.spec.js`) pour créer le patient et peupler `state.json`.

### Le dashboard infirmière ne s'affiche pas

Le dashboard est une SPA OWL. Si Odoo est lent au démarrage, augmenter le
timeout dans `playwright.config.js` (`timeout: 120000`) ou ajouter une pause
après navigation :

```js
await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000); // Laisser OWL s'initialiser
```

### Le patient portail reçoit "Access Denied"

Le compte `patient@nephro.test` doit être invité sur le portail Odoo. Via
l'interface admin : Contacts → patient → Accorder l'accès portail.
Ou via API dans `00_setup.spec.js` (groupe `base.group_portal`).

### La facture ne se crée pas (action_create_nephro_invoice échoue)

Vérifier :
1. La séance (`procedure_id`) est en état `done`
2. Une règle tarifaire (`acs.dialysis.pricing.rule`) est active pour le patient
3. L'option "Facturation automatique" (`nephro_auto_invoice`) dans les paramètres
   de l'entreprise

---

## Architecture des helpers

### helpers/api.js

Communication JSON-RPC avec Odoo sans navigateur. Utilise le contexte `request`
de Playwright (APIRequestContext). Fonctions exportées :

- `loginApi(request, login, password)` → `uid`
- `rpcCall(request, model, method, args, kwargs)` → `result`
- `apiCreate(request, model, values)` → `id`
- `apiWrite(request, model, ids, values)` → `boolean`
- `apiSearchRead(request, model, domain, fields, limit)` → `records[]`
- `apiRead(request, model, ids, fields)` → `records[]`
- `apiGetXmlId(request, xmlId)` → `res_id`
- `apiFindOrCreate(request, model, searchDomain, createVals)` → `id`

### helpers/auth.js

- `loginUI(page, login, password)` — connexion via l'interface Odoo
- `logoutUI(page)` — déconnexion via `/web/session/logout`

### helpers/state.js

- `readState()` — lit `state.json`, retourne l'état par défaut si absent
- `updateState(patch)` — fusionne le patch dans l'état courant et sauvegarde
- `writeState(data)` — écrase complètement `state.json`

### helpers/screenshot.js

- `snap(page, stepName)` — capture et sauvegarde dans `screenshots/NNN_stepName.png`
