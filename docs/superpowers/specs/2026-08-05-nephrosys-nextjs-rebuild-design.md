# NephroSys — Spec de design : Rebuild Next.js

> **Projet :** Reconstruction du module de gestion de nephrologie (actuellement Odoo 19 HMS) en application web moderne standalone.

**Date :** 2026-08-05
**Statut :** Validee

---

## 1. Objectif

Construire un MVP fonctionnel de gestion de nephrologie couvrant :
- Seances de dialyse (cycle complet : planifiee -> en cours -> terminee)
- Planning hebdomadaire par poste de dialyse
- Bilans biologiques complets (hematologie, electrolytes, serologies, etc.)
- Facturation des seances
- 6 roles utilisateur des le jour 1

Le tout avec un **design hybride moderne** : fond clair/sombre, sidebar, cartes arrondies, micro-animations, badges colores pour les statuts cliniques.

---

## 2. Decisions techniques

| Decision | Choix | Justification |
|----------|-------|---------------|
| Architecture | Monolithe Next.js 15 App Router | Un seul deploiement, types partages bout en bout |
| API | tRPC v11 | Type-safe RPC, SSE natif |
| ORM | Drizzle ORM | Queries type-safe, migrations SQL |
| Base de donnees | PostgreSQL 16 | Robuste, JSON, full-text search |
| Auth | Auth.js v5 (Credentials) | Self-hosted, donnees medicales sensibles |
| Styling | Tailwind CSS v4 | Utility-first, mode sombre natif |
| Tests unitaires | Vitest | Rapide, compatible ESM |
| Tests E2E | Playwright | Multi-navigateur, tablette |
| Deploiement | VPS + Docker Compose | Simple, controlable, economique |
| Langue | Francais uniquement | Contexte medical senegalais |
| Temps reel | SSE (Server-Sent Events) | Notifications legeres sans WebSocket |
| Devices | Desktop + tablette | Infirmieres en salle de dialyse |
| Migration donnees | Differee (V2) | MVP d'abord |

---

## 3. Modele de donnees

### 3.1. Table `users`

| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | PK |
| email | varchar | Unique |
| password_hash | varchar | Bcrypt 12 rounds |
| role | enum | `admin`, `secretaire`, `medecin`, `infirmiere`, `facturation`, `patient` |
| nom | varchar | Nom de famille |
| prenom | varchar | Prenom |
| is_active | boolean | Compte actif |
| created_at | timestamp | Date creation |
| updated_at | timestamp | Derniere modification |

### 3.2. Table `patients`

| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | PK |
| user_id | uuid? | FK users (lien portail, optionnel) |
| nom | varchar | Nom |
| prenom | varchar | Prenom |
| date_naissance | date | |
| sexe | enum | M / F |
| telephone | varchar | |
| groupe_sanguin | varchar | |
| taille_cm | decimal | |
| poids_sec_kg | decimal | Poids sec de reference |
| nephropathie | text | Diagnostic nephropathie |
| date_premiere_dialyse | date | |
| medecin_ref_id | uuid | FK users (medecin referent) |
| statut | enum | `actif`, `inactif`, `transfere`, `decede` |
| created_at | timestamp | |
| updated_at | timestamp | |

### 3.3. Table `plannings`

| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | PK |
| nom | varchar | Libelle du creneau |
| jour_semaine | integer | 0 (lundi) a 6 (dimanche) |
| heure_debut | time | |
| heure_fin | time | |
| poste_dialyse | varchar | Identifiant du poste |
| patient_id | uuid | FK patients |
| medecin_id | uuid | FK users |
| infirmier_id | uuid | FK users |
| recurrence | varchar | Frequence (ex: hebdomadaire) |
| is_active | boolean | |
| created_at | timestamp | |

### 3.4. Table `dialysis_sessions`

#### Pre-dialyse / Arrivee

| Champ | Type |
|-------|------|
| id | uuid PK |
| patient_id | uuid FK |
| planning_id | uuid FK |
| physician_id | uuid FK |
| nurse_id | uuid FK |
| date_seance | date |
| dialysis_number | integer |
| arrival_status | enum (stable/malade/urgence) |
| arrival_weight | decimal |
| dry_weight | decimal |
| interdialysis_increase | decimal (calcule) |
| ta_pre_dialyse | varchar |
| ta_debout | varchar |
| ta_coucher | varchar |
| temperature_pre | decimal |

