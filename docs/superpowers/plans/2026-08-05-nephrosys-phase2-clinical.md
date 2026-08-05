# NephroSys Phase 2 — Clinical : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le coeur clinique de NephroSys : seances de dialyse (cycle complet planifiee/en_cours/terminee, formulaire multi-sections, constantes vitales), bilans biologiques (100+ champs, 10 onglets, statuts calcules avec seuils configurables), planning hebdomadaire (3 vues grille/calendrier/liste), et configuration admin (seuils cliniques, postes de dialyse).

**Architecture:** Next.js App Router + tRPC + Drizzle ORM + PostgreSQL. Nouvelles tables (postes_dialyse, plannings, dialysis_sessions, vital_signs, bilans, seuils_cliniques) avec 10 nouveaux enums. 6 nouveaux tRPC routers. Pages sous `src/app/(dashboard)/`. Calculs cliniques dans une lib pure. Validation Zod cote client et serveur.

**Tech Stack:** Next.js (App Router), TypeScript, tRPC v11, Drizzle ORM, PostgreSQL, Zod, React Hook Form, Tailwind CSS, shadcn/ui, Vitest, Playwright

## Global Constraints

- All UI text in French (no i18n library)
- Zod error messages in French
- snake_case for DB columns, camelCase for TypeScript
- Docker NOT available — verify via `pnpm tsc --noEmit` and `pnpm db:generate`
- Follow existing patterns in the codebase
- All timestamps with timezone: `timestamp('x', { withTimezone: true })`
- Decimal fields use `decimal('x', { precision: P, scale: S })`
- UUIDs as primary keys with `.defaultRandom()`

---

## File Map

```
nephrosys/
├── src/
│   ├── server/
│   │   ├── db/
│   │   │   └── schema/
│   │   │       ├── enums.ts              ← ADD 10 new enums
│   │   │       ├── postes-dialyse.ts     ← NEW table
│   │   │       ├── plannings.ts          ← NEW table
│   │   │       ├── dialysis-sessions.ts  ← NEW table (~50 cols)
│   │   │       ├── vital-signs.ts        ← NEW table
│   │   │       ├── bilans.ts             ← NEW table (~100 cols)
│   │   │       ├── seuils-cliniques.ts   ← NEW table
│   │   │       ├── relations.ts          ← MODIFY add all new relations
│   │   │       └── index.ts             ← MODIFY export new tables
│   │   └── trpc/
│   │       ├── router.ts                ← MODIFY merge new routers
│   │       └── routers/
│   │           ├── postes.router.ts      ← NEW
│   │           ├── plannings.router.ts   ← NEW
│   │           ├── sessions.router.ts    ← NEW
│   │           ├── vital-signs.router.ts ← NEW
│   │           ├── bilans.router.ts      ← NEW
│   │           └── seuils.router.ts      ← NEW
│   ├── lib/
│   │   ├── clinical-calculations.ts      ← NEW pure functions
│   │   ├── permissions.ts                ← MODIFY add new routes
│   │   └── validators/
│   │       ├── postes.ts                 ← NEW
│   │       ├── plannings.ts              ← NEW
│   │       ├── sessions.ts              ← NEW
│   │       ├── vital-signs.ts           ← NEW
│   │       ├── bilans.ts                ← NEW
│   │       └── seuils.ts               ← NEW
│   ├── components/
│   │   ├── postes/
│   │   │   └── postes-grid.tsx           ← NEW
│   │   ├── planning/
│   │   │   ├── planning-grid-view.tsx    ← NEW
│   │   │   ├── planning-calendar-view.tsx← NEW
│   │   │   └── planning-list-view.tsx    ← NEW
│   │   ├── sessions/
│   │   │   ├── session-table.tsx         ← NEW
│   │   │   ├── session-form.tsx          ← NEW
│   │   │   ├── pre-dialyse-tab.tsx       ← NEW
│   │   │   ├── machine-tab.tsx           ← NEW
│   │   │   ├── constantes-tab.tsx        ← NEW
│   │   │   └── fin-seance-tab.tsx        ← NEW
│   │   ├── bilans/
│   │   │   ├── bilan-table.tsx           ← NEW
│   │   │   ├── bilan-form.tsx            ← NEW
│   │   │   └── bilan-tabs/              ← NEW (10 tab components)
│   │   │       ├── hematologie-tab.tsx
│   │   │       ├── biochimie-renale-tab.tsx
│   │   │       ├── electrolytes-tab.tsx
│   │   │       ├── mineraux-os-tab.tsx
│   │   │       ├── lipides-tab.tsx
│   │   │       ├── nutrition-inflammation-tab.tsx
│   │   │       ├── hepatique-tab.tsx
│   │   │       ├── martial-tab.tsx
│   │   │       ├── glycemie-urines-tab.tsx
│   │   │       └── serologies-pbr-tab.tsx
│   │   └── configuration/
│   │       └── seuils-table.tsx           ← NEW
│   └── app/(dashboard)/
│       ├── seances/
│       │   ├── page.tsx                   ← NEW
│       │   ├── nouvelle/page.tsx          ← NEW
│       │   └── [id]/page.tsx              ← NEW
│       ├── bilans/
│       │   ├── page.tsx                   ← NEW
│       │   ├── nouveau/page.tsx           ← NEW
│       │   └── [id]/page.tsx              ← NEW
│       ├── planning/
│       │   ├── page.tsx                   ← NEW
│       │   └── postes/page.tsx            ← NEW
│       └── admin/
│           └── configuration/page.tsx     ← NEW
├── tests/
│   ├── unit/
│   │   ├── clinical-calculations.test.ts  ← NEW
│   │   ├── sessions-validators.test.ts    ← NEW
│   │   ├── bilans-validators.test.ts      ← NEW
│   │   ├── plannings-validators.test.ts   ← NEW
│   │   └── postes-validators.test.ts      ← NEW
│   └── e2e/
│       ├── seances/flow.spec.ts           ← NEW
│       ├── bilans/crud.spec.ts            ← NEW
│       ├── planning/views.spec.ts         ← NEW
│       └── configuration/seuils.spec.ts   ← NEW
└── drizzle/                               ← migrations generated
```

---

### Task 1: Schema + Enums + Migrations

All new tables, enums, relations, and migration generation.

**Files:**
- Modify: `nephrosys/src/server/db/schema/enums.ts`
- Create: `nephrosys/src/server/db/schema/postes-dialyse.ts`
- Create: `nephrosys/src/server/db/schema/plannings.ts`
- Create: `nephrosys/src/server/db/schema/dialysis-sessions.ts`
- Create: `nephrosys/src/server/db/schema/vital-signs.ts`
- Create: `nephrosys/src/server/db/schema/bilans.ts`
- Create: `nephrosys/src/server/db/schema/seuils-cliniques.ts`
- Modify: `nephrosys/src/server/db/schema/relations.ts`
- Modify: `nephrosys/src/server/db/schema/index.ts`

**Interfaces:**
- Consumes: existing `users` table (FK physician_id, nurse_id, medecin_id, infirmier_id), existing `patients` table (FK patient_id)
- Produces: 6 new tables + 10 new enums + relations, all exported from barrel

- [ ] **Step 1: Add 10 new enums to `enums.ts`**

In `nephrosys/src/server/db/schema/enums.ts`, append after the `sexeEnum`:

```typescript
export const vacationEnum = pgEnum('vacation', ['matin', 'apres_midi']);

export const recurrenceEnum = pgEnum('recurrence', ['hebdo', 'bihebdo', 'trihebdo']);

export const statutSeanceEnum = pgEnum('statut_seance', [
  'planifiee',
  'en_cours',
  'terminee',
  'annulee',
]);

export const typeDialyseEnum = pgEnum('type_dialyse', [
  'hemodialyse',
  'hemodiafiltration',
  'dialyse_peritoneale',
]);

export const arrivalStatusEnum = pgEnum('arrival_status', ['stable', 'malade', 'urgence']);

export const toleranceEnum = pgEnum('tolerance', ['bonne', 'moyenne', 'mauvaise']);

export const typeBilanEnum = pgEnum('type_bilan', [
  'mensuel',
  'trimestriel',
  'semestriel',
  'annuel',
]);

export const serologieResultEnum = pgEnum('serologie_result', [
  'positif',
  'negatif',
  'non_fait',
]);

export const bioStatusEnum = pgEnum('bio_status', ['ok', 'low', 'high']);

export const ktvStatusEnum = pgEnum('ktv_status', ['adequate', 'inadequate']);
```

- [ ] **Step 2: Create `postes-dialyse.ts`**

Create `nephrosys/src/server/db/schema/postes-dialyse.ts`:

```typescript
import { pgTable, uuid, varchar, integer, boolean, text, timestamp } from 'drizzle-orm/pg-core';

export const postesDialyse = pgTable('postes_dialyse', {
  id: uuid('id').primaryKey().defaultRandom(),
  nom: varchar('nom', { length: 100 }).notNull(),
  numero: integer('numero').notNull(),
  isVip: boolean('is_vip').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  equipement: text('equipement'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PosteDialyse = typeof postesDialyse.$inferSelect;
export type NewPosteDialyse = typeof postesDialyse.$inferInsert;
```

- [ ] **Step 3: Create `plannings.ts`**

Create `nephrosys/src/server/db/schema/plannings.ts`:

```typescript
import { pgTable, uuid, integer, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { vacationEnum, recurrenceEnum } from './enums';
import { patients } from './patients';
import { postesDialyse } from './postes-dialyse';
import { users } from './users';

export const plannings = pgTable(
  'plannings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    posteId: uuid('poste_id')
      .notNull()
      .references(() => postesDialyse.id),
    medecinId: uuid('medecin_id')
      .notNull()
      .references(() => users.id),
    infirmierId: uuid('infirmier_id')
      .notNull()
      .references(() => users.id),
    jourSemaine: integer('jour_semaine').notNull(), // 0=lundi ... 6=dimanche
    vacation: vacationEnum('vacation').notNull(),
    recurrence: recurrenceEnum('recurrence').notNull().default('hebdo'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('plannings_poste_jour_vacation_unique').on(
      table.posteId,
      table.jourSemaine,
      table.vacation,
    ),
  ],
);

export type Planning = typeof plannings.$inferSelect;
export type NewPlanning = typeof plannings.$inferInsert;
```

- [ ] **Step 4: Create `dialysis-sessions.ts`**

Create `nephrosys/src/server/db/schema/dialysis-sessions.ts`:

```typescript
import {
  pgTable,
  uuid,
  date,
  integer,
  boolean,
  varchar,
  decimal,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import {
  statutSeanceEnum,
  typeDialyseEnum,
  arrivalStatusEnum,
  toleranceEnum,
  ktvStatusEnum,
} from './enums';
import { patients } from './patients';
import { plannings } from './plannings';
import { postesDialyse } from './postes-dialyse';
import { users } from './users';

export const dialysisSessions = pgTable('dialysis_sessions', {
  // === Identite ===
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  planningId: uuid('planning_id').references(() => plannings.id),
  posteId: uuid('poste_id')
    .notNull()
    .references(() => postesDialyse.id),
  physicianId: uuid('physician_id')
    .notNull()
    .references(() => users.id),
  nurseId: uuid('nurse_id')
    .notNull()
    .references(() => users.id),
  dateSeance: date('date_seance').notNull(),
  dialysisNumber: integer('dialysis_number'),
  isVip: boolean('is_vip').notNull().default(false),

  // === Pre-dialyse / Arrivee ===
  arrivalStatus: arrivalStatusEnum('arrival_status'),
  arrivalWeight: decimal('arrival_weight', { precision: 5, scale: 2 }),
  dryWeight: decimal('dry_weight', { precision: 5, scale: 2 }),
  interdialysisIncrease: decimal('interdialysis_increase', { precision: 5, scale: 2 }),
  taPreDialyse: varchar('ta_pre_dialyse', { length: 20 }),
  taDebout: varchar('ta_debout', { length: 20 }),
  taCoucher: varchar('ta_coucher', { length: 20 }),
  temperaturePre: decimal('temperature_pre', { precision: 4, scale: 1 }),

  // === Parametres machine / Dialysat ===
  typeDialyse: typeDialyseEnum('type_dialyse'),
  dialyzerType: varchar('dialyzer_type', { length: 100 }),
  typeAbordVasculaire: varchar('type_abord_vasculaire', { length: 100 }),
  debitSang: decimal('debit_sang', { precision: 6, scale: 1 }),
  debitDialysat: decimal('debit_dialysat', { precision: 6, scale: 1 }),
  ufPrescrite: decimal('uf_prescrite', { precision: 6, scale: 2 }),
  ufMax: decimal('uf_max', { precision: 6, scale: 2 }),
  dureePrescrite: integer('duree_prescrite'),
  conductivite: decimal('conductivite', { precision: 4, scale: 2 }),
  bainCalcium: decimal('bain_calcium', { precision: 4, scale: 2 }),
  bainPotassium: decimal('bain_potassium', { precision: 4, scale: 2 }),
  bainGlucose: decimal('bain_glucose', { precision: 4, scale: 2 }),
  bainSodium: varchar('bain_sodium', { length: 20 }),
  temperatureBain: decimal('temperature_bain', { precision: 4, scale: 1 }),
  bicarbonate: text('bicarbonate'),
  anticoagulation: text('anticoagulation'),
  aiguilleArterielle: varchar('aiguille_arterielle', { length: 50 }),
  aiguilleVeineuse: varchar('aiguille_veineuse', { length: 50 }),
  ponction: varchar('ponction', { length: 50 }),
  pressionArterielle: varchar('pression_arterielle', { length: 20 }),
  pressionVeineuse: varchar('pression_veineuse', { length: 20 }),
  ptm: varchar('ptm', { length: 20 }),

  // === Fin de seance ===
  departureWeight: decimal('departure_weight', { precision: 5, scale: 2 }),
  ufReelle: decimal('uf_reelle', { precision: 6, scale: 2 }),
  dureeReelle: integer('duree_reelle'),
  toleranceGlobale: toleranceEnum('tolerance_globale'),
  aspectRein: text('aspect_rein'),
  notesFin: text('notes_fin'),

  // === Adequation dialyse ===
  ureePre: decimal('uree_pre', { precision: 8, scale: 2 }),
  ureePost: decimal('uree_post', { precision: 8, scale: 2 }),
  ktvCalculated: decimal('ktv_calculated', { precision: 4, scale: 2 }),
  ktvStatus: ktvStatusEnum('ktv_status'),
  urrCalculated: decimal('urr_calculated', { precision: 5, scale: 2 }),

  // === Clinique divers ===
  traitementEnCours: text('traitement_en_cours'),
  hemoculture: text('hemoculture'),
  vaccination: text('vaccination'),
  transfusion: text('transfusion'),
  erythropoietine: varchar('erythropoietine', { length: 100 }),
  observations: text('observations'),

  // === Statut et verrouillage ===
  statut: statutSeanceEnum('statut').notNull().default('planifiee'),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DialysisSession = typeof dialysisSessions.$inferSelect;
export type NewDialysisSession = typeof dialysisSessions.$inferInsert;
```

- [ ] **Step 5: Create `vital-signs.ts`**

Create `nephrosys/src/server/db/schema/vital-signs.ts`:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  boolean,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { dialysisSessions } from './dialysis-sessions';

export const vitalSigns = pgTable('vital_signs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => dialysisSessions.id),
  heureMesure: timestamp('heure_mesure', { withTimezone: true }).notNull(),
  tensionArterielle: varchar('tension_arterielle', { length: 20 }).notNull(),
  frequenceCardiaque: integer('frequence_cardiaque'),
  frequenceRespiratoire: integer('frequence_respiratoire'),
  spo2: decimal('spo2', { precision: 4, scale: 1 }),
  temperature: decimal('temperature', { precision: 4, scale: 1 }),
  glycemie: decimal('glycemie', { precision: 5, scale: 2 }),
  isHypotension: boolean('is_hypotension').notNull().default(false),
  notes: text('notes'),
});

export type VitalSign = typeof vitalSigns.$inferSelect;
export type NewVitalSign = typeof vitalSigns.$inferInsert;
```

- [ ] **Step 6: Create `bilans.ts`**

Create `nephrosys/src/server/db/schema/bilans.ts`:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  decimal,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import {
  typeBilanEnum,
  serologieResultEnum,
  bioStatusEnum,
} from './enums';
import { patients } from './patients';
import { users } from './users';

export const bilans = pgTable('bilans', {
  // === En-tete ===
  id: uuid('id').primaryKey().defaultRandom(),
  reference: varchar('reference', { length: 50 }).notNull(),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  physicianId: uuid('physician_id')
    .notNull()
    .references(() => users.id),
  dateBilan: timestamp('date_bilan', { withTimezone: true }).notNull(),
  typeBilan: typeBilanEnum('type_bilan').notNull(),
  notes: text('notes'),

  // === Hematologie ===
  hemoglobine: decimal('hemoglobine', { precision: 5, scale: 2 }),
  hematocrite: decimal('hematocrite', { precision: 5, scale: 2 }),
  globulesBlancs: decimal('globules_blancs', { precision: 8, scale: 2 }),
  plaquettes: decimal('plaquettes', { precision: 10, scale: 0 }),
  neutrophiles: decimal('neutrophiles', { precision: 5, scale: 2 }),
  eosinophiles: decimal('eosinophiles', { precision: 5, scale: 2 }),
  basophiles: decimal('basophiles', { precision: 5, scale: 2 }),
  lymphocytes: decimal('lymphocytes', { precision: 5, scale: 2 }),
  monocytes: decimal('monocytes', { precision: 5, scale: 2 }),
  ferritine: decimal('ferritine', { precision: 8, scale: 2 }),
  saturationTransferrine: decimal('saturation_transferrine', { precision: 5, scale: 2 }),
  vgm: decimal('vgm', { precision: 6, scale: 2 }),
  ccmh: decimal('ccmh', { precision: 5, scale: 2 }),

  // === Biochimie renale ===
  creatinine: decimal('creatinine', { precision: 8, scale: 2 }),
  ureePre: decimal('uree_pre', { precision: 8, scale: 2 }),
  ureePost: decimal('uree_post', { precision: 8, scale: 2 }),
  acideUrique: decimal('acide_urique', { precision: 6, scale: 2 }),
  uricemie: decimal('uricemie', { precision: 6, scale: 2 }),
  urrCalculated: decimal('urr_calculated', { precision: 5, scale: 2 }),
  dfgMdrd: decimal('dfg_mdrd', { precision: 6, scale: 2 }),

  // === Electrolytes ===
  sodium: decimal('sodium', { precision: 6, scale: 2 }),
  potassium: decimal('potassium', { precision: 5, scale: 2 }),
  chlore: decimal('chlore', { precision: 6, scale: 2 }),
  calcium: decimal('calcium', { precision: 5, scale: 2 }),
  phosphore: decimal('phosphore', { precision: 5, scale: 2 }),
  bicarbonateBilan: decimal('bicarbonate_bilan', { precision: 6, scale: 2 }),
  reserveAlcaline: decimal('reserve_alcaline', { precision: 6, scale: 2 }),
  produitCaP: decimal('produit_ca_p', { precision: 6, scale: 2 }),

  // === Mineraux / Os ===
  pth: decimal('pth', { precision: 8, scale: 2 }),
  vitamineD: decimal('vitamine_d', { precision: 6, scale: 2 }),
  phosphataseAlcaline: decimal('phosphatase_alcaline', { precision: 8, scale: 2 }),

  // === Bilan lipidique ===
  hdl: decimal('hdl', { precision: 6, scale: 2 }),
  ldl: decimal('ldl', { precision: 6, scale: 2 }),
  cholesterolTotal: decimal('cholesterol_total', { precision: 6, scale: 2 }),
  triglycerides: decimal('triglycerides', { precision: 6, scale: 2 }),

  // === Nutrition et inflammation ===
  albumine: decimal('albumine', { precision: 5, scale: 2 }),
  prealbumine: decimal('prealbumine', { precision: 5, scale: 2 }),
  proteinesTotales: decimal('proteines_totales', { precision: 6, scale: 2 }),
  proteidemie: decimal('proteidemie', { precision: 6, scale: 2 }),
  crp: decimal('crp', { precision: 6, scale: 2 }),

  // === Bilan hepatique ===
  alat: decimal('alat', { precision: 8, scale: 2 }),
  asat: decimal('asat', { precision: 8, scale: 2 }),
  gammaGt: decimal('gamma_gt', { precision: 8, scale: 2 }),
  ldhBilan: decimal('ldh', { precision: 8, scale: 2 }),
  cpk: decimal('cpk', { precision: 8, scale: 2 }),
  haptoglobine: decimal('haptoglobine', { precision: 6, scale: 2 }),
  bilirubineTotale: decimal('bilirubine_totale', { precision: 6, scale: 2 }),
  bilirubineIndirecte: decimal('bilirubine_indirecte', { precision: 6, scale: 2 }),
  schizocytes: varchar('schizocytes', { length: 50 }),
  rac: varchar('rac', { length: 50 }),

  // === Bilan martial ===
  cst: decimal('cst', { precision: 5, scale: 2 }),
  ferSerique: decimal('fer_serique', { precision: 6, scale: 2 }),

  // === Glycemie ===
  gaj: decimal('gaj', { precision: 5, scale: 2 }),
  hba1c: decimal('hba1c', { precision: 4, scale: 1 }),

  // === Urines ===
  pu24h: varchar('pu_24h', { length: 50 }),
  eppu: varchar('eppu', { length: 50 }),
  ecbu: varchar('ecbu', { length: 50 }),
  nau: decimal('nau', { precision: 6, scale: 2 }),
  ku: decimal('ku', { precision: 6, scale: 2 }),
  rapportNaK: decimal('rapport_na_k', { precision: 5, scale: 2 }),
  ureeUrinaire: decimal('uree_urinaire', { precision: 8, scale: 2 }),
  creatUrinaire: decimal('creat_urinaire', { precision: 8, scale: 2 }),

  // === PBR ===
  pbrResultat: text('pbr_resultat'),

  // === Serologies ===
  hbsAg: serologieResultEnum('hbs_ag'),
  antiHbs: serologieResultEnum('anti_hbs'),
  antiHbc: serologieResultEnum('anti_hbc'),
  antiHcv: serologieResultEnum('anti_hcv'),
  antiHiv: serologieResultEnum('anti_hiv'),
  tpha: serologieResultEnum('tpha'),
  vdrl: serologieResultEnum('vdrl'),

  // === Statuts calcules ===
  hbStatut: bioStatusEnum('hb_statut'),
  potassiumStatut: bioStatusEnum('potassium_statut'),
  phosphoreStatut: bioStatusEnum('phosphore_statut'),
  albumineStatut: bioStatusEnum('albumine_statut'),
  pthStatut: bioStatusEnum('pth_statut'),
  caPStatut: bioStatusEnum('ca_p_statut'),

  // === Timestamps ===
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Bilan = typeof bilans.$inferSelect;
export type NewBilan = typeof bilans.$inferInsert;
```

