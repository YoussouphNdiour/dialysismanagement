# NephroSys Phase 3b — Prescriptions, Stock & Portail Patient : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la gestion de stock medicamenteux avec tracabilite FIFO par lot, les prescriptions medicamenteuses per-seance et ordonnances de fond, et un portail patient en lecture seule — en s'appuyant sur le catalogue d'articles et la facturation existants.

**Architecture:** Le stock est construit sur le catalogue `articles` existant avec 3 nouvelles tables (`lots`, `mouvements_stock`, `seuils_stock`). Les prescriptions consomment le stock via la logique FIFO factorisee dans `src/lib/stock-fifo.ts` et s'integrent dans `sessions.terminer`. Le portail patient est un layout independant sous `src/app/portail/` (hors du groupe `(dashboard)`), accessible uniquement au role `patient`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, tRPC v11, Drizzle ORM, PostgreSQL 16, Auth.js v5 JWT, Tailwind CSS v4, Zod v4, Vitest 4, lucide-react, react-hook-form, drizzle-kit.

## Global Constraints

- TypeScript strict, aucun `any`
- Labels UI en francais, sans accents dans le code (noms de variables, enums)
- Dark mode obligatoire (classes `dark:`)
- YAGNI — pas de fonctionnalites non decrites ici
- Tests unitaires pour les calculs et validateurs, `pnpm tsc --noEmit` pour verification
- snake_case pour les colonnes DB, camelCase pour TypeScript
- Les prix sont en FCFA, stockes en decimal(12,2)
- Les quantites en decimal(10,2)
- All timestamps with timezone: `timestamp('x', { withTimezone: true })`
- UUIDs as primary keys with `.defaultRandom()`
- Zod v4: utiliser `error` (pas `errorMap`), `as const` pour les tableaux d'enum
- Tests dans `tests/unit/`, picks par `vitest.config.ts` pattern `tests/**/*.test.ts`

---

## File Map

### Created

| Fichier | Responsabilite |
|---|---|
| `src/server/db/schema/lots.ts` | Table `lots` |
| `src/server/db/schema/mouvements-stock.ts` | Table `mouvements_stock` |
| `src/server/db/schema/seuils-stock.ts` | Table `seuils_stock` |
| `src/server/db/schema/prescriptions-seance.ts` | Table `prescriptions_seance` |
| `src/server/db/schema/ordonnances.ts` | Table `ordonnances` |
| `src/lib/stock-fifo.ts` | Logique FIFO pure (testable sans DB) |
| `src/lib/validators/stock.ts` | Schemas Zod pour le stock |
| `src/lib/validators/prescriptions.ts` | Schemas Zod pour les prescriptions |
| `src/server/trpc/routers/stock.router.ts` | Router tRPC stock |
| `src/server/trpc/routers/prescriptions.router.ts` | Router tRPC prescriptions + ordonnances |
| `src/server/trpc/routers/portail.router.ts` | Router tRPC portail patient |
| `src/components/stock/stock-list.tsx` | Page /stock — liste etat stock |
| `src/components/stock/stock-detail.tsx` | Page /stock/[articleId] — detail + formulaires |
| `src/components/stock/stock-alertes.tsx` | Page /stock/alertes — alertes actives |
| `src/components/sessions/prescriptions-tab.tsx` | 5e onglet de la page seance |
| `src/components/patients/ordonnances-tab.tsx` | Onglet ordonnances de la page patient |
| `src/app/(dashboard)/stock/page.tsx` | Page thin-wrapper /stock |
| `src/app/(dashboard)/stock/[articleId]/page.tsx` | Page thin-wrapper /stock/[articleId] |
| `src/app/(dashboard)/stock/alertes/page.tsx` | Page thin-wrapper /stock/alertes |
| `src/app/portail/layout.tsx` | Layout portail patient (hors dashboard) |
| `src/app/portail/page.tsx` | Accueil portail |
| `src/app/portail/seances/page.tsx` | Mes seances |
| `src/app/portail/seances/[id]/page.tsx` | Detail seance |
| `src/app/portail/bilans/page.tsx` | Mes bilans |
| `src/app/portail/bilans/[id]/page.tsx` | Detail bilan |
| `src/app/portail/factures/page.tsx` | Mes factures |
| `src/app/portail/ordonnances/page.tsx` | Mes ordonnances |
| `tests/unit/stock-fifo.test.ts` | Tests FIFO |
| `tests/unit/stock-validators.test.ts` | Tests validators stock |
| `tests/unit/prescriptions-validators.test.ts` | Tests validators prescriptions |

### Modified

| Fichier | Changements |
|---|---|
| `src/server/db/schema/enums.ts` | +`typeMouvementEnum`, +`statutPrescriptionEnum`, +`gestionnaire_stock` dans `userRoleEnum` |
| `src/server/db/schema/index.ts` | +5 nouveaux exports |
| `src/server/db/schema/relations.ts` | +relations pour lots, mouvements, seuils, prescriptions, ordonnances |
| `src/lib/permissions.ts` | +`gestionnaire_stock` dans `USER_ROLES`, +routes /stock, +menu Stock, +`ROLE_MENU_ITEMS` |
| `src/components/layout/sidebar.tsx` | +`Package`, `Warehouse`, `AlertTriangle` dans `ICON_MAP` |
| `src/components/dashboard/dashboard-client.tsx` | +case `gestionnaire_stock` |
| `src/server/trpc/router.ts` | +stock, +prescriptions, +portail |
| `src/server/trpc/routers/sessions.router.ts` | `terminer` etendu: auto-administration prescriptions |
| `src/app/(dashboard)/seances/[id]/page.tsx` | +5e onglet Prescriptions |
| `src/app/(dashboard)/patients/[id]/page.tsx` | Restructure en onglets (Dossier + Ordonnances) |
| `src/components/patients/patient-form.tsx` | +select association user_id (admin seulement) |

---

## Task 1: Schema + enums + migration

**Files:**
- Modify: `src/server/db/schema/enums.ts`
- Create: `src/server/db/schema/lots.ts`
- Create: `src/server/db/schema/mouvements-stock.ts`
- Create: `src/server/db/schema/seuils-stock.ts`
- Create: `src/server/db/schema/prescriptions-seance.ts`
- Create: `src/server/db/schema/ordonnances.ts`
- Modify: `src/server/db/schema/index.ts`
- Modify: `src/server/db/schema/relations.ts`
- Modify: `src/lib/permissions.ts`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/dashboard/dashboard-client.tsx`

**Interfaces:**
- Consumes: `articles` table (FK), `dialysisSessions` table (FK), `patients` table (FK), `users` table (FK)
- Produces:
  - `lots` table + `Lot` type + `NewLot` type
  - `mouvementsStock` table + `MouvementStock` type
  - `seuilsStock` table + `SeuilStock` type
  - `prescriptionsSeance` table + `PrescriptionSeance` type
  - `ordonnances` table + `Ordonnance` type
  - `typeMouvementEnum`, `statutPrescriptionEnum` enums
  - `gestionnaire_stock` ajout dans `USER_ROLES` et `userRoleEnum`
  - Menu item `Stock` pour roles `admin`, `gestionnaire_stock`, `infirmiere`

- [ ] **Step 1: Modifier `enums.ts` — ajouter gestionnaire_stock, typeMouvementEnum, statutPrescriptionEnum**

```typescript
// src/server/db/schema/enums.ts — remplacer userRoleEnum et ajouter 2 enums a la fin

import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'secretaire',
  'medecin',
  'infirmiere',
  'facturation',
  'patient',
  'gestionnaire_stock',
]);

// ... garder tous les enums existants inchanges ...

export const typeMouvementEnum = pgEnum('type_mouvement', [
  'entree',
  'sortie',
  'ajustement',
]);

export const statutPrescriptionEnum = pgEnum('statut_prescription', [
  'prescrite',
  'administree',
  'annulee',
]);
```

- [ ] **Step 2: Creer `src/server/db/schema/lots.ts`**

```typescript
import { pgTable, uuid, varchar, date, decimal, timestamp } from 'drizzle-orm/pg-core';
import { articles } from './articles';
import { users } from './users';

export const lots = pgTable('lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id').notNull().references(() => articles.id),
  numeroLot: varchar('numero_lot', { length: 100 }).notNull(),
  datePeremption: date('date_peremption').notNull(),
  quantiteInitiale: decimal('quantite_initiale', { precision: 10, scale: 2 }).notNull(),
  quantiteDisponible: decimal('quantite_disponible', { precision: 10, scale: 2 }).notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Lot = typeof lots.$inferSelect;
export type NewLot = typeof lots.$inferInsert;
```

- [ ] **Step 3: Creer `src/server/db/schema/mouvements-stock.ts`**

```typescript
import { pgTable, uuid, varchar, decimal, timestamp } from 'drizzle-orm/pg-core';
import { typeMouvementEnum } from './enums';
import { articles } from './articles';
import { lots } from './lots';
import { dialysisSessions } from './dialysis-sessions';
import { patients } from './patients';
import { users } from './users';