#### Parametres machine / Dialysat

| Champ | Type |
|-------|------|
| poste_dialyse | varchar |
| type_dialyse | enum (HD/HDF/DP) |
| dialyzer_type | varchar (rein artificiel) |
| type_abord_vasculaire | varchar |
| debit_sang | decimal (ml/min) |
| debit_dialysat | decimal (ml/min) |
| uf_prescrite | decimal |
| uf_max | decimal |
| duree_prescrite | integer (minutes) |
| conductivite | decimal (mS/cm) |
| bain_calcium | decimal |
| bain_potassium | decimal |
| bain_glucose | decimal |
| bain_sodium | varchar |
| temperature_bain | decimal |
| bicarbonate | text |
| anticoagulation | text |
| aiguille_arterielle | varchar |
| aiguille_veineuse | varchar |
| ponction | varchar |
| pression_arterielle | varchar |
| pression_veineuse | varchar |
| ptm | varchar |

#### Fin de seance

| Champ | Type |
|-------|------|
| departure_weight | decimal |
| uf_reelle | decimal |
| duree_reelle | integer (minutes) |
| tolerance_globale | enum (bonne/moyenne/mauvaise) |
| aspect_rein | text |
| notes_fin | text |

#### Adequation dialyse

| Champ | Type |
|-------|------|
| uree_pre | decimal |
| uree_post | decimal |
| ktv_calculated | decimal (calcule) |
| ktv_status | enum (adequate/inadequate) |
| urr_calculated | decimal (calcule) |

#### Clinique divers

| Champ | Type |
|-------|------|
| traitement_en_cours | text |
| hemoculture | text |
| vaccination | text |
| transfusion | text |
| erythropoietine | varchar |
| observations | text |
| statut | enum (planifiee/en_cours/terminee/annulee) |
| created_at | timestamp |
| updated_at | timestamp |

### 3.5. Table `vital_signs` (constantes per-seance)

| Champ | Type |
|-------|------|
| id | uuid PK |
| session_id | uuid FK dialysis_sessions |
| heure_mesure | timestamp |
| tension_arterielle | varchar |
| frequence_cardiaque | integer |
| frequence_respiratoire | integer |
| spo2 | decimal |
| temperature | decimal |
| glycemie | decimal |
| is_hypotension | boolean |
| notes | text |

### 3.6. Table `bilans`

#### En-tete

| Champ | Type |
|-------|------|
| id | uuid PK |
| reference | varchar (auto-genere) |
| patient_id | uuid FK |
| physician_id | uuid FK |
| date_bilan | timestamp |
| type_bilan | enum (mensuel/trimestriel/semestriel/annuel) |
| notes | text |

#### Hematologie

| Champ | Type |
|-------|------|
| hemoglobine | decimal |
| hematocrite | decimal |
| globules_blancs | decimal |
| plaquettes | decimal |
| neutrophiles | decimal |
| eosinophiles | decimal |
| basophiles | decimal |
| lymphocytes | decimal |
| monocytes | decimal |
| ferritine | decimal |
| saturation_transferrine | decimal |
| vgm | decimal |
| ccmh | decimal |
| gb | decimal |
| leu | decimal |

#### Biochimie renale

| Champ | Type |
|-------|------|
| creatinine | decimal |
| uree_pre | decimal |
| uree_post | decimal |
| acide_urique | decimal |
| uricemie | decimal |
| urr_calculated | decimal (calcule) |
| dfg_mdrd | decimal |

#### Electrolytes

| Champ | Type |
|-------|------|
| sodium | decimal |
| potassium | decimal |
| chlore | varchar |
| calcium | decimal |
| phosphore | decimal |
| bicarbonate | decimal |
| reserve_alcaline | decimal |
| produit_ca_p | decimal (calcule) |

#### Mineraux / Os

| Champ | Type |
|-------|------|
| pth | decimal |
| vitamine_d | decimal |
| phosphatase_alcaline | decimal |

#### Bilan lipidique

| Champ | Type |
|-------|------|
| hdl | decimal |
| ldl | decimal |
| cholesterol_total | decimal |
| triglycerides | decimal |