- [ ] **Step 7: Create `seuils-cliniques.ts`**

Create `nephrosys/src/server/db/schema/seuils-cliniques.ts`:

```typescript
import { pgTable, uuid, varchar, decimal, timestamp } from 'drizzle-orm/pg-core';

export const seuilsCliniques = pgTable('seuils_cliniques', {
  id: uuid('id').primaryKey().defaultRandom(),
  parametre: varchar('parametre', { length: 50 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  seuilBas: decimal('seuil_bas', { precision: 8, scale: 2 }),
  seuilHaut: decimal('seuil_haut', { precision: 8, scale: 2 }),
  unite: varchar('unite', { length: 20 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SeuilClinique = typeof seuilsCliniques.$inferSelect;
export type NewSeuilClinique = typeof seuilsCliniques.$inferInsert;
```

- [ ] **Step 8: Update `relations.ts`**

Replace the entire contents of `nephrosys/src/server/db/schema/relations.ts`:

```typescript
import { relations } from 'drizzle-orm';
import { users } from './users';
import { patients } from './patients';
import { postesDialyse } from './postes-dialyse';
import { plannings } from './plannings';
import { dialysisSessions } from './dialysis-sessions';
import { vitalSigns } from './vital-signs';
import { bilans } from './bilans';

export const usersRelations = relations(users, ({ many }) => ({
  patientsAsMedecin: many(patients, { relationName: 'medecinRef' }),
  planningsAsMedecin: many(plannings, { relationName: 'planningMedecin' }),
  planningsAsInfirmier: many(plannings, { relationName: 'planningInfirmier' }),
  sessionsAsPhysician: many(dialysisSessions, { relationName: 'sessionPhysician' }),
  sessionsAsNurse: many(dialysisSessions, { relationName: 'sessionNurse' }),
  bilansAsPhysician: many(bilans, { relationName: 'bilanPhysician' }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  user: one(users, {
    fields: [patients.userId],
    references: [users.id],
    relationName: 'portalUser',
  }),
  medecinRef: one(users, {
    fields: [patients.medecinRefId],
    references: [users.id],
    relationName: 'medecinRef',
  }),
  plannings: many(plannings),
  dialysisSessions: many(dialysisSessions),
  bilans: many(bilans),
}));

export const postesDialyseRelations = relations(postesDialyse, ({ many }) => ({
  plannings: many(plannings),
  dialysisSessions: many(dialysisSessions),
}));

export const planningsRelations = relations(plannings, ({ one, many }) => ({
  patient: one(patients, {
    fields: [plannings.patientId],
    references: [patients.id],
  }),
  poste: one(postesDialyse, {
    fields: [plannings.posteId],
    references: [postesDialyse.id],
  }),
  medecin: one(users, {
    fields: [plannings.medecinId],
    references: [users.id],
    relationName: 'planningMedecin',
  }),
  infirmier: one(users, {
    fields: [plannings.infirmierId],
    references: [users.id],
    relationName: 'planningInfirmier',
  }),
  dialysisSessions: many(dialysisSessions),
}));

export const dialysisSessionsRelations = relations(dialysisSessions, ({ one, many }) => ({
  patient: one(patients, {
    fields: [dialysisSessions.patientId],
    references: [patients.id],
  }),
  planning: one(plannings, {
    fields: [dialysisSessions.planningId],
    references: [plannings.id],
  }),
  poste: one(postesDialyse, {
    fields: [dialysisSessions.posteId],
    references: [postesDialyse.id],
  }),
  physician: one(users, {
    fields: [dialysisSessions.physicianId],
    references: [users.id],
    relationName: 'sessionPhysician',
  }),
  nurse: one(users, {
    fields: [dialysisSessions.nurseId],
    references: [users.id],
    relationName: 'sessionNurse',
  }),
  vitalSigns: many(vitalSigns),
}));

export const vitalSignsRelations = relations(vitalSigns, ({ one }) => ({
  session: one(dialysisSessions, {
    fields: [vitalSigns.sessionId],
    references: [dialysisSessions.id],
  }),
}));

export const bilansRelations = relations(bilans, ({ one }) => ({
  patient: one(patients, {
    fields: [bilans.patientId],
    references: [patients.id],
  }),
  physician: one(users, {
    fields: [bilans.physicianId],
    references: [users.id],
    relationName: 'bilanPhysician',
  }),
}));
```

- [ ] **Step 9: Update barrel export `index.ts`**

Replace the contents of `nephrosys/src/server/db/schema/index.ts`:

```typescript
export * from './enums';
export * from './users';
export * from './patients';
export * from './postes-dialyse';
export * from './plannings';
export * from './dialysis-sessions';
export * from './vital-signs';
export * from './bilans';
export * from './seuils-cliniques';
export * from './relations';
```

- [ ] **Step 10: Verify and generate migration**

```bash
cd nephrosys && pnpm tsc --noEmit && pnpm db:generate
```

**Commit:** `feat(schema): add Phase 2 clinical tables — postes, plannings, sessions, vital_signs, bilans, seuils`

---

### Task 2: Clinical Calculations — Pure Functions + Tests

Pure calculation functions with TDD.

**Files:**
- Create: `nephrosys/src/lib/clinical-calculations.ts`
- Create: `nephrosys/tests/unit/clinical-calculations.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no DB)
- Produces: `calculateInterdialysisIncrease`, `calculateKtV`, `calculateURR`, `calculateBioStatus`, `calculateProductCaP` — consumed by sessions and bilans routers

- [ ] **Step 1: Write failing tests**

Create `nephrosys/tests/unit/clinical-calculations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateInterdialysisIncrease,
  calculateKtV,
  calculateURR,
  calculateBioStatus,
  calculateProductCaP,
} from '@/lib/clinical-calculations';

describe('calculateInterdialysisIncrease', () => {
  it('returns difference between arrival and dry weight', () => {
    expect(calculateInterdialysisIncrease(72.5, 70.0)).toBeCloseTo(2.5, 2);
  });

  it('returns null if either weight is null', () => {
    expect(calculateInterdialysisIncrease(null, 70.0)).toBeNull();
    expect(calculateInterdialysisIncrease(72.5, null)).toBeNull();
  });

  it('handles negative difference (arrival < dry)', () => {
    expect(calculateInterdialysisIncrease(68.0, 70.0)).toBeCloseTo(-2.0, 2);
  });
});

describe('calculateKtV', () => {
  it('calculates Kt/V with Daugirdas formula', () => {
    // Known inputs: ureePre=60, ureePost=20, arrivalWeight=75, departureWeight=72
    const result = calculateKtV(60, 20, 75, 72);
    expect(result).not.toBeNull();
    // -ln(20/60) + (4 - 3.5*(20/60)) * (75-72)/72
    // = -ln(0.333) + (4 - 1.1667) * 0.04167
    // = 1.0986 + 2.8333 * 0.04167
    // = 1.0986 + 0.1181
    // = 1.2167
    expect(result!).toBeCloseTo(1.22, 1);
  });

  it('returns null if any input is null', () => {
    expect(calculateKtV(null, 20, 75, 72)).toBeNull();
    expect(calculateKtV(60, null, 75, 72)).toBeNull();
    expect(calculateKtV(60, 20, null, 72)).toBeNull();
    expect(calculateKtV(60, 20, 75, null)).toBeNull();
  });

  it('returns null if uree_pre is 0 (avoid division by zero)', () => {
    expect(calculateKtV(0, 20, 75, 72)).toBeNull();
  });

  it('returns null if departure_weight is 0', () => {
    expect(calculateKtV(60, 20, 75, 0)).toBeNull();
  });
});

describe('calculateURR', () => {
  it('calculates URR as percentage', () => {
    // (60 - 20) / 60 * 100 = 66.67%
    expect(calculateURR(60, 20)).toBeCloseTo(66.67, 1);
  });

  it('returns null if either value is null', () => {
    expect(calculateURR(null, 20)).toBeNull();
    expect(calculateURR(60, null)).toBeNull();
  });

  it('returns null if uree_pre is 0', () => {
    expect(calculateURR(0, 20)).toBeNull();
  });
});

describe('calculateBioStatus', () => {
  it('returns ok when value is within range', () => {
    expect(calculateBioStatus(12.0, 10.0, 16.0)).toBe('ok');
  });

  it('returns low when value is below seuil_bas', () => {
    expect(calculateBioStatus(8.0, 10.0, 16.0)).toBe('low');
  });

  it('returns high when value is above seuil_haut', () => {
    expect(calculateBioStatus(18.0, 10.0, 16.0)).toBe('high');
  });

  it('returns null when value is null', () => {
    expect(calculateBioStatus(null, 10.0, 16.0)).toBeNull();
  });

  it('handles null seuil_bas (no lower bound)', () => {
    expect(calculateBioStatus(5.0, null, 55.0)).toBe('ok');
    expect(calculateBioStatus(60.0, null, 55.0)).toBe('high');
  });

  it('handles null seuil_haut (no upper bound)', () => {
    expect(calculateBioStatus(5.0, 10.0, null)).toBe('low');
    expect(calculateBioStatus(15.0, 10.0, null)).toBe('ok');
  });

  it('returns ok on exact boundary values', () => {
    expect(calculateBioStatus(10.0, 10.0, 16.0)).toBe('ok');
    expect(calculateBioStatus(16.0, 10.0, 16.0)).toBe('ok');
  });
});

describe('calculateProductCaP', () => {
  it('calculates Ca x P product', () => {
    expect(calculateProductCaP(2.4, 1.2)).toBeCloseTo(2.88, 2);
  });

  it('returns null if either is null', () => {
    expect(calculateProductCaP(null, 1.2)).toBeNull();
    expect(calculateProductCaP(2.4, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd nephrosys && pnpm test -- tests/unit/clinical-calculations.test.ts
```

- [ ] **Step 3: Implement `clinical-calculations.ts`**

Create `nephrosys/src/lib/clinical-calculations.ts`:

```typescript
/**
 * Calculs cliniques — fonctions pures pour la nephrologie.
 * Toutes les valeurs numeriques sont passees en number | null.
 */

/** Prise de poids interdialytique = poids arrivee - poids sec */
export function calculateInterdialysisIncrease(
  arrivalWeight: number | null,
  dryWeight: number | null,
): number | null {
  if (arrivalWeight == null || dryWeight == null) return null;
  return Math.round((arrivalWeight - dryWeight) * 100) / 100;
}

/**
 * Kt/V (formule de Daugirdas II simplifiee)
 * = -ln(R) + (4 - 3.5 * R) * deltaW / departureWeight
 * ou R = ureePost / ureePre, deltaW = arrivalWeight - departureWeight
 */
export function calculateKtV(
  ureePre: number | null,
  ureePost: number | null,
  arrivalWeight: number | null,
  departureWeight: number | null,
): number | null {
  if (ureePre == null || ureePost == null || arrivalWeight == null || departureWeight == null) {
    return null;
  }
  if (ureePre === 0 || departureWeight === 0) return null;

  const r = ureePost / ureePre;
  const deltaW = arrivalWeight - departureWeight;
  const ktv = -Math.log(r) + (4 - 3.5 * r) * (deltaW / departureWeight);
  return Math.round(ktv * 100) / 100;
}

/** URR (%) = (ureePre - ureePost) / ureePre * 100 */
export function calculateURR(
  ureePre: number | null,
  ureePost: number | null,
): number | null {
  if (ureePre == null || ureePost == null) return null;
  if (ureePre === 0) return null;
  return Math.round(((ureePre - ureePost) / ureePre) * 10000) / 100;
}

/**
 * Statut biologique par rapport aux seuils configurables.
 * Retourne 'low' | 'ok' | 'high' | null.
 */
export function calculateBioStatus(
  value: number | null,
  seuilBas: number | null,
  seuilHaut: number | null,
): 'ok' | 'low' | 'high' | null {
  if (value == null) return null;
  if (seuilBas != null && value < seuilBas) return 'low';
  if (seuilHaut != null && value > seuilHaut) return 'high';
  return 'ok';
}

/** Produit phospho-calcique = calcium x phosphore */
export function calculateProductCaP(
  calcium: number | null,
  phosphore: number | null,
): number | null {
  if (calcium == null || phosphore == null) return null;
  return Math.round(calcium * phosphore * 100) / 100;
}
```

- [ ] **Step 4: Run tests — expect all green**

```bash
cd nephrosys && pnpm test -- tests/unit/clinical-calculations.test.ts
```

**Commit:** `feat(clinical): add pure clinical calculation functions with unit tests`

---

### Task 3: Seuils + Postes Validators, Routers, and Tests

**Files:**
- Create: `nephrosys/src/lib/validators/postes.ts`
- Create: `nephrosys/src/lib/validators/seuils.ts`
- Create: `nephrosys/src/server/trpc/routers/postes.router.ts`
- Create: `nephrosys/src/server/trpc/routers/seuils.router.ts`
- Create: `nephrosys/tests/unit/postes-validators.test.ts`
- Modify: `nephrosys/src/server/trpc/router.ts`

**Interfaces:**
- Consumes: `postesDialyse` table, `seuilsCliniques` table, `roleProcedure`
- Produces: `postesRouter`, `seuilsRouter` merged into `appRouter`

- [ ] **Step 1: Write validator tests (TDD)**

Create `nephrosys/tests/unit/postes-validators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createPosteSchema, updatePosteSchema } from '@/lib/validators/postes';
import { updateSeuilSchema } from '@/lib/validators/seuils';

describe('createPosteSchema', () => {
  it('accepts valid poste data', () => {
    const result = createPosteSchema.safeParse({
      nom: 'Poste 1',
      numero: 1,
      isVip: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty nom', () => {
    const result = createPosteSchema.safeParse({
      nom: '',
      numero: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative numero', () => {
    const result = createPosteSchema.safeParse({
      nom: 'Poste 1',
      numero: -1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional equipement', () => {
    const result = createPosteSchema.safeParse({
      nom: 'VIP 1',
      numero: 1,
      isVip: true,
      equipement: 'Fresenius 5008S',
    });
    expect(result.success).toBe(true);
  });
});

describe('updatePosteSchema', () => {
  it('requires id', () => {
    const result = updatePosteSchema.safeParse({ nom: 'Poste 2' });
    expect(result.success).toBe(false);
  });

  it('accepts partial update with id', () => {
    const result = updatePosteSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      nom: 'Poste 2',
    });
    expect(result.success).toBe(true);
  });
});

describe('updateSeuilSchema', () => {
  it('requires id', () => {
    const result = updateSeuilSchema.safeParse({ seuilBas: 10 });
    expect(result.success).toBe(false);
  });

  it('accepts valid seuil update', () => {
    const result = updateSeuilSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      seuilBas: 10.0,
      seuilHaut: 16.0,
      unite: 'g/dL',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null seuil_bas (no lower bound)', () => {
    const result = updateSeuilSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      seuilBas: null,
      seuilHaut: 55.0,
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd nephrosys && pnpm test -- tests/unit/postes-validators.test.ts
```

- [ ] **Step 3: Create validators**

Create `nephrosys/src/lib/validators/postes.ts`:

```typescript
import { z } from 'zod';

export const createPosteSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(100, 'Nom trop long'),
  numero: z.number().int('Numero entier requis').positive('Numero doit etre positif'),
  isVip: z.boolean().optional().default(false),
  equipement: z.string().optional(),
});

export type CreatePosteInput = z.infer<typeof createPosteSchema>;

export const updatePosteSchema = createPosteSchema.partial().extend({
  id: z.string().uuid('ID invalide'),
});

export type UpdatePosteInput = z.infer<typeof updatePosteSchema>;
```

Create `nephrosys/src/lib/validators/seuils.ts`:

```typescript
import { z } from 'zod';

export const updateSeuilSchema = z.object({
  id: z.string().uuid('ID invalide'),
  seuilBas: z.number().nullable().optional(),
  seuilHaut: z.number().nullable().optional(),
  unite: z.string().max(20, 'Unite trop longue').optional(),
});

export type UpdateSeuilInput = z.infer<typeof updateSeuilSchema>;
```

- [ ] **Step 4: Run tests — expect green**

```bash
cd nephrosys && pnpm test -- tests/unit/postes-validators.test.ts
```

- [ ] **Step 5: Create `postes.router.ts`**

Create `nephrosys/src/server/trpc/routers/postes.router.ts`:

```typescript
import { router, roleProcedure } from '@/server/trpc';
import { postesDialyse } from '@/server/db/schema';
import { createPosteSchema, updatePosteSchema } from '@/lib/validators/postes';
import { eq, count } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const postesRouter = router({
  list: roleProcedure(['admin', 'medecin', 'infirmiere', 'secretaire'])
    .query(async ({ ctx }) => {
      const data = await ctx.db
        .select()
        .from(postesDialyse)
        .orderBy(postesDialyse.numero);
      return data;
    }),

  getById: roleProcedure(['admin', 'medecin', 'infirmiere', 'secretaire'])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [poste] = await ctx.db
        .select()
        .from(postesDialyse)
        .where(eq(postesDialyse.id, input.id))
        .limit(1);

      if (!poste) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Poste non trouve' });
      }
      return poste;
    }),

  create: roleProcedure(['admin', 'medecin', 'secretaire'])
    .input(createPosteSchema)
    .mutation(async ({ ctx, input }) => {
      const [poste] = await ctx.db
        .insert(postesDialyse)
        .values({
          nom: input.nom,
          numero: input.numero,
          isVip: input.isVip ?? false,
          equipement: input.equipement ?? null,
        })
        .returning();
      return poste;
    }),

  update: roleProcedure(['admin', 'medecin', 'secretaire'])
    .input(updatePosteSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};

      if (data.nom !== undefined) updateData.nom = data.nom;
      if (data.numero !== undefined) updateData.numero = data.numero;
      if (data.isVip !== undefined) updateData.isVip = data.isVip;
      if (data.equipement !== undefined) updateData.equipement = data.equipement;

      const [poste] = await ctx.db
        .update(postesDialyse)
        .set(updateData)
        .where(eq(postesDialyse.id, id))
        .returning();

      if (!poste) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Poste non trouve' });
      }
      return poste;
    }),

  toggleActive: roleProcedure(['admin'])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ isActive: postesDialyse.isActive })
        .from(postesDialyse)
        .where(eq(postesDialyse.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Poste non trouve' });
      }

      const [poste] = await ctx.db
        .update(postesDialyse)
        .set({ isActive: !existing.isActive })
        .where(eq(postesDialyse.id, input.id))
        .returning();

      return poste;
    }),
});
```

- [ ] **Step 6: Create `seuils.router.ts`**

Create `nephrosys/src/server/trpc/routers/seuils.router.ts`:

```typescript
import { router, roleProcedure } from '@/server/trpc';
import { seuilsCliniques } from '@/server/db/schema';
import { updateSeuilSchema } from '@/lib/validators/seuils';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const seuilsRouter = router({
  list: roleProcedure(['admin'])
    .query(async ({ ctx }) => {
      const data = await ctx.db
        .select()
        .from(seuilsCliniques)
        .orderBy(seuilsCliniques.parametre);
      return data;
    }),

  update: roleProcedure(['admin'])
    .input(updateSeuilSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      if (data.seuilBas !== undefined) updateData.seuilBas = data.seuilBas?.toString() ?? null;
      if (data.seuilHaut !== undefined) updateData.seuilHaut = data.seuilHaut?.toString() ?? null;
      if (data.unite !== undefined) updateData.unite = data.unite;

      const [seuil] = await ctx.db
        .update(seuilsCliniques)
        .set(updateData)
        .where(eq(seuilsCliniques.id, id))
        .returning();

      if (!seuil) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Seuil non trouve' });
      }
      return seuil;
    }),
});
```

- [ ] **Step 7: Add postes and seuils to `router.ts`**

Update `nephrosys/src/server/trpc/router.ts`:

```typescript
import { router } from '@/server/trpc';
import { authRouter } from './routers/auth.router';
import { patientsRouter } from './routers/patients.router';
import { usersRouter } from './routers/users.router';
import { postesRouter } from './routers/postes.router';
import { seuilsRouter } from './routers/seuils.router';