export const mouvementsStock = pgTable('mouvements_stock', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id').notNull().references(() => articles.id),
  lotId: uuid('lot_id').references(() => lots.id),
  typeMouvement: typeMouvementEnum('type_mouvement').notNull(),
  quantite: decimal('quantite', { precision: 10, scale: 2 }).notNull(),
  motif: varchar('motif', { length: 200 }),
  sessionId: uuid('session_id').references(() => dialysisSessions.id),
  patientId: uuid('patient_id').references(() => patients.id),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MouvementStock = typeof mouvementsStock.$inferSelect;
export type NewMouvementStock = typeof mouvementsStock.$inferInsert;
```

- [ ] **Step 4: Creer `src/server/db/schema/seuils-stock.ts`**

```typescript
import { pgTable, uuid, decimal, timestamp } from 'drizzle-orm/pg-core';
import { articles } from './articles';

export const seuilsStock = pgTable('seuils_stock', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id').notNull().unique().references(() => articles.id),
  seuilMin: decimal('seuil_min', { precision: 10, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SeuilStock = typeof seuilsStock.$inferSelect;
export type NewSeuilStock = typeof seuilsStock.$inferInsert;
```

- [ ] **Step 5: Creer `src/server/db/schema/prescriptions-seance.ts`**

```typescript
import { pgTable, uuid, varchar, decimal, timestamp } from 'drizzle-orm/pg-core';
import { statutPrescriptionEnum } from './enums';
import { dialysisSessions } from './dialysis-sessions';
import { articles } from './articles';
import { patients } from './patients';
import { lots } from './lots';
import { users } from './users';

export const prescriptionsSeance = pgTable('prescriptions_seance', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => dialysisSessions.id),
  articleId: uuid('article_id').notNull().references(() => articles.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  quantite: decimal('quantite', { precision: 10, scale: 2 }).notNull(),
  posologie: varchar('posologie', { length: 200 }),
  statut: statutPrescriptionEnum('statut').notNull().default('prescrite'),
  lotId: uuid('lot_id').references(() => lots.id),
  prescritPar: uuid('prescrit_par').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PrescriptionSeance = typeof prescriptionsSeance.$inferSelect;
export type NewPrescriptionSeance = typeof prescriptionsSeance.$inferInsert;
```

- [ ] **Step 6: Creer `src/server/db/schema/ordonnances.ts`**

```typescript
import { pgTable, uuid, text, date, boolean, timestamp } from 'drizzle-orm/pg-core';
import { patients } from './patients';
import { users } from './users';

export const ordonnances = pgTable('ordonnances', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  contenu: text('contenu').notNull(),
  datePrescription: date('date_prescription').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  prescritPar: uuid('prescrit_par').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Ordonnance = typeof ordonnances.$inferSelect;
export type NewOrdonnance = typeof ordonnances.$inferInsert;
```

- [ ] **Step 7: Mettre a jour `src/server/db/schema/index.ts`**

Ajouter les 5 nouveaux exports apres `'./lignes-facture'` :

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
export * from './articles';
export * from './factures';
export * from './lignes-facture';
export * from './tarifs-base';
export * from './lots';
export * from './mouvements-stock';
export * from './seuils-stock';
export * from './prescriptions-seance';
export * from './ordonnances';
```

- [ ] **Step 8: Mettre a jour `src/server/db/schema/relations.ts`**

Ajouter les imports et les relations pour les 5 nouvelles tables. Remplacer le fichier complet :

```typescript
import { relations } from 'drizzle-orm';
import { users } from './users';
import { patients } from './patients';
import { postesDialyse } from './postes-dialyse';
import { plannings } from './plannings';
import { dialysisSessions } from './dialysis-sessions';
import { vitalSigns } from './vital-signs';
import { bilans } from './bilans';
import { articles } from './articles';
import { factures } from './factures';
import { lignesFacture } from './lignes-facture';
import { lots } from './lots';
import { mouvementsStock } from './mouvements-stock';
import { seuilsStock } from './seuils-stock';
import { prescriptionsSeance } from './prescriptions-seance';
import { ordonnances } from './ordonnances';

export const usersRelations = relations(users, ({ many }) => ({
  patientsAsMedecin: many(patients, { relationName: 'medecinRef' }),
  planningsAsMedecin: many(plannings, { relationName: 'planningMedecin' }),
  planningsAsInfirmier: many(plannings, { relationName: 'planningInfirmier' }),
  sessionsAsPhysician: many(dialysisSessions, { relationName: 'sessionPhysician' }),
  sessionsAsNurse: many(dialysisSessions, { relationName: 'sessionNurse' }),
  bilansAsPhysician: many(bilans, { relationName: 'bilanPhysician' }),
  facturesAsCreator: many(factures, { relationName: 'factureCreator' }),
  lotsCreated: many(lots),
  mouvementsCreated: many(mouvementsStock),
  prescriptionsCreated: many(prescriptionsSeance),
  ordonnancesCreated: many(ordonnances),
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
  factures: many(factures),
  prescriptionsSeance: many(prescriptionsSeance),
  ordonnances: many(ordonnances),
  mouvementsStock: many(mouvementsStock),
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
  factures: many(factures),
  prescriptionsSeance: many(prescriptionsSeance),
  mouvementsStock: many(mouvementsStock),
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

export const articlesRelations = relations(articles, ({ many }) => ({
  lignesFacture: many(lignesFacture),
  lots: many(lots),
  seuilStock: many(seuilsStock),
  prescriptionsSeance: many(prescriptionsSeance),
  mouvementsStock: many(mouvementsStock),
}));

export const facturesRelations = relations(factures, ({ one, many }) => ({
  session: one(dialysisSessions, {
    fields: [factures.sessionId],
    references: [dialysisSessions.id],
  }),
  patient: one(patients, {
    fields: [factures.patientId],
    references: [patients.id],
  }),
  createdByUser: one(users, {
    fields: [factures.createdBy],
    references: [users.id],
    relationName: 'factureCreator',
  }),
  lignes: many(lignesFacture),
}));

export const lignesFactureRelations = relations(lignesFacture, ({ one }) => ({
  facture: one(factures, {
    fields: [lignesFacture.factureId],
    references: [factures.id],
  }),
  article: one(articles, {
    fields: [lignesFacture.articleId],
    references: [articles.id],
  }),
}));

export const lotsRelations = relations(lots, ({ one, many }) => ({
  article: one(articles, {
    fields: [lots.articleId],
    references: [articles.id],
  }),
  createdByUser: one(users, {
    fields: [lots.createdBy],
    references: [users.id],
  }),
  mouvementsStock: many(mouvementsStock),
  prescriptionsSeance: many(prescriptionsSeance),
}));

export const mouvementsStockRelations = relations(mouvementsStock, ({ one }) => ({
  article: one(articles, {
    fields: [mouvementsStock.articleId],
    references: [articles.id],
  }),
  lot: one(lots, {
    fields: [mouvementsStock.lotId],
    references: [lots.id],
  }),
  session: one(dialysisSessions, {
    fields: [mouvementsStock.sessionId],
    references: [dialysisSessions.id],
  }),
  patient: one(patients, {
    fields: [mouvementsStock.patientId],
    references: [patients.id],
  }),
  createdByUser: one(users, {
    fields: [mouvementsStock.createdBy],
    references: [users.id],
  }),
}));

export const seuilsStockRelations = relations(seuilsStock, ({ one }) => ({
  article: one(articles, {
    fields: [seuilsStock.articleId],
    references: [articles.id],
  }),
}));

export const prescriptionsSeanceRelations = relations(prescriptionsSeance, ({ one }) => ({
  session: one(dialysisSessions, {
    fields: [prescriptionsSeance.sessionId],
    references: [dialysisSessions.id],
  }),
  article: one(articles, {
    fields: [prescriptionsSeance.articleId],
    references: [articles.id],
  }),
  patient: one(patients, {
    fields: [prescriptionsSeance.patientId],
    references: [patients.id],
  }),
  lot: one(lots, {
    fields: [prescriptionsSeance.lotId],
    references: [lots.id],
  }),
  prescritParUser: one(users, {
    fields: [prescriptionsSeance.prescritPar],
    references: [users.id],
  }),
}));

export const ordonnancesRelations = relations(ordonnances, ({ one }) => ({
  patient: one(patients, {
    fields: [ordonnances.patientId],
    references: [patients.id],
  }),
  prescritParUser: one(users, {
    fields: [ordonnances.prescritPar],
    references: [users.id],
  }),
}));
```

- [ ] **Step 9: Generer la migration Drizzle**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm db:generate
```

Verifier que le fichier SQL generé dans `drizzle/` contient :
- `CREATE TYPE user_role` avec `gestionnaire_stock`
- `CREATE TYPE type_mouvement`
- `CREATE TYPE statut_prescription`
- `CREATE TABLE lots`
- `CREATE TABLE mouvements_stock`
- `CREATE TABLE seuils_stock`
- `CREATE TABLE prescriptions_seance`
- `CREATE TABLE ordonnances`

- [ ] **Step 10: Mettre a jour `src/lib/permissions.ts`**

Remplacer le fichier complet :

```typescript
export const USER_ROLES = [
  'admin',
  'secretaire',
  'medecin',
  'infirmiere',
  'facturation',
  'patient',
  'gestionnaire_stock',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

type RoutePermission = {
  path: string;
  roles: UserRole[];
};

const ROUTE_PERMISSIONS: RoutePermission[] = [
  { path: '/patients', roles: ['admin', 'medecin', 'infirmiere', 'secretaire', 'facturation'] },
  { path: '/seances/nouvelle', roles: ['admin', 'medecin', 'secretaire'] },
  { path: '/seances', roles: ['admin', 'medecin', 'infirmiere', 'secretaire'] },
  { path: '/bilans/nouveau', roles: ['admin', 'medecin'] },
  { path: '/bilans', roles: ['admin', 'medecin', 'infirmiere'] },
  { path: '/planning/postes', roles: ['admin', 'medecin', 'secretaire'] },
  { path: '/planning', roles: ['admin', 'medecin', 'infirmiere', 'secretaire'] },
  { path: '/facturation', roles: ['admin', 'facturation', 'medecin', 'infirmiere', 'secretaire'] },
  { path: '/stock', roles: ['admin', 'gestionnaire_stock', 'infirmiere'] },
  { path: '/admin/articles', roles: ['admin'] },
  { path: '/admin/rapports', roles: ['admin'] },
  { path: '/admin', roles: ['admin'] },
  { path: '/portail', roles: ['patient'] },
];

export function canAccess(role: UserRole, path: string): boolean {
  if (role === 'admin' && !path.startsWith('/portail')) return true;

  const permission = ROUTE_PERMISSIONS.find((p) => path.startsWith(p.path));
  if (!permission) return true; // dashboard home — all backend roles
  return permission.roles.includes(role);
}

export type MenuItem = {
  label: string;
  href: string;
  icon: string; // lucide icon name
};

const ALL_MENU_ITEMS: (MenuItem & { roles: UserRole[] })[] = [
  {
    label: 'Tableau de bord',
    href: '/',
    icon: 'LayoutDashboard',
    roles: ['admin', 'medecin', 'infirmiere', 'secretaire', 'facturation'],
  },
  {
    label: 'Patients',
    href: '/patients',
    icon: 'Users',
    roles: ['admin', 'medecin', 'infirmiere', 'secretaire', 'facturation'],
  },
  {
    label: 'Seances',
    href: '/seances',
    icon: 'Activity',
    roles: ['admin', 'medecin', 'infirmiere', 'secretaire'],
  },
  {
    label: 'Planning',
    href: '/planning',
    icon: 'Calendar',
    roles: ['admin', 'medecin', 'infirmiere', 'secretaire'],
  },
  {
    label: 'Bilans',
    href: '/bilans',
    icon: 'FlaskConical',
    roles: ['admin', 'medecin', 'infirmiere'],
  },
  {
    label: 'Facturation',
    href: '/facturation',
    icon: 'Receipt',
    roles: ['admin', 'facturation'],
  },
  {
    label: 'Stock',
    href: '/stock',
    icon: 'Warehouse',
    roles: ['admin', 'gestionnaire_stock', 'infirmiere'],
  },
  {
    label: 'Utilisateurs',
    href: '/admin/utilisateurs',
    icon: 'Shield',
    roles: ['admin'],
  },
  {
    label: 'Configuration',
    href: '/admin/configuration',
    icon: 'Settings',
    roles: ['admin'],
  },
  {
    label: 'Articles',
    href: '/admin/articles',
    icon: 'Package',
    roles: ['admin'],
  },
  {
    label: 'Rapports',
    href: '/admin/rapports',
    icon: 'FileText',
    roles: ['admin'],
  },
];

export function getMenuItemsForRole(role: UserRole): MenuItem[] {
  return ALL_MENU_ITEMS.filter((item) => item.roles.includes(role)).map(
    ({ label, href, icon }) => ({ label, href, icon }),
  );
}

export const ROLE_MENU_ITEMS: Record<UserRole, MenuItem[]> = {
  admin: getMenuItemsForRole('admin'),
  secretaire: getMenuItemsForRole('secretaire'),
  medecin: getMenuItemsForRole('medecin'),
  infirmiere: getMenuItemsForRole('infirmiere'),
  facturation: getMenuItemsForRole('facturation'),
  patient: getMenuItemsForRole('patient'),
  gestionnaire_stock: getMenuItemsForRole('gestionnaire_stock'),
};
```

- [ ] **Step 11: Mettre a jour `src/components/layout/sidebar.tsx`**

Ajouter `Package`, `Warehouse`, `AlertTriangle` aux imports lucide et a `ICON_MAP`. Remplacer le bloc import et la constante ICON_MAP :

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Activity,
  Calendar,
  FlaskConical,
  Receipt,
  Shield,
  Settings,
  Package,
  Warehouse,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/lib/permissions';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  LayoutDashboard,
  Users,
  Activity,
  Calendar,
  FlaskConical,
  Receipt,
  Shield,
  Settings,
  Package,
  Warehouse,
  AlertTriangle,
  FileText,
};
```

Garder le reste du composant Sidebar identique.

- [ ] **Step 12: Mettre a jour `src/components/dashboard/dashboard-client.tsx`**

Ajouter le case `gestionnaire_stock` dans le switch :

```typescript
'use client';

import { AdminDashboard } from './admin-dashboard';
import { MedecinDashboard } from './medecin-dashboard';
import { InfirmiereDashboard } from './infirmiere-dashboard';
import { SecretaireDashboard } from './secretaire-dashboard';

type Props = {
  role: string;
};

export function DashboardClient({ role }: Props) {
  switch (role) {
    case 'admin':
    case 'facturation':
      return <AdminDashboard />;
    case 'medecin':
      return <MedecinDashboard />;
    case 'infirmiere':
      return <InfirmiereDashboard />;
    case 'secretaire':
      return <SecretaireDashboard />;
    case 'gestionnaire_stock':
      return (
        <div className="rounded-xl border border-gray-200 p-8 text-center dark:border-gray-800">
          <p className="text-lg text-gray-500 dark:text-gray-400">
            Accedez a la gestion du stock via le menu
          </p>
        </div>
      );
    case 'patient':
      return (
        <div className="rounded-xl border border-gray-200 p-8 text-center dark:border-gray-800">
          <p className="text-lg text-gray-500 dark:text-gray-400">
            Portail patient bientot disponible
          </p>
        </div>
      );
    default:
      return null;
  }
}
```

- [ ] **Step 13: Verifier la compilation TypeScript**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 14: Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
git add src/server/db/schema/enums.ts \
        src/server/db/schema/lots.ts \
        src/server/db/schema/mouvements-stock.ts \
        src/server/db/schema/seuils-stock.ts \
        src/server/db/schema/prescriptions-seance.ts \
        src/server/db/schema/ordonnances.ts \
        src/server/db/schema/index.ts \
        src/server/db/schema/relations.ts \
        src/lib/permissions.ts \
        src/components/layout/sidebar.tsx \
        src/components/dashboard/dashboard-client.tsx \
        drizzle/
git commit -m "feat(schema): ajouter lots, mouvements-stock, seuils-stock, prescriptions, ordonnances + role gestionnaire_stock"
```

---

## Task 2: Logique FIFO + validators stock + router stock + tests

**Files:**
- Create: `src/lib/stock-fifo.ts`
- Create: `src/lib/validators/stock.ts`
- Create: `src/server/trpc/routers/stock.router.ts`
- Modify: `src/server/trpc/router.ts`
- Create: `tests/unit/stock-fifo.test.ts`
- Create: `tests/unit/stock-validators.test.ts`

**Interfaces:**
- Consumes: `lots` table, `mouvementsStock` table, `seuilsStock` table, `articles` table (tous de `@/server/db/schema`), `roleProcedure` de `@/server/trpc`
- Produces:
  - `applyFifo(lots, quantiteDemandee)` → `{ allocations: Array<{ lotId: string, lotArticleId: string, quantite: number }>, totalDisponible: number, satisfait: boolean }`
  - `entreeStockSchema`, `sortieManuelleSchema`, `ajustementSchema`, `setSeuilSchema`
  - `stockRouter` exporte depuis `stock.router.ts`
  - `appRouter.stock` accessible via tRPC

- [ ] **Step 1: Ecrire les tests FIFO (failing)**

```typescript
// tests/unit/stock-fifo.test.ts
import { describe, it, expect } from 'vitest';
import { applyFifo } from '@/lib/stock-fifo';

describe('applyFifo', () => {
  it('alloue depuis un seul lot suffisant', () => {
    const lots = [
      { lotId: 'lot-1', lotArticleId: 'art-1', datePeremption: '2027-01-01', quantiteDisponible: 10 },
    ];
    const result = applyFifo(lots, 5);
    expect(result.satisfait).toBe(true);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]).toEqual({ lotId: 'lot-1', lotArticleId: 'art-1', quantite: 5 });
  });

  it('alloue sur plusieurs lots (multi-lot)', () => {
    const lots = [
      { lotId: 'lot-1', lotArticleId: 'art-1', datePeremption: '2026-06-01', quantiteDisponible: 3 },
      { lotId: 'lot-2', lotArticleId: 'art-1', datePeremption: '2027-01-01', quantiteDisponible: 7 },
    ];
    const result = applyFifo(lots, 8);
    expect(result.satisfait).toBe(true);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]).toEqual({ lotId: 'lot-1', lotArticleId: 'art-1', quantite: 3 });
    expect(result.allocations[1]).toEqual({ lotId: 'lot-2', lotArticleId: 'art-1', quantite: 5 });
  });

  it('retourne satisfait=false si stock insuffisant', () => {
    const lots = [
      { lotId: 'lot-1', lotArticleId: 'art-1', datePeremption: '2027-01-01', quantiteDisponible: 2 },
    ];
    const result = applyFifo(lots, 5);
    expect(result.satisfait).toBe(false);
    expect(result.totalDisponible).toBe(2);
    expect(result.allocations).toHaveLength(0);
  });

  it('retourne satisfait=false si aucun lot', () => {
    const result = applyFifo([], 5);
    expect(result.satisfait).toBe(false);
    expect(result.totalDisponible).toBe(0);
    expect(result.allocations).toHaveLength(0);
  });

  it('prend le lot a peremption la plus proche en premier (FEFO)', () => {
    const lots = [
      { lotId: 'lot-peremption-tardive', lotArticleId: 'art-1', datePeremption: '2028-01-01', quantiteDisponible: 10 },
      { lotId: 'lot-peremption-proche', lotArticleId: 'art-1', datePeremption: '2026-12-01', quantiteDisponible: 10 },
    ];
    // Lots passes dans un ordre non trie — la fonction doit trier elle-meme
    const result = applyFifo(lots, 3);
    expect(result.satisfait).toBe(true);
    expect(result.allocations[0]!.lotId).toBe('lot-peremption-proche');
  });

  it('ignore les lots avec quantiteDisponible = 0', () => {
    const lots = [
      { lotId: 'lot-vide', lotArticleId: 'art-1', datePeremption: '2026-06-01', quantiteDisponible: 0 },
      { lotId: 'lot-plein', lotArticleId: 'art-1', datePeremption: '2027-01-01', quantiteDisponible: 5 },
    ];
    const result = applyFifo(lots, 3);
    expect(result.satisfait).toBe(true);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]!.lotId).toBe('lot-plein');
  });

  it('alloue exactement le stock disponible total quand quantite = totalDisponible', () => {
    const lots = [
      { lotId: 'lot-1', lotArticleId: 'art-1', datePeremption: '2027-01-01', quantiteDisponible: 4 },
      { lotId: 'lot-2', lotArticleId: 'art-1', datePeremption: '2027-06-01', quantiteDisponible: 6 },
    ];
    const result = applyFifo(lots, 10);
    expect(result.satisfait).toBe(true);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]!.quantite).toBe(4);
    expect(result.allocations[1]!.quantite).toBe(6);
  });
});
```

- [ ] **Step 2: Lancer les tests — verifier qu'ils echouent**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm test -- tests/unit/stock-fifo.test.ts
```