#### Nutrition et inflammation

| Champ | Type |
|-------|------|
| albumine | decimal |
| prealbumine | decimal |
| proteines_totales | decimal |
| proteidemie | decimal |
| crp | decimal |

#### Bilan hepatique

| Champ | Type |
|-------|------|
| alat | decimal |
| asat | decimal |
| gamma_gt | decimal |
| ldh | decimal |
| cpk | decimal |
| haptoglobine | decimal |
| bilirubine_totale | decimal |
| bilirubine_indirecte | decimal |
| schizocytes | varchar |
| rac | varchar |

#### Bilan martial

| Champ | Type |
|-------|------|
| cst | decimal |
| fer_serique | decimal |

#### Glycemie

| Champ | Type |
|-------|------|
| gaj | decimal |
| hba1c | decimal |

#### Urines

| Champ | Type |
|-------|------|
| pu_24h | varchar |
| eppu | varchar |
| ecbu | varchar |
| nau | decimal |
| ku | decimal |
| rapport_na_k | decimal |
| uree_urinaire | decimal |
| creat_urinaire | decimal |

#### PBR

| Champ | Type |
|-------|------|
| pbr_resultat | text |

#### Serologies

| Champ | Type |
|-------|------|
| hbs_ag | enum (positif/negatif/non_fait) |
| anti_hbs | enum (positif/negatif/non_fait) |
| anti_hbc | enum (positif/negatif/non_fait) |
| anti_hcv | enum (positif/negatif/non_fait) |
| anti_hiv | enum (positif/negatif/non_fait) |
| tpha | enum (positif/negatif/non_fait) |
| vdrl | enum (positif/negatif/non_fait) |

#### Statuts calcules (computed)

| Champ | Type |
|-------|------|
| hb_statut | enum (ok/low/high) |
| potassium_statut | enum (ok/low/high) |
| phosphore_statut | enum (ok/low/high) |
| albumine_statut | enum (ok/low/high) |
| pth_statut | enum (ok/low/high) |
| ca_p_statut | enum (ok/low/high) |

#### Timestamps

| Champ | Type |
|-------|------|
| created_at | timestamp |
| updated_at | timestamp |

### 3.7. Table `factures`

| Champ | Type |
|-------|------|
| id | uuid PK |
| session_id | uuid FK dialysis_sessions |
| patient_id | uuid FK |
| numero_facture | varchar (auto) |
| montant_total | decimal |
| statut | enum (brouillon/emise/payee/annulee) |
| date_emission | date |
| date_paiement | date? |
| created_at | timestamp |

### 3.8. Enums

- `user_role` : admin, secretaire, medecin, infirmiere, facturation, patient
- `statut_seance` : planifiee, en_cours, terminee, annulee
- `type_dialyse` : hemodialyse, hemodiafiltration, dialyse_peritoneale
- `type_bilan` : mensuel, trimestriel, semestriel, annuel
- `statut_facture` : brouillon, emise, payee, annulee
- `statut_patient` : actif, inactif, transfere, decede
- `arrival_status` : stable, malade, urgence
- `tolerance` : bonne, moyenne, mauvaise
- `serologie_result` : positif, negatif, non_fait
- `bio_status` : ok, low, high
- `ktv_status` : adequate, inadequate
- `sexe` : M, F

---

## 4. Authentification et RBAC

### 4.1. Flux d'authentification

Auth.js v5 avec Credentials Provider. Login email + mot de passe. JWT signe en cookie httpOnly. Middleware Next.js verifie le token et le role sur chaque route.

### 4.2. Matrice des permissions

| Route / Action | admin | medecin | infirmiere | secretaire | facturation | patient |
|---|---|---|---|---|---|---|
| `/dashboard` | oui | oui | oui | oui | oui | non |
| `/patients` lecture | oui | oui | oui | oui | oui (limite) | non |
| `/patients` creation/edition | oui | oui | non | oui | non | non |
| `/seances` lecture | oui | oui | oui | oui | non | non |
| `/seances` demarrer/terminer | oui | oui | oui | non | non | non |
| `/seances` constantes vitales | oui | oui | oui | non | non | non |
| `/bilans` lecture | oui | oui | oui | non | non | ses bilans |
| `/bilans` creation/edition | oui | oui | non | non | non | non |
| `/planning` lecture | oui | oui | oui | oui | non | non |
| `/planning` modification | oui | oui | non | oui | non | non |
| `/facturation` | oui | non | non | non | oui | non |
| `/portail` | non | non | non | non | non | oui |
| `/admin/utilisateurs` | oui | non | non | non | non | non |
| `/admin/configuration` | oui | non | non | non | non | non |