export const appRouter = router({
  auth: authRouter,
  patients: patientsRouter,
  users: usersRouter,
  postes: postesRouter,
  seuils: seuilsRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 8: Verify TypeScript**

```bash
cd nephrosys && pnpm tsc --noEmit
```

**Commit:** `feat(routers): add postes and seuils tRPC routers with validators`

---

### Task 4: Postes UI + Configuration UI

**Files:**
- Create: `nephrosys/src/components/postes/postes-grid.tsx`
- Create: `nephrosys/src/app/(dashboard)/planning/postes/page.tsx`
- Create: `nephrosys/src/components/configuration/seuils-table.tsx`
- Create: `nephrosys/src/app/(dashboard)/admin/configuration/page.tsx`

**Interfaces:**
- Consumes: `api.postes.list`, `api.postes.create`, `api.postes.update`, `api.postes.toggleActive`, `api.seuils.list`, `api.seuils.update`
- Produces: `/planning/postes` page, `/admin/configuration` page

- [ ] **Step 1: Create `postes-grid.tsx`**

Create `nephrosys/src/components/postes/postes-grid.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPosteSchema, type CreatePosteInput } from '@/lib/validators/postes';
import { Plus, X } from 'lucide-react';

export function PostesGrid() {
  const [showForm, setShowForm] = useState(false);
  const utils = api.useUtils();

  const { data: postes, isLoading } = api.postes.list.useQuery();
  const createMutation = api.postes.create.useMutation({
    onSuccess: () => {
      utils.postes.list.invalidate();
      setShowForm(false);
      reset();
    },
  });
  const toggleMutation = api.postes.toggleActive.useMutation({
    onSuccess: () => utils.postes.list.invalidate(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePosteInput>({
    resolver: zodResolver(createPosteSchema),
    defaultValues: { isVip: false },
  });

  const onSubmit = (data: CreatePosteInput) => {
    createMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {showForm ? 'Annuler' : 'Nouveau poste'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 p-4">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap gap-4">
            <div>
              <Input placeholder="Nom du poste" {...register('nom')} />
              {errors.nom && <p className="text-sm text-red-500">{errors.nom.message}</p>}
            </div>
            <div>
              <Input
                type="number"
                placeholder="Numero"
                {...register('numero', { valueAsNumber: true })}
              />
              {errors.numero && <p className="text-sm text-red-500">{errors.numero.message}</p>}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isVip" {...register('isVip')} />
              <label htmlFor="isVip">VIP</label>
            </div>
            <div>
              <Input placeholder="Equipement (optionnel)" {...register('equipement')} />
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creation...' : 'Creer'}
            </Button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {postes?.map((poste) => (
          <Card
            key={poste.id}
            className={`p-4 ${poste.isVip ? 'border-2 border-amber-400' : ''} ${
              !poste.isActive ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{poste.nom}</p>
                <p className="text-sm text-gray-500">N° {poste.numero}</p>
              </div>
              <div className="flex gap-1">
                {poste.isVip && (
                  <Badge className="bg-amber-100 text-amber-800">VIP</Badge>
                )}
                <Badge className={poste.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {poste.isActive ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
            </div>
            {poste.equipement && (
              <p className="mt-2 text-xs text-gray-500">{poste.equipement}</p>
            )}
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleMutation.mutate({ id: poste.id })}
                disabled={toggleMutation.isPending}
              >
                {poste.isActive ? 'Desactiver' : 'Activer'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create postes page**

Create `nephrosys/src/app/(dashboard)/planning/postes/page.tsx`:

```tsx
'use client';

import { PostesGrid } from '@/components/postes/postes-grid';

export default function PostesPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Postes de dialyse
      </h1>
      <PostesGrid />
    </div>
  );
}
```

- [ ] **Step 3: Create `seuils-table.tsx`**

Create `nephrosys/src/components/configuration/seuils-table.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Check } from 'lucide-react';

type EditingState = {
  id: string;
  seuilBas: string;
  seuilHaut: string;
  unite: string;
} | null;

export function SeuilsTable() {
  const [editing, setEditing] = useState<EditingState>(null);
  const utils = api.useUtils();

  const { data: seuils, isLoading } = api.seuils.list.useQuery();
  const updateMutation = api.seuils.update.useMutation({
    onSuccess: () => {
      utils.seuils.list.invalidate();
      setEditing(null);
    },
  });

  const startEdit = (seuil: NonNullable<typeof seuils>[number]) => {
    setEditing({
      id: seuil.id,
      seuilBas: seuil.seuilBas ?? '',
      seuilHaut: seuil.seuilHaut ?? '',
      unite: seuil.unite,
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      seuilBas: editing.seuilBas === '' ? null : parseFloat(editing.seuilBas),
      seuilHaut: editing.seuilHaut === '' ? null : parseFloat(editing.seuilHaut),
      unite: editing.unite,
    });
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3">Parametre</th>
            <th className="px-4 py-3">Seuil bas</th>
            <th className="px-4 py-3">Seuil haut</th>
            <th className="px-4 py-3">Unite</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {seuils?.map((seuil) => (
            <tr key={seuil.id} className="border-b">
              <td className="px-4 py-3 font-medium">{seuil.label}</td>
              {editing?.id === seuil.id ? (
                <>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={editing.seuilBas}
                      onChange={(e) => setEditing({ ...editing, seuilBas: e.target.value })}
                      className="w-24"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={editing.seuilHaut}
                      onChange={(e) => setEditing({ ...editing, seuilHaut: e.target.value })}
                      className="w-24"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      value={editing.unite}
                      onChange={(e) => setEditing({ ...editing, unite: e.target.value })}
                      className="w-24"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={updateMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-3">{seuil.seuilBas ?? '—'}</td>
                  <td className="px-4 py-3">{seuil.seuilHaut ?? '—'}</td>
                  <td className="px-4 py-3">{seuil.unite}</td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" onClick={() => startEdit(seuil)}>
                      Modifier
                    </Button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create configuration page**

Create `nephrosys/src/app/(dashboard)/admin/configuration/page.tsx`:

```tsx
'use client';

import { SeuilsTable } from '@/components/configuration/seuils-table';

export default function ConfigurationPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Configuration — Seuils cliniques
      </h1>
      <p className="mb-4 text-gray-600 dark:text-gray-400">
        Definissez les seuils de reference pour les parametres biologiques. Les statuts des bilans seront calcules automatiquement en fonction de ces seuils.
      </p>
      <SeuilsTable />
    </div>
  );
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd nephrosys && pnpm tsc --noEmit
```

**Commit:** `feat(ui): add postes grid page and seuils configuration page`

---

### Task 5: Plannings Router + Validators

**Files:**
- Create: `nephrosys/src/lib/validators/plannings.ts`
- Create: `nephrosys/src/server/trpc/routers/plannings.router.ts`
- Create: `nephrosys/tests/unit/plannings-validators.test.ts`
- Modify: `nephrosys/src/server/trpc/router.ts`

**Interfaces:**
- Consumes: `plannings` table, `dialysisSessions` table, `postesDialyse` table
- Produces: `planningsRouter` with `list`, `create`, `update`, `delete`, `generateWeekSessions`

- [ ] **Step 1: Write failing validator tests**

Create `nephrosys/tests/unit/plannings-validators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  createPlanningSchema,
  updatePlanningSchema,
  planningListSchema,
  generateWeekSessionsSchema,
} from '@/lib/validators/plannings';

describe('createPlanningSchema', () => {
  it('accepts valid planning data', () => {
    const result = createPlanningSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      posteId: '550e8400-e29b-41d4-a716-446655440001',
      medecinId: '550e8400-e29b-41d4-a716-446655440002',
      infirmierId: '550e8400-e29b-41d4-a716-446655440003',
      jourSemaine: 0,
      vacation: 'matin',
      recurrence: 'hebdo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid jourSemaine (>6)', () => {
    const result = createPlanningSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      posteId: '550e8400-e29b-41d4-a716-446655440001',
      medecinId: '550e8400-e29b-41d4-a716-446655440002',
      infirmierId: '550e8400-e29b-41d4-a716-446655440003',
      jourSemaine: 7,
      vacation: 'matin',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid vacation', () => {
    const result = createPlanningSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      posteId: '550e8400-e29b-41d4-a716-446655440001',
      medecinId: '550e8400-e29b-41d4-a716-446655440002',
      infirmierId: '550e8400-e29b-41d4-a716-446655440003',
      jourSemaine: 0,
      vacation: 'soir',
    });
    expect(result.success).toBe(false);
  });
});

describe('updatePlanningSchema', () => {
  it('requires id', () => {
    const result = updatePlanningSchema.safeParse({ jourSemaine: 1 });
    expect(result.success).toBe(false);
  });

  it('accepts partial update with id', () => {
    const result = updatePlanningSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      vacation: 'apres_midi',
    });
    expect(result.success).toBe(true);
  });
});

describe('planningListSchema', () => {
  it('accepts empty filter (all optional)', () => {
    const result = planningListSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts jourSemaine filter', () => {
    const result = planningListSchema.safeParse({ jourSemaine: 2 });
    expect(result.success).toBe(true);
  });
});

describe('generateWeekSessionsSchema', () => {
  it('accepts valid weekStart date', () => {
    const result = generateWeekSessionsSchema.safeParse({
      weekStart: '2026-08-10',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-date string', () => {
    const result = generateWeekSessionsSchema.safeParse({
      weekStart: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd nephrosys && pnpm test -- tests/unit/plannings-validators.test.ts
```

- [ ] **Step 3: Create validators**

Create `nephrosys/src/lib/validators/plannings.ts`:

```typescript
import { z } from 'zod';

export const createPlanningSchema = z.object({
  patientId: z.string().uuid('Patient ID invalide'),
  posteId: z.string().uuid('Poste ID invalide'),
  medecinId: z.string().uuid('Medecin ID invalide'),
  infirmierId: z.string().uuid('Infirmier ID invalide'),
  jourSemaine: z
    .number()
    .int('Jour entier requis')
    .min(0, 'Jour minimum : 0 (lundi)')
    .max(6, 'Jour maximum : 6 (dimanche)'),
  vacation: z.enum(['matin', 'apres_midi'], {
    errorMap: () => ({ message: 'Vacation invalide (matin ou apres_midi)' }),
  }),
  recurrence: z
    .enum(['hebdo', 'bihebdo', 'trihebdo'], {
      errorMap: () => ({ message: 'Recurrence invalide' }),
    })
    .optional()
    .default('hebdo'),
});

export type CreatePlanningInput = z.infer<typeof createPlanningSchema>;

export const updatePlanningSchema = createPlanningSchema.partial().extend({
  id: z.string().uuid('ID invalide'),
});

export type UpdatePlanningInput = z.infer<typeof updatePlanningSchema>;

export const planningListSchema = z.object({
  jourSemaine: z.number().int().min(0).max(6).optional(),
  posteId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
});

export type PlanningListInput = z.infer<typeof planningListSchema>;

export const generateWeekSessionsSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
});

export type GenerateWeekSessionsInput = z.infer<typeof generateWeekSessionsSchema>;
```

- [ ] **Step 4: Run tests — expect green**

```bash
cd nephrosys && pnpm test -- tests/unit/plannings-validators.test.ts
```

- [ ] **Step 5: Create `plannings.router.ts`**

Create `nephrosys/src/server/trpc/routers/plannings.router.ts`:

```typescript
import { router, roleProcedure } from '@/server/trpc';
import {
  plannings,
  dialysisSessions,
  patients,
  postesDialyse,
  users,
} from '@/server/db/schema';
import {
  createPlanningSchema,
  updatePlanningSchema,
  planningListSchema,
  generateWeekSessionsSchema,
} from '@/lib/validators/plannings';
import { eq, and, count } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const planningsRouter = router({
  list: roleProcedure(['admin', 'medecin', 'infirmiere', 'secretaire'])
    .input(planningListSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [eq(plannings.isActive, true)];

      if (input.jourSemaine !== undefined) {
        conditions.push(eq(plannings.jourSemaine, input.jourSemaine));
      }
      if (input.posteId) {
        conditions.push(eq(plannings.posteId, input.posteId));
      }
      if (input.patientId) {
        conditions.push(eq(plannings.patientId, input.patientId));
      }

      const data = await ctx.db
        .select({
          planning: plannings,
          patient: { id: patients.id, nom: patients.nom, prenom: patients.prenom },
          poste: { id: postesDialyse.id, nom: postesDialyse.nom, numero: postesDialyse.numero, isVip: postesDialyse.isVip },
          medecin: { id: users.id, nom: users.nom, prenom: users.prenom },
        })
        .from(plannings)
        .innerJoin(patients, eq(plannings.patientId, patients.id))
        .innerJoin(postesDialyse, eq(plannings.posteId, postesDialyse.id))
        .innerJoin(users, eq(plannings.medecinId, users.id))
        .where(and(...conditions))
        .orderBy(plannings.jourSemaine, postesDialyse.numero);

      return data;
    }),

  create: roleProcedure(['admin', 'medecin', 'secretaire'])
    .input(createPlanningSchema)
    .mutation(async ({ ctx, input }) => {
      const [planning] = await ctx.db
        .insert(plannings)
        .values({
          patientId: input.patientId,
          posteId: input.posteId,
          medecinId: input.medecinId,
          infirmierId: input.infirmierId,
          jourSemaine: input.jourSemaine,
          vacation: input.vacation,
          recurrence: input.recurrence,
        })
        .returning();
      return planning;
    }),

  update: roleProcedure(['admin', 'medecin', 'secretaire'])
    .input(updatePlanningSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};

      if (data.patientId !== undefined) updateData.patientId = data.patientId;
      if (data.posteId !== undefined) updateData.posteId = data.posteId;
      if (data.medecinId !== undefined) updateData.medecinId = data.medecinId;
      if (data.infirmierId !== undefined) updateData.infirmierId = data.infirmierId;
      if (data.jourSemaine !== undefined) updateData.jourSemaine = data.jourSemaine;
      if (data.vacation !== undefined) updateData.vacation = data.vacation;
      if (data.recurrence !== undefined) updateData.recurrence = data.recurrence;

      const [planning] = await ctx.db
        .update(plannings)
        .set(updateData)
        .where(eq(plannings.id, id))
        .returning();

      if (!planning) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Planning non trouve' });
      }
      return planning;
    }),

  delete: roleProcedure(['admin', 'medecin', 'secretaire'])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Soft delete: set isActive = false
      const [planning] = await ctx.db
        .update(plannings)
        .set({ isActive: false })
        .where(eq(plannings.id, input.id))
        .returning();

      if (!planning) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Planning non trouve' });
      }
      return planning;
    }),

  generateWeekSessions: roleProcedure(['admin', 'secretaire'])
    .input(generateWeekSessionsSchema)
    .mutation(async ({ ctx, input }) => {
      const weekStart = new Date(input.weekStart);

      // Fetch all active plannings
      const activePlannings = await ctx.db
        .select()
        .from(plannings)
        .where(eq(plannings.isActive, true));

      let created = 0;

      for (const planning of activePlannings) {
        // Calculate the actual date for this planning's jourSemaine
        const sessionDate = new Date(weekStart);
        sessionDate.setDate(weekStart.getDate() + planning.jourSemaine);
        const dateStr = sessionDate.toISOString().split('T')[0];

        // Check if session already exists for this planning + date
        const [existing] = await ctx.db
          .select({ total: count() })
          .from(dialysisSessions)
          .where(
            and(
              eq(dialysisSessions.planningId, planning.id),
              eq(dialysisSessions.dateSeance, dateStr),
            ),
          );

        if (existing.total > 0) continue;

        // Get poste info for VIP status
        const [poste] = await ctx.db
          .select({ isVip: postesDialyse.isVip })
          .from(postesDialyse)
          .where(eq(postesDialyse.id, planning.posteId))
          .limit(1);

        await ctx.db.insert(dialysisSessions).values({
          patientId: planning.patientId,
          planningId: planning.id,
          posteId: planning.posteId,
          physicianId: planning.medecinId,
          nurseId: planning.infirmierId,
          dateSeance: dateStr,
          isVip: poste?.isVip ?? false,
          statut: 'planifiee',
        });

        created++;
      }

      return { created, message: `${created} seance(s) generee(s)` };
    }),
});
```

- [ ] **Step 6: Add plannings router to `router.ts`**

Update `nephrosys/src/server/trpc/router.ts` to add:

```typescript
import { planningsRouter } from './routers/plannings.router';
```

And in the router object:

```typescript
plannings: planningsRouter,
```

Full file:

```typescript
import { router } from '@/server/trpc';
import { authRouter } from './routers/auth.router';
import { patientsRouter } from './routers/patients.router';
import { usersRouter } from './routers/users.router';
import { postesRouter } from './routers/postes.router';
import { seuilsRouter } from './routers/seuils.router';
import { planningsRouter } from './routers/plannings.router';