Expected: FAIL avec "Cannot find module '@/lib/stock-fifo'"

- [ ] **Step 3: Implementer `src/lib/stock-fifo.ts`**

```typescript
// src/lib/stock-fifo.ts

export type LotPourFifo = {
  lotId: string;
  lotArticleId: string;
  datePeremption: string; // YYYY-MM-DD
  quantiteDisponible: number;
};

export type AllocationFifo = {
  lotId: string;
  lotArticleId: string;
  quantite: number;
};

export type ResultatFifo = {
  allocations: AllocationFifo[];
  totalDisponible: number;
  satisfait: boolean;
};

/**
 * Calcule les allocations FIFO (FEFO) pour une sortie de stock.
 * Trie les lots par date de peremption ascendante (lots qui expirent en premier, utilises en premier).
 * Si le stock total est insuffisant, retourne satisfait=false et allocations=[].
 * Fonction pure — aucun effet de bord, aucune DB.
 */
export function applyFifo(lots: LotPourFifo[], quantiteDemandee: number): ResultatFifo {
  const lotsActifs = lots.filter((l) => l.quantiteDisponible > 0);
  const lotsTries = [...lotsActifs].sort((a, b) =>
    a.datePeremption.localeCompare(b.datePeremption),
  );

  const totalDisponible = lotsTries.reduce((sum, l) => sum + l.quantiteDisponible, 0);

  if (totalDisponible < quantiteDemandee) {
    return { allocations: [], totalDisponible, satisfait: false };
  }

  const allocations: AllocationFifo[] = [];
  let reste = quantiteDemandee;

  for (const lot of lotsTries) {
    if (reste <= 0) break;
    const pris = Math.min(lot.quantiteDisponible, reste);
    allocations.push({ lotId: lot.lotId, lotArticleId: lot.lotArticleId, quantite: pris });
    reste -= pris;
  }

  return { allocations, totalDisponible, satisfait: true };
}
```

- [ ] **Step 4: Lancer les tests FIFO — verifier qu'ils passent**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm test -- tests/unit/stock-fifo.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 5: Ecrire les tests validators stock (failing)**

```typescript
// tests/unit/stock-validators.test.ts
import { describe, it, expect } from 'vitest';
import {
  entreeStockSchema,
  sortieManuelleSchema,
  ajustementSchema,
  setSeuilSchema,
} from '@/lib/validators/stock';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('entreeStockSchema', () => {
  it('accepte une entree valide', () => {
    const result = entreeStockSchema.safeParse({
      articleId: UUID,
      numeroLot: 'LOT-2024-001',
      datePeremption: '2027-01-15',
      quantite: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejette articleId non UUID', () => {
    const result = entreeStockSchema.safeParse({
      articleId: 'pas-un-uuid',
      numeroLot: 'LOT-001',
      datePeremption: '2027-01-15',
      quantite: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejette numeroLot vide', () => {
    const result = entreeStockSchema.safeParse({
      articleId: UUID,
      numeroLot: '',
      datePeremption: '2027-01-15',
      quantite: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejette numeroLot > 100 caracteres', () => {
    const result = entreeStockSchema.safeParse({
      articleId: UUID,
      numeroLot: 'X'.repeat(101),
      datePeremption: '2027-01-15',
      quantite: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejette datePeremption format invalide', () => {
    const result = entreeStockSchema.safeParse({
      articleId: UUID,
      numeroLot: 'LOT-001',
      datePeremption: '15/01/2027',
      quantite: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejette quantite negative', () => {
    const result = entreeStockSchema.safeParse({
      articleId: UUID,
      numeroLot: 'LOT-001',
      datePeremption: '2027-01-15',
      quantite: -10,
    });
    expect(result.success).toBe(false);
  });

  it('rejette quantite zero', () => {
    const result = entreeStockSchema.safeParse({
      articleId: UUID,
      numeroLot: 'LOT-001',
      datePeremption: '2027-01-15',
      quantite: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('sortieManuelleSchema', () => {
  it('accepte une sortie valide', () => {
    const result = sortieManuelleSchema.safeParse({
      articleId: UUID,
      quantite: 5,
      motif: 'Utilise pour patient externe',
    });
    expect(result.success).toBe(true);
  });

  it('rejette quantite negative', () => {
    const result = sortieManuelleSchema.safeParse({
      articleId: UUID,
      quantite: -1,
      motif: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('rejette motif vide', () => {
    const result = sortieManuelleSchema.safeParse({
      articleId: UUID,
      quantite: 5,
      motif: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejette motif > 200 caracteres', () => {
    const result = sortieManuelleSchema.safeParse({
      articleId: UUID,
      quantite: 5,
      motif: 'M'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe('ajustementSchema', () => {
  it('accepte un ajustement positif avec lotId', () => {
    const result = ajustementSchema.safeParse({
      articleId: UUID,
      lotId: UUID,
      quantite: 10,
      motif: 'Correction inventaire',
    });
    expect(result.success).toBe(true);
  });

  it('accepte un ajustement negatif sans lotId', () => {
    const result = ajustementSchema.safeParse({
      articleId: UUID,
      quantite: -5,
      motif: 'Perte constatee',
    });
    expect(result.success).toBe(true);
  });

  it('rejette quantite zero', () => {
    const result = ajustementSchema.safeParse({
      articleId: UUID,
      quantite: 0,
      motif: 'Test',
    });
    expect(result.success).toBe(false);
  });
});

describe('setSeuilSchema', () => {
  it('accepte un seuil valide', () => {
    const result = setSeuilSchema.safeParse({
      articleId: UUID,
      seuilMin: 10,
    });
    expect(result.success).toBe(true);
  });

  it('rejette seuilMin negatif', () => {
    const result = setSeuilSchema.safeParse({
      articleId: UUID,
      seuilMin: -5,
    });
    expect(result.success).toBe(false);
  });

  it('rejette seuilMin zero', () => {
    const result = setSeuilSchema.safeParse({
      articleId: UUID,
      seuilMin: 0,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 6: Lancer les tests validators — verifier qu'ils echouent**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm test -- tests/unit/stock-validators.test.ts
```

Expected: FAIL avec "Cannot find module '@/lib/validators/stock'"

- [ ] **Step 7: Creer `src/lib/validators/stock.ts`**

```typescript
import { z } from 'zod';

export const entreeStockSchema = z.object({
  articleId: z.string().uuid('Article ID invalide'),
  numeroLot: z.string().min(1, 'Numero de lot requis').max(100, 'Numero de lot trop long'),
  datePeremption: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
  quantite: z.number().positive('La quantite doit etre positive'),
});

export type EntreeStockInput = z.infer<typeof entreeStockSchema>;

export const sortieManuelleSchema = z.object({
  articleId: z.string().uuid('Article ID invalide'),
  quantite: z.number().positive('La quantite doit etre positive'),
  motif: z.string().min(1, 'Motif requis').max(200, 'Motif trop long'),
});

export type SortieManuelleInput = z.infer<typeof sortieManuelleSchema>;

export const ajustementSchema = z
  .object({
    articleId: z.string().uuid('Article ID invalide'),
    lotId: z.string().uuid('Lot ID invalide').optional(),
    quantite: z.number().refine((v) => v !== 0, { message: 'La quantite ne peut pas etre zero' }),
    motif: z.string().min(1, 'Motif requis').max(200, 'Motif trop long'),
  });

export type AjustementInput = z.infer<typeof ajustementSchema>;

export const setSeuilSchema = z.object({
  articleId: z.string().uuid('Article ID invalide'),
  seuilMin: z.number().positive('Le seuil doit etre positif'),
});

export type SetSeuilInput = z.infer<typeof setSeuilSchema>;
```

