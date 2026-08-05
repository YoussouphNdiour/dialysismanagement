# Spec : Simplification des workflows néphro + Tests Playwright par rôle

**Date** : 2026-08-05
**Branche** : `feat/champs-cliniques-manquants` (ou nouvelle branche dédiée)
**Approche** : Simplification d'abord, tests Playwright ensuite (Approche A)

---

## 1. Contexte

Le système HMS néphro (Odoo 19) contient des workflows hérités du HMS généraliste qui ne correspondent pas à la réalité d'un centre de dialyse :
- Workflow RDV en 7 états conçu pour des consultations ambulatoires
- Lien automatique RDV ↔ séance qui crée des doublons inutiles
- Couche "Traitement" inutile pour la dialyse chronique
- Données labo dupliquées entre évaluations et bilans néphro
- Code mort et privilèges orphelins

L'objectif est de simplifier le système puis de verrouiller le résultat avec des tests E2E Playwright couvrant chaque rôle utilisateur.

---

## 2. Simplifications (Phase 1)

### 2.1 — Réduire les états RDV de 7 à 4

**Actuel** : draft → confirm → waiting → in_consultation → pause → to_invoice → done (+ cancel)
**Cible** : draft → confirmed → done → cancel

- Supprimer les boutons "Salle d'attente", "Pause", "En consultation" des form views
- Supprimer les champs `waiting_duration_timer`, `pause_date_start`, `pause_date_end` des vues (conserver en base)
- Migration des données existantes :
  - `waiting`, `in_consultation`, `pause` → `confirmed`
  - `to_invoice` → `done`

### 2.2 — Supprimer `acs.pain.level`

- Supprimer le TransientModel vide et ses vues/actions associées
- Aucune dépendance fonctionnelle identifiée

### 2.3 — Consolider les données labo

- `acs.nephro.bilan` est la source unique pour les bilans biologiques
- Supprimer les champs hématologie dupliqués (gb, hb, vgm...) des vues `acs.patient.evaluation` en contexte néphro
- Conserver les champs en base pour ne pas casser les données existantes
- L'UI redirige vers les bilans néphro pour toute saisie labo

### 2.4 — Supprimer le privilège "rdv infirmier"

- Retirer le groupe `privilege_acs_hms_nurse_appointment` des définitions de sécurité
- Aucun menu ni vue n'en dépend

### 2.5 — Découpler RDV et séance dialyse

- Supprimer la création automatique de RDV quand le `session_generator` ou le `treatment` génère des séances
- Le planning dialyse repose uniquement sur les séances (`acs.patient.procedure`)
- Le menu RDV reste accessible pour les consultations ponctuelles (première consultation néphro, suivi, urgence)

### 2.6 — Supprimer la couche Traitement pour la dialyse

- Le `session_generator` travaille directement depuis le patient et son planning dialyse, sans passer par `hms.treatment`
- Le modèle `hms.treatment` reste disponible pour d'éventuels usages non-dialyse
- Les traitements existants ne sont pas supprimés mais ne sont plus nécessaires pour générer des séances

### 2.7 — Désactiver les Évaluations en contexte néphro

- Les constantes vitales (TA, poids, pouls) sont saisies uniquement sur la séance de dialyse
- Masquer/désactiver le menu Évaluations en contexte néphro
- Le modèle `acs.patient.evaluation` reste disponible pour d'autres spécialités

### 2.8 — Adapter la reprogrammation aux séances

- Adapter le wizard existant `acs.reschedule.appointments` pour cibler `acs.patient.procedure` au lieu de `hms.appointment`
- Renommer en `acs.reschedule.sessions` pour refléter le changement
- Conserver la même logique (décaler de N heures) appliquée aux séances sélectionnées

### 2.9 — Accès médecin au menu Clinique

- Ajouter `group_hms_doctor` aux `groups` du menu racine "Clinique" (actuellement `group_hms_manager` uniquement)

---

## 3. Tests Playwright (Phase 2)

### 3.1 — Infrastructure

**Config** : réutiliser `tests/playwright.config.js` existant (baseURL=localhost:8069, 1 worker, séquentiel)

**Structure des fichiers** :

```
tests/
├── playwright.config.js          (existant)
├── helpers/
│   └── login.js                  (helper partagé : login par rôle)
├── roles/
│   ├── 01_secretaire.spec.js
│   ├── 02_medecin.spec.js
│   ├── 03_infirmiere.spec.js
│   ├── 04_facturation.spec.js
│   └── 05_patient_portal.spec.js
```