### 4.3. Securite

- Mots de passe : bcrypt (12 rounds)
- Session JWT : expiration 8h, refresh silent
- Rate limiting : 5 tentatives / 15 min sur `/api/auth`
- Headers securite : CSP, HSTS, X-Frame-Options
- Patient portail : filtre `patient_id` systematique sur toutes les queries

---

## 5. Architecture des pages

### 5.1. Routes

```
/app
  (auth)/
    login/page.tsx

  (dashboard)/                    -- Layout sidebar + topbar
    page.tsx                      -- Dashboard par role
    patients/
      page.tsx                    -- Liste patients
      nouveau/page.tsx            -- Creation patient
      [id]/
        page.tsx                  -- Fiche patient
        seances/page.tsx          -- Historique seances
        bilans/page.tsx           -- Bilans du patient
    seances/
      page.tsx                    -- Seances du jour
      nouvelle/page.tsx           -- Creation seance
      [id]/
        page.tsx                  -- Formulaire seance
        constantes/page.tsx       -- Saisie constantes
    planning/
      page.tsx                    -- Calendrier hebdomadaire
      postes/page.tsx             -- Gestion postes
    bilans/
      page.tsx                    -- Liste bilans
      nouveau/page.tsx            -- Saisie bilan
      [id]/page.tsx               -- Detail bilan (onglets)
    facturation/
      page.tsx                    -- Liste factures
      [id]/page.tsx               -- Detail facture
      generer/page.tsx            -- Generation par lot
    admin/
      utilisateurs/page.tsx       -- CRUD utilisateurs
      configuration/page.tsx      -- Parametres

  (portail)/                      -- Layout patient simplifie
    page.tsx                      -- Accueil portail
    mes-seances/page.tsx
    mes-bilans/
      page.tsx
      [id]/page.tsx

  api/
    trpc/[trpc]/route.ts
    sse/route.ts
    health/route.ts
```

### 5.2. Layout

- **Sidebar** collapsible avec icones et labels, badge notifications
- **Topbar** avec logo, cloche notifications, avatar utilisateur, toggle mode sombre
- **Sidebar** affiche uniquement les menus autorises selon le role
- **Responsive tablette** : sidebar repliee en icones, tables scrollables

### 5.3. Dashboard par role

| Role | Contenu dashboard |
|------|-------------------|
| admin | Stats globales, utilisateurs actifs, alertes systeme |
| medecin | Seances du jour, alertes bilans critiques, patients suivis |
| infirmiere | Seances en cours, prochaines seances, constantes a saisir |
| secretaire | RDV du jour, patients a accueillir, planning |
| facturation | Factures en attente, montants du mois, impayes |
| patient | Prochaine seance, dernier bilan |

---

## 6. Architecture tRPC

### 6.1. Routeurs

```
trpc/routers/
  auth.router.ts        -- login, logout, me, changePassword
  patients.router.ts    -- list, getById, create, update, search
  seances.router.ts     -- list, getById, create, start, end, update
  constantes.router.ts  -- list, create (vital signs per seance)
  bilans.router.ts      -- list, getById, create, update, alertes
  planning.router.ts    -- list, create, update, delete, byWeek
  facturation.router.ts -- list, getById, generate, markPaid
  users.router.ts       -- list, create, update, toggleActive (admin)
  dashboard.router.ts   -- stats par role, compteurs, alertes
  notifications.router.ts -- list, markRead, subscribe (SSE)
```

### 6.2. Niveaux de procedure

- `publicProcedure` : login uniquement
- `protectedProcedure` : tout utilisateur authentifie
- `roleProcedure(roles[])` : roles specifiques

### 6.3. Notifications SSE