- [ ] **Step 8: Lancer les tests validators — verifier qu'ils passent**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm test -- tests/unit/stock-validators.test.ts
```

Expected: tous les tests PASS.

- [ ] **Step 9: Creer `src/server/trpc/routers/stock.router.ts`**

```typescript
import { router, roleProcedure } from '@/server/trpc';
import {
  lots,
  mouvementsStock,
  seuilsStock,
  articles,
} from '@/server/db/schema';
import {
  entreeStockSchema,
  sortieManuelleSchema,
  ajustementSchema,
  setSeuilSchema,
} from '@/lib/validators/stock';
import { applyFifo } from '@/lib/stock-fifo';
import { eq, and, gt, sql, lte, desc, asc } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const stockRouter = router({
  etatStock: roleProcedure(['admin', 'gestionnaire_stock', 'infirmiere'])
    .input(
      z.object({
        categorie: z
          .enum(['medicament', 'consommable', 'acte_medical'] as const)
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const articlesQuery = ctx.db
        .select({
          id: articles.id,
          nom: articles.nom,
          categorie: articles.categorie,
          unite: articles.unite,
        })
        .from(articles)
        .where(
          input.categorie
            ? and(eq(articles.isActive, true), eq(articles.categorie, input.categorie))
            : eq(articles.isActive, true),
        );

      const articlesData = await articlesQuery;

      const result = await Promise.all(
        articlesData.map(async (article) => {
          const [stockRow] = await ctx.db
            .select({ total: sql<string>`COALESCE(SUM(${lots.quantiteDisponible}), '0')` })
            .from(lots)
            .where(eq(lots.articleId, article.id));

          const [seuilRow] = await ctx.db
            .select({ seuilMin: seuilsStock.seuilMin })
            .from(seuilsStock)
            .where(eq(seuilsStock.articleId, article.id))
            .limit(1);

          const stockActuel = parseFloat(stockRow?.total ?? '0');
          const seuilMin = seuilRow ? parseFloat(seuilRow.seuilMin) : null;

          let statut: 'normal' | 'alerte' | 'rupture' = 'normal';
          if (seuilMin !== null) {
            if (stockActuel === 0) statut = 'rupture';
            else if (stockActuel < seuilMin) statut = 'alerte';
          }

          return {
            ...article,
            stockActuel,
            seuilMin,
            statut,
          };
        }),
      );

      return result;
    }),

  lotsByArticle: roleProcedure(['admin', 'gestionnaire_stock'])
    .input(z.object({ articleId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(lots)
        .where(eq(lots.articleId, input.articleId))
        .orderBy(asc(lots.datePeremption));
    }),

  mouvements: roleProcedure(['admin', 'gestionnaire_stock'])
    .input(
      z.object({
        articleId: z.string().uuid().optional(),
        typeMouvement: z
          .enum(['entree', 'sortie', 'ajustement'] as const)
          .optional(),
        dateDebut: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        dateFin: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        page: z.number().int().positive().default(1),
        perPage: z.number().int().positive().max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.articleId) conditions.push(eq(mouvementsStock.articleId, input.articleId));
      if (input.typeMouvement)
        conditions.push(eq(mouvementsStock.typeMouvement, input.typeMouvement));

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (input.page - 1) * input.perPage;

      const data = await ctx.db
        .select()
        .from(mouvementsStock)
        .where(where)
        .orderBy(desc(mouvementsStock.createdAt))
        .limit(input.perPage)
        .offset(offset);

      return data;
    }),

  entree: roleProcedure(['admin', 'gestionnaire_stock'])
    .input(entreeStockSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [lot] = await ctx.db
        .insert(lots)
        .values({
          articleId: input.articleId,
          numeroLot: input.numeroLot,
          datePeremption: input.datePeremption,
          quantiteInitiale: input.quantite.toString(),
          quantiteDisponible: input.quantite.toString(),
          createdBy: userId,
        })
        .returning();

      if (!lot) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erreur creation lot' });

      await ctx.db.insert(mouvementsStock).values({
        articleId: input.articleId,
        lotId: lot.id,
        typeMouvement: 'entree',
        quantite: input.quantite.toString(),
        createdBy: userId,
      });

      return lot;
    }),

  sortieManuelle: roleProcedure(['admin', 'gestionnaire_stock', 'infirmiere'])
    .input(sortieManuelleSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const lotsDisponibles = await ctx.db
        .select({
          lotId: lots.id,
          lotArticleId: lots.articleId,
          datePeremption: lots.datePeremption,
          quantiteDisponible: sql<number>`CAST(${lots.quantiteDisponible} AS FLOAT)`,
        })
        .from(lots)
        .where(and(eq(lots.articleId, input.articleId), gt(lots.quantiteDisponible, '0')));

      const resultat = applyFifo(lotsDisponibles, input.quantite);

      if (!resultat.satisfait) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `STOCK_INSUFFISANT: stock disponible ${resultat.totalDisponible}`,
        });
      }

      for (const alloc of resultat.allocations) {
        await ctx.db
          .update(lots)
          .set({
            quantiteDisponible: sql`${lots.quantiteDisponible} - ${alloc.quantite}`,
          })
          .where(eq(lots.id, alloc.lotId));

        await ctx.db.insert(mouvementsStock).values({
          articleId: input.articleId,
          lotId: alloc.lotId,
          typeMouvement: 'sortie',
          quantite: (-alloc.quantite).toString(),
          motif: input.motif,
          createdBy: userId,
        });
      }

      return { succes: true, allocations: resultat.allocations };
    }),

  ajustement: roleProcedure(['admin', 'gestionnaire_stock'])
    .input(ajustementSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (input.quantite > 0) {
        if (!input.lotId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'lotId requis pour un ajustement positif',
          });
        }
        await ctx.db
          .update(lots)
          .set({
            quantiteDisponible: sql`${lots.quantiteDisponible} + ${input.quantite}`,
          })
          .where(eq(lots.id, input.lotId));
      } else {
        const quantiteAbs = Math.abs(input.quantite);
        const lotsDisponibles = await ctx.db
          .select({
            lotId: lots.id,
            lotArticleId: lots.articleId,
            datePeremption: lots.datePeremption,
            quantiteDisponible: sql<number>`CAST(${lots.quantiteDisponible} AS FLOAT)`,
          })
          .from(lots)
          .where(and(eq(lots.articleId, input.articleId), gt(lots.quantiteDisponible, '0')));

        const resultat = applyFifo(lotsDisponibles, quantiteAbs);
        if (!resultat.satisfait) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `STOCK_INSUFFISANT: stock disponible ${resultat.totalDisponible}`,
          });
        }
        for (const alloc of resultat.allocations) {
          await ctx.db
            .update(lots)
            .set({
              quantiteDisponible: sql`${lots.quantiteDisponible} - ${alloc.quantite}`,
            })
            .where(eq(lots.id, alloc.lotId));
        }
      }

      await ctx.db.insert(mouvementsStock).values({
        articleId: input.articleId,
        lotId: input.lotId ?? null,
        typeMouvement: 'ajustement',
        quantite: input.quantite.toString(),
        motif: input.motif,
        createdBy: userId,
      });

      return { succes: true };
    }),

  setSeuil: roleProcedure(['admin', 'gestionnaire_stock'])
    .input(setSeuilSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: seuilsStock.id })
        .from(seuilsStock)
        .where(eq(seuilsStock.articleId, input.articleId))
        .limit(1);

      if (existing.length > 0) {
        await ctx.db
          .update(seuilsStock)
          .set({ seuilMin: input.seuilMin.toString(), updatedAt: new Date() })
          .where(eq(seuilsStock.articleId, input.articleId));
      } else {
        await ctx.db.insert(seuilsStock).values({
          articleId: input.articleId,
          seuilMin: input.seuilMin.toString(),
        });
      }

      return { succes: true };
    }),

  alertes: roleProcedure(['admin', 'gestionnaire_stock'])
    .query(async ({ ctx }) => {
      // Articles en stock bas
      const tousArticles = await ctx.db
        .select({ id: articles.id, nom: articles.nom })
        .from(articles)
        .where(eq(articles.isActive, true));

      const stockBas = [];
      for (const article of tousArticles) {
        const [seuil] = await ctx.db
          .select({ seuilMin: seuilsStock.seuilMin })
          .from(seuilsStock)
          .where(eq(seuilsStock.articleId, article.id))
          .limit(1);

        if (!seuil) continue;

        const [stockRow] = await ctx.db
          .select({ total: sql<string>`COALESCE(SUM(${lots.quantiteDisponible}), '0')` })
          .from(lots)
          .where(eq(lots.articleId, article.id));

        const stockActuel = parseFloat(stockRow?.total ?? '0');
        const seuilMin = parseFloat(seuil.seuilMin);

        if (stockActuel < seuilMin) {
          stockBas.push({ ...article, stockActuel, seuilMin });
        }
      }

      // Lots peremption proche (30 jours)
      const dans30Jours = new Date();
      dans30Jours.setDate(dans30Jours.getDate() + 30);
      const dateLimite = dans30Jours.toISOString().slice(0, 10);

      const lotsPeremption = await ctx.db
        .select({
          id: lots.id,
          articleId: lots.articleId,
          numeroLot: lots.numeroLot,
          datePeremption: lots.datePeremption,
          quantiteDisponible: lots.quantiteDisponible,
        })
        .from(lots)
        .where(and(lte(lots.datePeremption, dateLimite), gt(lots.quantiteDisponible, '0')))
        .orderBy(asc(lots.datePeremption));

      return { stockBas, lotsPeremption };
    }),

  alertesCount: roleProcedure(['admin', 'gestionnaire_stock', 'infirmiere'])
    .query(async ({ ctx }) => {
      const tousArticles = await ctx.db
        .select({ id: articles.id })
        .from(articles)
        .where(eq(articles.isActive, true));

      let nbStockBas = 0;
      for (const article of tousArticles) {
        const [seuil] = await ctx.db
          .select({ seuilMin: seuilsStock.seuilMin })
          .from(seuilsStock)
          .where(eq(seuilsStock.articleId, article.id))
          .limit(1);

        if (!seuil) continue;

        const [stockRow] = await ctx.db
          .select({ total: sql<string>`COALESCE(SUM(${lots.quantiteDisponible}), '0')` })
          .from(lots)
          .where(eq(lots.articleId, article.id));

        if (parseFloat(stockRow?.total ?? '0') < parseFloat(seuil.seuilMin)) {
          nbStockBas++;
        }
      }

      const dans30Jours = new Date();
      dans30Jours.setDate(dans30Jours.getDate() + 30);
      const dateLimite = dans30Jours.toISOString().slice(0, 10);

      const [{ nbLotsPeremption }] = await ctx.db
        .select({ nbLotsPeremption: sql<number>`COUNT(*)::int` })
        .from(lots)
        .where(and(lte(lots.datePeremption, dateLimite), gt(lots.quantiteDisponible, '0')));

      return { count: nbStockBas + (nbLotsPeremption ?? 0) };
    }),
});
```

- [ ] **Step 10: Enregistrer le router stock dans `src/server/trpc/router.ts`**

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
import { articlesRouter } from './routers/articles.router';
import { facturesRouter } from './routers/factures.router';
import { dashboardRouter } from './routers/dashboard.router';
import { stockRouter } from './routers/stock.router';

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
  articles: articlesRouter,
  factures: facturesRouter,
  dashboard: dashboardRouter,
  stock: stockRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 11: Verifier la compilation**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 12: Lancer tous les tests**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm test
```

Expected: tous PASS.

- [ ] **Step 13: Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
git add src/lib/stock-fifo.ts \
        src/lib/validators/stock.ts \
        src/server/trpc/routers/stock.router.ts \
        src/server/trpc/router.ts \
        tests/unit/stock-fifo.test.ts \
        tests/unit/stock-validators.test.ts
git commit -m "feat(stock): logique FIFO, validators, router stock + tests"
```

---

## Task 3: UI Stock — etat, detail, alertes, badge menu

**Files:**
- Create: `src/components/stock/stock-list.tsx`
- Create: `src/components/stock/stock-detail.tsx`
- Create: `src/components/stock/stock-alertes.tsx`
- Create: `src/app/(dashboard)/stock/page.tsx`
- Create: `src/app/(dashboard)/stock/[articleId]/page.tsx`
- Create: `src/app/(dashboard)/stock/alertes/page.tsx`
- Modify: `src/components/layout/sidebar.tsx` (badge alertesCount)

**Interfaces:**
- Consumes: `api.stock.etatStock`, `api.stock.lotsByArticle`, `api.stock.mouvements`, `api.stock.entree`, `api.stock.sortieManuelle`, `api.stock.ajustement`, `api.stock.setSeuil`, `api.stock.alertes`, `api.stock.alertesCount`
- Produces: pages `/stock`, `/stock/[articleId]`, `/stock/alertes`

- [ ] **Step 1: Creer `src/components/stock/stock-list.tsx`**

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIE_OPTIONS = [
  { value: '', label: 'Toutes categories' },
  { value: 'medicament', label: 'Medicament' },
  { value: 'consommable', label: 'Consommable' },
  { value: 'acte_medical', label: 'Acte medical' },
] as const;

const STATUT_BADGE: Record<string, string> = {
  normal: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  alerte: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  rupture: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const STATUT_LABEL: Record<string, string> = {
  normal: 'Normal',
  alerte: 'Alerte',
  rupture: 'Rupture',
};

export function StockList() {
  const [categorie, setCategorie] = useState<'medicament' | 'consommable' | 'acte_medical' | undefined>(undefined);
  const [seuilArticleId, setSeuilArticleId] = useState<string | null>(null);
  const [seuilValeur, setSeuilValeur] = useState('');

  const { data, isLoading, refetch } = api.stock.etatStock.useQuery(
    { categorie },
  );

  const setSeuilMutation = api.stock.setSeuil.useMutation({
    onSuccess: () => {
      setSeuilArticleId(null);
      setSeuilValeur('');
      void refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Etat du stock</h1>
        <Link href="/stock/alertes">
          <Button variant="outline">Voir les alertes</Button>
        </Link>
      </div>

      <div className="mb-4">
        <select
          value={categorie ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setCategorie(
              val === '' ? undefined : (val as 'medicament' | 'consommable' | 'acte_medical'),
            );
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          {CATEGORIE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Article</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Categorie</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Stock dispo</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Seuil min</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Statut</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {data?.map((row) => (
              <tr
                key={row.id}
                className="bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/stock/${row.id}`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {row.nom}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.categorie}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {row.stockActuel} {row.unite}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {row.seuilMin !== null ? `${row.seuilMin} ${row.unite}` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge className={STATUT_BADGE[row.statut] ?? ''}>
                    {STATUT_LABEL[row.statut] ?? row.statut}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  {seuilArticleId === row.id ? (
                    <div className="flex items-center gap-2 justify-center">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={seuilValeur}
                        onChange={(e) => setSeuilValeur(e.target.value)}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                        placeholder="Seuil"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          const val = parseFloat(seuilValeur);
                          if (!isNaN(val) && val > 0) {
                            setSeuilMutation.mutate({ articleId: row.id, seuilMin: val });
                          }
                        }}
                        disabled={setSeuilMutation.isPending}
                      >
                        OK
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSeuilArticleId(null)}
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSeuilArticleId(row.id);
                        setSeuilValeur(row.seuilMin !== null ? String(row.seuilMin) : '');
                      }}
                    >
                      Definir seuil
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Aucun article
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