export const appRouter = router({
  auth: authRouter,
  patients: patientsRouter,
  users: usersRouter,
  postes: postesRouter,
  seuils: seuilsRouter,
  plannings: planningsRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd nephrosys && pnpm tsc --noEmit
```

**Commit:** `feat(plannings): add plannings router with session generation and validators`

---

### Task 6: Sessions Router + Validators

**Files:**
- Create: `nephrosys/src/lib/validators/sessions.ts`
- Create: `nephrosys/src/server/trpc/routers/sessions.router.ts`
- Create: `nephrosys/tests/unit/sessions-validators.test.ts`
- Modify: `nephrosys/src/server/trpc/router.ts`

**Interfaces:**
- Consumes: `dialysisSessions` table, `patients`, `postesDialyse`, `users`, clinical calculations
- Produces: `sessionsRouter` with full session lifecycle (create, updatePreDialyse, updateMachine, updateFinSeance, demarrer, terminer, annuler)

- [ ] **Step 1: Write failing validator tests**

Create `nephrosys/tests/unit/sessions-validators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  createSessionSchema,
  updatePreDialyseSchema,
  updateMachineSchema,
  updateFinSeanceSchema,
  sessionListSchema,
} from '@/lib/validators/sessions';

describe('createSessionSchema', () => {
  it('accepts valid session data', () => {
    const result = createSessionSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      posteId: '550e8400-e29b-41d4-a716-446655440001',
      physicianId: '550e8400-e29b-41d4-a716-446655440002',
      nurseId: '550e8400-e29b-41d4-a716-446655440003',
      dateSeance: '2026-08-10',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing patientId', () => {
    const result = createSessionSchema.safeParse({
      posteId: '550e8400-e29b-41d4-a716-446655440001',
      physicianId: '550e8400-e29b-41d4-a716-446655440002',
      nurseId: '550e8400-e29b-41d4-a716-446655440003',
      dateSeance: '2026-08-10',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional planningId', () => {
    const result = createSessionSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      posteId: '550e8400-e29b-41d4-a716-446655440001',
      physicianId: '550e8400-e29b-41d4-a716-446655440002',
      nurseId: '550e8400-e29b-41d4-a716-446655440003',
      dateSeance: '2026-08-10',
      planningId: '550e8400-e29b-41d4-a716-446655440004',
    });
    expect(result.success).toBe(true);
  });
});

describe('updatePreDialyseSchema', () => {
  it('requires id', () => {
    const result = updatePreDialyseSchema.safeParse({
      arrivalWeight: 72.5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid pre-dialyse data', () => {
    const result = updatePreDialyseSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      arrivalStatus: 'stable',
      arrivalWeight: 72.5,
      dryWeight: 70.0,
      taPreDialyse: '140/90',
      taDebout: '135/85',
      taCoucher: '130/80',
      temperaturePre: 36.5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid arrival status', () => {
    const result = updatePreDialyseSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      arrivalStatus: 'critique',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateMachineSchema', () => {
  it('accepts valid machine parameters', () => {
    const result = updateMachineSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      typeDialyse: 'hemodialyse',
      dialyzerType: 'FX80',
      debitSang: 300,
      debitDialysat: 500,
      ufPrescrite: 2.5,
      dureePrescrite: 240,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type_dialyse', () => {
    const result = updateMachineSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      typeDialyse: 'inconnu',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateFinSeanceSchema', () => {
  it('accepts valid fin de seance data', () => {
    const result = updateFinSeanceSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      departureWeight: 70.5,
      ufReelle: 2.0,
      dureeReelle: 235,
      toleranceGlobale: 'bonne',
      ureePre: 60,
      ureePost: 20,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid tolerance', () => {
    const result = updateFinSeanceSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      toleranceGlobale: 'excellente',
    });
    expect(result.success).toBe(false);
  });
});

describe('sessionListSchema', () => {
  it('provides defaults for page and perPage', () => {
    const result = sessionListSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
  });

  it('accepts date filter', () => {
    const result = sessionListSchema.safeParse({
      date: '2026-08-10',
    });
    expect(result.success).toBe(true);
  });

  it('accepts statut filter', () => {
    const result = sessionListSchema.safeParse({
      statut: 'en_cours',
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd nephrosys && pnpm test -- tests/unit/sessions-validators.test.ts
```

- [ ] **Step 3: Create validators**

Create `nephrosys/src/lib/validators/sessions.ts`:

```typescript
import { z } from 'zod';

export const createSessionSchema = z.object({
  patientId: z.string().uuid('Patient ID invalide'),
  posteId: z.string().uuid('Poste ID invalide'),
  physicianId: z.string().uuid('Medecin ID invalide'),
  nurseId: z.string().uuid('Infirmier ID invalide'),
  dateSeance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
  planningId: z.string().uuid().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updatePreDialyseSchema = z.object({
  id: z.string().uuid('ID invalide'),
  arrivalStatus: z.enum(['stable', 'malade', 'urgence'], {
    errorMap: () => ({ message: 'Statut arrivee invalide' }),
  }).optional(),
  arrivalWeight: z.number().positive('Poids doit etre positif').optional(),
  dryWeight: z.number().positive('Poids sec doit etre positif').optional(),
  taPreDialyse: z.string().max(20).optional(),
  taDebout: z.string().max(20).optional(),
  taCoucher: z.string().max(20).optional(),
  temperaturePre: z.number().min(30).max(45).optional(),
});

export type UpdatePreDialyseInput = z.infer<typeof updatePreDialyseSchema>;

export const updateMachineSchema = z.object({
  id: z.string().uuid('ID invalide'),
  typeDialyse: z.enum(['hemodialyse', 'hemodiafiltration', 'dialyse_peritoneale'], {
    errorMap: () => ({ message: 'Type de dialyse invalide' }),
  }).optional(),
  dialyzerType: z.string().max(100).optional(),
  typeAbordVasculaire: z.string().max(100).optional(),
  debitSang: z.number().positive().optional(),
  debitDialysat: z.number().positive().optional(),
  ufPrescrite: z.number().min(0).optional(),
  ufMax: z.number().min(0).optional(),
  dureePrescrite: z.number().int().positive().optional(),
  conductivite: z.number().positive().optional(),
  bainCalcium: z.number().min(0).optional(),
  bainPotassium: z.number().min(0).optional(),
  bainGlucose: z.number().min(0).optional(),
  bainSodium: z.string().max(20).optional(),
  temperatureBain: z.number().min(30).max(42).optional(),
  bicarbonate: z.string().optional(),
  anticoagulation: z.string().optional(),
  aiguilleArterielle: z.string().max(50).optional(),
  aiguilleVeineuse: z.string().max(50).optional(),
  ponction: z.string().max(50).optional(),
  pressionArterielle: z.string().max(20).optional(),
  pressionVeineuse: z.string().max(20).optional(),
  ptm: z.string().max(20).optional(),
});

export type UpdateMachineInput = z.infer<typeof updateMachineSchema>;

export const updateFinSeanceSchema = z.object({
  id: z.string().uuid('ID invalide'),
  departureWeight: z.number().positive('Poids depart doit etre positif').optional(),
  ufReelle: z.number().min(0).optional(),
  dureeReelle: z.number().int().positive().optional(),
  toleranceGlobale: z.enum(['bonne', 'moyenne', 'mauvaise'], {
    errorMap: () => ({ message: 'Tolerance invalide' }),
  }).optional(),
  aspectRein: z.string().optional(),
  notesFin: z.string().optional(),
  ureePre: z.number().min(0).optional(),
  ureePost: z.number().min(0).optional(),
  traitementEnCours: z.string().optional(),
  hemoculture: z.string().optional(),
  vaccination: z.string().optional(),
  transfusion: z.string().optional(),
  erythropoietine: z.string().max(100).optional(),
  observations: z.string().optional(),
});

export type UpdateFinSeanceInput = z.infer<typeof updateFinSeanceSchema>;

export const sessionListSchema = z.object({
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  posteId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  statut: z.enum(['planifiee', 'en_cours', 'terminee', 'annulee']).optional(),
});

export type SessionListInput = z.infer<typeof sessionListSchema>;
```

- [ ] **Step 4: Run tests — expect green**

```bash
cd nephrosys && pnpm test -- tests/unit/sessions-validators.test.ts
```

- [ ] **Step 5: Create `sessions.router.ts`**

Create `nephrosys/src/server/trpc/routers/sessions.router.ts`:

```typescript
import { router, roleProcedure } from '@/server/trpc';
import {
  dialysisSessions,
  patients,
  postesDialyse,
  users,
} from '@/server/db/schema';
import {
  createSessionSchema,
  updatePreDialyseSchema,
  updateMachineSchema,
  updateFinSeanceSchema,
  sessionListSchema,
} from '@/lib/validators/sessions';
import {
  calculateInterdialysisIncrease,
  calculateKtV,
  calculateURR,
} from '@/lib/clinical-calculations';
import { eq, and, count } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

/** Helper: check if session is locked (terminee > 24h ago) */
function isSessionLocked(session: { statut: string; lockedAt: Date | null; updatedAt: Date }) {
  if (session.lockedAt) return true;
  if (session.statut === 'terminee') {
    const hoursAgo = (Date.now() - new Date(session.updatedAt).getTime()) / (1000 * 60 * 60);
    return hoursAgo > 24;
  }
  return false;
}

export const sessionsRouter = router({
  list: roleProcedure(['admin', 'medecin', 'infirmiere', 'secretaire'])
    .input(sessionListSchema)
    .query(async ({ ctx, input }) => {
      const { page, perPage, date, posteId, patientId, statut } = input;
      const offset = (page - 1) * perPage;

      const conditions = [];

      if (date) {
        conditions.push(eq(dialysisSessions.dateSeance, date));
      }
      if (posteId) {
        conditions.push(eq(dialysisSessions.posteId, posteId));
      }
      if (patientId) {
        conditions.push(eq(dialysisSessions.patientId, patientId));
      }
      if (statut) {
        conditions.push(eq(dialysisSessions.statut, statut));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [data, [{ total }]] = await Promise.all([
        ctx.db
          .select({
            session: dialysisSessions,
            patient: { id: patients.id, nom: patients.nom, prenom: patients.prenom },
            poste: { id: postesDialyse.id, nom: postesDialyse.nom, numero: postesDialyse.numero },
            physician: { id: users.id, nom: users.nom, prenom: users.prenom },
          })
          .from(dialysisSessions)
          .innerJoin(patients, eq(dialysisSessions.patientId, patients.id))
          .innerJoin(postesDialyse, eq(dialysisSessions.posteId, postesDialyse.id))
          .innerJoin(users, eq(dialysisSessions.physicianId, users.id))
          .where(where)
          .orderBy(dialysisSessions.dateSeance)
          .limit(perPage)
          .offset(offset),
        ctx.db
          .select({ total: count() })
          .from(dialysisSessions)
          .where(where),
      ]);

      return { data, total };
    }),

  getById: roleProcedure(['admin', 'medecin', 'infirmiere', 'secretaire'])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .select()
        .from(dialysisSessions)
        .where(eq(dialysisSessions.id, input.id))
        .limit(1);

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Seance non trouvee' });
      }

      // Auto-lock check: if terminee > 24h and not yet locked
      if (result.statut === 'terminee' && !result.lockedAt) {
        const hoursAgo = (Date.now() - new Date(result.updatedAt).getTime()) / (1000 * 60 * 60);
        if (hoursAgo > 24) {
          await ctx.db
            .update(dialysisSessions)
            .set({ lockedAt: new Date() })
            .where(eq(dialysisSessions.id, input.id));
          result.lockedAt = new Date();
        }
      }

      // Fetch related data
      const [patient] = await ctx.db
        .select({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
        .from(patients)
        .where(eq(patients.id, result.patientId))
        .limit(1);

      const [poste] = await ctx.db
        .select({ id: postesDialyse.id, nom: postesDialyse.nom, numero: postesDialyse.numero })
        .from(postesDialyse)
        .where(eq(postesDialyse.id, result.posteId))
        .limit(1);

      const [physician] = await ctx.db
        .select({ id: users.id, nom: users.nom, prenom: users.prenom })
        .from(users)
        .where(eq(users.id, result.physicianId))
        .limit(1);

      const [nurse] = await ctx.db
        .select({ id: users.id, nom: users.nom, prenom: users.prenom })
        .from(users)
        .where(eq(users.id, result.nurseId))
        .limit(1);

      const locked = isSessionLocked(result);

      return { ...result, patient, poste, physician, nurse, isLocked: locked };
    }),

  create: roleProcedure(['admin', 'medecin', 'secretaire'])
    .input(createSessionSchema)
    .mutation(async ({ ctx, input }) => {
      // Get poste VIP status
      const [poste] = await ctx.db
        .select({ isVip: postesDialyse.isVip })
        .from(postesDialyse)
        .where(eq(postesDialyse.id, input.posteId))
        .limit(1);

      const [session] = await ctx.db
        .insert(dialysisSessions)
        .values({
          patientId: input.patientId,
          posteId: input.posteId,
          physicianId: input.physicianId,
          nurseId: input.nurseId,
          dateSeance: input.dateSeance,
          planningId: input.planningId ?? null,
          isVip: poste?.isVip ?? false,
          statut: 'planifiee',
        })
        .returning();

      return session;
    }),

  updatePreDialyse: roleProcedure(['admin', 'medecin', 'infirmiere'])
    .input(updatePreDialyseSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Check session exists and is not locked
      const [existing] = await ctx.db
        .select({ statut: dialysisSessions.statut, lockedAt: dialysisSessions.lockedAt, updatedAt: dialysisSessions.updatedAt })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.id, id))
        .limit(1);

      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Seance non trouvee' });
      if (isSessionLocked(existing)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Seance verrouillee' });

      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      if (data.arrivalStatus !== undefined) updateData.arrivalStatus = data.arrivalStatus;
      if (data.arrivalWeight !== undefined) updateData.arrivalWeight = data.arrivalWeight.toString();
      if (data.dryWeight !== undefined) updateData.dryWeight = data.dryWeight.toString();
      if (data.taPreDialyse !== undefined) updateData.taPreDialyse = data.taPreDialyse;
      if (data.taDebout !== undefined) updateData.taDebout = data.taDebout;
      if (data.taCoucher !== undefined) updateData.taCoucher = data.taCoucher;
      if (data.temperaturePre !== undefined) updateData.temperaturePre = data.temperaturePre.toString();

      // Auto-calculate interdialysis increase
      const arrivalW = data.arrivalWeight ?? null;
      const dryW = data.dryWeight ?? null;
      if (arrivalW != null || dryW != null) {
        // Need both values: fetch the other if not provided
        let finalArrival = arrivalW;
        let finalDry = dryW;
        if (finalArrival == null || finalDry == null) {
          const [current] = await ctx.db
            .select({ arrivalWeight: dialysisSessions.arrivalWeight, dryWeight: dialysisSessions.dryWeight })
            .from(dialysisSessions)
            .where(eq(dialysisSessions.id, id))
            .limit(1);
          if (finalArrival == null && current?.arrivalWeight) finalArrival = parseFloat(current.arrivalWeight);
          if (finalDry == null && current?.dryWeight) finalDry = parseFloat(current.dryWeight);
        }
        const increase = calculateInterdialysisIncrease(finalArrival, finalDry);
        if (increase != null) updateData.interdialysisIncrease = increase.toString();
      }

      const [session] = await ctx.db
        .update(dialysisSessions)
        .set(updateData)
        .where(eq(dialysisSessions.id, id))
        .returning();

      return session;
    }),

  updateMachine: roleProcedure(['admin', 'medecin', 'infirmiere'])
    .input(updateMachineSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [existing] = await ctx.db
        .select({ statut: dialysisSessions.statut, lockedAt: dialysisSessions.lockedAt, updatedAt: dialysisSessions.updatedAt })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.id, id))
        .limit(1);

      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Seance non trouvee' });
      if (isSessionLocked(existing)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Seance verrouillee' });

      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      if (data.typeDialyse !== undefined) updateData.typeDialyse = data.typeDialyse;
      if (data.dialyzerType !== undefined) updateData.dialyzerType = data.dialyzerType;
      if (data.typeAbordVasculaire !== undefined) updateData.typeAbordVasculaire = data.typeAbordVasculaire;
      if (data.debitSang !== undefined) updateData.debitSang = data.debitSang.toString();
      if (data.debitDialysat !== undefined) updateData.debitDialysat = data.debitDialysat.toString();
      if (data.ufPrescrite !== undefined) updateData.ufPrescrite = data.ufPrescrite.toString();
      if (data.ufMax !== undefined) updateData.ufMax = data.ufMax.toString();
      if (data.dureePrescrite !== undefined) updateData.dureePrescrite = data.dureePrescrite;
      if (data.conductivite !== undefined) updateData.conductivite = data.conductivite.toString();
      if (data.bainCalcium !== undefined) updateData.bainCalcium = data.bainCalcium.toString();
      if (data.bainPotassium !== undefined) updateData.bainPotassium = data.bainPotassium.toString();
      if (data.bainGlucose !== undefined) updateData.bainGlucose = data.bainGlucose.toString();
      if (data.bainSodium !== undefined) updateData.bainSodium = data.bainSodium;
      if (data.temperatureBain !== undefined) updateData.temperatureBain = data.temperatureBain.toString();
      if (data.bicarbonate !== undefined) updateData.bicarbonate = data.bicarbonate;
      if (data.anticoagulation !== undefined) updateData.anticoagulation = data.anticoagulation;
      if (data.aiguilleArterielle !== undefined) updateData.aiguilleArterielle = data.aiguilleArterielle;
      if (data.aiguilleVeineuse !== undefined) updateData.aiguilleVeineuse = data.aiguilleVeineuse;
      if (data.ponction !== undefined) updateData.ponction = data.ponction;
      if (data.pressionArterielle !== undefined) updateData.pressionArterielle = data.pressionArterielle;
      if (data.pressionVeineuse !== undefined) updateData.pressionVeineuse = data.pressionVeineuse;
      if (data.ptm !== undefined) updateData.ptm = data.ptm;

      const [session] = await ctx.db
        .update(dialysisSessions)
        .set(updateData)
        .where(eq(dialysisSessions.id, id))
        .returning();

      return session;
    }),

  updateFinSeance: roleProcedure(['admin', 'medecin'])
    .input(updateFinSeanceSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [existing] = await ctx.db
        .select({
          statut: dialysisSessions.statut,
          lockedAt: dialysisSessions.lockedAt,
          updatedAt: dialysisSessions.updatedAt,
          arrivalWeight: dialysisSessions.arrivalWeight,
        })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.id, id))
        .limit(1);

      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Seance non trouvee' });
      if (isSessionLocked(existing)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Seance verrouillee' });

      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      if (data.departureWeight !== undefined) updateData.departureWeight = data.departureWeight.toString();
      if (data.ufReelle !== undefined) updateData.ufReelle = data.ufReelle.toString();
      if (data.dureeReelle !== undefined) updateData.dureeReelle = data.dureeReelle;
      if (data.toleranceGlobale !== undefined) updateData.toleranceGlobale = data.toleranceGlobale;
      if (data.aspectRein !== undefined) updateData.aspectRein = data.aspectRein;
      if (data.notesFin !== undefined) updateData.notesFin = data.notesFin;
      if (data.ureePre !== undefined) updateData.ureePre = data.ureePre.toString();
      if (data.ureePost !== undefined) updateData.ureePost = data.ureePost.toString();
      if (data.traitementEnCours !== undefined) updateData.traitementEnCours = data.traitementEnCours;
      if (data.hemoculture !== undefined) updateData.hemoculture = data.hemoculture;
      if (data.vaccination !== undefined) updateData.vaccination = data.vaccination;
      if (data.transfusion !== undefined) updateData.transfusion = data.transfusion;
      if (data.erythropoietine !== undefined) updateData.erythropoietine = data.erythropoietine;
      if (data.observations !== undefined) updateData.observations = data.observations;

      // Auto-calculate Kt/V, URR if uree values provided
      const ureePre = data.ureePre ?? null;
      const ureePost = data.ureePost ?? null;
      const arrivalWeight = existing.arrivalWeight ? parseFloat(existing.arrivalWeight) : null;
      const departureWeight = data.departureWeight ?? null;

      if (ureePre != null && ureePost != null) {
        const urr = calculateURR(ureePre, ureePost);
        if (urr != null) updateData.urrCalculated = urr.toString();

        const ktv = calculateKtV(ureePre, ureePost, arrivalWeight, departureWeight);
        if (ktv != null) {
          updateData.ktvCalculated = ktv.toString();
          updateData.ktvStatus = ktv >= 1.2 ? 'adequate' : 'inadequate';
        }
      }

      const [session] = await ctx.db
        .update(dialysisSessions)
        .set(updateData)
        .where(eq(dialysisSessions.id, id))
        .returning();

      return session;
    }),

  demarrer: roleProcedure(['admin', 'medecin', 'infirmiere'])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ statut: dialysisSessions.statut })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.id, input.id))
        .limit(1);

      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Seance non trouvee' });
      if (existing.statut !== 'planifiee') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seule une seance planifiee peut etre demarree',
        });
      }

      const [session] = await ctx.db
        .update(dialysisSessions)
        .set({ statut: 'en_cours', updatedAt: new Date() })
        .where(eq(dialysisSessions.id, input.id))
        .returning();

      return session;
    }),

  terminer: roleProcedure(['admin', 'medecin'])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ statut: dialysisSessions.statut })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.id, input.id))
        .limit(1);

      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Seance non trouvee' });
      if (existing.statut !== 'en_cours') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seule une seance en cours peut etre terminee',
        });
      }

      const [session] = await ctx.db
        .update(dialysisSessions)
        .set({ statut: 'terminee', updatedAt: new Date() })
        .where(eq(dialysisSessions.id, input.id))
        .returning();

      return session;
    }),

  annuler: roleProcedure(['admin', 'medecin'])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ statut: dialysisSessions.statut })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.id, input.id))
        .limit(1);

      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Seance non trouvee' });
      if (existing.statut !== 'planifiee' && existing.statut !== 'en_cours') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seule une seance planifiee ou en cours peut etre annulee',
        });
      }

      const [session] = await ctx.db
        .update(dialysisSessions)
        .set({ statut: 'annulee', updatedAt: new Date() })
        .where(eq(dialysisSessions.id, input.id))
        .returning();

      return session;
    }),
});
```

- [ ] **Step 6: Add sessions router to `router.ts`**

Update `nephrosys/src/server/trpc/router.ts`:

```typescript
import { router } from '@/server/trpc';
import { authRouter } from './routers/auth.router';
import { patientsRouter } from './routers/patients.router';
import { usersRouter } from './routers/users.router';
import { postesRouter } from './routers/postes.router';
import { seuilsRouter } from './routers/seuils.router';
import { planningsRouter } from './routers/plannings.router';
import { sessionsRouter } from './routers/sessions.router';

export const appRouter = router({
  auth: authRouter,
  patients: patientsRouter,
  users: usersRouter,
  postes: postesRouter,
  seuils: seuilsRouter,
  plannings: planningsRouter,
  sessions: sessionsRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd nephrosys && pnpm tsc --noEmit
```

**Commit:** `feat(sessions): add sessions router with full lifecycle and validators`

---

### Task 7: Vital Signs Router + Validators

**Files:**
- Create: `nephrosys/src/lib/validators/vital-signs.ts`
- Create: `nephrosys/src/server/trpc/routers/vital-signs.router.ts`
- Modify: `nephrosys/src/server/trpc/router.ts`

**Interfaces:**
- Consumes: `vitalSigns` table, `dialysisSessions` table
- Produces: `vitalSignsRouter` with `listBySession`, `create`, `update`, `delete`

- [ ] **Step 1: Create validators**

Create `nephrosys/src/lib/validators/vital-signs.ts`:

```typescript
import { z } from 'zod';

export const createVitalSignSchema = z.object({
  sessionId: z.string().uuid('Session ID invalide'),
  heureMesure: z.string().datetime({ message: 'Heure invalide' }),
  tensionArterielle: z.string().min(1, 'Tension arterielle requise').max(20),
  frequenceCardiaque: z.number().int().positive().optional(),
  frequenceRespiratoire: z.number().int().positive().optional(),
  spo2: z.number().min(0).max(100).optional(),
  temperature: z.number().min(30).max(45).optional(),
  glycemie: z.number().positive().optional(),
  isHypotension: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export type CreateVitalSignInput = z.infer<typeof createVitalSignSchema>;

export const updateVitalSignSchema = createVitalSignSchema
  .omit({ sessionId: true })
  .partial()
  .extend({
    id: z.string().uuid('ID invalide'),
  });

export type UpdateVitalSignInput = z.infer<typeof updateVitalSignSchema>;
```

- [ ] **Step 2: Create `vital-signs.router.ts`**

Create `nephrosys/src/server/trpc/routers/vital-signs.router.ts`:

```typescript
import { router, roleProcedure } from '@/server/trpc';
import { vitalSigns, dialysisSessions } from '@/server/db/schema';
import { createVitalSignSchema, updateVitalSignSchema } from '@/lib/validators/vital-signs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const vitalSignsRouter = router({
  listBySession: roleProcedure(['admin', 'medecin', 'infirmiere', 'secretaire'])
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db
        .select()
        .from(vitalSigns)
        .where(eq(vitalSigns.sessionId, input.sessionId))
        .orderBy(vitalSigns.heureMesure);
      return data;
    }),

  create: roleProcedure(['admin', 'medecin', 'infirmiere'])
    .input(createVitalSignSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify session exists and is en_cours
      const [session] = await ctx.db
        .select({ statut: dialysisSessions.statut })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Seance non trouvee' });
      }
      if (session.statut !== 'en_cours') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Les constantes ne peuvent etre ajoutees que sur une seance en cours',
        });
      }

      const [sign] = await ctx.db
        .insert(vitalSigns)
        .values({
          sessionId: input.sessionId,
          heureMesure: new Date(input.heureMesure),
          tensionArterielle: input.tensionArterielle,
          frequenceCardiaque: input.frequenceCardiaque ?? null,
          frequenceRespiratoire: input.frequenceRespiratoire ?? null,
          spo2: input.spo2?.toString() ?? null,
          temperature: input.temperature?.toString() ?? null,
          glycemie: input.glycemie?.toString() ?? null,
          isHypotension: input.isHypotension ?? false,
          notes: input.notes ?? null,
        })
        .returning();

      return sign;
    }),

  update: roleProcedure(['admin', 'medecin', 'infirmiere'])
    .input(updateVitalSignSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};

      if (data.heureMesure !== undefined) updateData.heureMesure = new Date(data.heureMesure);
      if (data.tensionArterielle !== undefined) updateData.tensionArterielle = data.tensionArterielle;
      if (data.frequenceCardiaque !== undefined) updateData.frequenceCardiaque = data.frequenceCardiaque;
      if (data.frequenceRespiratoire !== undefined) updateData.frequenceRespiratoire = data.frequenceRespiratoire;
      if (data.spo2 !== undefined) updateData.spo2 = data.spo2?.toString();
      if (data.temperature !== undefined) updateData.temperature = data.temperature?.toString();
      if (data.glycemie !== undefined) updateData.glycemie = data.glycemie?.toString();
      if (data.isHypotension !== undefined) updateData.isHypotension = data.isHypotension;
      if (data.notes !== undefined) updateData.notes = data.notes;

      const [sign] = await ctx.db
        .update(vitalSigns)
        .set(updateData)
        .where(eq(vitalSigns.id, id))
        .returning();

      if (!sign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Constante non trouvee' });
      }
      return sign;
    }),

  delete: roleProcedure(['admin', 'medecin'])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [sign] = await ctx.db
        .delete(vitalSigns)
        .where(eq(vitalSigns.id, input.id))
        .returning();

      if (!sign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Constante non trouvee' });
      }
      return sign;
    }),
});
```

- [ ] **Step 3: Add vitalSigns router to `router.ts`**

Update `nephrosys/src/server/trpc/router.ts` — add import and merge:

```typescript
import { vitalSignsRouter } from './routers/vital-signs.router';
```

```typescript
vitalSigns: vitalSignsRouter,
```

Full file:

```typescript
import { router } from '@/server/trpc';
import { authRouter } from './routers/auth.router';
import { patientsRouter } from './routers/patients.router';
import { usersRouter } from './routers/users.router';
import { postesRouter } from './routers/postes.router';
import { seuilsRouter } from './routers/seuils.router';
import { planningsRouter } from './routers/plannings.router';
import { sessionsRouter } from './routers/sessions.router';
import { vitalSignsRouter } from './routers/vital-signs.router';