Endpoint `/api/sse/route.ts` avec `ReadableStream`. Evenements :
- `seance.demarree`
- `seance.terminee`
- `bilan.alerte_critique`
- `planning.modification`

Filtre par user_id et role. Pas de WebSocket, pas de Redis au MVP.

### 6.4. Validation

Schemas Zod partages client/serveur. Validation cote client (react-hook-form + zod resolver) et cote serveur (tRPC input). Contraintes DB comme dernier filet.

### 6.5. Stack donnees

| Couche | Technologie |
|--------|-------------|
| Formulaires | react-hook-form + Zod |
| Cache client | @tanstack/react-query (via tRPC) |
| API | tRPC v11 |
| ORM | Drizzle ORM |
| DB | PostgreSQL 16 |

---

## 7. Infrastructure et deploiement

### 7.1. Docker Compose

3 services :
- `app` : Next.js standalone (Node 20 Alpine, ~150 MB)
- `db` : PostgreSQL 16 Alpine
- `caddy` (optionnel) : reverse proxy, TLS auto Let's Encrypt

### 7.2. Dockerfile multi-stage

1. `deps` : npm ci (cache node_modules)
2. `build` : next build (output standalone)
3. `runner` : Node 20 Alpine, user non-root

### 7.3. Variables d'environnement

- `AUTH_SECRET` : secret JWT Auth.js
- `AUTH_URL` : URL publique de l'app
- `DATABASE_URL` : connexion PostgreSQL
- `NODE_ENV` : production

### 7.4. Backup

pg_dump quotidien compresse, rotation 7 jours, copie distante (S3/Backblaze).

### 7.5. CI/CD (GitHub Actions)

1. Lint + type-check
2. Tests Vitest
3. Build Docker image
4. Push vers GitHub Container Registry
5. SSH deploy : `docker compose pull && docker compose up -d`

### 7.6. Migrations

Drizzle Kit pour generation et application des migrations SQL. En production, executees au deploiement.

### 7.7. Monitoring MVP

- `/api/health` : health check (connexion DB)
- Logs structures JSON (pino)
- Uptime monitoring externe (UptimeRobot)
- Compteurs dans le dashboard admin

---

## 8. Tests et qualite

### 8.1. Tests unitaires (Vitest)

Fonctions pures : calculs cliniques (KtV, URR, CaxP, statuts bilans), validation Zod, helpers dates, permissions.

### 8.2. Tests d'integration (Vitest + PostgreSQL)

Routeurs tRPC contre DB reelle (container test). Transaction rollback entre tests. Couvrent : CRUD patients, cycle seance, bilans + statuts, planning + conflits, facturation, auth + RBAC.

### 8.3. Tests E2E (Playwright)

6 specs (1 par role) :
- `admin.spec.ts` : creer utilisateur, configurer, acces complet
- `secretaire.spec.ts` : creer patient, planifier seance, pas d'acces admin
- `medecin.spec.ts` : voir patients, ouvrir bilan, terminer seance
- `infirmiere.spec.ts` : demarrer seance, saisir constantes, terminer
- `facturation.spec.ts` : generer facture, marquer payee, pas d'acces clinique
- `patient.spec.ts` : portail, voir bilans/seances, pas d'acces backend

Projets Playwright : Desktop Chrome + iPad Mini.

### 8.4. Seed

Script `scripts/seed.ts` : 6 utilisateurs, 10 patients, 1 planning, 5 seances, 3 bilans.

---

## 9. Design UI

### 9.1. Style

Design hybride moderne :
- Fond clair par defaut + mode sombre (toggle topbar, persiste localStorage)
- Sidebar navigation collapsible
- Cartes arrondies (border-radius)
- Micro-animations (transitions, hover states)
- Badges colores pour statuts cliniques (vert ok, rouge low, orange high)
- Typographie clean, espacement genereux

### 9.2. Composants cles

- **Sidebar** : collapsible, icones + labels, badge compteur, indicateur page active
- **Tables** : tri, recherche, pagination, export (style shadcn/ui DataTable)
- **Formulaires** : onglets pour sections longues (bilan), validation inline, auto-save draft
- **Badges statut** : `ok` vert, `low` rouge, `high` orange
- **Responsive tablette** : sidebar en icones, tables scrollables horizontalement