- [ ] **Step 2: Creer `src/components/stock/stock-detail.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Props = { articleId: string };

export function StockDetail({ articleId }: Props) {
  const utils = api.useUtils();

  const { data: lots, isLoading: lotsLoading } = api.stock.lotsByArticle.useQuery({ articleId });
  const { data: mouvements, isLoading: mouvementsLoading } = api.stock.mouvements.useQuery({
    articleId,
    page: 1,
    perPage: 20,
  });

  // Formulaire entree
  const [entreeForm, setEntreeForm] = useState({ numeroLot: '', datePeremption: '', quantite: '' });
  const entreeMutation = api.stock.entree.useMutation({
    onSuccess: () => {
      setEntreeForm({ numeroLot: '', datePeremption: '', quantite: '' });
      void utils.stock.lotsByArticle.invalidate({ articleId });
      void utils.stock.mouvements.invalidate({ articleId });
    },
  });

  // Formulaire sortie
  const [sortieForm, setSortieForm] = useState({ quantite: '', motif: '' });
  const sortieMutation = api.stock.sortieManuelle.useMutation({
    onSuccess: () => {
      setSortieForm({ quantite: '', motif: '' });
      void utils.stock.lotsByArticle.invalidate({ articleId });
      void utils.stock.mouvements.invalidate({ articleId });
    },
  });

  // Formulaire ajustement
  const [ajustForm, setAjustForm] = useState({ lotId: '', quantite: '', motif: '' });
  const ajustMutation = api.stock.ajustement.useMutation({
    onSuccess: () => {
      setAjustForm({ lotId: '', quantite: '', motif: '' });
      void utils.stock.lotsByArticle.invalidate({ articleId });
      void utils.stock.mouvements.invalidate({ articleId });
    },
  });

  if (lotsLoading || mouvementsLoading) return <Skeleton className="h-96 w-full" />;

  const aujourd = new Date().toISOString().slice(0, 10);
  const dans30j = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Tableau des lots */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Lots en stock</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">N° Lot</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Peremption</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Qte initiale</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Qte dispo</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {lots?.map((lot) => {
                const estPerime = lot.datePeremption <= aujourd;
                const expireProche = lot.datePeremption <= dans30j && !estPerime;
                return (
                  <tr key={lot.id} className="bg-white dark:bg-gray-950">
                    <td className="px-4 py-3 font-mono">{lot.numeroLot}</td>
                    <td className="px-4 py-3">{lot.datePeremption}</td>
                    <td className="px-4 py-3 text-right font-mono">{lot.quantiteInitiale}</td>
                    <td className="px-4 py-3 text-right font-mono">{lot.quantiteDisponible}</td>
                    <td className="px-4 py-3 text-center">
                      {estPerime && (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                          Perime
                        </Badge>
                      )}
                      {expireProche && (
                        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                          Expire bientot
                        </Badge>
                      )}
                      {!estPerime && !expireProche && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                          OK
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {lots?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Aucun lot
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Formulaire entree */}
      <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Nouvelle entree</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">N° Lot</label>
            <input
              type="text"
              value={entreeForm.numeroLot}
              onChange={(e) => setEntreeForm((f) => ({ ...f, numeroLot: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="LOT-2024-001"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Date peremption</label>
            <input
              type="date"
              value={entreeForm.datePeremption}
              onChange={(e) => setEntreeForm((f) => ({ ...f, datePeremption: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Quantite</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={entreeForm.quantite}
              onChange={(e) => setEntreeForm((f) => ({ ...f, quantite: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </div>
        {entreeMutation.error && (
          <p className="mt-2 text-sm text-red-600">{entreeMutation.error.message}</p>
        )}
        <Button
          className="mt-4"
          onClick={() => {
            const q = parseFloat(entreeForm.quantite);
            if (!entreeForm.numeroLot || !entreeForm.datePeremption || isNaN(q)) return;
            entreeMutation.mutate({
              articleId,
              numeroLot: entreeForm.numeroLot,
              datePeremption: entreeForm.datePeremption,
              quantite: q,
            });
          }}
          disabled={entreeMutation.isPending}
        >
          Enregistrer l'entree
        </Button>
      </section>

      {/* Formulaire sortie manuelle */}
      <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Sortie manuelle</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Quantite</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={sortieForm.quantite}
              onChange={(e) => setSortieForm((f) => ({ ...f, quantite: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Motif</label>
            <input
              type="text"
              value={sortieForm.motif}
              onChange={(e) => setSortieForm((f) => ({ ...f, motif: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Raison de la sortie"
            />
          </div>
        </div>
        {sortieMutation.error && (
          <p className="mt-2 text-sm text-red-600">{sortieMutation.error.message}</p>
        )}
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            const q = parseFloat(sortieForm.quantite);
            if (isNaN(q) || !sortieForm.motif) return;
            sortieMutation.mutate({ articleId, quantite: q, motif: sortieForm.motif });
          }}
          disabled={sortieMutation.isPending}
        >
          Enregistrer la sortie
        </Button>
      </section>

      {/* Formulaire ajustement */}
      <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Ajustement d'inventaire</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              Lot (requis si positif)
            </label>
            <select
              value={ajustForm.lotId}
              onChange={(e) => setAjustForm((f) => ({ ...f, lotId: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">-- Choisir un lot --</option>
              {lots?.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.numeroLot} (exp. {lot.datePeremption})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              Quantite (negatif = perte)
            </label>
            <input
              type="number"
              step="0.01"
              value={ajustForm.quantite}
              onChange={(e) => setAjustForm((f) => ({ ...f, quantite: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Motif</label>
            <input
              type="text"
              value={ajustForm.motif}
              onChange={(e) => setAjustForm((f) => ({ ...f, motif: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Correction inventaire"
            />
          </div>
        </div>
        {ajustMutation.error && (
          <p className="mt-2 text-sm text-red-600">{ajustMutation.error.message}</p>
        )}
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            const q = parseFloat(ajustForm.quantite);
            if (isNaN(q) || q === 0 || !ajustForm.motif) return;
            ajustMutation.mutate({
              articleId,
              lotId: ajustForm.lotId || undefined,
              quantite: q,
              motif: ajustForm.motif,
            });
          }}
          disabled={ajustMutation.isPending}
        >
          Enregistrer l'ajustement
        </Button>
      </section>

      {/* Historique mouvements */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Historique des mouvements
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Type</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Quantite</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Motif</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {mouvements?.map((m) => (
                <tr key={m.id} className="bg-white dark:bg-gray-950">
                  <td className="px-4 py-3 capitalize">{m.typeMouvement}</td>
                  <td className={`px-4 py-3 text-right font-mono ${parseFloat(m.quantite) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {parseFloat(m.quantite) >= 0 ? '+' : ''}{m.quantite}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{m.motif ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(m.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
              {mouvements?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    Aucun mouvement
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Creer `src/components/stock/stock-alertes.tsx`**

```typescript
'use client';

import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';

export function StockAlertes() {
  const { data, isLoading } = api.stock.alertes.useQuery();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alertes stock</h1>

      {/* Stock bas */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-orange-600 dark:text-orange-400">
          Articles en stock bas ({data?.stockBas.length ?? 0})
        </h2>
        {data?.stockBas.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun article en alerte stock bas</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-orange-200 dark:border-orange-900">
            <table className="w-full text-sm">
              <thead className="bg-orange-50 dark:bg-orange-950">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-orange-700 dark:text-orange-300">Article</th>
                  <th className="px-4 py-3 text-right font-medium text-orange-700 dark:text-orange-300">Stock actuel</th>
                  <th className="px-4 py-3 text-right font-medium text-orange-700 dark:text-orange-300">Seuil min</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100 dark:divide-orange-900">
                {data?.stockBas.map((a) => (
                  <tr key={a.id} className="bg-white dark:bg-gray-950">
                    <td className="px-4 py-3 font-medium">{a.nom}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">{a.stockActuel}</td>
                    <td className="px-4 py-3 text-right font-mono">{a.seuilMin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Peremption proche */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-red-600 dark:text-red-400">
          Lots a peremption proche — 30 jours ({data?.lotsPeremption.length ?? 0})
        </h2>
        {data?.lotsPeremption.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun lot expirant dans les 30 prochains jours</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-red-200 dark:border-red-900">
            <table className="w-full text-sm">
              <thead className="bg-red-50 dark:bg-red-950">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-red-700 dark:text-red-300">N° Lot</th>
                  <th className="px-4 py-3 text-left font-medium text-red-700 dark:text-red-300">Date peremption</th>
                  <th className="px-4 py-3 text-right font-medium text-red-700 dark:text-red-300">Quantite dispo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100 dark:divide-red-900">
                {data?.lotsPeremption.map((lot) => (
                  <tr key={lot.id} className="bg-white dark:bg-gray-950">
                    <td className="px-4 py-3 font-mono">{lot.numeroLot}</td>
                    <td className="px-4 py-3 text-red-600">{lot.datePeremption}</td>
                    <td className="px-4 py-3 text-right font-mono">{lot.quantiteDisponible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Creer les pages thin-wrapper**

```typescript
// src/app/(dashboard)/stock/page.tsx
import { StockList } from '@/components/stock/stock-list';

export default function StockPage() {
  return <StockList />;
}
```

```typescript
// src/app/(dashboard)/stock/[articleId]/page.tsx
import { use } from 'react';
import { StockDetail } from '@/components/stock/stock-detail';

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = use(params);
  return <StockDetail articleId={articleId} />;
}
```

```typescript
// src/app/(dashboard)/stock/alertes/page.tsx
import { StockAlertes } from '@/components/stock/stock-alertes';

export default function StockAlertesPage() {
  return <StockAlertes />;
}
```

- [ ] **Step 5: Ajouter le badge alertesCount dans `src/components/layout/sidebar.tsx`**

Modifier le composant `Sidebar` pour afficher un badge rouge a cote du lien "Stock". Remplacer la section `<nav>` dans le composant :

```typescript
// Ajouter apres les imports existants, dans le composant Sidebar:
// 1. Importer api depuis '@/lib/trpc/client'
// 2. Appeler alertesCount dans le composant
// 3. Afficher un badge sur le lien Stock

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Activity,
  Calendar,
  FlaskConical,
  Receipt,
  Shield,
  Settings,
  Package,
  Warehouse,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/lib/permissions';
import { api } from '@/lib/trpc/client';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  LayoutDashboard,
  Users,
  Activity,
  Calendar,
  FlaskConical,
  Receipt,
  Shield,
  Settings,
  Package,
  Warehouse,
  AlertTriangle,
  FileText,
};

type SidebarProps = {
  items: MenuItem[];
};

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const hasStockItem = items.some((item) => item.href === '/stock');
  const { data: alertesData } = api.stock.alertesCount.useQuery(undefined, {
    enabled: hasStockItem,
    refetchInterval: 60_000,
  });
  const alertesCount = alertesData?.count ?? 0;

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-900',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
        {!collapsed && (
          <span className="text-xl font-bold text-blue-600">NephroSys</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={collapsed ? 'Ouvrir le menu' : 'Reduire le menu'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 p-2">
        {items.map((item) => {
          const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const showBadge = item.href === '/stock' && alertesCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} />
              {!collapsed && (
                <span className="flex-1">{item.label}</span>
              )}
              {!collapsed && showBadge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                  {alertesCount > 99 ? '99+' : alertesCount}
                </span>
              )}
              {collapsed && showBadge && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {alertesCount > 99 ? '99+' : alertesCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 6: Verifier la compilation**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
git add src/components/stock/ \
        src/app/(dashboard)/stock/ \
        src/components/layout/sidebar.tsx
git commit -m "feat(stock-ui): pages etat stock, detail article, alertes + badge menu"
```

---

## Task 4: Router prescriptions + validators + tests + sessions.terminer

**Files:**
- Create: `src/lib/validators/prescriptions.ts`
- Create: `src/server/trpc/routers/prescriptions.router.ts`
- Modify: `src/server/trpc/router.ts`
- Modify: `src/server/trpc/routers/sessions.router.ts` (procedure `terminer`)
- Create: `tests/unit/prescriptions-validators.test.ts`

**Interfaces:**
- Consumes: `prescriptionsSeance`, `ordonnances`, `dialysisSessions`, `articles`, `lots`, `mouvementsStock` (schema), `applyFifo` (stock-fifo.ts), `roleProcedure`
- Produces:
  - `addPrescriptionSchema`, `cancelPrescriptionSchema`, `ordonnanceCreateSchema`, `ordonnanceToggleSchema`
  - `prescriptionsRouter` avec procedures: `listBySession`, `addToSession`, `cancelPrescription`, `ordonnancesList`, `ordonnanceCreate`, `ordonnanceToggle`
  - `sessions.terminer` etendu avec auto-administration FIFO

- [ ] **Step 1: Ecrire les tests validators prescriptions (failing)**

```typescript
// tests/unit/prescriptions-validators.test.ts
import { describe, it, expect } from 'vitest';
import {
  addPrescriptionSchema,
  cancelPrescriptionSchema,
  ordonnanceCreateSchema,
  ordonnanceToggleSchema,
} from '@/lib/validators/prescriptions';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('addPrescriptionSchema', () => {
  it('accepte une prescription valide avec posologie', () => {
    const result = addPrescriptionSchema.safeParse({
      sessionId: UUID,
      articleId: UUID,
      quantite: 2,
      posologie: 'Administrer en fin de seance',
    });
    expect(result.success).toBe(true);
  });

  it('accepte une prescription valide sans posologie', () => {
    const result = addPrescriptionSchema.safeParse({
      sessionId: UUID,
      articleId: UUID,
      quantite: 1,
    });
    expect(result.success).toBe(true);
  });

  it('rejette quantite negative', () => {
    const result = addPrescriptionSchema.safeParse({
      sessionId: UUID,
      articleId: UUID,
      quantite: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejette quantite zero', () => {
    const result = addPrescriptionSchema.safeParse({
      sessionId: UUID,
      articleId: UUID,
      quantite: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejette sessionId non UUID', () => {
    const result = addPrescriptionSchema.safeParse({
      sessionId: 'pas-un-uuid',
      articleId: UUID,
      quantite: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejette posologie > 200 caracteres', () => {
    const result = addPrescriptionSchema.safeParse({
      sessionId: UUID,
      articleId: UUID,
      quantite: 1,
      posologie: 'X'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe('cancelPrescriptionSchema', () => {
  it('accepte un UUID valide', () => {
    const result = cancelPrescriptionSchema.safeParse({ prescriptionId: UUID });
    expect(result.success).toBe(true);
  });

  it('rejette un non-UUID', () => {
    const result = cancelPrescriptionSchema.safeParse({ prescriptionId: 'pas-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('ordonnanceCreateSchema', () => {
  it('accepte patientId et contenu valides', () => {
    const result = ordonnanceCreateSchema.safeParse({
      patientId: UUID,
      contenu: 'Erythropoietine 4000 UI SC 3x/semaine',
    });
    expect(result.success).toBe(true);
  });

  it('rejette contenu vide', () => {
    const result = ordonnanceCreateSchema.safeParse({
      patientId: UUID,
      contenu: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejette patientId non UUID', () => {
    const result = ordonnanceCreateSchema.safeParse({
      patientId: 'pas-uuid',
      contenu: 'Test',
    });
    expect(result.success).toBe(false);
  });
});

describe('ordonnanceToggleSchema', () => {
  it('accepte un UUID valide', () => {
    const result = ordonnanceToggleSchema.safeParse({ ordonnanceId: UUID });
    expect(result.success).toBe(true);
  });

  it('rejette un non-UUID', () => {
    const result = ordonnanceToggleSchema.safeParse({ ordonnanceId: 'pas-uuid' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests — verifier qu'ils echouent**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm test -- tests/unit/prescriptions-validators.test.ts
```

Expected: FAIL avec "Cannot find module '@/lib/validators/prescriptions'"

- [ ] **Step 3: Creer `src/lib/validators/prescriptions.ts`**

```typescript
import { z } from 'zod';

export const addPrescriptionSchema = z.object({
  sessionId: z.string().uuid('Session ID invalide'),
  articleId: z.string().uuid('Article ID invalide'),
  quantite: z.number().positive('La quantite doit etre positive'),
  posologie: z.string().max(200, 'Posologie trop longue').optional(),
});

export type AddPrescriptionInput = z.infer<typeof addPrescriptionSchema>;

export const cancelPrescriptionSchema = z.object({
  prescriptionId: z.string().uuid('Prescription ID invalide'),
});

export type CancelPrescriptionInput = z.infer<typeof cancelPrescriptionSchema>;

export const ordonnanceCreateSchema = z.object({
  patientId: z.string().uuid('Patient ID invalide'),
  contenu: z.string().min(1, 'Contenu requis'),
});

export type OrdonnanceCreateInput = z.infer<typeof ordonnanceCreateSchema>;

export const ordonnanceToggleSchema = z.object({
  ordonnanceId: z.string().uuid('Ordonnance ID invalide'),
});

export type OrdonnanceToggleInput = z.infer<typeof ordonnanceToggleSchema>;
```

- [ ] **Step 4: Lancer les tests — verifier qu'ils passent**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm test -- tests/unit/prescriptions-validators.test.ts
```

Expected: tous PASS.

- [ ] **Step 5: Creer `src/server/trpc/routers/prescriptions.router.ts`**

```typescript
import { router, roleProcedure } from '@/server/trpc';
import {
  prescriptionsSeance,
  ordonnances,
  dialysisSessions,
  articles,
  patients,
  lots,
  users,
} from '@/server/db/schema';
import {
  addPrescriptionSchema,
  cancelPrescriptionSchema,
  ordonnanceCreateSchema,
  ordonnanceToggleSchema,
} from '@/lib/validators/prescriptions';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const prescriptionsRouter = router({
  listBySession: roleProcedure(['admin', 'medecin', 'infirmiere'])
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          prescription: prescriptionsSeance,
          article: { id: articles.id, nom: articles.nom, unite: articles.unite },
          lot: { id: lots.id, numeroLot: lots.numeroLot },
        })
        .from(prescriptionsSeance)
        .innerJoin(articles, eq(prescriptionsSeance.articleId, articles.id))
        .leftJoin(lots, eq(prescriptionsSeance.lotId, lots.id))
        .where(eq(prescriptionsSeance.sessionId, input.sessionId));

      return rows;
    }),

  addToSession: roleProcedure(['medecin'])
    .input(addPrescriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verifier que la seance existe et est planifiee ou en_cours
      const [session] = await ctx.db
        .select({ statut: dialysisSessions.statut, patientId: dialysisSessions.patientId })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Seance non trouvee' });
      }
      if (session.statut !== 'planifiee' && session.statut !== 'en_cours') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La seance doit etre planifiee ou en cours pour ajouter une prescription',
        });
      }

      // Verifier que l'article est actif et de categorie medicament ou acte_medical
      const [article] = await ctx.db
        .select({ id: articles.id, categorie: articles.categorie, isActive: articles.isActive })
        .from(articles)
        .where(eq(articles.id, input.articleId))
        .limit(1);

      if (!article) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Article non trouve' });
      }
      if (!article.isActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Article inactif' });
      }
      if (article.categorie !== 'medicament' && article.categorie !== 'acte_medical') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seuls les medicaments et actes medicaux peuvent etre prescrits',
        });
      }

      const [prescription] = await ctx.db
        .insert(prescriptionsSeance)
        .values({
          sessionId: input.sessionId,
          articleId: input.articleId,
          patientId: session.patientId,
          quantite: input.quantite.toString(),
          posologie: input.posologie ?? null,
          statut: 'prescrite',
          prescritPar: userId,
        })
        .returning();

      return prescription;
    }),

  cancelPrescription: roleProcedure(['medecin'])
    .input(cancelPrescriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const [prescription] = await ctx.db
        .select({
          id: prescriptionsSeance.id,
          statut: prescriptionsSeance.statut,
          sessionId: prescriptionsSeance.sessionId,
        })
        .from(prescriptionsSeance)
        .where(eq(prescriptionsSeance.id, input.prescriptionId))
        .limit(1);

      if (!prescription) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Prescription non trouvee' });
      }
      if (prescription.statut !== 'prescrite') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seule une prescription au statut prescrite peut etre annulee',
        });
      }

      const [session] = await ctx.db
        .select({ statut: dialysisSessions.statut })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.id, prescription.sessionId))
        .limit(1);

      if (session?.statut === 'terminee' || session?.statut === 'annulee') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible d\'annuler une prescription d\'une seance terminee ou annulee',
        });
      }

      const [updated] = await ctx.db
        .update(prescriptionsSeance)
        .set({ statut: 'annulee', updatedAt: new Date() })
        .where(eq(prescriptionsSeance.id, input.prescriptionId))
        .returning();

      return updated;
    }),

  ordonnancesList: roleProcedure(['admin', 'medecin', 'infirmiere', 'patient'])
    .input(z.object({ patientId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      let patientId = input.patientId;

      // Role patient: filtre automatique sur son propre patient_id
      if (role === 'patient') {
        const userId = ctx.session.user.id;
        const [patient] = await ctx.db
          .select({ id: patients.id })
          .from(patients)
          .where(eq(patients.userId, userId))
          .limit(1);

        if (!patient) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'PROFIL_NON_CONFIGURE: Votre profil patient n\'est pas encore configure. Contactez l\'administration.',
          });
        }
        patientId = patient.id;
      }

      if (!patientId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'patientId requis' });
      }

      const rows = await ctx.db
        .select({
          ordonnance: ordonnances,
          prescripteur: { nom: users.nom, prenom: users.prenom },
        })
        .from(ordonnances)
        .innerJoin(users, eq(ordonnances.prescritPar, users.id))
        .where(eq(ordonnances.patientId, patientId))
        .orderBy(desc(ordonnances.datePrescription));

      return rows;
    }),

  ordonnanceCreate: roleProcedure(['medecin'])
    .input(ordonnanceCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const today = new Date().toISOString().slice(0, 10);

      const [ordonnance] = await ctx.db
        .insert(ordonnances)
        .values({
          patientId: input.patientId,
          contenu: input.contenu,
          datePrescription: today,
          isActive: true,
          prescritPar: userId,
        })
        .returning();

      return ordonnance;
    }),

  ordonnanceToggle: roleProcedure(['medecin'])
    .input(ordonnanceToggleSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: ordonnances.id, isActive: ordonnances.isActive })
        .from(ordonnances)
        .where(eq(ordonnances.id, input.ordonnanceId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordonnance non trouvee' });
      }

      const [updated] = await ctx.db
        .update(ordonnances)
        .set({ isActive: !existing.isActive, updatedAt: new Date() })
        .where(eq(ordonnances.id, input.ordonnanceId))
        .returning();

      return updated;
    }),
});
```

- [ ] **Step 6: Modifier `sessions.terminer` dans `sessions.router.ts` pour auto-administrer les prescriptions**

Remplacer la procedure `terminer` uniquement (garder tout le reste du fichier identique). Ajouter les imports necessaires en haut du fichier :

```typescript
// Ajouter ces imports en haut de sessions.router.ts, apres les imports existants:
import { prescriptionsSeance, lots, mouvementsStock } from '@/server/db/schema';
import { applyFifo } from '@/lib/stock-fifo';
import { gt, sql } from 'drizzle-orm';
```

Remplacer la procedure `terminer` par :

```typescript
  terminer: roleProcedure(['admin', 'medecin'])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ statut: dialysisSessions.statut, patientId: dialysisSessions.patientId })
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

      // Auto-administration des prescriptions
      const prescriptionsPrescrites = await ctx.db
        .select()
        .from(prescriptionsSeance)
        .where(
          and(
            eq(prescriptionsSeance.sessionId, input.id),
            eq(prescriptionsSeance.statut, 'prescrite'),
          ),
        );

      for (const prescription of prescriptionsPrescrites) {
        const lotsDisponibles = await ctx.db
          .select({
            lotId: lots.id,
            lotArticleId: lots.articleId,
            datePeremption: lots.datePeremption,
            quantiteDisponible: sql<number>`CAST(${lots.quantiteDisponible} AS FLOAT)`,
          })
          .from(lots)
          .where(
            and(
              eq(lots.articleId, prescription.articleId),
              gt(lots.quantiteDisponible, '0'),
            ),
          );

        const quantite = parseFloat(prescription.quantite);
        const resultat = applyFifo(lotsDisponibles, quantite);

        if (resultat.satisfait && resultat.allocations.length > 0) {
          // Decrementer les lots et creer les mouvements
          const premierLot = resultat.allocations[0]!;
          for (const alloc of resultat.allocations) {
            await ctx.db
              .update(lots)
              .set({
                quantiteDisponible: sql`${lots.quantiteDisponible} - ${alloc.quantite}`,
              })
              .where(eq(lots.id, alloc.lotId));

            await ctx.db.insert(mouvementsStock).values({
              articleId: prescription.articleId,
              lotId: alloc.lotId,
              typeMouvement: 'sortie',
              quantite: (-alloc.quantite).toString(),
              motif: 'Administration per-seance',
              sessionId: input.id,
              patientId: existing.patientId,
              createdBy: ctx.session.user.id,
            });
          }

          // Mettre a jour la prescription: statut administree, lot_id du premier lot
          await ctx.db
            .update(prescriptionsSeance)
            .set({
              statut: 'administree',
              lotId: premierLot.lotId,
              updatedAt: new Date(),
            })
            .where(eq(prescriptionsSeance.id, prescription.id));
        }
        // Si stock insuffisant: laisser statut 'prescrite' — seance se termine quand meme
      }

      // Terminer la seance
      const [session] = await ctx.db
        .update(dialysisSessions)
        .set({ statut: 'terminee', updatedAt: new Date() })
        .where(eq(dialysisSessions.id, input.id))
        .returning();

      return session;
    }),
```

- [ ] **Step 7: Enregistrer le router prescriptions dans `router.ts`**

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
import { articlesRouter } from './routers/articles.router';
import { facturesRouter } from './routers/factures.router';
import { dashboardRouter } from './routers/dashboard.router';
import { stockRouter } from './routers/stock.router';
import { prescriptionsRouter } from './routers/prescriptions.router';

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
  articles: articlesRouter,
  factures: facturesRouter,
  dashboard: dashboardRouter,
  stock: stockRouter,
  prescriptions: prescriptionsRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 8: Verifier la compilation et les tests**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm tsc --noEmit && pnpm test
```

Expected: aucune erreur TS, tous les tests PASS.

- [ ] **Step 9: Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
git add src/lib/validators/prescriptions.ts \
        src/server/trpc/routers/prescriptions.router.ts \
        src/server/trpc/routers/sessions.router.ts \
        src/server/trpc/router.ts \
        tests/unit/prescriptions-validators.test.ts
git commit -m "feat(prescriptions): router prescriptions + ordonnances, auto-administration dans sessions.terminer"
```

---

## Task 5: UI Prescriptions — onglet seance + onglet ordonnances patient

**Files:**
- Create: `src/components/sessions/prescriptions-tab.tsx`
- Create: `src/components/patients/ordonnances-tab.tsx`
- Modify: `src/app/(dashboard)/seances/[id]/page.tsx`
- Modify: `src/app/(dashboard)/patients/[id]/page.tsx`

**Interfaces:**
- Consumes: `api.prescriptions.listBySession`, `api.prescriptions.addToSession`, `api.prescriptions.cancelPrescription`, `api.prescriptions.ordonnancesList`, `api.prescriptions.ordonnanceCreate`, `api.prescriptions.ordonnanceToggle`, `api.articles.list` (pour le select d'articles)
- Produces: 5e onglet "Prescriptions" dans la page seance, onglet "Ordonnances" dans la page patient

- [ ] **Step 1: Creer `src/components/sessions/prescriptions-tab.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  sessionId: string;
  sessionStatut: string;
  isLocked: boolean;
};

const STATUT_BADGE: Record<string, string> = {
  prescrite: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  administree: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  annulee: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const STATUT_LABEL: Record<string, string> = {
  prescrite: 'Prescrite',
  administree: 'Administree',
  annulee: 'Annulee',
};

export function PrescriptionsTab({ sessionId, sessionStatut, isLocked }: Props) {
  const utils = api.useUtils();

  const { data: prescriptions, isLoading } = api.prescriptions.listBySession.useQuery({
    sessionId,
  });

  const { data: articlesData } = api.articles.list.useQuery({
    activeOnly: true,
  });

  const articles = articlesData?.filter(
    (a) => a.categorie === 'medicament' || a.categorie === 'acte_medical',
  ) ?? [];

  const [form, setForm] = useState({ articleId: '', quantite: '', posologie: '' });

  const addMutation = api.prescriptions.addToSession.useMutation({
    onSuccess: () => {
      setForm({ articleId: '', quantite: '', posologie: '' });
      void utils.prescriptions.listBySession.invalidate({ sessionId });
    },
  });

  const cancelMutation = api.prescriptions.cancelPrescription.useMutation({
    onSuccess: () => {
      void utils.prescriptions.listBySession.invalidate({ sessionId });
    },
  });

  const peutAjouter =
    !isLocked &&
    (sessionStatut === 'planifiee' || sessionStatut === 'en_cours');

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      {/* Tableau des prescriptions */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Article</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Quantite</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Posologie</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Statut</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Lot</th>
              {peutAjouter && (
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {prescriptions?.map((row) => (
              <tr key={row.prescription.id} className="bg-white dark:bg-gray-950">
                <td className="px-4 py-3 font-medium">{row.article.nom}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {row.prescription.quantite} {row.article.unite}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {row.prescription.posologie ?? '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge className={STATUT_BADGE[row.prescription.statut] ?? ''}>
                    {STATUT_LABEL[row.prescription.statut] ?? row.prescription.statut}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-gray-500">
                  {row.lot?.numeroLot ?? '—'}
                </td>
                {peutAjouter && (
                  <td className="px-4 py-3 text-center">
                    {row.prescription.statut === 'prescrite' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() =>
                          cancelMutation.mutate({ prescriptionId: row.prescription.id })
                        }
                        disabled={cancelMutation.isPending}
                      >
                        Annuler
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {prescriptions?.length === 0 && (
              <tr>
                <td
                  colSpan={peutAjouter ? 6 : 5}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  Aucune prescription pour cette seance
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Formulaire d'ajout (medecin seulement, seance non terminee) */}
      {peutAjouter && (
        <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            Ajouter une prescription
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Article</label>
              <select
                value={form.articleId}
                onChange={(e) => setForm((f) => ({ ...f, articleId: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">-- Choisir --</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom} ({a.categorie})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Quantite</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantite}
                onChange={(e) => setForm((f) => ({ ...f, quantite: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
                Posologie (optionnel)
              </label>
              <input
                type="text"
                value={form.posologie}
                onChange={(e) => setForm((f) => ({ ...f, posologie: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Instructions d'administration"
              />
            </div>
          </div>
          {addMutation.error && (
            <p className="mt-2 text-sm text-red-600">{addMutation.error.message}</p>
          )}
          <Button
            className="mt-4"
            onClick={() => {
              const q = parseFloat(form.quantite);
              if (!form.articleId || isNaN(q)) return;
              addMutation.mutate({
                sessionId,
                articleId: form.articleId,
                quantite: q,
                posologie: form.posologie || undefined,
              });
            }}
            disabled={addMutation.isPending}
          >
            Ajouter la prescription
          </Button>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Modifier `src/app/(dashboard)/seances/[id]/page.tsx` pour ajouter le 5e onglet**

Deux changements dans ce fichier :

1. Modifier la constante `TABS` :

```typescript
const TABS = ['Pre-dialyse', 'Machine', 'Constantes', 'Fin de seance', 'Prescriptions'] as const;
```

2. Ajouter l'import du composant :

```typescript
import { PrescriptionsTab } from '@/components/sessions/prescriptions-tab';
```

3. Ajouter le rendu du 5e onglet apres `{activeTab === 3 && ...}` :

```typescript
      {activeTab === 4 && (
        <PrescriptionsTab
          sessionId={id}
          sessionStatut={session.statut}
          isLocked={isLocked}
        />
      )}
```

- [ ] **Step 3: Creer `src/components/patients/ordonnances-tab.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  patientId: string;
  canEdit: boolean; // true si role medecin
};

export function OrdonnancesTab({ patientId, canEdit }: Props) {
  const utils = api.useUtils();

  const { data: rows, isLoading } = api.prescriptions.ordonnancesList.useQuery({ patientId });
  const [contenu, setContenu] = useState('');

  const createMutation = api.prescriptions.ordonnanceCreate.useMutation({
    onSuccess: () => {
      setContenu('');
      void utils.prescriptions.ordonnancesList.invalidate({ patientId });
    },
  });

  const toggleMutation = api.prescriptions.ordonnanceToggle.useMutation({
    onSuccess: () => {
      void utils.prescriptions.ordonnancesList.invalidate({ patientId });
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      {/* Liste des ordonnances */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Contenu</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Prescripteur</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Statut</th>
              {canEdit && (
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {rows?.map((row) => (
              <tr key={row.ordonnance.id} className="bg-white dark:bg-gray-950">
                <td className="px-4 py-3 whitespace-nowrap">
                  {row.ordonnance.datePrescription}
                </td>
                <td className="max-w-xs px-4 py-3">
                  <p className="truncate text-gray-700 dark:text-gray-300">
                    {row.ordonnance.contenu}
                  </p>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  Dr {row.prescripteur.prenom} {row.prescripteur.nom}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.ordonnance.isActive ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      Active
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      Inactive
                    </Badge>
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        toggleMutation.mutate({ ordonnanceId: row.ordonnance.id })
                      }
                      disabled={toggleMutation.isPending}
                    >
                      {row.ordonnance.isActive ? 'Desactiver' : 'Activer'}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-gray-400">
                  Aucune ordonnance
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Formulaire creation (medecin seulement) */}
      {canEdit && (
        <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            Nouvelle ordonnance
          </h3>
          <textarea
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="Contenu de l'ordonnance..."
          />
          {createMutation.error && (
            <p className="mt-2 text-sm text-red-600">{createMutation.error.message}</p>
          )}
          <Button
            className="mt-3"
            onClick={() => {
              if (!contenu.trim()) return;
              createMutation.mutate({ patientId, contenu });
            }}
            disabled={createMutation.isPending}
          >
            Enregistrer l'ordonnance
          </Button>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Restructurer `src/app/(dashboard)/patients/[id]/page.tsx` en onglets**

Remplacer le fichier complet :

```typescript
'use client';

import { use, useState } from 'react';
import { api } from '@/lib/trpc/client';
import { PatientForm } from '@/components/patients/patient-form';
import { OrdonnancesTab } from '@/components/patients/ordonnances-tab';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportPdfButton } from '@/components/reports/export-pdf-button';

const TABS = ['Dossier', 'Ordonnances'] as const;

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState(0);
  const { data: patient, isLoading } = api.patients.getById.useQuery({ id });

  // Recuperer le role depuis la session (via un endpoint auth ou depuis le layout)
  // On utilise api.auth.me si disponible, sinon on passe canEdit=false par defaut
  // Le composant OrdonnancesTab recoit canEdit en fonction du role
  const { data: me } = api.auth.me.useQuery();
  const canEdit = me?.role === 'medecin' || me?.role === 'admin';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient) {
    return <p className="text-red-500">Patient non trouve</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {patient.prenom} {patient.nom}
        </h1>
        <ExportPdfButton href={`/api/reports/patient/${id}`} label="Exporter PDF" />
      </div>

      {/* Tab navigation */}
      <div className="mb-4 flex border-b border-gray-200 dark:border-gray-800">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === i
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 0 && (
        <PatientForm
          mode="edit"
          defaultValues={{
            id: patient.id,
            nom: patient.nom,
            prenom: patient.prenom,
            dateNaissance: patient.dateNaissance || undefined,
            sexe: patient.sexe || undefined,
            telephone: patient.telephone || undefined,
            groupeSanguin: patient.groupeSanguin || undefined,
            tailleCm: patient.tailleCm ? parseFloat(patient.tailleCm) : undefined,
            poidsSecKg: patient.poidsSecKg ? parseFloat(patient.poidsSecKg) : undefined,
            nephropathie: patient.nephropathie || undefined,
            datePremiereDialyse: patient.datePremiereDialyse || undefined,
            medecinRefId: patient.medecinRefId || undefined,
            statut: patient.statut || undefined,
          }}
        />
      )}
      {activeTab === 1 && (
        <OrdonnancesTab patientId={id} canEdit={canEdit} />
      )}
    </div>
  );
}
```

> **Note:** Si `api.auth.me` n'existe pas encore dans le router auth, consulter la procedure existante la plus proche (ex: `api.auth.session` ou `api.users.me`). Adapter l'appel en consequence, ou lire le role depuis un cookie/props de layout. L'important est que `canEdit` soit `true` pour les roles `medecin` et `admin`.

- [ ] **Step 5: Verifier la compilation**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
git add src/components/sessions/prescriptions-tab.tsx \
        src/components/patients/ordonnances-tab.tsx \
        src/app/(dashboard)/seances/[id]/page.tsx \
        src/app/(dashboard)/patients/[id]/page.tsx
git commit -m "feat(prescriptions-ui): onglet prescriptions seance + onglet ordonnances patient"
```

---

## Task 6: Router portail

**Files:**
- Create: `src/server/trpc/routers/portail.router.ts`
- Modify: `src/server/trpc/router.ts`

**Interfaces:**
- Consumes: `patients`, `dialysisSessions`, `vitalSigns`, `bilans`, `factures`, `ordonnances`, `users` (schema), `roleProcedure`
- Produces:
  - `portailRouter` avec procedures: `monProfil`, `mesSeances`, `seanceDetail`, `mesBilans`, `bilanDetail`, `mesFactures`, `mesOrdonnances`
  - Helper interne `resolvePatientId(ctx)` → `string` (lance `PROFIL_NON_CONFIGURE` si absent)

- [ ] **Step 1: Creer `src/server/trpc/routers/portail.router.ts`**

```typescript
import { router, roleProcedure } from '@/server/trpc';
import {
  patients,
  dialysisSessions,
  vitalSigns,
  bilans,
  factures,
  ordonnances,
  postesDialyse,
  users,
} from '@/server/db/schema';
import { eq, and, desc, asc, ne } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { TRPCContext } from '@/server/trpc';

/**
 * Resout le patient_id depuis le user_id de la session.
 * Lance NOT_FOUND avec le message PROFIL_NON_CONFIGURE si aucun patient lie.
 */
async function resolvePatientId(ctx: TRPCContext & { session: NonNullable<TRPCContext['session']> }): Promise<string> {
  const userId = ctx.session.user.id;
  const [patient] = await ctx.db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'PROFIL_NON_CONFIGURE: Votre profil patient n\'est pas encore configure. Contactez l\'administration.',
    });
  }
  return patient.id;
}

export const portailRouter = router({
  monProfil: roleProcedure(['patient'])
    .query(async ({ ctx }) => {
      const patientId = await resolvePatientId(ctx);

      const [patient] = await ctx.db
        .select({
          id: patients.id,
          nom: patients.nom,
          prenom: patients.prenom,
          dateNaissance: patients.dateNaissance,
          groupeSanguin: patients.groupeSanguin,
          nephropathie: patients.nephropathie,
          poidsSecKg: patients.poidsSecKg,
        })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      return patient ?? null;
    }),

  mesSeances: roleProcedure(['patient'])
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        perPage: z.number().int().positive().max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const patientId = await resolvePatientId(ctx);
      const offset = (input.page - 1) * input.perPage;

      const data = await ctx.db
        .select({
          id: dialysisSessions.id,
          dateSeance: dialysisSessions.dateSeance,
          statut: dialysisSessions.statut,
          dureeReelle: dialysisSessions.dureeReelle,
          ktvCalculated: dialysisSessions.ktvCalculated,
          poste: { nom: postesDialyse.nom, numero: postesDialyse.numero },
        })
        .from(dialysisSessions)
        .innerJoin(postesDialyse, eq(dialysisSessions.posteId, postesDialyse.id))
        .where(eq(dialysisSessions.patientId, patientId))
        .orderBy(desc(dialysisSessions.dateSeance))
        .limit(input.perPage)
        .offset(offset);

      return data;
    }),

  seanceDetail: roleProcedure(['patient'])
    .input(z.object({ seanceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const patientId = await resolvePatientId(ctx);

      const [session] = await ctx.db
        .select({
          session: dialysisSessions,
          poste: { nom: postesDialyse.nom },
          medecin: { nom: users.nom, prenom: users.prenom },
        })
        .from(dialysisSessions)
        .innerJoin(postesDialyse, eq(dialysisSessions.posteId, postesDialyse.id))
        .innerJoin(users, eq(dialysisSessions.physicianId, users.id))
        .where(
          and(
            eq(dialysisSessions.id, input.seanceId),
            eq(dialysisSessions.patientId, patientId),
          ),
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Seance non trouvee ou non accessible',
        });
      }

      const constantes = await ctx.db
        .select()
        .from(vitalSigns)
        .where(eq(vitalSigns.sessionId, input.seanceId))
        .orderBy(asc(vitalSigns.recordedAt));

      return { ...session, constantes };
    }),

  mesBilans: roleProcedure(['patient'])
    .query(async ({ ctx }) => {
      const patientId = await resolvePatientId(ctx);

      const data = await ctx.db
        .select({
          id: bilans.id,
          dateBilan: bilans.dateBilan,
          reference: bilans.reference,
          typeBilan: bilans.typeBilan,
        })
        .from(bilans)
        .where(eq(bilans.patientId, patientId))
        .orderBy(desc(bilans.dateBilan));

      return data;
    }),

  bilanDetail: roleProcedure(['patient'])
    .input(z.object({ bilanId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const patientId = await resolvePatientId(ctx);

      const [bilan] = await ctx.db
        .select()
        .from(bilans)
        .where(and(eq(bilans.id, input.bilanId), eq(bilans.patientId, patientId)))
        .limit(1);

      if (!bilan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bilan non trouve ou non accessible',
        });
      }

      return bilan;
    }),

  mesFactures: roleProcedure(['patient'])
    .query(async ({ ctx }) => {
      const patientId = await resolvePatientId(ctx);

      const data = await ctx.db
        .select({
          id: factures.id,
          reference: factures.reference,
          dateFacture: factures.dateFacture,
          montantTotal: factures.montantTotal,
          statut: factures.statut,
        })
        .from(factures)
        .where(
          and(
            eq(factures.patientId, patientId),
            ne(factures.statut, 'brouillon'),
          ),
        )
        .orderBy(desc(factures.dateFacture));

      return data;
    }),

  mesOrdonnances: roleProcedure(['patient'])
    .query(async ({ ctx }) => {
      const patientId = await resolvePatientId(ctx);

      const data = await ctx.db
        .select({
          ordonnance: ordonnances,
          prescripteur: { nom: users.nom, prenom: users.prenom },
        })
        .from(ordonnances)
        .innerJoin(users, eq(ordonnances.prescritPar, users.id))
        .where(and(eq(ordonnances.patientId, patientId), eq(ordonnances.isActive, true)))
        .orderBy(desc(ordonnances.datePrescription));

      return data;
    }),
});
```

- [ ] **Step 2: Enregistrer le router portail dans `router.ts`**

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
import { articlesRouter } from './routers/articles.router';
import { facturesRouter } from './routers/factures.router';
import { dashboardRouter } from './routers/dashboard.router';
import { stockRouter } from './routers/stock.router';
import { prescriptionsRouter } from './routers/prescriptions.router';
import { portailRouter } from './routers/portail.router';

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
  articles: articlesRouter,
  factures: facturesRouter,
  dashboard: dashboardRouter,
  stock: stockRouter,
  prescriptions: prescriptionsRouter,
  portail: portailRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Verifier la compilation**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
git add src/server/trpc/routers/portail.router.ts \
        src/server/trpc/router.ts
git commit -m "feat(portail): router portail patient avec 7 procedures lecture-seule"
```

---

## Task 7: Layout portail + pages

**Files:**
- Create: `src/app/portail/layout.tsx`
- Create: `src/app/portail/page.tsx`
- Create: `src/app/portail/seances/page.tsx`
- Create: `src/app/portail/seances/[id]/page.tsx`
- Create: `src/app/portail/bilans/page.tsx`
- Create: `src/app/portail/bilans/[id]/page.tsx`
- Create: `src/app/portail/factures/page.tsx`
- Create: `src/app/portail/ordonnances/page.tsx`

**Interfaces:**
- Consumes: `api.portail.monProfil`, `api.portail.mesSeances`, `api.portail.seanceDetail`, `api.portail.mesBilans`, `api.portail.bilanDetail`, `api.portail.mesFactures`, `api.portail.mesOrdonnances`
- Produces: toutes les pages `/portail/*` accessibles uniquement au role `patient`

- [ ] **Step 1: Creer `src/app/portail/layout.tsx`**

```typescript
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import Link from 'next/link';
import { SignOutButton } from '@/components/auth/sign-out-button';

const NAV_LINKS = [
  { href: '/portail', label: 'Accueil' },
  { href: '/portail/seances', label: 'Mes seances' },
  { href: '/portail/bilans', label: 'Mes bilans' },
  { href: '/portail/factures', label: 'Mes factures' },
  { href: '/portail/ordonnances', label: 'Mes ordonnances' },
];

export default async function PortailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'patient') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="text-xl font-bold text-blue-600">NephroSys</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {session.user.prenom} {session.user.nom}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl gap-1 px-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="border-b-2 border-transparent px-3 py-3 text-sm font-medium text-gray-600 transition hover:border-blue-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Contenu */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
```

> **Note:** `SignOutButton` est probablement deja dans le codebase (`src/components/auth/sign-out-button.tsx`). Si ce n'est pas le cas, creer un composant minimal :
>
> ```typescript
> // src/components/auth/sign-out-button.tsx
> 'use client';
> import { signOut } from 'next-auth/react';
> import { Button } from '@/components/ui/button';
> export function SignOutButton() {
>   return (
>     <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
>       Deconnexion
>     </Button>
>   );
> }
> ```

- [ ] **Step 2: Creer `src/app/portail/page.tsx`**

```typescript
'use client';

import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function PortailAccueilPage() {
  const { data: profil, isLoading: profilLoading } = api.portail.monProfil.useQuery();
  const { data: seances, isLoading: seancesLoading } = api.portail.mesSeances.useQuery({
    page: 1,
    perPage: 3,
  });
  const { data: ordonnances, isLoading: ordLoading } = api.portail.mesOrdonnances.useQuery();

  const isLoading = profilLoading || seancesLoading || ordLoading;

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const prochainesSeances = seances?.filter((s) => s.statut === 'planifiee') ?? [];
  const derniereOrdonnance = ordonnances?.[0] ?? null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Bienvenue, {profil?.prenom} {profil?.nom}
      </h1>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Card prochaines seances */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Prochaines seances
          </h2>
          {prochainesSeances.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune seance planifiee</p>
          ) : (
            <ul className="space-y-2">
              {prochainesSeances.slice(0, 3).map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{s.dateSeance}</span>
                  <span className="text-gray-500">{s.poste.nom}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/portail/seances"
            className="mt-4 block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Voir toutes mes seances →
          </Link>
        </div>

        {/* Card derniere ordonnance */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Derniere ordonnance active
          </h2>
          {derniereOrdonnance ? (
            <div>
              <p className="text-sm text-gray-500">{derniereOrdonnance.ordonnance.datePrescription}</p>
              <p className="mt-2 line-clamp-3 text-sm text-gray-700 dark:text-gray-300">
                {derniereOrdonnance.ordonnance.contenu}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aucune ordonnance active</p>
          )}
          <Link
            href="/portail/ordonnances"
            className="mt-4 block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Voir toutes mes ordonnances →
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Creer `src/app/portail/seances/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const STATUT_BADGE: Record<string, string> = {
  planifiee: 'bg-blue-100 text-blue-800',
  en_cours: 'bg-orange-100 text-orange-800',
  terminee: 'bg-green-100 text-green-800',
  annulee: 'bg-red-100 text-red-800',
};

export default function PortailSeancesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = api.portail.mesSeances.useQuery({ page, perPage: 10 });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Mes seances</h1>
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Poste</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Duree (min)</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Kt/V</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {data?.map((s) => (
              <tr
                key={s.id}
                className="cursor-pointer bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900"
              >
                <td className="px-4 py-3">
                  <Link href={`/portail/seances/${s.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                    {s.dateSeance}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{s.poste.nom}</td>
                <td className="px-4 py-3 text-right font-mono">{s.dureeReelle ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {s.ktvCalculated ? parseFloat(s.ktvCalculated).toFixed(2) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge className={STATUT_BADGE[s.statut] ?? ''}>{s.statut}</Badge>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Aucune seance
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {(data?.length ?? 0) === 10 && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Precedent
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 text-sm"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Creer `src/app/portail/seances/[id]/page.tsx`**

```typescript
'use client';

import { use } from 'react';
import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function PortailSeanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading } = api.portail.seanceDetail.useQuery({ seanceId: id });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return <p className="text-red-500">Seance non trouvee</p>;

  const { session, poste, medecin, constantes } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/portail/seances" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Mes seances
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
          Seance du {session.dateSeance}
        </h1>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Poste</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{poste.nom}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Medecin</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              Dr {medecin.prenom} {medecin.nom}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Duree</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {session.dureeReelle ? `${session.dureeReelle} min` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Tolerance</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {session.toleranceGlobale ?? '—'}
            </dd>
          </div>
          {session.ktvCalculated && (
            <div>
              <dt className="text-sm text-gray-500">Kt/V</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {parseFloat(session.ktvCalculated).toFixed(2)}{' '}
                {session.ktvStatus && (
                  <Badge className={session.ktvStatus === 'adequate' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {session.ktvStatus === 'adequate' ? 'Adequat' : 'Inadequat'}
                  </Badge>
                )}
              </dd>
            </div>
          )}
          {session.urrCalculated && (
            <div>
              <dt className="text-sm text-gray-500">URR</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {parseFloat(session.urrCalculated).toFixed(1)}%
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Constantes */}
      {constantes.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Constantes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Heure</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">TA</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Pouls</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Temp.</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">SpO2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {constantes.map((c) => (
                  <tr key={c.id} className="bg-white dark:bg-gray-950">
                    <td className="px-3 py-2">
                      {c.recordedAt
                        ? new Date(c.recordedAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2">{c.tensionArterielle ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{c.pouls ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{c.temperature ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{c.spo2 ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Creer `src/app/portail/bilans/page.tsx`**

```typescript
'use client';

import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function PortailBilansPage() {
  const { data, isLoading } = api.portail.mesBilans.useQuery();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Mes bilans</h1>
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Reference</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {data?.map((b) => (
              <tr key={b.id} className="bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900">
                <td className="px-4 py-3">
                  <Link href={`/portail/bilans/${b.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                    {b.dateBilan}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-gray-500">{b.reference}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{b.typeBilan}</td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  Aucun bilan
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

- [ ] **Step 6: Creer `src/app/portail/bilans/[id]/page.tsx`**

```typescript
'use client';

import { use } from 'react';
import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function PortailBilanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: bilan, isLoading } = api.portail.bilanDetail.useQuery({ bilanId: id });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!bilan) return <p className="text-red-500">Bilan non trouve</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portail/bilans" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Mes bilans
        </Link>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
          Bilan du {bilan.dateBilan}
        </h1>
        <p className="mb-6 text-sm text-gray-500">Ref: {bilan.reference} — {bilan.typeBilan}</p>
        <p className="text-sm text-gray-500 italic">
          Detail des valeurs biologiques disponible dans votre dossier medical.
          Consultez votre medecin pour les interpretations.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Creer `src/app/portail/factures/page.tsx`**

```typescript
'use client';

import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const STATUT_BADGE: Record<string, string> = {
  validee: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  payee: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  annulee: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const STATUT_LABEL: Record<string, string> = {
  validee: 'Validee',
  payee: 'Payee',
  annulee: 'Annulee',
};

export default function PortailFacturesPage() {
  const { data, isLoading } = api.portail.mesFactures.useQuery();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Mes factures</h1>
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Reference</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Montant (FCFA)</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {data?.map((f) => (
              <tr key={f.id} className="bg-white dark:bg-gray-950">
                <td className="px-4 py-3 font-mono">{f.reference}</td>
                <td className="px-4 py-3">{f.dateFacture}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {parseFloat(f.montantTotal).toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge className={STATUT_BADGE[f.statut] ?? ''}>
                    {STATUT_LABEL[f.statut] ?? f.statut}
                  </Badge>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Aucune facture
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

- [ ] **Step 8: Creer `src/app/portail/ordonnances/page.tsx`**

```typescript
'use client';

import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';

export default function PortailOrdonnancesPage() {
  const { data, isLoading } = api.portail.mesOrdonnances.useQuery();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mes ordonnances</h1>
      {data?.length === 0 && (
        <p className="text-gray-400">Aucune ordonnance active</p>
      )}
      {data?.map((row) => (
        <div
          key={row.ordonnance.id}
          className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">{row.ordonnance.datePrescription}</span>
            <span className="text-sm text-gray-500">
              Dr {row.prescripteur.prenom} {row.prescripteur.nom}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
            {row.ordonnance.contenu}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 9: Verifier la compilation**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm tsc --noEmit
```

Expected: aucune erreur. Si des champs comme `tensionArterielle`, `pouls`, `temperature`, `spo2`, `recordedAt` n'existent pas dans `vitalSigns` schema avec ces noms exacts, ajuster les noms de colonnes en consultant `src/server/db/schema/vital-signs.ts`.

- [ ] **Step 10: Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
git add src/app/portail/
git commit -m "feat(portail): layout + pages accueil, seances, bilans, factures, ordonnances"
```

---

## Task 8: Association user-patient dans le formulaire patient

**Files:**
- Modify: `src/components/patients/patient-form.tsx`

**Interfaces:**
- Consumes: `api.users.list` (filtre par role `patient`), `patients.userId` column (deja en DB depuis Task 1 schema qui confirme que `userId` existe deja)
- Produces: select visible uniquement pour le role `admin` dans le formulaire patient, permettant d'associer un user avec role `patient` non encore lie

- [ ] **Step 1: Lire le fichier actuel `patient-form.tsx`**

```bash
cat "/Users/yusper/Downloads/modules 19/as shafi/nephrosys/src/components/patients/patient-form.tsx"
```

Observer la structure du formulaire (react-hook-form, champs existants, type des props).

- [ ] **Step 2: Ajouter le select userId dans le formulaire (admin seulement)**

Dans `patient-form.tsx`, ajouter :

1. Import `api` si absent.
2. Une query pour les users patients disponibles :

```typescript
// A l'interieur du composant PatientForm, avant le return:
const { data: usersPatient } = api.users.list.useQuery(
  { role: 'patient' },
  { enabled: isAdmin }, // isAdmin = une prop ou detection du role
);
```

> **Note sur `api.users.list`:** Verifier que la procedure `users.list` accepte un filtre `role` en consultant `src/server/trpc/routers/users.router.ts`. Si le filtre `role` n'existe pas encore, ajouter une procedure `users.listByRole` ou adapter le filtre existant. La requete doit retourner uniquement les users avec role `patient` qui n'ont pas encore de patient associe (requete avec `LEFT JOIN patients ON patients.user_id = users.id WHERE patients.id IS NULL`).

3. Ajouter le champ dans le formulaire, visible uniquement si `mode === 'edit'` et le role courant est `admin` :

```typescript
{isAdmin && mode === 'edit' && (
  <div>
    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      Compte portail patient (optionnel)
    </label>
    <select
      {...register('userId')}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <option value="">-- Aucun compte associe --</option>
      {usersPatient?.map((u) => (
        <option key={u.id} value={u.id}>
          {u.prenom} {u.nom} ({u.email})
        </option>
      ))}
    </select>
    <p className="mt-1 text-xs text-gray-500">
      Seuls les comptes avec role &quot;patient&quot; non encore associes sont listes.
    </p>
  </div>
)}
```

4. Ajouter `userId` dans le schema de validation du formulaire et dans les `defaultValues`.

5. S'assurer que la mutation `patients.update` inclut `userId` dans son payload (verifier `src/server/trpc/routers/patients.router.ts` et le validator `patients.ts`).

- [ ] **Step 3: Verifier que `patients.update` accepte `userId`**

```bash
cat "/Users/yusper/Downloads/modules 19/as shafi/nephrosys/src/lib/validators/patients.ts"
```

Si `userId` n'est pas dans `updatePatientSchema`, l'ajouter :

```typescript
userId: z.string().uuid().nullable().optional(),
```

Et dans le router patients, s'assurer que `userId` est applique dans l'`update` :

```typescript
if (data.userId !== undefined) updateData.userId = data.userId;
```

- [ ] **Step 4: Verifier la compilation**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 5: Lancer tous les tests**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
pnpm test
```

Expected: tous PASS.

- [ ] **Step 6: Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/nephrosys"
git add src/components/patients/patient-form.tsx \
        src/lib/validators/patients.ts \
        src/server/trpc/routers/patients.router.ts
git commit -m "feat(patient): association compte portail patient depuis le formulaire admin"
```

---

## Self-Review

### Spec coverage

| Spec section | Task couverte |
|---|---|
| Enum `gestionnaire_stock` | Task 1 |
| Enum `type_mouvement` | Task 1 |
| Enum `statut_prescription` | Task 1 |
| Table `lots` | Task 1 |
| Table `mouvements_stock` | Task 1 |
| Table `seuils_stock` | Task 1 |
| Logique FIFO / FEFO | Task 2 |
| Router stock (8 procedures) | Task 2 |
| UI `/stock` | Task 3 |
| UI `/stock/[articleId]` | Task 3 |
| UI `/stock/alertes` | Task 3 |
| Badge menu alertes | Task 3 |
| Dashboard `gestionnaire_stock` | Task 1 |
| Table `prescriptions_seance` | Task 1 |
| Table `ordonnances` | Task 1 |
| Router prescriptions (6 procedures) | Task 4 |
| Integration `sessions.terminer` | Task 4 |
| UI onglet Prescriptions seance | Task 5 |
| UI onglet Ordonnances patient | Task 5 |
| `patients.user_id` (column deja existante) | Task 1 — deja dans schema existant, confirmed in snapshot |
| Router portail (7 procedures) | Task 6 |
| Resolution `PROFIL_NON_CONFIGURE` | Task 6 |
| Layout portail | Task 7 |
| Pages portail (7 pages) | Task 7 |
| Securite portail (lecture seule, pas brouillon) | Task 6 |
| Association user-patient formulaire | Task 8 |
| Permissions `/stock` dans `canAccess` | Task 1 |
| ICON_MAP `Warehouse`, `Package`, `AlertTriangle` | Task 1 |

### Points d'attention pour l'implementeur

1. **`api.auth.me`** (Task 5, patient detail page) : verifier que cette procedure existe dans `auth.router.ts`. Si non, lire la session cote client via un autre moyen (props du layout ou `useSession` de next-auth).

2. **Champs `vitalSigns`** (Task 7, detail seance portail) : verifier les noms exacts dans `src/server/db/schema/vital-signs.ts` — notamment `tensionArterielle`, `pouls`, `temperature`, `spo2`, `recordedAt` — et adapter si necessaire.

3. **`api.users.list`** (Task 8) : verifier que le filtre `role` est supporte. Si non, ajouter une procedure dediee.

4. **`patients.update` + `userId`** (Task 8) : `patients.userId` est deja nullable dans le schema existant (confirme dans le snapshot). Il faut juste s'assurer que le validator et la mutation le propagent.

5. **`SignOutButton`** (Task 7) : si le composant n'existe pas, creer le fichier minimal donne dans la note.

6. **`gestionnaire_stock` dans `(dashboard)/layout.tsx`** : le layout redirige `patient` vers `/portail` mais pas `gestionnaire_stock`. Ce role accede normalement au dashboard (affiche le message via `DashboardClient`). Aucune modification necessaire — le comportement actuel convient.

7. **La colonne `patients.userId` existe deja** (confirme dans snapshot) — aucune modification du schema `patients.ts` ni migration supplementaire n'est necessaire pour Task 8.