export const appRouter = router({
  auth: authRouter,
  patients: patientsRouter,
  users: usersRouter,
  postes: postesRouter,
  seuils: seuilsRouter,
  plannings: planningsRouter,
  sessions: sessionsRouter,
  vitalSigns: vitalSignsRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd nephrosys && pnpm tsc --noEmit
```

**Commit:** `feat(vital-signs): add vital signs router with CRUD and session validation`

---

### Task 8: Bilans Router + Validators

**Files:**
- Create: `nephrosys/src/lib/validators/bilans.ts`
- Create: `nephrosys/src/server/trpc/routers/bilans.router.ts`
- Create: `nephrosys/tests/unit/bilans-validators.test.ts`
- Modify: `nephrosys/src/server/trpc/router.ts`

**Interfaces:**
- Consumes: `bilans` table, `seuilsCliniques` table, `calculateBioStatus`, `calculateProductCaP`, `calculateURR`
- Produces: `bilansRouter` with `list`, `getById`, `create`, `update`, `delete`

- [ ] **Step 1: Write failing validator tests**

Create `nephrosys/tests/unit/bilans-validators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  createBilanSchema,
  updateBilanSchema,
  bilanListSchema,
} from '@/lib/validators/bilans';

describe('createBilanSchema', () => {
  it('accepts valid bilan creation data', () => {
    const result = createBilanSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      physicianId: '550e8400-e29b-41d4-a716-446655440001',
      dateBilan: '2026-08-10T10:00:00.000Z',
      typeBilan: 'mensuel',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type_bilan', () => {
    const result = createBilanSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      physicianId: '550e8400-e29b-41d4-a716-446655440001',
      dateBilan: '2026-08-10T10:00:00.000Z',
      typeBilan: 'quotidien',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing patientId', () => {
    const result = createBilanSchema.safeParse({
      physicianId: '550e8400-e29b-41d4-a716-446655440001',
      dateBilan: '2026-08-10T10:00:00.000Z',
      typeBilan: 'mensuel',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateBilanSchema', () => {
  it('requires id', () => {
    const result = updateBilanSchema.safeParse({
      hemoglobine: 12.5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts hematologie fields', () => {
    const result = updateBilanSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      hemoglobine: 12.5,
      hematocrite: 38.0,
      globulesBlancs: 7.2,
      plaquettes: 250000,
      ferritine: 450,
    });
    expect(result.success).toBe(true);
  });

  it('accepts serologie enum values', () => {
    const result = updateBilanSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      hbsAg: 'negatif',
      antiHbs: 'positif',
      antiHcv: 'non_fait',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid serologie value', () => {
    const result = updateBilanSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      hbsAg: 'inconnu',
    });
    expect(result.success).toBe(false);
  });

  it('accepts electrolytes fields', () => {
    const result = updateBilanSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      sodium: 140,
      potassium: 4.5,
      calcium: 2.3,
      phosphore: 1.2,
    });
    expect(result.success).toBe(true);
  });
});

describe('bilanListSchema', () => {
  it('provides defaults', () => {
    const result = bilanListSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
  });

  it('accepts all filters', () => {
    const result = bilanListSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      typeBilan: 'trimestriel',
      dateDebut: '2026-01-01',
      dateFin: '2026-12-31',
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd nephrosys && pnpm test -- tests/unit/bilans-validators.test.ts
```

- [ ] **Step 3: Create validators**

Create `nephrosys/src/lib/validators/bilans.ts`:

```typescript
import { z } from 'zod';

const serologieEnum = z.enum(['positif', 'negatif', 'non_fait'], {
  errorMap: () => ({ message: 'Valeur serologie invalide (positif, negatif, non_fait)' }),
});

export const createBilanSchema = z.object({
  patientId: z.string().uuid('Patient ID invalide'),
  physicianId: z.string().uuid('Medecin ID invalide'),
  dateBilan: z.string().datetime({ message: 'Date invalide' }),
  typeBilan: z.enum(['mensuel', 'trimestriel', 'semestriel', 'annuel'], {
    errorMap: () => ({ message: 'Type de bilan invalide' }),
  }),
  notes: z.string().optional(),
});

export type CreateBilanInput = z.infer<typeof createBilanSchema>;

export const updateBilanSchema = z.object({
  id: z.string().uuid('ID invalide'),

  // En-tete
  notes: z.string().optional(),

  // Hematologie
  hemoglobine: z.number().positive().optional(),
  hematocrite: z.number().positive().optional(),
  globulesBlancs: z.number().positive().optional(),
  plaquettes: z.number().positive().optional(),
  neutrophiles: z.number().min(0).optional(),
  eosinophiles: z.number().min(0).optional(),
  basophiles: z.number().min(0).optional(),
  lymphocytes: z.number().min(0).optional(),
  monocytes: z.number().min(0).optional(),
  ferritine: z.number().positive().optional(),
  saturationTransferrine: z.number().min(0).max(100).optional(),
  vgm: z.number().positive().optional(),
  ccmh: z.number().positive().optional(),

  // Biochimie renale
  creatinine: z.number().positive().optional(),
  ureePre: z.number().min(0).optional(),
  ureePost: z.number().min(0).optional(),
  acideUrique: z.number().positive().optional(),
  uricemie: z.number().positive().optional(),
  dfgMdrd: z.number().positive().optional(),

  // Electrolytes
  sodium: z.number().positive().optional(),
  potassium: z.number().positive().optional(),
  chlore: z.number().positive().optional(),
  calcium: z.number().positive().optional(),
  phosphore: z.number().positive().optional(),
  bicarbonateBilan: z.number().positive().optional(),
  reserveAlcaline: z.number().positive().optional(),

  // Mineraux / Os
  pth: z.number().positive().optional(),
  vitamineD: z.number().positive().optional(),
  phosphataseAlcaline: z.number().positive().optional(),

  // Lipides
  hdl: z.number().positive().optional(),
  ldl: z.number().positive().optional(),
  cholesterolTotal: z.number().positive().optional(),
  triglycerides: z.number().positive().optional(),

  // Nutrition / Inflammation
  albumine: z.number().positive().optional(),
  prealbumine: z.number().positive().optional(),
  proteinesTotales: z.number().positive().optional(),
  proteidemie: z.number().positive().optional(),
  crp: z.number().min(0).optional(),

  // Hepatique
  alat: z.number().positive().optional(),
  asat: z.number().positive().optional(),
  gammaGt: z.number().positive().optional(),
  ldhBilan: z.number().positive().optional(),
  cpk: z.number().positive().optional(),
  haptoglobine: z.number().positive().optional(),
  bilirubineTotale: z.number().positive().optional(),
  bilirubineIndirecte: z.number().positive().optional(),
  schizocytes: z.string().max(50).optional(),
  rac: z.string().max(50).optional(),

  // Martial
  cst: z.number().min(0).max(100).optional(),
  ferSerique: z.number().positive().optional(),

  // Glycemie
  gaj: z.number().positive().optional(),
  hba1c: z.number().min(0).max(20).optional(),

  // Urines
  pu24h: z.string().max(50).optional(),
  eppu: z.string().max(50).optional(),
  ecbu: z.string().max(50).optional(),
  nau: z.number().positive().optional(),
  ku: z.number().positive().optional(),
  rapportNaK: z.number().positive().optional(),
  ureeUrinaire: z.number().positive().optional(),
  creatUrinaire: z.number().positive().optional(),

  // PBR
  pbrResultat: z.string().optional(),

  // Serologies
  hbsAg: serologieEnum.optional(),
  antiHbs: serologieEnum.optional(),
  antiHbc: serologieEnum.optional(),
  antiHcv: serologieEnum.optional(),
  antiHiv: serologieEnum.optional(),
  tpha: serologieEnum.optional(),
  vdrl: serologieEnum.optional(),
});

export type UpdateBilanInput = z.infer<typeof updateBilanSchema>;

export const bilanListSchema = z.object({
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(20),
  patientId: z.string().uuid().optional(),
  typeBilan: z.enum(['mensuel', 'trimestriel', 'semestriel', 'annuel']).optional(),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
});

export type BilanListInput = z.infer<typeof bilanListSchema>;
```

- [ ] **Step 4: Run tests — expect green**

```bash
cd nephrosys && pnpm test -- tests/unit/bilans-validators.test.ts
```

- [ ] **Step 5: Create `bilans.router.ts`**

Create `nephrosys/src/server/trpc/routers/bilans.router.ts`:

```typescript
import { router, roleProcedure } from '@/server/trpc';
import { bilans, patients, users, seuilsCliniques } from '@/server/db/schema';
import { createBilanSchema, updateBilanSchema, bilanListSchema } from '@/lib/validators/bilans';
import { calculateBioStatus, calculateProductCaP, calculateURR } from '@/lib/clinical-calculations';
import { eq, and, gte, lte, count, desc } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

/** Generate reference: BIO-YYYYMMDD-NNN */
async function generateReference(db: any, dateBilan: Date): Promise<string> {
  const dateStr = dateBilan.toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `BIO-${dateStr}-`;

  // Count existing bilans for this date
  const [{ total }] = await db
    .select({ total: count() })
    .from(bilans)
    .where(eq(bilans.dateBilan, dateBilan));

  const num = (total + 1).toString().padStart(3, '0');
  return `${prefix}${num}`;
}

/** Load seuils into a map for quick lookup */
async function loadSeuils(db: any): Promise<Map<string, { seuilBas: number | null; seuilHaut: number | null }>> {
  const rows = await db.select().from(seuilsCliniques);
  const map = new Map<string, { seuilBas: number | null; seuilHaut: number | null }>();
  for (const row of rows) {
    map.set(row.parametre, {
      seuilBas: row.seuilBas ? parseFloat(row.seuilBas) : null,
      seuilHaut: row.seuilHaut ? parseFloat(row.seuilHaut) : null,
    });
  }
  return map;
}

export const bilansRouter = router({
  list: roleProcedure(['admin', 'medecin', 'infirmiere'])
    .input(bilanListSchema)
    .query(async ({ ctx, input }) => {
      const { page, perPage, patientId, typeBilan, dateDebut, dateFin } = input;
      const offset = (page - 1) * perPage;

      const conditions = [];

      if (patientId) {
        conditions.push(eq(bilans.patientId, patientId));
      }
      if (typeBilan) {
        conditions.push(eq(bilans.typeBilan, typeBilan));
      }
      if (dateDebut) {
        conditions.push(gte(bilans.dateBilan, new Date(dateDebut)));
      }
      if (dateFin) {
        conditions.push(lte(bilans.dateBilan, new Date(dateFin)));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [data, [{ total }]] = await Promise.all([
        ctx.db
          .select({
            bilan: bilans,
            patient: { id: patients.id, nom: patients.nom, prenom: patients.prenom },
            physician: { id: users.id, nom: users.nom, prenom: users.prenom },
          })
          .from(bilans)
          .innerJoin(patients, eq(bilans.patientId, patients.id))
          .innerJoin(users, eq(bilans.physicianId, users.id))
          .where(where)
          .orderBy(desc(bilans.dateBilan))
          .limit(perPage)
          .offset(offset),
        ctx.db
          .select({ total: count() })
          .from(bilans)
          .where(where),
      ]);

      return { data, total };
    }),

  getById: roleProcedure(['admin', 'medecin', 'infirmiere'])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [bilan] = await ctx.db
        .select()
        .from(bilans)
        .where(eq(bilans.id, input.id))
        .limit(1);

      if (!bilan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bilan non trouve' });
      }

      const [patient] = await ctx.db
        .select({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
        .from(patients)
        .where(eq(patients.id, bilan.patientId))
        .limit(1);

      const [physician] = await ctx.db
        .select({ id: users.id, nom: users.nom, prenom: users.prenom })
        .from(users)
        .where(eq(users.id, bilan.physicianId))
        .limit(1);

      return { ...bilan, patient, physician };
    }),

  create: roleProcedure(['admin', 'medecin'])
    .input(createBilanSchema)
    .mutation(async ({ ctx, input }) => {
      const dateBilan = new Date(input.dateBilan);
      const reference = await generateReference(ctx.db, dateBilan);

      const [bilan] = await ctx.db
        .insert(bilans)
        .values({
          reference,
          patientId: input.patientId,
          physicianId: input.physicianId,
          dateBilan,
          typeBilan: input.typeBilan,
          notes: input.notes ?? null,
        })
        .returning();

      return bilan;
    }),

  update: roleProcedure(['admin', 'medecin'])
    .input(updateBilanSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [existing] = await ctx.db
        .select()
        .from(bilans)
        .where(eq(bilans.id, id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bilan non trouve' });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      // Map all fields (converting numbers to strings for decimal columns)
      const decimalFields = [
        'hemoglobine', 'hematocrite', 'globulesBlancs', 'plaquettes',
        'neutrophiles', 'eosinophiles', 'basophiles', 'lymphocytes', 'monocytes',
        'ferritine', 'saturationTransferrine', 'vgm', 'ccmh',
        'creatinine', 'ureePre', 'ureePost', 'acideUrique', 'uricemie', 'dfgMdrd',
        'sodium', 'potassium', 'chlore', 'calcium', 'phosphore',
        'bicarbonateBilan', 'reserveAlcaline',
        'pth', 'vitamineD', 'phosphataseAlcaline',
        'hdl', 'ldl', 'cholesterolTotal', 'triglycerides',
        'albumine', 'prealbumine', 'proteinesTotales', 'proteidemie', 'crp',
        'alat', 'asat', 'gammaGt', 'ldhBilan', 'cpk',
        'haptoglobine', 'bilirubineTotale', 'bilirubineIndirecte',
        'cst', 'ferSerique',
        'gaj', 'hba1c',
        'nau', 'ku', 'rapportNaK', 'ureeUrinaire', 'creatUrinaire',
      ] as const;

      for (const field of decimalFields) {
        if ((data as any)[field] !== undefined) {
          updateData[field] = (data as any)[field]?.toString() ?? null;
        }
      }

      // String fields
      const stringFields = [
        'notes', 'schizocytes', 'rac', 'pu24h', 'eppu', 'ecbu', 'pbrResultat',
      ] as const;

      for (const field of stringFields) {
        if ((data as any)[field] !== undefined) {
          updateData[field] = (data as any)[field] ?? null;
        }
      }

      // Serologie enum fields
      const serologieFields = [
        'hbsAg', 'antiHbs', 'antiHbc', 'antiHcv', 'antiHiv', 'tpha', 'vdrl',
      ] as const;

      for (const field of serologieFields) {
        if ((data as any)[field] !== undefined) {
          updateData[field] = (data as any)[field] ?? null;
        }
      }

      // Auto-calculate produit Ca x P
      const ca = data.calcium ?? (existing.calcium ? parseFloat(existing.calcium) : null);
      const p = data.phosphore ?? (existing.phosphore ? parseFloat(existing.phosphore) : null);
      const produit = calculateProductCaP(ca, p);
      if (produit != null) {
        updateData.produitCaP = produit.toString();
      }

      // Auto-calculate URR
      const ureePre = data.ureePre ?? (existing.ureePre ? parseFloat(existing.ureePre) : null);
      const ureePost = data.ureePost ?? (existing.ureePost ? parseFloat(existing.ureePost) : null);
      const urr = calculateURR(ureePre, ureePost);
      if (urr != null) {
        updateData.urrCalculated = urr.toString();
      }

      // Auto-calculate bio statuses
      const seuils = await loadSeuils(ctx.db);

      const statusMappings: { field: string; parametre: string; valueField: string }[] = [
        { field: 'hbStatut', parametre: 'hemoglobine', valueField: 'hemoglobine' },
        { field: 'potassiumStatut', parametre: 'potassium', valueField: 'potassium' },
        { field: 'phosphoreStatut', parametre: 'phosphore', valueField: 'phosphore' },
        { field: 'albumineStatut', parametre: 'albumine', valueField: 'albumine' },
        { field: 'pthStatut', parametre: 'pth', valueField: 'pth' },
        { field: 'caPStatut', parametre: 'produit_ca_p', valueField: 'produitCaP' },
      ];

      for (const mapping of statusMappings) {
        const seuil = seuils.get(mapping.parametre);
        if (!seuil) continue;

        // Get value: from input or existing or computed (produitCaP)
        let value: number | null = null;
        if (mapping.valueField === 'produitCaP') {
          value = produit;
        } else if ((data as any)[mapping.valueField] !== undefined) {
          value = (data as any)[mapping.valueField] ?? null;
        } else if ((existing as any)[mapping.valueField]) {
          value = parseFloat((existing as any)[mapping.valueField]);
        }

        const status = calculateBioStatus(value, seuil.seuilBas, seuil.seuilHaut);
        updateData[mapping.field] = status;
      }

      const [bilan] = await ctx.db
        .update(bilans)
        .set(updateData)
        .where(eq(bilans.id, id))
        .returning();

      return bilan;
    }),

  delete: roleProcedure(['admin'])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [bilan] = await ctx.db
        .delete(bilans)
        .where(eq(bilans.id, input.id))
        .returning();

      if (!bilan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bilan non trouve' });
      }
      return bilan;
    }),
});
```

- [ ] **Step 6: Add bilans router to `router.ts`**

Final `nephrosys/src/server/trpc/router.ts`:

```typescript
import { router } from '@/server/trpc';
import { authRouter } from './routers/auth.router';
import { patientsRouter } from './routers/patients.router';
import { usersRouter } from './routers/users.router';
import { postesRouter } from './routers/postes.router';
import { seuilsRouter } from './routers/seuils.router';
import { planningsRouter } from './routers/plannings.router';
import { sessionsRouter } from './routers/sessions.router';
import { vitalSignsRouter } from './routers/vital-signs.router';
import { bilansRouter } from './routers/bilans.router';

export const appRouter = router({
  auth: authRouter,
  patients: patientsRouter,
  users: usersRouter,
  postes: postesRouter,
  seuils: seuilsRouter,
  plannings: planningsRouter,
  sessions: sessionsRouter,
  vitalSigns: vitalSignsRouter,
  bilans: bilansRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd nephrosys && pnpm tsc --noEmit
```

**Commit:** `feat(bilans): add bilans router with auto-calculated statuses and validators`

---

### Task 9: Planning UI — 3 Views

**Files:**
- Create: `nephrosys/src/components/planning/planning-grid-view.tsx`
- Create: `nephrosys/src/components/planning/planning-calendar-view.tsx`
- Create: `nephrosys/src/components/planning/planning-list-view.tsx`
- Create: `nephrosys/src/app/(dashboard)/planning/page.tsx`

**Interfaces:**
- Consumes: `api.plannings.list`, `api.plannings.generateWeekSessions`, `api.postes.list`, `api.sessions.list`
- Produces: `/planning` page with 3 switchable views

- [ ] **Step 1: Create Grid View component**

Create `nephrosys/src/components/planning/planning-grid-view.tsx`:

```tsx
'use client';

import { api } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const VACATIONS = ['matin', 'apres_midi'] as const;
const VACATION_LABELS: Record<string, string> = { matin: 'Matin (7H-11H)', apres_midi: 'Apres-midi (12H-16H)' };

export function PlanningGridView() {
  const [jourIndex, setJourIndex] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

  const { data: postes, isLoading: postesLoading } = api.postes.list.useQuery();
  const { data: planningData, isLoading: planningsLoading } = api.plannings.list.useQuery({
    jourSemaine: jourIndex,
  });

  const isLoading = postesLoading || planningsLoading;

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const activePostes = postes?.filter((p) => p.isActive) ?? [];

  // Build lookup: posteId+vacation -> planning
  const planningMap = new Map<string, NonNullable<typeof planningData>[number]>();
  for (const item of planningData ?? []) {
    const key = `${item.planning.posteId}-${item.planning.vacation}`;
    planningMap.set(key, item);
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setJourIndex((j) => (j === 0 ? 6 : j - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold">{JOURS[jourIndex]}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setJourIndex((j) => (j === 6 ? 0 : j + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2 text-left">Vacation</th>
              {activePostes.map((poste) => (
                <th
                  key={poste.id}
                  className={`px-3 py-2 text-center ${poste.isVip ? 'border-2 border-amber-400' : ''}`}
                >
                  {poste.nom}
                  {poste.isVip && <Badge className="ml-1 bg-amber-100 text-amber-800 text-xs">VIP</Badge>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VACATIONS.map((vacation) => (
              <tr key={vacation} className="border-b">
                <td className="px-3 py-4 font-medium">{VACATION_LABELS[vacation]}</td>
                {activePostes.map((poste) => {
                  const key = `${poste.id}-${vacation}`;
                  const item = planningMap.get(key);
                  return (
                    <td
                      key={poste.id}
                      className={`px-3 py-4 text-center ${
                        poste.isVip ? 'bg-amber-50 dark:bg-amber-950' : ''
                      } ${!item ? 'text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}`}
                    >
                      {item ? (
                        <div className="text-xs">
                          <p className="font-medium">{item.patient.nom} {item.patient.prenom}</p>
                          <p className="text-gray-500">Dr {item.medecin.nom}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Calendar View component**

Create `nephrosys/src/components/planning/planning-calendar-view.tsx`:

```tsx
'use client';

import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const VACATION_LABELS: Record<string, string> = { matin: 'M', apres_midi: 'AM' };

export function PlanningCalendarView() {
  const { data: postes, isLoading: postesLoading } = api.postes.list.useQuery();

  // Load plannings for all days 0-5 (lun-sam)
  const { data: allPlannings, isLoading: planningsLoading } = api.plannings.list.useQuery({});

  const isLoading = postesLoading || planningsLoading;

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const activePostes = postes?.filter((p) => p.isActive) ?? [];

  // Build lookup: jourSemaine+posteId+vacation -> planning
  const planningMap = new Map<string, NonNullable<typeof allPlannings>[number]>();
  for (const item of allPlannings ?? []) {
    const key = `${item.planning.jourSemaine}-${item.planning.posteId}-${item.planning.vacation}`;
    planningMap.set(key, item);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-2 text-left">Poste</th>
            {JOURS.map((jour, i) => (
              <th key={i} className="px-2 py-2 text-center" colSpan={1}>
                {jour}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activePostes.map((poste) => (
            <tr key={poste.id} className={`border-b ${poste.isVip ? 'bg-amber-50 dark:bg-amber-950' : ''}`}>
              <td className="px-2 py-2 font-medium whitespace-nowrap">
                {poste.nom}
                {poste.isVip && <Badge className="ml-1 bg-amber-100 text-amber-800 text-xs">VIP</Badge>}
              </td>
              {JOURS.map((_, jourIndex) => (
                <td key={jourIndex} className="px-1 py-1">
                  <div className="space-y-1">
                    {(['matin', 'apres_midi'] as const).map((vacation) => {
                      const key = `${jourIndex}-${poste.id}-${vacation}`;
                      const item = planningMap.get(key);
                      return (
                        <div
                          key={vacation}
                          className={`rounded px-1 py-0.5 text-center ${
                            item
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-gray-50 text-gray-300 dark:bg-gray-800'
                          }`}
                        >
                          {item ? (
                            <span className="truncate block">{VACATION_LABELS[vacation]}: {item.patient.nom}</span>
                          ) : (
                            <span>{VACATION_LABELS[vacation]}: —</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create List View component**

Create `nephrosys/src/components/planning/planning-list-view.tsx`:

```tsx
'use client';

import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const VACATION_LABELS: Record<string, string> = { matin: 'Matin', apres_midi: 'Apres-midi' };

export function PlanningListView() {
  const { data: allPlannings, isLoading } = api.plannings.list.useQuery({});

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  // Group by jour_semaine
  const grouped = new Map<number, NonNullable<typeof allPlannings>>();
  for (const item of allPlannings ?? []) {
    const jour = item.planning.jourSemaine;
    if (!grouped.has(jour)) grouped.set(jour, []);
    grouped.get(jour)!.push(item);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries())
        .sort(([a], [b]) => a - b)
        .map(([jour, items]) => {
          const matin = items.filter((i) => i.planning.vacation === 'matin');
          const apresmidi = items.filter((i) => i.planning.vacation === 'apres_midi');

          return (
            <div key={jour}>
              <h3 className="mb-2 text-lg font-semibold">
                {JOURS[jour]}{' '}
                <span className="text-sm font-normal text-gray-500">
                  ({matin.length} matin, {apresmidi.length} apres-midi)
                </span>
              </h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Vacation</th>
                    <th className="px-3 py-2 text-left">Poste</th>
                    <th className="px-3 py-2 text-left">Patient</th>
                    <th className="px-3 py-2 text-left">Medecin</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.planning.id} className="border-b">
                      <td className="px-3 py-2">{VACATION_LABELS[item.planning.vacation]}</td>
                      <td className="px-3 py-2">
                        {item.poste.nom}
                        {item.poste.isVip && (
                          <Badge className="ml-1 bg-amber-100 text-amber-800 text-xs">VIP</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">{item.patient.nom} {item.patient.prenom}</td>
                      <td className="px-3 py-2">Dr {item.medecin.nom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

      {grouped.size === 0 && (
        <p className="text-center text-gray-500 py-8">Aucune affectation trouvee</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create planning page with view switcher**

Create `nephrosys/src/app/(dashboard)/planning/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/trpc/client';
import { PlanningGridView } from '@/components/planning/planning-grid-view';
import { PlanningCalendarView } from '@/components/planning/planning-calendar-view';
import { PlanningListView } from '@/components/planning/planning-list-view';
import { Grid3X3, Calendar, List } from 'lucide-react';

type ViewMode = 'grille' | 'calendrier' | 'liste';

export default function PlanningPage() {
  const [view, setView] = useState<ViewMode>('grille');
  const [weekStart, setWeekStart] = useState('');

  const generateMutation = api.plannings.generateWeekSessions.useMutation();

  const handleGenerate = () => {
    if (!weekStart) return;
    generateMutation.mutate({ weekStart });
  };

  // Default weekStart to next Monday
  const getNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Planning
        </h1>

        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex rounded-lg border">
            <Button
              variant={view === 'grille' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('grille')}
            >
              <Grid3X3 className="mr-1 h-4 w-4" /> Grille
            </Button>
            <Button
              variant={view === 'calendrier' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('calendrier')}
            >
              <Calendar className="mr-1 h-4 w-4" /> Calendrier
            </Button>
            <Button
              variant={view === 'liste' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('liste')}
            >
              <List className="mr-1 h-4 w-4" /> Liste
            </Button>
          </div>
        </div>
      </div>

      {/* Session generation */}
      <div className="mb-6 flex items-center gap-3 rounded-lg border p-3">
        <label className="text-sm font-medium">Generer les seances de la semaine du :</label>
        <input
          type="date"
          className="rounded border px-2 py-1 text-sm"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          defaultValue={getNextMonday()}
        />
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={!weekStart || generateMutation.isPending}
        >
          {generateMutation.isPending ? 'Generation...' : 'Generer'}
        </Button>
        {generateMutation.data && (
          <span className="text-sm text-green-600">{generateMutation.data.message}</span>
        )}
      </div>

      {/* Current view */}
      {view === 'grille' && <PlanningGridView />}
      {view === 'calendrier' && <PlanningCalendarView />}
      {view === 'liste' && <PlanningListView />}
    </div>
  );
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd nephrosys && pnpm tsc --noEmit
```

**Commit:** `feat(planning-ui): add planning page with grid, calendar, and list views`

---

### Task 10: Sessions UI — List, Create, Detail

**Files:**
- Create: `nephrosys/src/components/sessions/session-table.tsx`
- Create: `nephrosys/src/components/sessions/pre-dialyse-tab.tsx`
- Create: `nephrosys/src/components/sessions/machine-tab.tsx`
- Create: `nephrosys/src/components/sessions/constantes-tab.tsx`
- Create: `nephrosys/src/components/sessions/fin-seance-tab.tsx`
- Create: `nephrosys/src/components/sessions/session-form.tsx`
- Create: `nephrosys/src/app/(dashboard)/seances/page.tsx`
- Create: `nephrosys/src/app/(dashboard)/seances/nouvelle/page.tsx`
- Create: `nephrosys/src/app/(dashboard)/seances/[id]/page.tsx`

**Interfaces:**
- Consumes: `api.sessions.*`, `api.vitalSigns.*`, `api.postes.list`, `api.patients.list`
- Produces: `/seances`, `/seances/nouvelle`, `/seances/[id]` pages

- [ ] **Step 1: Create session-table.tsx**

Create `nephrosys/src/components/sessions/session-table.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const STATUT_BADGES: Record<string, { className: string; label: string }> = {
  planifiee: { className: 'bg-blue-100 text-blue-800', label: 'Planifiee' },
  en_cours: { className: 'bg-orange-100 text-orange-800', label: 'En cours' },
  terminee: { className: 'bg-green-100 text-green-800', label: 'Terminee' },
  annulee: { className: 'bg-red-100 text-red-800', label: 'Annulee' },
};

export function SessionTable() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [statut, setStatut] = useState<string>('');

  const { data, isLoading } = api.sessions.list.useQuery({
    date: date || undefined,
    statut: statut ? (statut as any) : undefined,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-48"
        />
        <select
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="planifiee">Planifiee</option>
          <option value="en_cours">En cours</option>
          <option value="terminee">Terminee</option>
          <option value="annulee">Annulee</option>
        </select>
        <Link href="/seances/nouvelle">
          <Button>Nouvelle seance</Button>
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left">Patient</th>
              <th className="px-3 py-2 text-left">Poste</th>
              <th className="px-3 py-2 text-left">Medecin</th>
              <th className="px-3 py-2 text-center">Statut</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((row) => {
              const badge = STATUT_BADGES[row.session.statut] ?? STATUT_BADGES.planifiee;
              return (
                <tr key={row.session.id} className="border-b">
                  <td className="px-3 py-2">{row.patient.nom} {row.patient.prenom}</td>
                  <td className="px-3 py-2">{row.poste.nom}</td>
                  <td className="px-3 py-2">Dr {row.physician.nom}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Link href={`/seances/${row.session.id}`}>
                      <Button variant="outline" size="sm">Ouvrir</Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(!data?.data || data.data.length === 0) && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  Aucune seance trouvee
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data && (
        <p className="mt-2 text-xs text-gray-500">{data.total} seance(s) au total</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create pre-dialyse-tab.tsx**

Create `nephrosys/src/components/sessions/pre-dialyse-tab.tsx`:

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updatePreDialyseSchema, type UpdatePreDialyseInput } from '@/lib/validators/sessions';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  sessionId: string;
  defaultValues: Partial<UpdatePreDialyseInput>;
  isLocked: boolean;
};

export function PreDialyseTab({ sessionId, defaultValues, isLocked }: Props) {
  const utils = api.useUtils();
  const mutation = api.sessions.updatePreDialyse.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePreDialyseInput>({
    resolver: zodResolver(updatePreDialyseSchema),
    defaultValues: { id: sessionId, ...defaultValues },
  });

  const onSubmit = (data: UpdatePreDialyseInput) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register('id')} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Statut arrivee</label>
          <select {...register('arrivalStatus')} disabled={isLocked} className="w-full rounded border px-2 py-1">
            <option value="">—</option>
            <option value="stable">Stable</option>
            <option value="malade">Malade</option>
            <option value="urgence">Urgence</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Poids arrivee (kg)</label>
          <Input type="number" step="0.01" {...register('arrivalWeight', { valueAsNumber: true })} disabled={isLocked} />
          {errors.arrivalWeight && <p className="text-sm text-red-500">{errors.arrivalWeight.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Poids sec (kg)</label>
          <Input type="number" step="0.01" {...register('dryWeight', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">TA pre-dialyse</label>
          <Input placeholder="140/90" {...register('taPreDialyse')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">TA debout</label>
          <Input placeholder="135/85" {...register('taDebout')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">TA couche</label>
          <Input placeholder="130/80" {...register('taCoucher')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Temperature (°C)</label>
          <Input type="number" step="0.1" {...register('temperaturePre', { valueAsNumber: true })} disabled={isLocked} />
        </div>
      </div>

      {!isLocked && (
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Enregistrement...' : 'Enregistrer pre-dialyse'}
        </Button>
      )}
      {mutation.isSuccess && <p className="text-sm text-green-600">Enregistre</p>}
    </form>
  );
}
```

- [ ] **Step 3: Create machine-tab.tsx**

Create `nephrosys/src/components/sessions/machine-tab.tsx`:

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateMachineSchema, type UpdateMachineInput } from '@/lib/validators/sessions';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  sessionId: string;
  defaultValues: Partial<UpdateMachineInput>;
  isLocked: boolean;
};

export function MachineTab({ sessionId, defaultValues, isLocked }: Props) {
  const utils = api.useUtils();
  const mutation = api.sessions.updateMachine.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateMachineInput>({
    resolver: zodResolver(updateMachineSchema),
    defaultValues: { id: sessionId, ...defaultValues },
  });

  const onSubmit = (data: UpdateMachineInput) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register('id')} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Type de dialyse</label>
          <select {...register('typeDialyse')} disabled={isLocked} className="w-full rounded border px-2 py-1">
            <option value="">—</option>
            <option value="hemodialyse">Hemodialyse</option>
            <option value="hemodiafiltration">Hemodiafiltration</option>
            <option value="dialyse_peritoneale">Dialyse peritoneale</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Dialyseur (rein artificiel)</label>
          <Input {...register('dialyzerType')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Abord vasculaire</label>
          <Input {...register('typeAbordVasculaire')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Debit sang (ml/min)</label>
          <Input type="number" step="0.1" {...register('debitSang', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Debit dialysat (ml/min)</label>
          <Input type="number" step="0.1" {...register('debitDialysat', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">UF prescrite (L)</label>
          <Input type="number" step="0.01" {...register('ufPrescrite', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">UF max (L)</label>
          <Input type="number" step="0.01" {...register('ufMax', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Duree prescrite (min)</label>
          <Input type="number" {...register('dureePrescrite', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Conductivite (mS/cm)</label>
          <Input type="number" step="0.01" {...register('conductivite', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bain calcium</label>
          <Input type="number" step="0.01" {...register('bainCalcium', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bain potassium</label>
          <Input type="number" step="0.01" {...register('bainPotassium', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bain glucose</label>
          <Input type="number" step="0.01" {...register('bainGlucose', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bain sodium</label>
          <Input {...register('bainSodium')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Temperature bain (°C)</label>
          <Input type="number" step="0.1" {...register('temperatureBain', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bicarbonate</label>
          <Input {...register('bicarbonate')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Anticoagulation</label>
          <Input {...register('anticoagulation')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Aiguille arterielle</label>
          <Input {...register('aiguilleArterielle')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Aiguille veineuse</label>
          <Input {...register('aiguilleVeineuse')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Ponction</label>
          <Input {...register('ponction')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Pression arterielle</label>
          <Input {...register('pressionArterielle')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Pression veineuse</label>
          <Input {...register('pressionVeineuse')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">PTM</label>
          <Input {...register('ptm')} disabled={isLocked} />
        </div>
      </div>

      {!isLocked && (
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Enregistrement...' : 'Enregistrer parametres machine'}
        </Button>
      )}
      {mutation.isSuccess && <p className="text-sm text-green-600">Enregistre</p>}
    </form>
  );
}
```

- [ ] **Step 4: Create constantes-tab.tsx**

Create `nephrosys/src/components/sessions/constantes-tab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';

type Props = {
  sessionId: string;
  sessionStatut: string;
  isLocked: boolean;
};

export function ConstantesTab({ sessionId, sessionStatut, isLocked }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [ta, setTa] = useState('');
  const [fc, setFc] = useState('');
  const [fr, setFr] = useState('');
  const [spo2, setSpo2] = useState('');
  const [temp, setTemp] = useState('');
  const [glycemie, setGlycemie] = useState('');
  const [hypotension, setHypotension] = useState(false);
  const [notes, setNotes] = useState('');

  const utils = api.useUtils();
  const { data: constantes, isLoading } = api.vitalSigns.listBySession.useQuery({ sessionId });
  const createMutation = api.vitalSigns.create.useMutation({
    onSuccess: () => {
      utils.vitalSigns.listBySession.invalidate({ sessionId });
      resetForm();
    },
  });
  const deleteMutation = api.vitalSigns.delete.useMutation({
    onSuccess: () => utils.vitalSigns.listBySession.invalidate({ sessionId }),
  });

  const resetForm = () => {
    setShowForm(false);
    setTa('');
    setFc('');
    setFr('');
    setSpo2('');
    setTemp('');
    setGlycemie('');
    setHypotension(false);
    setNotes('');
  };

  const handleCreate = () => {
    createMutation.mutate({
      sessionId,
      heureMesure: new Date().toISOString(),
      tensionArterielle: ta,
      frequenceCardiaque: fc ? parseInt(fc) : undefined,
      frequenceRespiratoire: fr ? parseInt(fr) : undefined,
      spo2: spo2 ? parseFloat(spo2) : undefined,
      temperature: temp ? parseFloat(temp) : undefined,
      glycemie: glycemie ? parseFloat(glycemie) : undefined,
      isHypotension: hypotension,
      notes: notes || undefined,
    });
  };

  const canAdd = sessionStatut === 'en_cours' && !isLocked;

  return (
    <div>
      {canAdd && (
        <div className="mb-4">
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" /> Nouveau releve
          </Button>
        </div>
      )}

      {showForm && (
        <div className="mb-6 rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs font-medium">TA *</label>
              <Input placeholder="130/80" value={ta} onChange={(e) => setTa(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">FC (bpm)</label>
              <Input type="number" value={fc} onChange={(e) => setFc(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">FR (c/min)</label>
              <Input type="number" value={fr} onChange={(e) => setFr(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">SpO2 (%)</label>
              <Input type="number" step="0.1" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Temperature (°C)</label>
              <Input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Glycemie (g/L)</label>
              <Input type="number" step="0.01" value={glycemie} onChange={(e) => setGlycemie(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <input
                type="checkbox"
                id="hypotension"
                checked={hypotension}
                onChange={(e) => setHypotension(e.target.checked)}
              />
              <label htmlFor="hypotension" className="text-xs font-medium">Hypotension</label>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={!ta || createMutation.isPending}>
              {createMutation.isPending ? 'Ajout...' : 'Ajouter'}
            </Button>
            <Button variant="outline" onClick={resetForm}>Annuler</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-2 py-2 text-left">Heure</th>
              <th className="px-2 py-2">TA</th>
              <th className="px-2 py-2">FC</th>
              <th className="px-2 py-2">FR</th>
              <th className="px-2 py-2">SpO2</th>
              <th className="px-2 py-2">T°</th>
              <th className="px-2 py-2">Glyc.</th>
              <th className="px-2 py-2">Hypo.</th>
              <th className="px-2 py-2 text-left">Notes</th>
              {canAdd && <th className="px-2 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {constantes?.map((c) => (
              <tr key={c.id} className={`border-b ${c.isHypotension ? 'bg-red-50 dark:bg-red-950' : ''}`}>
                <td className="px-2 py-2 text-xs">
                  {new Date(c.heureMesure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-2 py-2 text-center">{c.tensionArterielle}</td>
                <td className="px-2 py-2 text-center">{c.frequenceCardiaque ?? '—'}</td>
                <td className="px-2 py-2 text-center">{c.frequenceRespiratoire ?? '—'}</td>
                <td className="px-2 py-2 text-center">{c.spo2 ?? '—'}</td>
                <td className="px-2 py-2 text-center">{c.temperature ?? '—'}</td>
                <td className="px-2 py-2 text-center">{c.glycemie ?? '—'}</td>
                <td className="px-2 py-2 text-center">
                  {c.isHypotension && <Badge className="bg-red-100 text-red-800">Oui</Badge>}
                </td>
                <td className="px-2 py-2 text-xs">{c.notes ?? ''}</td>
                {canAdd && (
                  <td className="px-2 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate({ id: c.id })}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {(!constantes || constantes.length === 0) && (
              <tr>
                <td colSpan={canAdd ? 10 : 9} className="px-2 py-6 text-center text-gray-500">
                  Aucune constante enregistree
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create fin-seance-tab.tsx**

Create `nephrosys/src/components/sessions/fin-seance-tab.tsx`:

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateFinSeanceSchema, type UpdateFinSeanceInput } from '@/lib/validators/sessions';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Props = {
  sessionId: string;
  defaultValues: Partial<UpdateFinSeanceInput>;
  ktvCalculated?: string | null;
  ktvStatus?: string | null;
  urrCalculated?: string | null;
  isLocked: boolean;
};

export function FinSeanceTab({ sessionId, defaultValues, ktvCalculated, ktvStatus, urrCalculated, isLocked }: Props) {
  const utils = api.useUtils();
  const mutation = api.sessions.updateFinSeance.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateFinSeanceInput>({
    resolver: zodResolver(updateFinSeanceSchema),
    defaultValues: { id: sessionId, ...defaultValues },
  });

  const onSubmit = (data: UpdateFinSeanceInput) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <input type="hidden" {...register('id')} />

      <div>
        <h3 className="mb-3 text-lg font-semibold">Fin de seance</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Poids depart (kg)</label>
            <Input type="number" step="0.01" {...register('departureWeight', { valueAsNumber: true })} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">UF reelle (L)</label>
            <Input type="number" step="0.01" {...register('ufReelle', { valueAsNumber: true })} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Duree reelle (min)</label>
            <Input type="number" {...register('dureeReelle', { valueAsNumber: true })} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tolerance globale</label>
            <select {...register('toleranceGlobale')} disabled={isLocked} className="w-full rounded border px-2 py-1">
              <option value="">—</option>
              <option value="bonne">Bonne</option>
              <option value="moyenne">Moyenne</option>
              <option value="mauvaise">Mauvaise</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Aspect du rein</label>
            <Input {...register('aspectRein')} disabled={isLocked} />
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">Notes fin de seance</label>
            <textarea {...register('notesFin')} disabled={isLocked} className="w-full rounded border px-2 py-1" rows={2} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Adequation dialyse</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Uree pre-dialyse</label>
            <Input type="number" step="0.01" {...register('ureePre', { valueAsNumber: true })} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Uree post-dialyse</label>
            <Input type="number" step="0.01" {...register('ureePost', { valueAsNumber: true })} disabled={isLocked} />
          </div>
          <div className="flex items-end gap-4">
            {ktvCalculated && (
              <div>
                <span className="text-sm text-gray-500">Kt/V: </span>
                <span className="font-semibold">{ktvCalculated}</span>
                {ktvStatus && (
                  <Badge className={`ml-1 ${ktvStatus === 'adequate' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {ktvStatus === 'adequate' ? 'Adequat' : 'Inadequat'}
                  </Badge>
                )}
              </div>
            )}
            {urrCalculated && (
              <div>
                <span className="text-sm text-gray-500">URR: </span>
                <span className="font-semibold">{urrCalculated}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Clinique divers</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Traitement en cours</label>
            <textarea {...register('traitementEnCours')} disabled={isLocked} className="w-full rounded border px-2 py-1" rows={2} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Hemoculture</label>
            <Input {...register('hemoculture')} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Vaccination</label>
            <Input {...register('vaccination')} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Transfusion</label>
            <Input {...register('transfusion')} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Erythropoietine</label>
            <Input {...register('erythropoietine')} disabled={isLocked} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Observations</label>
            <textarea {...register('observations')} disabled={isLocked} className="w-full rounded border px-2 py-1" rows={3} />
          </div>
        </div>
      </div>

      {!isLocked && (
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Enregistrement...' : 'Enregistrer fin de seance'}
        </Button>
      )}
      {mutation.isSuccess && <p className="text-sm text-green-600">Enregistre</p>}
    </form>
  );
}
```

- [ ] **Step 6: Create pages**

Create `nephrosys/src/app/(dashboard)/seances/page.tsx`:

```tsx
'use client';

import { SessionTable } from '@/components/sessions/session-table';

export default function SeancesPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Seances de dialyse
      </h1>
      <SessionTable />
    </div>
  );
}
```

Create `nephrosys/src/app/(dashboard)/seances/nouvelle/page.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSessionSchema, type CreateSessionInput } from '@/lib/validators/sessions';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NouvelleSeancePage() {
  const router = useRouter();

  const { data: postesData } = api.postes.list.useQuery();
  const { data: patientsData } = api.patients.list.useQuery({ page: 1, perPage: 100 });
  const { data: usersData } = api.users.list.useQuery({ page: 1, perPage: 100 });

  const createMutation = api.sessions.create.useMutation({
    onSuccess: (session) => {
      router.push(`/seances/${session.id}`);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSessionInput>({
    resolver: zodResolver(createSessionSchema),
    defaultValues: {
      dateSeance: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = (data: CreateSessionInput) => {
    createMutation.mutate(data);
  };

  const medecins = usersData?.data.filter((u) => u.role === 'medecin') ?? [];
  const infirmieres = usersData?.data.filter((u) => u.role === 'infirmiere') ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Nouvelle seance
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Patient *</label>
          <select {...register('patientId')} className="w-full rounded border px-2 py-1">
            <option value="">Selectionner un patient</option>
            {patientsData?.data.map((p) => (
              <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
            ))}
          </select>
          {errors.patientId && <p className="text-sm text-red-500">{errors.patientId.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Date *</label>
          <Input type="date" {...register('dateSeance')} />
          {errors.dateSeance && <p className="text-sm text-red-500">{errors.dateSeance.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Poste *</label>
          <select {...register('posteId')} className="w-full rounded border px-2 py-1">
            <option value="">Selectionner un poste</option>
            {postesData?.filter((p) => p.isActive).map((p) => (
              <option key={p.id} value={p.id}>{p.nom}{p.isVip ? ' (VIP)' : ''}</option>
            ))}
          </select>
          {errors.posteId && <p className="text-sm text-red-500">{errors.posteId.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Medecin *</label>
          <select {...register('physicianId')} className="w-full rounded border px-2 py-1">
            <option value="">Selectionner un medecin</option>
            {medecins.map((u) => (
              <option key={u.id} value={u.id}>Dr {u.nom} {u.prenom}</option>
            ))}
          </select>
          {errors.physicianId && <p className="text-sm text-red-500">{errors.physicianId.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Infirmier(e) *</label>
          <select {...register('nurseId')} className="w-full rounded border px-2 py-1">
            <option value="">Selectionner un(e) infirmier(e)</option>
            {infirmieres.map((u) => (
              <option key={u.id} value={u.id}>{u.nom} {u.prenom}</option>
            ))}
          </select>
          {errors.nurseId && <p className="text-sm text-red-500">{errors.nurseId.message}</p>}
        </div>

        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creation...' : 'Creer la seance'}
        </Button>
      </form>
    </div>
  );
}
```

Create `nephrosys/src/app/(dashboard)/seances/[id]/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PreDialyseTab } from '@/components/sessions/pre-dialyse-tab';
import { MachineTab } from '@/components/sessions/machine-tab';
import { ConstantesTab } from '@/components/sessions/constantes-tab';
import { FinSeanceTab } from '@/components/sessions/fin-seance-tab';

const TABS = ['Pre-dialyse', 'Machine', 'Constantes', 'Fin de seance'] as const;

const STATUT_BADGES: Record<string, { className: string; label: string }> = {
  planifiee: { className: 'bg-blue-100 text-blue-800', label: 'Planifiee' },
  en_cours: { className: 'bg-orange-100 text-orange-800', label: 'En cours' },
  terminee: { className: 'bg-green-100 text-green-800', label: 'Terminee' },
  annulee: { className: 'bg-red-100 text-red-800', label: 'Annulee' },
};

export default function SessionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState(0);

  const utils = api.useUtils();
  const { data: session, isLoading } = api.sessions.getById.useQuery({ id });
  const demarrerMutation = api.sessions.demarrer.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id }),
  });
  const terminerMutation = api.sessions.terminer.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id }),
  });
  const annulerMutation = api.sessions.annuler.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id }),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!session) return <p>Seance non trouvee</p>;

  const badge = STATUT_BADGES[session.statut] ?? STATUT_BADGES.planifiee;
  const isLocked = session.isLocked;

  // Calculate remaining modification time for terminee sessions
  let modificationRemaining = '';
  if (session.statut === 'terminee' && !isLocked) {
    const hoursAgo = (Date.now() - new Date(session.updatedAt).getTime()) / (1000 * 60 * 60);
    const remaining = Math.max(0, Math.round(24 - hoursAgo));
    modificationRemaining = `Modifiable encore ${remaining}h`;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Seance — {session.patient?.nom} {session.patient?.prenom}
          </h1>
          <p className="text-sm text-gray-500">
            {session.dateSeance} | {session.poste?.nom} | Dr {session.physician?.nom}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={badge.className}>{badge.label}</Badge>
          {isLocked && <Badge className="bg-gray-200 text-gray-700">Verrouillee</Badge>}
          {modificationRemaining && (
            <Badge className="bg-yellow-100 text-yellow-800">{modificationRemaining}</Badge>
          )}

          {session.statut === 'planifiee' && (
            <Button
              onClick={() => demarrerMutation.mutate({ id })}
              disabled={demarrerMutation.isPending}
            >
              Demarrer la seance
            </Button>
          )}
          {session.statut === 'en_cours' && (
            <Button
              onClick={() => terminerMutation.mutate({ id })}
              disabled={terminerMutation.isPending}
            >
              Terminer la seance
            </Button>
          )}
          {(session.statut === 'planifiee' || session.statut === 'en_cours') && (
            <Button
              variant="outline"
              onClick={() => annulerMutation.mutate({ id })}
              disabled={annulerMutation.isPending}
              className="text-red-600"
            >
              Annuler
            </Button>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mb-4 flex border-b">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === i
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 0 && (
        <PreDialyseTab
          sessionId={id}
          defaultValues={{
            arrivalStatus: session.arrivalStatus ?? undefined,
            arrivalWeight: session.arrivalWeight ? parseFloat(session.arrivalWeight) : undefined,
            dryWeight: session.dryWeight ? parseFloat(session.dryWeight) : undefined,
            taPreDialyse: session.taPreDialyse ?? undefined,
            taDebout: session.taDebout ?? undefined,
            taCoucher: session.taCoucher ?? undefined,
            temperaturePre: session.temperaturePre ? parseFloat(session.temperaturePre) : undefined,
          }}
          isLocked={isLocked}
        />
      )}
      {activeTab === 1 && (
        <MachineTab
          sessionId={id}
          defaultValues={{
            typeDialyse: session.typeDialyse ?? undefined,
            dialyzerType: session.dialyzerType ?? undefined,
            typeAbordVasculaire: session.typeAbordVasculaire ?? undefined,
            debitSang: session.debitSang ? parseFloat(session.debitSang) : undefined,
            debitDialysat: session.debitDialysat ? parseFloat(session.debitDialysat) : undefined,
            ufPrescrite: session.ufPrescrite ? parseFloat(session.ufPrescrite) : undefined,
            ufMax: session.ufMax ? parseFloat(session.ufMax) : undefined,
            dureePrescrite: session.dureePrescrite ?? undefined,
            conductivite: session.conductivite ? parseFloat(session.conductivite) : undefined,
            bainCalcium: session.bainCalcium ? parseFloat(session.bainCalcium) : undefined,
            bainPotassium: session.bainPotassium ? parseFloat(session.bainPotassium) : undefined,
            bainGlucose: session.bainGlucose ? parseFloat(session.bainGlucose) : undefined,
            bainSodium: session.bainSodium ?? undefined,
            temperatureBain: session.temperatureBain ? parseFloat(session.temperatureBain) : undefined,
            bicarbonate: session.bicarbonate ?? undefined,
            anticoagulation: session.anticoagulation ?? undefined,
            aiguilleArterielle: session.aiguilleArterielle ?? undefined,
            aiguilleVeineuse: session.aiguilleVeineuse ?? undefined,
            ponction: session.ponction ?? undefined,
            pressionArterielle: session.pressionArterielle ?? undefined,
            pressionVeineuse: session.pressionVeineuse ?? undefined,
            ptm: session.ptm ?? undefined,
          }}
          isLocked={isLocked}
        />
      )}
      {activeTab === 2 && (
        <ConstantesTab
          sessionId={id}
          sessionStatut={session.statut}
          isLocked={isLocked}
        />
      )}
      {activeTab === 3 && (
        <FinSeanceTab
          sessionId={id}
          defaultValues={{
            departureWeight: session.departureWeight ? parseFloat(session.departureWeight) : undefined,
            ufReelle: session.ufReelle ? parseFloat(session.ufReelle) : undefined,
            dureeReelle: session.dureeReelle ?? undefined,
            toleranceGlobale: session.toleranceGlobale ?? undefined,
            aspectRein: session.aspectRein ?? undefined,
            notesFin: session.notesFin ?? undefined,
            ureePre: session.ureePre ? parseFloat(session.ureePre) : undefined,
            ureePost: session.ureePost ? parseFloat(session.ureePost) : undefined,
            traitementEnCours: session.traitementEnCours ?? undefined,
            hemoculture: session.hemoculture ?? undefined,
            vaccination: session.vaccination ?? undefined,
            transfusion: session.transfusion ?? undefined,
            erythropoietine: session.erythropoietine ?? undefined,
            observations: session.observations ?? undefined,
          }}
          ktvCalculated={session.ktvCalculated}
          ktvStatus={session.ktvStatus}
          urrCalculated={session.urrCalculated}
          isLocked={isLocked}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd nephrosys && pnpm tsc --noEmit
```

**Commit:** `feat(sessions-ui): add seances list, creation, and multi-tab detail pages`

---

### Task 11: Bilans UI — List, Create, 10-Tab Detail

**Files:**
- Create: `nephrosys/src/components/bilans/bilan-table.tsx`
- Create: `nephrosys/src/components/bilans/bilan-tabs/hematologie-tab.tsx`
- Create: `nephrosys/src/components/bilans/bilan-tabs/biochimie-renale-tab.tsx`
- Create: `nephrosys/src/components/bilans/bilan-tabs/electrolytes-tab.tsx`
- Create: `nephrosys/src/components/bilans/bilan-tabs/mineraux-os-tab.tsx`
- Create: `nephrosys/src/components/bilans/bilan-tabs/lipides-tab.tsx`
- Create: `nephrosys/src/components/bilans/bilan-tabs/nutrition-inflammation-tab.tsx`
- Create: `nephrosys/src/components/bilans/bilan-tabs/hepatique-tab.tsx`
- Create: `nephrosys/src/components/bilans/bilan-tabs/martial-tab.tsx`
- Create: `nephrosys/src/components/bilans/bilan-tabs/glycemie-urines-tab.tsx`
- Create: `nephrosys/src/components/bilans/bilan-tabs/serologies-pbr-tab.tsx`
- Create: `nephrosys/src/components/bilans/bilan-form.tsx`
- Create: `nephrosys/src/app/(dashboard)/bilans/page.tsx`
- Create: `nephrosys/src/app/(dashboard)/bilans/nouveau/page.tsx`
- Create: `nephrosys/src/app/(dashboard)/bilans/[id]/page.tsx`

**Interfaces:**
- Consumes: `api.bilans.*`, `api.patients.list`
- Produces: `/bilans`, `/bilans/nouveau`, `/bilans/[id]` pages

- [ ] **Step 1: Create reusable bilan tab component helper**

Each tab follows the same pattern: a form section with decimal input fields. Create a helper component.

Create `nephrosys/src/components/bilans/bilan-tabs/bilan-section.tsx`:

```tsx
'use client';

import { Input } from '@/components/ui/input';
import type { UseFormRegister } from 'react-hook-form';

type FieldDef = {
  name: string;
  label: string;
  type?: 'number' | 'text' | 'select';
  step?: string;
  options?: { value: string; label: string }[];
};

type Props = {
  fields: FieldDef[];
  register: UseFormRegister<any>;
  disabled: boolean;
};

export function BilanSection({ fields, register, disabled }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <div key={field.name}>
          <label className="mb-1 block text-sm font-medium">{field.label}</label>
          {field.type === 'select' ? (
            <select
              {...register(field.name)}
              disabled={disabled}
              className="w-full rounded border px-2 py-1"
            >
              <option value="">—</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <Input
              type={field.type ?? 'number'}
              step={field.step ?? '0.01'}
              {...register(field.name, field.type === 'number' || !field.type ? { valueAsNumber: true } : undefined)}
              disabled={disabled}
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create bilan-table.tsx**

Create `nephrosys/src/components/bilans/bilan-table.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const STATUS_BADGE: Record<string, { ok: string; low: string; high: string }> = {
  ok: { ok: 'bg-green-100 text-green-800', low: '', high: '' },
  low: { ok: '', low: 'bg-red-100 text-red-800', high: '' },
  high: { ok: '', low: '', high: 'bg-red-100 text-red-800' },
};

function StatusBadge({ label, status }: { label: string; status: string | null }) {
  if (!status) return null;
  const className = status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  return <Badge className={`${className} text-xs`}>{label}</Badge>;
}

export function BilanTable() {
  const [typeBilan, setTypeBilan] = useState('');

  const { data, isLoading } = api.bilans.list.useQuery({
    typeBilan: typeBilan ? (typeBilan as any) : undefined,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={typeBilan}
          onChange={(e) => setTypeBilan(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">Tous les types</option>
          <option value="mensuel">Mensuel</option>
          <option value="trimestriel">Trimestriel</option>
          <option value="semestriel">Semestriel</option>
          <option value="annuel">Annuel</option>
        </select>
        <Link href="/bilans/nouveau">
          <Button>Nouveau bilan</Button>
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-left">Patient</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-center">Statuts</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((row) => (
              <tr key={row.bilan.id} className="border-b">
                <td className="px-3 py-2 font-mono text-xs">{row.bilan.reference}</td>
                <td className="px-3 py-2">{row.patient.nom} {row.patient.prenom}</td>
                <td className="px-3 py-2">{new Date(row.bilan.dateBilan).toLocaleDateString('fr-FR')}</td>
                <td className="px-3 py-2 capitalize">{row.bilan.typeBilan}</td>
                <td className="px-3 py-2 text-center">
                  <div className="flex flex-wrap justify-center gap-1">
                    <StatusBadge label="Hb" status={row.bilan.hbStatut} />
                    <StatusBadge label="K+" status={row.bilan.potassiumStatut} />
                    <StatusBadge label="PO4" status={row.bilan.phosphoreStatut} />
                    <StatusBadge label="Alb" status={row.bilan.albumineStatut} />
                    <StatusBadge label="PTH" status={row.bilan.pthStatut} />
                    <StatusBadge label="CaP" status={row.bilan.caPStatut} />
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <Link href={`/bilans/${row.bilan.id}`}>
                    <Button variant="outline" size="sm">Ouvrir</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {(!data?.data || data.data.length === 0) && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  Aucun bilan trouve
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create all 10 bilan tabs + bilan detail page**

Create `nephrosys/src/app/(dashboard)/bilans/page.tsx`:

```tsx
'use client';

import { BilanTable } from '@/components/bilans/bilan-table';

export default function BilansPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Bilans biologiques
      </h1>
      <BilanTable />
    </div>
  );
}
```

Create `nephrosys/src/app/(dashboard)/bilans/nouveau/page.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createBilanSchema, type CreateBilanInput } from '@/lib/validators/bilans';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NouveauBilanPage() {
  const router = useRouter();
  const { data: patientsData } = api.patients.list.useQuery({ page: 1, perPage: 100 });
  const { data: usersData } = api.users.list.useQuery({ page: 1, perPage: 100 });

  const createMutation = api.bilans.create.useMutation({
    onSuccess: (bilan) => {
      router.push(`/bilans/${bilan.id}`);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateBilanInput>({
    resolver: zodResolver(createBilanSchema),
    defaultValues: {
      dateBilan: new Date().toISOString(),
      typeBilan: 'mensuel',
    },
  });

  const onSubmit = (data: CreateBilanInput) => {
    createMutation.mutate(data);
  };

  const medecins = usersData?.data.filter((u) => u.role === 'medecin') ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Nouveau bilan biologique
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Patient *</label>
          <select {...register('patientId')} className="w-full rounded border px-2 py-1">
            <option value="">Selectionner un patient</option>
            {patientsData?.data.map((p) => (
              <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
            ))}
          </select>
          {errors.patientId && <p className="text-sm text-red-500">{errors.patientId.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Medecin *</label>
          <select {...register('physicianId')} className="w-full rounded border px-2 py-1">
            <option value="">Selectionner un medecin</option>
            {medecins.map((u) => (
              <option key={u.id} value={u.id}>Dr {u.nom} {u.prenom}</option>
            ))}
          </select>
          {errors.physicianId && <p className="text-sm text-red-500">{errors.physicianId.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Date *</label>
          <Input type="datetime-local" {...register('dateBilan')} />
          {errors.dateBilan && <p className="text-sm text-red-500">{errors.dateBilan.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Type de bilan *</label>
          <select {...register('typeBilan')} className="w-full rounded border px-2 py-1">
            <option value="mensuel">Mensuel</option>
            <option value="trimestriel">Trimestriel</option>
            <option value="semestriel">Semestriel</option>
            <option value="annuel">Annuel</option>
          </select>
        </div>

        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creation...' : 'Creer le bilan'}
        </Button>
      </form>
    </div>
  );
}
```

Create `nephrosys/src/app/(dashboard)/bilans/[id]/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateBilanSchema, type UpdateBilanInput } from '@/lib/validators/bilans';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BilanSection } from '@/components/bilans/bilan-tabs/bilan-section';

const TABS = [
  'Hematologie',
  'Biochimie renale',
  'Electrolytes',
  'Mineraux / Os',
  'Lipides',
  'Nutrition / Inflammation',
  'Hepatique',
  'Martial',
  'Glycemie / Urines',
  'Serologies / PBR',
] as const;

const SEROLOGIE_OPTIONS = [
  { value: 'positif', label: 'Positif' },
  { value: 'negatif', label: 'Negatif' },
  { value: 'non_fait', label: 'Non fait' },
];

const TAB_FIELDS: Record<number, { name: string; label: string; type?: 'number' | 'text' | 'select'; step?: string; options?: { value: string; label: string }[] }[]> = {
  0: [ // Hematologie
    { name: 'hemoglobine', label: 'Hemoglobine (g/dL)' },
    { name: 'hematocrite', label: 'Hematocrite (%)' },
    { name: 'globulesBlancs', label: 'Globules blancs (10^3/uL)' },
    { name: 'plaquettes', label: 'Plaquettes (/uL)', step: '1' },
    { name: 'neutrophiles', label: 'Neutrophiles (%)' },
    { name: 'eosinophiles', label: 'Eosinophiles (%)' },
    { name: 'basophiles', label: 'Basophiles (%)' },
    { name: 'lymphocytes', label: 'Lymphocytes (%)' },
    { name: 'monocytes', label: 'Monocytes (%)' },
    { name: 'ferritine', label: 'Ferritine (ng/mL)' },
    { name: 'saturationTransferrine', label: 'Saturation transferrine (%)' },
    { name: 'vgm', label: 'VGM (fL)' },
    { name: 'ccmh', label: 'CCMH (g/dL)' },
  ],
  1: [ // Biochimie renale
    { name: 'creatinine', label: 'Creatinine (umol/L)' },
    { name: 'ureePre', label: 'Uree pre-dialyse (mmol/L)' },
    { name: 'ureePost', label: 'Uree post-dialyse (mmol/L)' },
    { name: 'acideUrique', label: 'Acide urique (umol/L)' },
    { name: 'uricemie', label: 'Uricemie (mg/L)' },
    { name: 'dfgMdrd', label: 'DFG MDRD (mL/min)' },
  ],
  2: [ // Electrolytes
    { name: 'sodium', label: 'Sodium (mmol/L)' },
    { name: 'potassium', label: 'Potassium (mmol/L)' },
    { name: 'chlore', label: 'Chlore (mmol/L)' },
    { name: 'calcium', label: 'Calcium (mmol/L)' },
    { name: 'phosphore', label: 'Phosphore (mmol/L)' },
    { name: 'bicarbonateBilan', label: 'Bicarbonate (mmol/L)' },
    { name: 'reserveAlcaline', label: 'Reserve alcaline (mmol/L)' },
  ],
  3: [ // Mineraux / Os
    { name: 'pth', label: 'PTH (pg/mL)' },
    { name: 'vitamineD', label: 'Vitamine D (ng/mL)' },
    { name: 'phosphataseAlcaline', label: 'Phosphatase alcaline (UI/L)' },
  ],
  4: [ // Lipides
    { name: 'hdl', label: 'HDL (g/L)' },
    { name: 'ldl', label: 'LDL (g/L)' },
    { name: 'cholesterolTotal', label: 'Cholesterol total (g/L)' },
    { name: 'triglycerides', label: 'Triglycerides (g/L)' },
  ],
  5: [ // Nutrition / Inflammation
    { name: 'albumine', label: 'Albumine (g/L)' },
    { name: 'prealbumine', label: 'Prealbumine (mg/L)' },
    { name: 'proteinesTotales', label: 'Proteines totales (g/L)' },
    { name: 'proteidemie', label: 'Proteidemie (g/L)' },
    { name: 'crp', label: 'CRP (mg/L)' },
  ],
  6: [ // Hepatique
    { name: 'alat', label: 'ALAT (UI/L)' },
    { name: 'asat', label: 'ASAT (UI/L)' },
    { name: 'gammaGt', label: 'Gamma GT (UI/L)' },
    { name: 'ldhBilan', label: 'LDH (UI/L)' },
    { name: 'cpk', label: 'CPK (UI/L)' },
    { name: 'haptoglobine', label: 'Haptoglobine (g/L)' },
    { name: 'bilirubineTotale', label: 'Bilirubine totale (umol/L)' },
    { name: 'bilirubineIndirecte', label: 'Bilirubine indirecte (umol/L)' },
    { name: 'schizocytes', label: 'Schizocytes', type: 'text' as const },
    { name: 'rac', label: 'RAC', type: 'text' as const },
  ],
  7: [ // Martial
    { name: 'cst', label: 'CST (%)' },
    { name: 'ferSerique', label: 'Fer serique (umol/L)' },
  ],
  8: [ // Glycemie / Urines
    { name: 'gaj', label: 'GAJ (g/L)' },
    { name: 'hba1c', label: 'HbA1c (%)', step: '0.1' },
    { name: 'pu24h', label: 'PU 24h', type: 'text' as const },
    { name: 'eppu', label: 'EPPU', type: 'text' as const },
    { name: 'ecbu', label: 'ECBU', type: 'text' as const },
    { name: 'nau', label: 'NaU (mmol/L)' },
    { name: 'ku', label: 'KU (mmol/L)' },
    { name: 'rapportNaK', label: 'Rapport Na/K' },
    { name: 'ureeUrinaire', label: 'Uree urinaire (mmol/L)' },
    { name: 'creatUrinaire', label: 'Creatinine urinaire (umol/L)' },
  ],
  9: [ // Serologies / PBR
    { name: 'hbsAg', label: 'HBs Ag', type: 'select' as const, options: SEROLOGIE_OPTIONS },
    { name: 'antiHbs', label: 'Anti-HBs', type: 'select' as const, options: SEROLOGIE_OPTIONS },
    { name: 'antiHbc', label: 'Anti-HBc', type: 'select' as const, options: SEROLOGIE_OPTIONS },
    { name: 'antiHcv', label: 'Anti-HCV', type: 'select' as const, options: SEROLOGIE_OPTIONS },
    { name: 'antiHiv', label: 'Anti-HIV', type: 'select' as const, options: SEROLOGIE_OPTIONS },
    { name: 'tpha', label: 'TPHA', type: 'select' as const, options: SEROLOGIE_OPTIONS },
    { name: 'vdrl', label: 'VDRL', type: 'select' as const, options: SEROLOGIE_OPTIONS },
    { name: 'pbrResultat', label: 'Resultat PBR', type: 'text' as const },
  ],
};

export default function BilanDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState(0);

  const utils = api.useUtils();
  const { data: bilan, isLoading } = api.bilans.getById.useQuery({ id });
  const updateMutation = api.bilans.update.useMutation({
    onSuccess: () => utils.bilans.getById.invalidate({ id }),
  });

  // Build default values from bilan data
  const defaults: Record<string, any> = { id };
  if (bilan) {
    const decimalKeys = [
      'hemoglobine', 'hematocrite', 'globulesBlancs', 'plaquettes',
      'neutrophiles', 'eosinophiles', 'basophiles', 'lymphocytes', 'monocytes',
      'ferritine', 'saturationTransferrine', 'vgm', 'ccmh',
      'creatinine', 'ureePre', 'ureePost', 'acideUrique', 'uricemie', 'dfgMdrd',
      'sodium', 'potassium', 'chlore', 'calcium', 'phosphore',
      'bicarbonateBilan', 'reserveAlcaline',
      'pth', 'vitamineD', 'phosphataseAlcaline',
      'hdl', 'ldl', 'cholesterolTotal', 'triglycerides',
      'albumine', 'prealbumine', 'proteinesTotales', 'proteidemie', 'crp',
      'alat', 'asat', 'gammaGt', 'ldhBilan', 'cpk',
      'haptoglobine', 'bilirubineTotale', 'bilirubineIndirecte',
      'cst', 'ferSerique', 'gaj', 'hba1c',
      'nau', 'ku', 'rapportNaK', 'ureeUrinaire', 'creatUrinaire',
    ];
    for (const key of decimalKeys) {
      const val = (bilan as any)[key];
      defaults[key] = val ? parseFloat(val) : undefined;
    }
    const stringKeys = ['notes', 'schizocytes', 'rac', 'pu24h', 'eppu', 'ecbu', 'pbrResultat'];
    for (const key of stringKeys) {
      defaults[key] = (bilan as any)[key] ?? undefined;
    }
    const enumKeys = ['hbsAg', 'antiHbs', 'antiHbc', 'antiHcv', 'antiHiv', 'tpha', 'vdrl'];
    for (const key of enumKeys) {
      defaults[key] = (bilan as any)[key] ?? undefined;
    }
  }

  const {
    register,
    handleSubmit,
  } = useForm<UpdateBilanInput>({
    resolver: zodResolver(updateBilanSchema),
    defaultValues: defaults,
    values: defaults, // re-sync when bilan loads
  });

  const onSubmit = (data: UpdateBilanInput) => {
    updateMutation.mutate(data);
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!bilan) return <p>Bilan non trouve</p>;

  function StatusBadge({ label, status }: { label: string; status: string | null }) {
    if (!status) return null;
    const cls = status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    return <Badge className={`${cls} text-xs`}>{label}: {status}</Badge>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bilan {bilan.reference}
        </h1>
        <p className="text-sm text-gray-500">
          {bilan.patient?.nom} {bilan.patient?.prenom} | {new Date(bilan.dateBilan).toLocaleDateString('fr-FR')} | {bilan.typeBilan}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <StatusBadge label="Hb" status={bilan.hbStatut} />
          <StatusBadge label="K+" status={bilan.potassiumStatut} />
          <StatusBadge label="PO4" status={bilan.phosphoreStatut} />
          <StatusBadge label="Alb" status={bilan.albumineStatut} />
          <StatusBadge label="PTH" status={bilan.pthStatut} />
          <StatusBadge label="CaP" status={bilan.caPStatut} />
          {bilan.urrCalculated && (
            <Badge className="bg-blue-100 text-blue-800 text-xs">URR: {bilan.urrCalculated}%</Badge>
          )}
          {bilan.produitCaP && (
            <Badge className="bg-blue-100 text-blue-800 text-xs">Ca x P: {bilan.produitCaP}</Badge>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <input type="hidden" {...register('id')} />

        {/* Tab navigation */}
        <div className="mb-4 flex flex-wrap border-b">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`px-3 py-2 text-xs font-medium ${
                activeTab === i
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <BilanSection
          fields={TAB_FIELDS[activeTab] ?? []}
          register={register}
          disabled={false}
        />

        <div className="mt-6">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          {updateMutation.isSuccess && <span className="ml-3 text-sm text-green-600">Enregistre</span>}
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd nephrosys && pnpm tsc --noEmit
```

**Commit:** `feat(bilans-ui): add bilans list, creation, and 10-tab detail page`

---

### Task 12: Permissions Update + Seed Data + E2E Tests

**Files:**
- Modify: `nephrosys/src/lib/permissions.ts` (add sub-route permissions)
- Create: `nephrosys/src/server/db/seed-phase2.ts`
- Create: `nephrosys/tests/e2e/seances/flow.spec.ts`
- Create: `nephrosys/tests/e2e/bilans/crud.spec.ts`
- Create: `nephrosys/tests/e2e/planning/views.spec.ts`
- Create: `nephrosys/tests/e2e/configuration/seuils.spec.ts`

**Interfaces:**
- Consumes: all routers, all pages, all tables
- Produces: seed script, E2E tests, updated permissions

- [ ] **Step 1: Update permissions.ts**

Add sub-route permissions for `/seances/nouvelle`, `/bilans/nouveau`, `/planning/postes`. In `nephrosys/src/lib/permissions.ts`, update the `ROUTE_PERMISSIONS` array:

```typescript
const ROUTE_PERMISSIONS: RoutePermission[] = [
  { path: '/patients', roles: ['admin', 'medecin', 'infirmiere', 'secretaire', 'facturation'] },
  { path: '/seances/nouvelle', roles: ['admin', 'medecin', 'secretaire'] },
  { path: '/seances', roles: ['admin', 'medecin', 'infirmiere', 'secretaire'] },
  { path: '/bilans/nouveau', roles: ['admin', 'medecin'] },
  { path: '/bilans', roles: ['admin', 'medecin', 'infirmiere'] },
  { path: '/planning/postes', roles: ['admin', 'medecin', 'secretaire'] },
  { path: '/planning', roles: ['admin', 'medecin', 'infirmiere', 'secretaire'] },
  { path: '/facturation', roles: ['admin', 'facturation'] },
  { path: '/admin', roles: ['admin'] },
  { path: '/portail', roles: ['patient'] },
];
```

Note: more specific routes must come before less specific ones since `canAccess` uses `startsWith`.

- [ ] **Step 2: Create seed script**

Create `nephrosys/src/server/db/seed-phase2.ts`:

```typescript
import { db } from './index';
import { postesDialyse, seuilsCliniques } from './schema';

async function seedPhase2() {
  console.log('Seeding Phase 2 data...');

  // Seed postes de dialyse
  const posteData = [
    ...Array.from({ length: 20 }, (_, i) => ({
      nom: `Poste ${i + 1}`,
      numero: i + 1,
      isVip: false,
      isActive: true,
    })),
    { nom: 'VIP 1', numero: 21, isVip: true, isActive: true },
    { nom: 'VIP 2', numero: 22, isVip: true, isActive: true },
    { nom: 'VIP 3', numero: 23, isVip: true, isActive: true },
  ];

  for (const poste of posteData) {
    await db
      .insert(postesDialyse)
      .values(poste)
      .onConflictDoNothing();
  }
  console.log(`  ${posteData.length} postes created`);

  // Seed seuils cliniques
  const seuilsData = [
    { parametre: 'hemoglobine', label: 'Hemoglobine', seuilBas: '10.0', seuilHaut: '16.0', unite: 'g/dL' },
    { parametre: 'potassium', label: 'Potassium', seuilBas: '3.5', seuilHaut: '5.5', unite: 'mmol/L' },
    { parametre: 'phosphore', label: 'Phosphore', seuilBas: '0.8', seuilHaut: '1.5', unite: 'mmol/L' },
    { parametre: 'albumine', label: 'Albumine', seuilBas: '35.0', seuilHaut: '50.0', unite: 'g/L' },
    { parametre: 'pth', label: 'PTH', seuilBas: '150.0', seuilHaut: '600.0', unite: 'pg/mL' },
    { parametre: 'produit_ca_p', label: 'Produit Ca x P', seuilBas: null, seuilHaut: '55.0', unite: 'mg2/dL2' },
  ];

  for (const seuil of seuilsData) {
    await db
      .insert(seuilsCliniques)
      .values(seuil)
      .onConflictDoNothing();
  }
  console.log(`  ${seuilsData.length} seuils created`);

  console.log('Phase 2 seed complete.');
}

seedPhase2()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 3: Create E2E test — seances flow**

Create `nephrosys/tests/e2e/seances/flow.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', 'Nephro2024!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Seances de dialyse', () => {
  test('admin voit la liste des seances', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Seances');
    await expect(page.locator('h1:has-text("Seances de dialyse")')).toBeVisible();
  });

  test('admin cree une seance manuelle', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Seances');
    await page.click('text=Nouvelle seance');

    await page.selectOption('select:near(:text("Patient"))', { index: 1 });
    await page.selectOption('select:near(:text("Poste"))', { index: 1 });
    await page.selectOption('select:near(:text("Medecin"))', { index: 1 });
    await page.selectOption('select:near(:text("Infirmier"))', { index: 1 });

    await page.click('button:has-text("Creer la seance")');
    await page.waitForURL(/\/seances\//, { timeout: 10000 });

    // Should see planifiee badge
    await expect(page.locator('text=Planifiee')).toBeVisible();
  });

  test('demarrer et terminer une seance', async ({ page }) => {
    // Requires a seance to exist
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Seances');

    // Click first session
    const firstOuvrir = page.locator('button:has-text("Ouvrir")').first();
    if (await firstOuvrir.isVisible()) {
      await firstOuvrir.click();
      await page.waitForURL(/\/seances\//, { timeout: 10000 });

      // If planifiee, demarrer
      const demarrerBtn = page.locator('button:has-text("Demarrer la seance")');
      if (await demarrerBtn.isVisible()) {
        await demarrerBtn.click();
        await expect(page.locator('text=En cours')).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
```

- [ ] **Step 4: Create E2E test — bilans**

Create `nephrosys/tests/e2e/bilans/crud.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', 'Nephro2024!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Bilans biologiques', () => {
  test('admin voit la liste des bilans', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Bilans');
    await expect(page.locator('h1:has-text("Bilans biologiques")')).toBeVisible();
  });

  test('admin cree un bilan', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Bilans');
    await page.click('text=Nouveau bilan');

    await page.selectOption('select:near(:text("Patient"))', { index: 1 });
    await page.selectOption('select:near(:text("Medecin"))', { index: 1 });

    await page.click('button:has-text("Creer le bilan")');
    await page.waitForURL(/\/bilans\//, { timeout: 10000 });

    await expect(page.locator('text=BIO-')).toBeVisible();
  });

  test('remplir onglet hematologie et verifier badge', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Bilans');

    const firstOuvrir = page.locator('button:has-text("Ouvrir")').first();
    if (await firstOuvrir.isVisible()) {
      await firstOuvrir.click();
      await page.waitForURL(/\/bilans\//, { timeout: 10000 });

      // Fill hemoglobine with low value (< 10)
      await page.fill('input:near(:text("Hemoglobine"))', '8.5');
      await page.click('button:has-text("Enregistrer")');
      await expect(page.locator('text=Enregistre')).toBeVisible({ timeout: 5000 });

      // Reload and check badge
      await page.reload();
      await expect(page.locator('text=Hb: low')).toBeVisible({ timeout: 5000 });
    }
  });
});
```

- [ ] **Step 5: Create E2E test — planning views**

Create `nephrosys/tests/e2e/planning/views.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', 'Nephro2024!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Planning', () => {
  test('admin voit la vue grille par defaut', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Planning');
    await expect(page.locator('h1:has-text("Planning")')).toBeVisible();
    // Grid view is default
    await expect(page.locator('text=Matin')).toBeVisible({ timeout: 5000 });
  });

  test('switch entre les 3 vues', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Planning');

    // Calendar
    await page.click('button:has-text("Calendrier")');
    await expect(page.locator('text=Lun')).toBeVisible({ timeout: 5000 });

    // List
    await page.click('button:has-text("Liste")');
    // Should show list or empty message
    await expect(
      page.locator('text=Aucune affectation').or(page.locator('table'))
    ).toBeVisible({ timeout: 5000 });

    // Back to grid
    await page.click('button:has-text("Grille")');
    await expect(page.locator('text=Matin')).toBeVisible({ timeout: 5000 });
  });

  test('admin voit la page postes', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.goto('/planning/postes');
    await expect(page.locator('h1:has-text("Postes de dialyse")')).toBeVisible();
  });
});
```

- [ ] **Step 6: Create E2E test — configuration seuils**

Create `nephrosys/tests/e2e/configuration/seuils.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', 'Nephro2024!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Configuration seuils', () => {
  test('admin voit la page configuration', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.goto('/admin/configuration');
    await expect(page.locator('h1:has-text("Configuration")')).toBeVisible();
    await expect(page.locator('text=Hemoglobine')).toBeVisible({ timeout: 10000 });
  });

  test('admin modifie un seuil', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.goto('/admin/configuration');

    // Click modify on first row
    const firstModifier = page.locator('button:has-text("Modifier")').first();
    await firstModifier.click();

    // Should show input fields
    await expect(page.locator('input[type="number"]').first()).toBeVisible();
  });
});
```

- [ ] **Step 7: Run all unit tests**

```bash
cd nephrosys && pnpm test
```

- [ ] **Step 8: Verify TypeScript**

```bash
cd nephrosys && pnpm tsc --noEmit
```

**Commit:** `feat(phase2): add permissions, seed data, and E2E tests for clinical module`

---

## Self-Review Checklist

- [ ] All 10 new enums defined in `enums.ts`
- [ ] All 6 new tables with complete column definitions (no abbreviations)
- [ ] `dialysis_sessions` has all ~50 columns
- [ ] `bilans` has all ~100 columns including serologies and statuts
- [ ] Relations cover all FK relationships
- [ ] 5 pure clinical calculation functions with unit tests
- [ ] 6 tRPC routers (postes, seuils, plannings, sessions, vitalSigns, bilans) all merged into appRouter
- [ ] 6 Zod validator files with French error messages
- [ ] RBAC matches spec matrix for all routes
- [ ] Session lifecycle: planifiee -> en_cours -> terminee -> locked
- [ ] Auto-lock check on getById (terminee > 24h)
- [ ] Calculated fields: interdialysis increase, Kt/V, URR, bio statuses, Ca x P
- [ ] Planning page with 3 switchable views
- [ ] Session detail with 4 tabs (pre-dialyse, machine, constantes, fin)
- [ ] Bilan detail with 10 tabs (all fields covered)
- [ ] Seed data for 23 postes + 6 seuils
- [ ] Permissions updated with sub-route specificity
- [ ] E2E test skeletons for all major flows
- [ ] All UI text in French
- [ ] snake_case DB columns, camelCase TypeScript
- [ ] No Docker dependency — verified via `pnpm tsc --noEmit` and `pnpm db:generate`