**Helper `login.js`** : fonction `loginAs(page, role)` qui :
1. Navigue vers `/web/login`
2. Remplit login/mot de passe selon le rôle
3. Attend le chargement complet de l'interface

Credentials (tous avec mot de passe `Nephro2024!`) :

| Rôle | Login | Redirection attendue |
|------|-------|---------------------|
| Secrétaire | secretaire@nephro.test | Liste patients |
| Médecin | medecin@nephro.test | Liste patients |
| Infirmière | infirmiere@nephro.test | Dashboard infirmier |
| Facturation | facturation@nephro.test | Factures dialyse |
| Patient | patient@nephro.test | Portail /my |

### 3.2 — Tests par rôle

#### 01 — Secrétaire (`secretaire@nephro.test`)

**Accès positifs** :
- Se connecte → redirigée vers la liste patients
- Voit le menu Néphrologie
- Voit le menu Clinique
- Voit le menu Facturation Dialyse

**Accès négatifs** :
- Ne voit PAS le menu Configuration

**Parcours métier** :
- Crée un patient → vérifie qu'il apparaît dans la liste
- Crée un RDV consultation → vérifie état draft → confirme → vérifie état confirmed
- Lance la facturation en lot → sélectionne une période → génère les factures
- Exporte en Excel

#### 02 — Médecin (`medecin@nephro.test`)

**Accès positifs** :
- Se connecte → redirigé vers la liste patients
- Voit le menu Néphrologie
- Voit le menu Clinique
- Accède aux bilans biologiques

**Accès négatifs** :
- Ne voit PAS le menu Configuration
- Ne voit PAS le menu Facturation Dialyse

**Parcours métier** :
- Ouvre un patient → crée une ordonnance → valide
- Ouvre une séance → saisit les paramètres néphro → termine la séance (done)
- Consulte les bilans biologiques d'un patient

#### 03 — Infirmière (`infirmiere@nephro.test`)

**Accès positifs** :
- Se connecte → arrive sur le dashboard infirmier
- Accède aux bilans biologiques

**Accès négatifs** :
- Ne voit PAS le menu Facturation Dialyse
- Ne voit PAS le menu Configuration

**Parcours métier** :
- Ouvre une séance planifiée → démarre (running) → saisit les constantes → termine (done)
- Accède aux bilans biologiques d'un patient

#### 04 — Facturation (`facturation@nephro.test`)

**Accès positifs** :
- Se connecte → redirigée vers les factures dialyse
- Voit le menu Facturation Dialyse

**Accès négatifs** :
- Ne voit PAS le menu Clinique
- Ne voit PAS le menu Ordonnances

**Parcours métier** :
- Lance la facturation en lot → sélectionne une période → génère les factures
- Exporte en Excel

#### 05 — Patient portail (`patient@nephro.test`)

**Accès positifs** :
- Se connecte via `/web/login` → redirigé vers `/my`
- Voit son historique de séances de dialyse
- Voit ses bilans (sparklines KT/V, hémoglobine, potassium, phosphore)

**Accès négatifs** :
- Ne peut PAS accéder à `/web` (backend Odoo)

**Parcours métier** :
- Navigue dans l'historique des séances
- Consulte les graphiques de suivi biologique

---

## 4. Matrice d'accès menus (résumé)

| Menu | Secrétaire | Médecin | Infirmière | Facturation | Patient |
|------|:----------:|:-------:|:----------:|:-----------:|:-------:|
| Néphrologie | ✅ | ✅ | ✅ | ❌ | ❌ |
| Clinique | ✅ | ✅ | ❌ | ❌ | ❌ |
| Facturation Dialyse | ✅ | ❌ | ❌ | ✅ | ❌ |
| Ordonnances | ❌ | ✅ | ❌ | ❌ | ❌ |
| Bilans biologiques | ❌ | ✅ | ✅ | ❌ | ❌ |
| Configuration | ❌ | ❌ | ❌ | ❌ | ❌ |
| Portail /my | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 5. Prérequis d'exécution

- Odoo 19 démarré en local sur `localhost:8069`
- Base de données `asshafi` avec les 5 utilisateurs de test
- Au moins 1 patient existant avec des séances et bilans
- Node.js + Playwright installés (`npx playwright install`)

---

## 6. Ordre d'implémentation

1. **Phase 1** : Simplifications (points 2.1 à 2.9)
   - Modifier les modèles, vues, sécurité
   - Migrer les données existantes
   - Tester manuellement chaque changement
2. **Phase 2** : Tests Playwright (point 3)
   - Créer le helper de login
   - Écrire les 5 fichiers de tests par rôle
   - Exécuter et corriger jusqu'au vert
