# NephroSys Phase 3a — Operations & Reporting : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter les modules operationnels a NephroSys : catalogue d'articles (medicaments, consommables, actes), facturation des seances de dialyse (workflow brouillon/validee/payee/annulee), tableaux de bord par role (admin, medecin, infirmiere, secretaire), et rapports PDF (fiche patient, rapport mensuel).

**Architecture:** Next.js App Router + tRPC + Drizzle ORM + PostgreSQL. 4 nouvelles tables (articles, factures, lignes_facture, tarifs_base) avec 3 nouveaux enums. 3 nouveaux tRPC routers (articles, factures, dashboard). 2 routes API Next.js pour la generation PDF. Pages sous `src/app/(dashboard)/`. Validation Zod cote client et serveur.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, tRPC v11, Drizzle ORM, PostgreSQL 16, Zod, Tailwind CSS v4, @react-pdf/renderer, Vitest

## Global Constraints

- TypeScript strict, aucun `any`
- Labels UI en francais, sans accents dans le code (noms de variables, enums)
- Dark mode obligatoire (classes `dark:`)
- YAGNI — pas de fonctionnalites non decrites ici
- Tests unitaires pour les calculs et validateurs, `pnpm tsc --noEmit` pour verification
- snake_case pour les colonnes DB, camelCase pour TypeScript
- Les prix sont en FCFA, stockes en decimal(12,2)
- All timestamps with timezone: `timestamp('x', { withTimezone: true })`
- UUIDs as primary keys with `.defaultRandom()`

## File Map

```
nephrosys/
├── src/
│   ├── server/
│   │   ├── db/
│   │   │   ├── schema/
│   │   │   │   ├── enums.ts              ← MODIFY add 3 new enums
│   │   │   │   ├── articles.ts           ← NEW table
│   │   │   │   ├── factures.ts           ← NEW table
│   │   │   │   ├── lignes-facture.ts     ← NEW table
│   │   │   │   ├── tarifs-base.ts        ← NEW table
│   │   │   │   ├── relations.ts          ← MODIFY add new relations
│   │   │   │   └── index.ts             ← MODIFY export new tables
│   │   │   └── seed-phase3.ts            ← NEW seed script
│   │   └── trpc/
│   │       ├── router.ts                ← MODIFY merge new routers
│   │       └── routers/
│   │           ├── articles.router.ts    ← NEW
│   │           ├── factures.router.ts    ← NEW
│   │           └── dashboard.router.ts   ← NEW
│   ├── lib/
│   │   ├── permissions.ts                ← MODIFY add new routes + menu items
│   │   ├── facture-calculations.ts       ← NEW pure functions
│   │   └── validators/
│   │       ├── articles.ts              ← NEW
│   │       └── factures.ts              ← NEW
│   ├── components/
│   │   ├── articles/
│   │   │   └── articles-page.tsx         ← NEW
│   │   ├── facturation/
│   │   │   ├── factures-list.tsx         ← NEW
│   │   │   ├── facture-detail.tsx        ← NEW
│   │   │   └── tarifs-config.tsx         ← NEW
│   │   ├── dashboard/
│   │   │   ├── admin-dashboard.tsx       ← NEW
│   │   │   ├── medecin-dashboard.tsx     ← NEW
│   │   │   ├── infirmiere-dashboard.tsx  ← NEW
│   │   │   ├── secretaire-dashboard.tsx  ← NEW
│   │   │   └── stat-card.tsx             ← NEW
│   │   └── reports/
│   │       └── export-pdf-button.tsx     ← NEW
│   └── app/
│       ├── (dashboard)/
│       │   ├── page.tsx                  ← REPLACE dashboard
│       │   ├── admin/
│       │   │   ├── articles/
│       │   │   │   └── page.tsx           ← NEW
│       │   │   └── rapports/
│       │   │       └── page.tsx           ← NEW
│       │   └── facturation/
│       │       ├── page.tsx               ← NEW
│       │       └── [id]/
│       │           └── page.tsx           ← NEW
│       └── api/
│           └── reports/
│               ├── patient/
│               │   └── [id]/
│               │       └── route.ts       ← NEW
│               └── monthly/
│                   └── [month]/
│                       └── route.ts       ← NEW
├── __tests__/
│   ├── validators/
│   │   ├── articles.test.ts              ← NEW
│   │   └── factures.test.ts              ← NEW
│   └── lib/
│       └── facture-calculations.test.ts  ← NEW
```

---

### Task 1: Schema + Enums + Migration

**Files:**
- Modify: `nephrosys/src/server/db/schema/enums.ts`
- Create: `nephrosys/src/server/db/schema/articles.ts`
- Create: `nephrosys/src/server/db/schema/factures.ts`
- Create: `nephrosys/src/server/db/schema/lignes-facture.ts`
- Create: `nephrosys/src/server/db/schema/tarifs-base.ts`
- Modify: `nephrosys/src/server/db/schema/relations.ts`
- Modify: `nephrosys/src/server/db/schema/index.ts`

**Interfaces:**
- Produces: `articles`, `factures`, `lignesFacture`, `tarifsBase` tables
- Produces: `categorieArticleEnum`, `statutFactureEnum`, `modePaiementEnum` enums
- Produces: TypeScript types `Article`, `NewArticle`, `Facture`, `NewFacture`, `LigneFacture`, `NewLigneFacture`, `TarifBase`, `NewTarifBase`

- [ ] **Step 1: Add 3 new enums to enums.ts**

Append at end of `nephrosys/src/server/db/schema/enums.ts`, after the `ktvStatusEnum` line:

```typescript
export const categorieArticleEnum = pgEnum('categorie_article', [
  'medicament',
  'consommable',
  'acte_medical',
]);

export const statutFactureEnum = pgEnum('statut_facture', [
  'brouillon',
  'validee',
  'payee',
  'annulee',
]);

export const modePaiementEnum = pgEnum('mode_paiement', [
  'especes',
  'cheque',
  'virement',
  'mobile_money',
]);
```

- [ ] **Step 2: Create articles.ts schema**

Create `nephrosys/src/server/db/schema/articles.ts`:

```typescript
import { boolean, decimal, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { categorieArticleEnum } from './enums';

export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  nom: varchar('nom', { length: 200 }).notNull(),
  categorie: categorieArticleEnum('categorie').notNull(),
  prixUnitaire: decimal('prix_unitaire', { precision: 12, scale: 2 }).notNull(),
  unite: varchar('unite', { length: 50 }).notNull(),
  voieAdministration: varchar('voie_administration', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
```

- [ ] **Step 3: Create factures.ts schema**

Create `nephrosys/src/server/db/schema/factures.ts`:

```typescript
import { date, decimal, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { statutFactureEnum, modePaiementEnum } from './enums';
import { dialysisSessions } from './dialysis-sessions';
import { patients } from './patients';
import { users } from './users';

export const factures = pgTable('factures', {
  id: uuid('id').primaryKey().defaultRandom(),
  reference: varchar('reference', { length: 30 }).notNull().unique(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => dialysisSessions.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  dateFacture: date('date_facture').notNull(),
  montantBase: decimal('montant_base', { precision: 12, scale: 2 }).notNull(),
  montantSupplements: decimal('montant_supplements', { precision: 12, scale: 2 }).notNull().default('0'),
  montantTotal: decimal('montant_total', { precision: 12, scale: 2 }).notNull(),
  statut: statutFactureEnum('statut').notNull().default('brouillon'),
  modePaiement: modePaiementEnum('mode_paiement'),
  datePaiement: timestamp('date_paiement', { withTimezone: true }),
  notes: text('notes'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Facture = typeof factures.$inferSelect;
export type NewFacture = typeof factures.$inferInsert;
```

- [ ] **Step 4: Create lignes-facture.ts schema**

Create `nephrosys/src/server/db/schema/lignes-facture.ts`:

```typescript
import { decimal, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { factures } from './factures';
import { articles } from './articles';

export const lignesFacture = pgTable('lignes_facture', {
  id: uuid('id').primaryKey().defaultRandom(),
  factureId: uuid('facture_id')
    .notNull()
    .references(() => factures.id, { onDelete: 'cascade' }),
  articleId: uuid('article_id').references(() => articles.id),
  designation: varchar('designation', { length: 200 }).notNull(),
  quantite: decimal('quantite', { precision: 10, scale: 2 }).notNull().default('1'),
  prixUnitaire: decimal('prix_unitaire', { precision: 12, scale: 2 }).notNull(),
  montant: decimal('montant', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LigneFacture = typeof lignesFacture.$inferSelect;
export type NewLigneFacture = typeof lignesFacture.$inferInsert;
```

- [ ] **Step 5: Create tarifs-base.ts schema**

Create `nephrosys/src/server/db/schema/tarifs-base.ts`:

```typescript
import { decimal, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const tarifsBase = pgTable('tarifs_base', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: varchar('label', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  montant: decimal('montant', { precision: 12, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TarifBase = typeof tarifsBase.$inferSelect;
export type NewTarifBase = typeof tarifsBase.$inferInsert;
```

- [ ] **Step 6: Add new relations to relations.ts**

In `nephrosys/src/server/db/schema/relations.ts`, add the new imports at the top alongside existing imports:

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
```

Add `facturesAsCreator: many(factures, { relationName: 'factureCreator' })` to `usersRelations`:

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  patientsAsMedecin: many(patients, { relationName: 'medecinRef' }),
  planningsAsMedecin: many(plannings, { relationName: 'planningMedecin' }),
  planningsAsInfirmier: many(plannings, { relationName: 'planningInfirmier' }),
  sessionsAsPhysician: many(dialysisSessions, { relationName: 'sessionPhysician' }),
  sessionsAsNurse: many(dialysisSessions, { relationName: 'sessionNurse' }),
  bilansAsPhysician: many(bilans, { relationName: 'bilanPhysician' }),
  facturesAsCreator: many(factures, { relationName: 'factureCreator' }),
}));
```

Add `factures: many(factures)` to `patientsRelations`:

```typescript
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
}));
```

Add `facture: many(factures)` to `dialysisSessionsRelations`:

```typescript
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
}));
```

Add new relation blocks at the end of the file:

```typescript
export const articlesRelations = relations(articles, ({ many }) => ({
  lignesFacture: many(lignesFacture),
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
```

- [ ] **Step 7: Update schema barrel export**

In `nephrosys/src/server/db/schema/index.ts`, add the new exports after the existing ones:

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
```

- [ ] **Step 8: Generate migration**

```bash
cd nephrosys && pnpm drizzle-kit generate
```

- [ ] **Step 9: Verify**

```bash
cd nephrosys && pnpm tsc --noEmit
```

---

### Task 2: Articles Router + Validators + Tests

**Files:**
- Create: `nephrosys/src/lib/validators/articles.ts`
- Create: `nephrosys/src/server/trpc/routers/articles.router.ts`
- Create: `nephrosys/__tests__/validators/articles.test.ts`
- Modify: `nephrosys/src/server/trpc/router.ts`

**Interfaces:**
- Consumes: `articles` table, `categorieArticleEnum`
- Produces: `articlesRouter` with `list`, `getById`, `create`, `update`, `toggleActive`

- [ ] **Step 1: Create articles validators**

Create `nephrosys/src/lib/validators/articles.ts`:

```typescript
import { z } from 'zod';

const categorieValues = ['medicament', 'consommable', 'acte_medical'] as const;

export const createArticleSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(200, 'Nom trop long'),
  categorie: z.enum(categorieValues, { message: 'Categorie invalide' }),
  prixUnitaire: z.number().positive('Prix doit etre positif'),
  unite: z.string().min(1, 'Unite requise').max(50, 'Unite trop longue'),
  voieAdministration: z.string().max(50, 'Voie trop longue').optional(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;

export const updateArticleSchema = createArticleSchema.partial().extend({
  id: z.string().uuid('ID invalide'),
});

export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

export const articleListSchema = z.object({
  categorie: z.enum(categorieValues).optional(),
  activeOnly: z.boolean().default(true),
});

export type ArticleListInput = z.infer<typeof articleListSchema>;
```

- [ ] **Step 2: Create articles router**

Create `nephrosys/src/server/trpc/routers/articles.router.ts`:

```typescript
import { router, roleProcedure } from '@/server/trpc';
import { articles } from '@/server/db/schema';
import { createArticleSchema, updateArticleSchema, articleListSchema } from '@/lib/validators/articles';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const articlesRouter = router({
  list: roleProcedure(['admin', 'medecin', 'infirmiere', 'facturation'])
    .input(articleListSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.categorie) {
        conditions.push(eq(articles.categorie, input.categorie));
      }
      if (input.activeOnly) {
        conditions.push(eq(articles.isActive, true));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const data = await ctx.db
        .select()
        .from(articles)
        .where(where)
        .orderBy(articles.nom);

      return data;
    }),

  getById: roleProcedure(['admin', 'medecin', 'infirmiere', 'facturation'])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [article] = await ctx.db
        .select()
        .from(articles)
        .where(eq(articles.id, input.id))
        .limit(1);

      if (!article) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Article non trouve' });
      }
      return article;
    }),

  create: roleProcedure(['admin'])
    .input(createArticleSchema)
    .mutation(async ({ ctx, input }) => {
      const [article] = await ctx.db
        .insert(articles)
        .values({
          nom: input.nom,
          categorie: input.categorie,
          prixUnitaire: input.prixUnitaire.toString(),
          unite: input.unite,
          voieAdministration: input.voieAdministration ?? null,
        })
        .returning();

      return article;
    }),

  update: roleProcedure(['admin'])
    .input(updateArticleSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [existing] = await ctx.db
        .select()
        .from(articles)
        .where(eq(articles.id, id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Article non trouve' });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      if (data.nom !== undefined) updateData.nom = data.nom;
      if (data.categorie !== undefined) updateData.categorie = data.categorie;
      if (data.prixUnitaire !== undefined) updateData.prixUnitaire = data.prixUnitaire.toString();
      if (data.unite !== undefined) updateData.unite = data.unite;
      if (data.voieAdministration !== undefined) updateData.voieAdministration = data.voieAdministration ?? null;

      const [article] = await ctx.db
        .update(articles)
        .set(updateData)
        .where(eq(articles.id, id))
        .returning();

      return article;
    }),

  toggleActive: roleProcedure(['admin'])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ isActive: articles.isActive })
        .from(articles)
        .where(eq(articles.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Article non trouve' });
      }

      const [article] = await ctx.db
        .update(articles)
        .set({ isActive: !existing.isActive, updatedAt: new Date() })
        .where(eq(articles.id, input.id))
        .returning();

      return article;
    }),
});
```

- [ ] **Step 3: Register articles router**

In `nephrosys/src/server/trpc/router.ts`, add the import and registration:

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
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 4: Create articles validator tests**

Create `nephrosys/__tests__/validators/articles.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createArticleSchema, updateArticleSchema, articleListSchema } from '@/lib/validators/articles';

describe('createArticleSchema', () => {
  it('accepts valid medicament article', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Erythropoietine 4000 UI',
      categorie: 'medicament',
      prixUnitaire: 15000,
      unite: 'UI',
      voieAdministration: 'SC',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid consommable without voieAdministration', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Dialyseur F8',
      categorie: 'consommable',
      prixUnitaire: 25000,
      unite: 'unite',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid acte_medical', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Seance de dialyse standard',
      categorie: 'acte_medical',
      prixUnitaire: 25000,
      unite: 'seance',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty nom', () => {
    const result = createArticleSchema.safeParse({
      nom: '',
      categorie: 'medicament',
      prixUnitaire: 15000,
      unite: 'UI',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative prixUnitaire', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Test',
      categorie: 'medicament',
      prixUnitaire: -100,
      unite: 'UI',
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero prixUnitaire', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Test',
      categorie: 'medicament',
      prixUnitaire: 0,
      unite: 'mg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid categorie', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Test',
      categorie: 'invalid_cat',
      prixUnitaire: 100,
      unite: 'mg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects nom longer than 200 characters', () => {
    const result = createArticleSchema.safeParse({
      nom: 'A'.repeat(201),
      categorie: 'medicament',
      prixUnitaire: 100,
      unite: 'mg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty unite', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Test',
      categorie: 'medicament',
      prixUnitaire: 100,
      unite: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateArticleSchema', () => {
  it('accepts partial update with only nom', () => {
    const result = updateArticleSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      nom: 'Nouveau nom',
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with only prixUnitaire', () => {
    const result = updateArticleSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      prixUnitaire: 30000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const result = updateArticleSchema.safeParse({
      nom: 'Nouveau nom',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid uuid', () => {
    const result = updateArticleSchema.safeParse({
      id: 'not-a-uuid',
      nom: 'Test',
    });
    expect(result.success).toBe(false);
  });
});

describe('articleListSchema', () => {
  it('defaults activeOnly to true', () => {
    const result = articleListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeOnly).toBe(true);
    }
  });

  it('accepts categorie filter', () => {
    const result = articleListSchema.safeParse({ categorie: 'medicament' });
    expect(result.success).toBe(true);
  });

  it('accepts activeOnly false', () => {
    const result = articleListSchema.safeParse({ activeOnly: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeOnly).toBe(false);
    }
  });
});
```

- [ ] **Step 5: Verify**

```bash
cd nephrosys && pnpm tsc --noEmit && pnpm test
```

---

### Task 3: Articles UI (admin page)

**Files:**
- Create: `nephrosys/src/components/articles/articles-page.tsx`
- Create: `nephrosys/src/app/(dashboard)/admin/articles/page.tsx`
- Modify: `nephrosys/src/lib/permissions.ts`

**Interfaces:**
- Consumes: `articles.list`, `articles.create`, `articles.update`, `articles.toggleActive`
- Produces: Admin page at `/admin/articles`

- [ ] **Step 1: Create ArticlesPage client component**

Create `nephrosys/src/components/articles/articles-page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIE_OPTIONS = [
  { value: '', label: 'Toutes les categories' },
  { value: 'medicament', label: 'Medicament' },
  { value: 'consommable', label: 'Consommable' },
  { value: 'acte_medical', label: 'Acte medical' },
];

const CATEGORIE_BADGES: Record<string, { variant: 'info' | 'success' | 'default'; label: string }> = {
  medicament: { variant: 'info', label: 'Medicament' },
  consommable: { variant: 'success', label: 'Consommable' },
  acte_medical: { variant: 'default', label: 'Acte medical' },
};

const UNITE_OPTIONS = [
  { value: 'unite', label: 'Unite' },
  { value: 'mg', label: 'mg' },
  { value: 'ml', label: 'ml' },
  { value: 'UI', label: 'UI' },
  { value: 'seance', label: 'Seance' },
];

const VOIE_OPTIONS = [
  { value: '', label: 'Aucune' },
  { value: 'IV', label: 'IV' },
  { value: 'SC', label: 'SC' },
  { value: 'PO', label: 'PO' },
  { value: 'IM', label: 'IM' },
];

type FormData = {
  nom: string;
  categorie: 'medicament' | 'consommable' | 'acte_medical';
  prixUnitaire: string;
  unite: string;
  voieAdministration: string;
};

const EMPTY_FORM: FormData = {
  nom: '',
  categorie: 'medicament',
  prixUnitaire: '',
  unite: 'unite',
  voieAdministration: '',
};

export function ArticlesPage() {
  const [categorieFilter, setCategorieFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const utils = api.useUtils();

  const { data: articlesList, isLoading } = api.articles.list.useQuery({
    categorie: categorieFilter ? (categorieFilter as 'medicament' | 'consommable' | 'acte_medical') : undefined,
    activeOnly: false,
  });

  const createMutation = api.articles.create.useMutation({
    onSuccess: () => {
      utils.articles.list.invalidate();
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  const updateMutation = api.articles.update.useMutation({
    onSuccess: () => {
      utils.articles.list.invalidate();
      setEditId(null);
      setForm(EMPTY_FORM);
    },
  });

  const toggleMutation = api.articles.toggleActive.useMutation({
    onSuccess: () => utils.articles.list.invalidate(),
  });

  function handleSubmit() {
    const prixUnitaire = parseFloat(form.prixUnitaire);
    if (isNaN(prixUnitaire) || prixUnitaire <= 0) return;

    if (editId) {
      updateMutation.mutate({
        id: editId,
        nom: form.nom,
        categorie: form.categorie,
        prixUnitaire,
        unite: form.unite,
        voieAdministration: form.voieAdministration || undefined,
      });
    } else {
      createMutation.mutate({
        nom: form.nom,
        categorie: form.categorie,
        prixUnitaire,
        unite: form.unite,
        voieAdministration: form.voieAdministration || undefined,
      });
    }
  }

  function startEdit(article: NonNullable<typeof articlesList>[number]) {
    setEditId(article.id);
    setForm({
      nom: article.nom,
      categorie: article.categorie,
      prixUnitaire: article.prixUnitaire,
      unite: article.unite,
      voieAdministration: article.voieAdministration ?? '',
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Catalogue d&apos;articles
        </h1>
        <div className="flex items-center gap-3">
          <Select
            options={CATEGORIE_OPTIONS}
            value={categorieFilter}
            onChange={(e) => setCategorieFilter(e.target.value)}
            placeholder="Filtrer par categorie"
          />
          <Button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}>
            Nouvel article
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            {editId ? 'Modifier l\'article' : 'Nouvel article'}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Nom"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
            />
            <Select
              label="Categorie"
              options={CATEGORIE_OPTIONS.slice(1)}
              value={form.categorie}
              onChange={(e) => setForm({ ...form, categorie: e.target.value as FormData['categorie'] })}
            />
            <Input
              label="Prix unitaire (FCFA)"
              type="number"
              value={form.prixUnitaire}
              onChange={(e) => setForm({ ...form, prixUnitaire: e.target.value })}
            />
            <Select
              label="Unite"
              options={UNITE_OPTIONS}
              value={form.unite}
              onChange={(e) => setForm({ ...form, unite: e.target.value })}
            />
            <Select
              label="Voie d'administration"
              options={VOIE_OPTIONS}
              value={form.voieAdministration}
              onChange={(e) => setForm({ ...form, voieAdministration: e.target.value })}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editId ? 'Enregistrer' : 'Creer'}
            </Button>
            <Button variant="outline" onClick={cancelForm}>
              Annuler
            </Button>
          </div>
          {(createMutation.error || updateMutation.error) && (
            <p className="mt-2 text-sm text-red-500">
              {createMutation.error?.message || updateMutation.error?.message}
            </p>
          )}
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Nom</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Categorie</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Prix unitaire</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Unite</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Statut</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {articlesList?.map((article) => {
                  const catBadge = CATEGORIE_BADGES[article.categorie] ?? CATEGORIE_BADGES['medicament']!;
                  return (
                    <tr key={article.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{article.nom}</td>
                      <td className="px-4 py-3">
                        <Badge variant={catBadge.variant}>{catBadge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {parseFloat(article.prixUnitaire).toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{article.unite}</td>
                      <td className="px-4 py-3">
                        <Badge variant={article.isActive ? 'success' : 'danger'}>
                          {article.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(article)}>
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleMutation.mutate({ id: article.id })}
                            disabled={toggleMutation.isPending}
                          >
                            {article.isActive ? 'Desactiver' : 'Activer'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {articlesList?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Aucun article trouve
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create admin articles page**

Create `nephrosys/src/app/(dashboard)/admin/articles/page.tsx`:

```typescript
import { ArticlesPage } from '@/components/articles/articles-page';

export default function AdminArticlesPage() {
  return <ArticlesPage />;
}
```

- [ ] **Step 3: Update permissions.ts**

In `nephrosys/src/lib/permissions.ts`, add the articles route before the `/admin` catch-all in `ROUTE_PERMISSIONS`, and add menu items:

Add to `ROUTE_PERMISSIONS` array, before the `{ path: '/admin', roles: ['admin'] }` line:

```typescript
  { path: '/admin/articles', roles: ['admin'] },
  { path: '/admin/rapports', roles: ['admin'] },
```

Add to `ALL_MENU_ITEMS` array, after the `Configuration` entry:

```typescript
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
```

The full updated `ROUTE_PERMISSIONS` array should be:

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
  { path: '/admin/articles', roles: ['admin'] },
  { path: '/admin/rapports', roles: ['admin'] },
  { path: '/admin', roles: ['admin'] },
  { path: '/portail', roles: ['patient'] },
];
```

The full updated `ALL_MENU_ITEMS` array should be:

```typescript
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
```

- [ ] **Step 4: Verify**

```bash
cd nephrosys && pnpm tsc --noEmit
```

---

### Task 4: Factures Router + Validators + Tests

**Files:**
- Create: `nephrosys/src/lib/validators/factures.ts`
- Create: `nephrosys/src/lib/facture-calculations.ts`
- Create: `nephrosys/src/server/trpc/routers/factures.router.ts`
- Create: `nephrosys/__tests__/validators/factures.test.ts`
- Create: `nephrosys/__tests__/lib/facture-calculations.test.ts`
- Modify: `nephrosys/src/server/trpc/router.ts`
- Create: `nephrosys/src/server/db/seed-phase3.ts`

**Interfaces:**
- Consumes: `factures`, `lignesFacture`, `articles`, `tarifsBase`, `dialysisSessions`, `patients`, `postesDialyse` tables
- Produces: `facturesRouter` with `list`, `getById`, `generate`, `addLigne`, `removeLigne`, `valider`, `enregistrerPaiement`, `annuler`, `stats`
- Produces: `tarifsRouter` nested procedures `list`, `update`

- [ ] **Step 1: Create facture-calculations.ts**

Create `nephrosys/src/lib/facture-calculations.ts`:

```typescript
/**
 * Calculs de facturation — fonctions pures.
 * Tous les montants en FCFA (decimal string ou number).
 */

/** Calcule le montant d'une ligne : quantite x prix unitaire */
export function calculateLigneMontant(quantite: number, prixUnitaire: number): number {
  return Math.round(quantite * prixUnitaire * 100) / 100;
}

/** Calcule le total des supplements a partir des lignes (exclut la ligne forfait = articleId null) */
export function calculateMontantSupplements(
  lignes: { articleId: string | null; montant: string }[],
): number {
  let total = 0;
  for (const ligne of lignes) {
    if (ligne.articleId !== null) {
      total += parseFloat(ligne.montant);
    }
  }
  return Math.round(total * 100) / 100;
}

/** Calcule le montant total = base + supplements */
export function calculateMontantTotal(montantBase: number, montantSupplements: number): number {
  return Math.round((montantBase + montantSupplements) * 100) / 100;
}
```

- [ ] **Step 2: Create factures validators**

Create `nephrosys/src/lib/validators/factures.ts`:

```typescript
import { z } from 'zod';

const statutFactureValues = ['brouillon', 'validee', 'payee', 'annulee'] as const;
const modePaiementValues = ['especes', 'cheque', 'virement', 'mobile_money'] as const;

export const generateFactureSchema = z.object({
  sessionId: z.string().uuid('Session ID invalide'),
});

export type GenerateFactureInput = z.infer<typeof generateFactureSchema>;

export const addLigneSchema = z.object({
  factureId: z.string().uuid('Facture ID invalide'),
  articleId: z.string().uuid('Article ID invalide'),
  quantite: z.number().positive('Quantite doit etre positive').default(1),
});

export type AddLigneInput = z.infer<typeof addLigneSchema>;

export const removeLigneSchema = z.object({
  ligneId: z.string().uuid('Ligne ID invalide'),
});

export type RemoveLigneInput = z.infer<typeof removeLigneSchema>;

export const validerFactureSchema = z.object({
  factureId: z.string().uuid('Facture ID invalide'),
});

export type ValiderFactureInput = z.infer<typeof validerFactureSchema>;

export const enregistrerPaiementSchema = z.object({
  factureId: z.string().uuid('Facture ID invalide'),
  modePaiement: z.enum(modePaiementValues, { message: 'Mode de paiement invalide' }),
});

export type EnregistrerPaiementInput = z.infer<typeof enregistrerPaiementSchema>;

export const annulerFactureSchema = z.object({
  factureId: z.string().uuid('Facture ID invalide'),
});

export type AnnulerFactureInput = z.infer<typeof annulerFactureSchema>;

export const factureListSchema = z.object({
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(20),
  statut: z.enum(statutFactureValues).optional(),
  dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide').optional(),
  dateFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide').optional(),
  patientId: z.string().uuid().optional(),
});

export type FactureListInput = z.infer<typeof factureListSchema>;

export const updateTarifSchema = z.object({
  id: z.string().uuid('ID invalide'),
  montant: z.number().positive('Montant doit etre positif'),
});

export type UpdateTarifInput = z.infer<typeof updateTarifSchema>;
```

- [ ] **Step 3: Create factures router**

Create `nephrosys/src/server/trpc/routers/factures.router.ts`:

```typescript
import { router, roleProcedure } from '@/server/trpc';
import {
  factures,
  lignesFacture,
  articles,
  tarifsBase,
  dialysisSessions,
  patients,
  postesDialyse,
  users,
} from '@/server/db/schema';
import {
  generateFactureSchema,
  addLigneSchema,
  removeLigneSchema,
  validerFactureSchema,
  enregistrerPaiementSchema,
  annulerFactureSchema,
  factureListSchema,
  updateTarifSchema,
} from '@/lib/validators/factures';
import {
  calculateLigneMontant,
  calculateMontantSupplements,
  calculateMontantTotal,
} from '@/lib/facture-calculations';
import { eq, and, gte, lte, count, desc, sql, ne } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { TRPCContext } from '@/server/trpc';

type Db = TRPCContext['db'];

/** Generate reference: FAC-YYYYMMDD-NNN */
async function generateFactureReference(db: Db, dateFacture: Date, offset = 0): Promise<string> {
  const dateStr = dateFacture.toISOString().split('T')[0]!.replace(/-/g, '');
  const prefix = `FAC-${dateStr}-`;

  const dateString = dateFacture.toISOString().split('T')[0]!;

  const [row] = await db
    .select({ total: count() })
    .from(factures)
    .where(eq(factures.dateFacture, dateString));

  const total = row?.total ?? 0;
  const num = (total + 1 + offset).toString().padStart(3, '0');
  return `${prefix}${num}`;
}

/** Check if a Postgres error is a unique constraint violation */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

/** Recalculate supplements and total for a facture */
async function recalculateTotals(db: Db, factureId: string): Promise<void> {
  const lignes = await db
    .select({ articleId: lignesFacture.articleId, montant: lignesFacture.montant })
    .from(lignesFacture)
    .where(eq(lignesFacture.factureId, factureId));

  const montantSupplements = calculateMontantSupplements(lignes);

  const [facture] = await db
    .select({ montantBase: factures.montantBase })
    .from(factures)
    .where(eq(factures.id, factureId))
    .limit(1);

  if (!facture) return;

  const montantBase = parseFloat(facture.montantBase);
  const montantTotal = calculateMontantTotal(montantBase, montantSupplements);

  await db
    .update(factures)
    .set({
      montantSupplements: montantSupplements.toString(),
      montantTotal: montantTotal.toString(),
      updatedAt: new Date(),
    })
    .where(eq(factures.id, factureId));
}

export const facturesRouter = router({
  list: roleProcedure(['admin', 'facturation', 'medecin', 'infirmiere', 'secretaire'])
    .input(factureListSchema)
    .query(async ({ ctx, input }) => {
      const { page, perPage, statut, dateDebut, dateFin, patientId } = input;
      const offset = (page - 1) * perPage;

      const conditions = [];

      if (statut) {
        conditions.push(eq(factures.statut, statut));
      }
      if (dateDebut) {
        conditions.push(gte(factures.dateFacture, dateDebut));
      }
      if (dateFin) {
        conditions.push(lte(factures.dateFacture, dateFin));
      }
      if (patientId) {
        conditions.push(eq(factures.patientId, patientId));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [data, totalRows] = await Promise.all([
        ctx.db
          .select({
            facture: factures,
            patient: { id: patients.id, nom: patients.nom, prenom: patients.prenom },
          })
          .from(factures)
          .innerJoin(patients, eq(factures.patientId, patients.id))
          .where(where)
          .orderBy(desc(factures.createdAt))
          .limit(perPage)
          .offset(offset),
        ctx.db.select({ total: count() }).from(factures).where(where),
      ]);

      const total = totalRows[0]?.total ?? 0;

      return { data, total };
    }),

  getById: roleProcedure(['admin', 'facturation', 'medecin', 'infirmiere', 'secretaire'])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [facture] = await ctx.db
        .select()
        .from(factures)
        .where(eq(factures.id, input.id))
        .limit(1);

      if (!facture) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Facture non trouvee' });
      }

      const [patient] = await ctx.db
        .select({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
        .from(patients)
        .where(eq(patients.id, facture.patientId))
        .limit(1);

      const [session] = await ctx.db
        .select({
          id: dialysisSessions.id,
          dateSeance: dialysisSessions.dateSeance,
          statut: dialysisSessions.statut,
        })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.id, facture.sessionId))
        .limit(1);

      const lignes = await ctx.db
        .select()
        .from(lignesFacture)
        .where(eq(lignesFacture.factureId, facture.id))
        .orderBy(lignesFacture.createdAt);

      const [createdByUser] = await ctx.db
        .select({ id: users.id, nom: users.nom, prenom: users.prenom })
        .from(users)
        .where(eq(users.id, facture.createdBy))
        .limit(1);

      return { ...facture, patient, session, lignes, createdByUser };
    }),

  generate: roleProcedure(['admin', 'facturation'])
    .input(generateFactureSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify session exists and is terminee
      const [session] = await ctx.db
        .select({
          id: dialysisSessions.id,
          patientId: dialysisSessions.patientId,
          posteId: dialysisSessions.posteId,
          statut: dialysisSessions.statut,
          dateSeance: dialysisSessions.dateSeance,
          isVip: dialysisSessions.isVip,
        })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Seance non trouvee' });
      }
      if (session.statut !== 'terminee') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La seance doit etre terminee pour generer une facture',
        });
      }

      // Check if session already has a facture
      const [existingFacture] = await ctx.db
        .select({ id: factures.id })
        .from(factures)
        .where(and(
          eq(factures.sessionId, input.sessionId),
          ne(factures.statut, 'annulee'),
        ))
        .limit(1);

      if (existingFacture) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cette seance a deja une facture',
        });
      }

      // Get tarif based on VIP status
      const tarifCode = session.isVip ? 'tarif_vip' : 'tarif_standard';
      const [tarif] = await ctx.db
        .select()
        .from(tarifsBase)
        .where(eq(tarifsBase.code, tarifCode))
        .limit(1);

      if (!tarif) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Tarif "${tarifCode}" non configure`,
        });
      }

      const montantBase = parseFloat(tarif.montant);
      const dateFacture = new Date();
      const userId = ctx.session.user.id;

      // Generate reference with retry on unique violation
      const MAX_RETRIES = 3;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const reference = await generateFactureReference(ctx.db, dateFacture, attempt);
        try {
          const [facture] = await ctx.db
            .insert(factures)
            .values({
              reference,
              sessionId: session.id,
              patientId: session.patientId,
              dateFacture: dateFacture.toISOString().split('T')[0]!,
              montantBase: montantBase.toString(),
              montantSupplements: '0',
              montantTotal: montantBase.toString(),
              statut: 'brouillon',
              createdBy: userId,
            })
            .returning();

          // Create forfait line
          await ctx.db
            .insert(lignesFacture)
            .values({
              factureId: facture!.id,
              articleId: null,
              designation: tarif.label,
              quantite: '1',
              prixUnitaire: tarif.montant,
              montant: tarif.montant,
            });

          return facture;
        } catch (err) {
          if (isUniqueViolation(err) && attempt < MAX_RETRIES - 1) {
            continue;
          }
          throw err;
        }
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Impossible de generer une reference unique',
      });
    }),

  addLigne: roleProcedure(['admin', 'facturation'])
    .input(addLigneSchema)
    .mutation(async ({ ctx, input }) => {
      // Check facture exists and is brouillon
      const [facture] = await ctx.db
        .select({ id: factures.id, statut: factures.statut })
        .from(factures)
        .where(eq(factures.id, input.factureId))
        .limit(1);

      if (!facture) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Facture non trouvee' });
      }
      if (facture.statut !== 'brouillon') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible de modifier une facture qui n\'est pas en brouillon',
        });
      }

      // Get article
      const [article] = await ctx.db
        .select()
        .from(articles)
        .where(eq(articles.id, input.articleId))
        .limit(1);

      if (!article) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Article non trouve' });
      }

      const quantite = input.quantite;
      const prixUnitaire = parseFloat(article.prixUnitaire);
      const montant = calculateLigneMontant(quantite, prixUnitaire);

      const [ligne] = await ctx.db
        .insert(lignesFacture)
        .values({
          factureId: input.factureId,
          articleId: input.articleId,
          designation: article.nom,
          quantite: quantite.toString(),
          prixUnitaire: prixUnitaire.toString(),
          montant: montant.toString(),
        })
        .returning();

      // Recalculate totals
      await recalculateTotals(ctx.db, input.factureId);

      return ligne;
    }),

  removeLigne: roleProcedure(['admin', 'facturation'])
    .input(removeLigneSchema)
    .mutation(async ({ ctx, input }) => {
      // Get the ligne
      const [ligne] = await ctx.db
        .select()
        .from(lignesFacture)
        .where(eq(lignesFacture.id, input.ligneId))
        .limit(1);

      if (!ligne) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Ligne non trouvee' });
      }

      // Cannot remove forfait line (articleId is null)
      if (ligne.articleId === null) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible de supprimer la ligne forfait',
        });
      }

      // Check facture is brouillon
      const [facture] = await ctx.db
        .select({ statut: factures.statut })
        .from(factures)
        .where(eq(factures.id, ligne.factureId))
        .limit(1);

      if (!facture || facture.statut !== 'brouillon') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible de modifier une facture qui n\'est pas en brouillon',
        });
      }

      await ctx.db.delete(lignesFacture).where(eq(lignesFacture.id, input.ligneId));

      // Recalculate totals
      await recalculateTotals(ctx.db, ligne.factureId);

      return { success: true };
    }),

  valider: roleProcedure(['admin', 'facturation'])
    .input(validerFactureSchema)
    .mutation(async ({ ctx, input }) => {
      const [facture] = await ctx.db
        .select({ statut: factures.statut })
        .from(factures)
        .where(eq(factures.id, input.factureId))
        .limit(1);

      if (!facture) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Facture non trouvee' });
      }
      if (facture.statut !== 'brouillon') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seule une facture en brouillon peut etre validee',
        });
      }

      const [updated] = await ctx.db
        .update(factures)
        .set({ statut: 'validee', updatedAt: new Date() })
        .where(eq(factures.id, input.factureId))
        .returning();

      return updated;
    }),

  enregistrerPaiement: roleProcedure(['admin', 'facturation'])
    .input(enregistrerPaiementSchema)
    .mutation(async ({ ctx, input }) => {
      const [facture] = await ctx.db
        .select({ statut: factures.statut })
        .from(factures)
        .where(eq(factures.id, input.factureId))
        .limit(1);

      if (!facture) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Facture non trouvee' });
      }
      if (facture.statut !== 'validee') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seule une facture validee peut etre payee',
        });
      }

      const [updated] = await ctx.db
        .update(factures)
        .set({
          statut: 'payee',
          modePaiement: input.modePaiement,
          datePaiement: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(factures.id, input.factureId))
        .returning();

      return updated;
    }),

  annuler: roleProcedure(['admin'])
    .input(annulerFactureSchema)
    .mutation(async ({ ctx, input }) => {
      const [facture] = await ctx.db
        .select({ statut: factures.statut })
        .from(factures)
        .where(eq(factures.id, input.factureId))
        .limit(1);

      if (!facture) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Facture non trouvee' });
      }
      if (facture.statut !== 'brouillon' && facture.statut !== 'validee') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seule une facture en brouillon ou validee peut etre annulee',
        });
      }

      const [updated] = await ctx.db
        .update(factures)
        .set({ statut: 'annulee', updatedAt: new Date() })
        .where(eq(factures.id, input.factureId))
        .returning();

      return updated;
    }),

  stats: roleProcedure(['admin', 'facturation'])
    .query(async ({ ctx }) => {
      const now = new Date();
      const today = now.toISOString().split('T')[0]!;

      // Start of week (Monday)
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - diffToMonday);
      const weekStart = startOfWeek.toISOString().split('T')[0]!;

      // Start of month
      const monthStart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;

      // CA jour
      const [caJour] = await ctx.db
        .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
        .from(factures)
        .where(and(
          eq(factures.dateFacture, today),
          eq(factures.statut, 'payee'),
        ));

      // CA semaine
      const [caSemaine] = await ctx.db
        .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
        .from(factures)
        .where(and(
          gte(factures.dateFacture, weekStart),
          eq(factures.statut, 'payee'),
        ));

      // CA mois
      const [caMois] = await ctx.db
        .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
        .from(factures)
        .where(and(
          gte(factures.dateFacture, monthStart),
          eq(factures.statut, 'payee'),
        ));

      // Factures par statut
      const facturesParStatut = await ctx.db
        .select({
          statut: factures.statut,
          count: count(),
        })
        .from(factures)
        .groupBy(factures.statut);

      // Montant impaye (validee non payee)
      const [impaye] = await ctx.db
        .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)`, count: count() })
        .from(factures)
        .where(eq(factures.statut, 'validee'));

      return {
        caJour: parseFloat(caJour?.total ?? '0'),
        caSemaine: parseFloat(caSemaine?.total ?? '0'),
        caMois: parseFloat(caMois?.total ?? '0'),
        facturesParStatut: facturesParStatut.reduce(
          (acc, row) => ({ ...acc, [row.statut]: row.count }),
          {} as Record<string, number>,
        ),
        impaye: {
          montant: parseFloat(impaye?.total ?? '0'),
          count: impaye?.count ?? 0,
        },
      };
    }),

  // Tarifs sub-procedures
  tarifsList: roleProcedure(['admin', 'facturation'])
    .query(async ({ ctx }) => {
      const data = await ctx.db
        .select()
        .from(tarifsBase)
        .orderBy(tarifsBase.code);
      return data;
    }),

  tarifsUpdate: roleProcedure(['admin'])
    .input(updateTarifSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(tarifsBase)
        .where(eq(tarifsBase.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tarif non trouve' });
      }

      const [tarif] = await ctx.db
        .update(tarifsBase)
        .set({ montant: input.montant.toString(), updatedAt: new Date() })
        .where(eq(tarifsBase.id, input.id))
        .returning();

      return tarif;
    }),

  // Get facture by session ID (for session detail page)
  getBySessionId: roleProcedure(['admin', 'facturation', 'medecin', 'infirmiere', 'secretaire'])
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [facture] = await ctx.db
        .select({ id: factures.id, reference: factures.reference, statut: factures.statut })
        .from(factures)
        .where(and(
          eq(factures.sessionId, input.sessionId),
          ne(factures.statut, 'annulee'),
        ))
        .limit(1);

      return facture ?? null;
    }),
});
```

- [ ] **Step 4: Update router.ts to add factures router**

In `nephrosys/src/server/trpc/router.ts`, add the factures import and registration:

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
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 5: Create seed-phase3.ts**

Create `nephrosys/src/server/db/seed-phase3.ts`:

```typescript
import { db } from './index';
import { tarifsBase, articles } from './schema';

async function seedPhase3() {
  console.log('Seeding Phase 3 data...');

  // Seed tarifs de base
  const tarifsData = [
    {
      label: 'Tarif seance standard',
      code: 'tarif_standard',
      montant: '25000',
    },
    {
      label: 'Tarif seance VIP',
      code: 'tarif_vip',
      montant: '40000',
    },
  ];

  for (const tarif of tarifsData) {
    await db
      .insert(tarifsBase)
      .values(tarif)
      .onConflictDoNothing();
  }
  console.log(`  ${tarifsData.length} tarifs created`);

  // Seed sample articles
  const articlesData = [
    {
      nom: 'Erythropoietine 4000 UI',
      categorie: 'medicament' as const,
      prixUnitaire: '15000',
      unite: 'UI',
      voieAdministration: 'SC',
    },
    {
      nom: 'Fer injectable (Venofer) 100mg',
      categorie: 'medicament' as const,
      prixUnitaire: '8000',
      unite: 'mg',
      voieAdministration: 'IV',
    },
    {
      nom: 'Heparine 5000 UI',
      categorie: 'medicament' as const,
      prixUnitaire: '3000',
      unite: 'UI',
      voieAdministration: 'IV',
    },
    {
      nom: 'Dialyseur F8 HPS',
      categorie: 'consommable' as const,
      prixUnitaire: '25000',
      unite: 'unite',
    },
    {
      nom: 'Ligne arterielle',
      categorie: 'consommable' as const,
      prixUnitaire: '5000',
      unite: 'unite',
    },
    {
      nom: 'Ligne veineuse',
      categorie: 'consommable' as const,
      prixUnitaire: '5000',
      unite: 'unite',
    },
    {
      nom: 'Catheter temporaire',
      categorie: 'acte_medical' as const,
      prixUnitaire: '50000',
      unite: 'unite',
    },
    {
      nom: 'Bilan sanguin complet',
      categorie: 'acte_medical' as const,
      prixUnitaire: '15000',
      unite: 'unite',
    },
  ];

  for (const article of articlesData) {
    await db
      .insert(articles)
      .values(article)
      .onConflictDoNothing();
  }
  console.log(`  ${articlesData.length} articles created`);

  console.log('Phase 3 seed complete.');
}

seedPhase3()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 6: Create facture-calculations tests**

Create `nephrosys/__tests__/lib/facture-calculations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateLigneMontant,
  calculateMontantSupplements,
  calculateMontantTotal,
} from '@/lib/facture-calculations';

describe('calculateLigneMontant', () => {
  it('calculates simple montant', () => {
    expect(calculateLigneMontant(1, 25000)).toBe(25000);
  });

  it('calculates montant with quantity', () => {
    expect(calculateLigneMontant(3, 5000)).toBe(15000);
  });

  it('calculates montant with decimal quantity', () => {
    expect(calculateLigneMontant(1.5, 10000)).toBe(15000);
  });

  it('handles rounding correctly', () => {
    expect(calculateLigneMontant(3, 3333.33)).toBe(9999.99);
  });
});

describe('calculateMontantSupplements', () => {
  it('returns 0 for empty lignes', () => {
    expect(calculateMontantSupplements([])).toBe(0);
  });

  it('excludes forfait line (articleId null)', () => {
    const lignes = [
      { articleId: null, montant: '25000' },
      { articleId: 'abc-123', montant: '15000' },
    ];
    expect(calculateMontantSupplements(lignes)).toBe(15000);
  });

  it('sums multiple supplement lines', () => {
    const lignes = [
      { articleId: null, montant: '25000' },
      { articleId: 'abc-123', montant: '15000' },
      { articleId: 'def-456', montant: '8000' },
      { articleId: 'ghi-789', montant: '3000' },
    ];
    expect(calculateMontantSupplements(lignes)).toBe(26000);
  });

  it('returns 0 when only forfait line exists', () => {
    const lignes = [{ articleId: null, montant: '25000' }];
    expect(calculateMontantSupplements(lignes)).toBe(0);
  });
});

describe('calculateMontantTotal', () => {
  it('calculates total = base + supplements', () => {
    expect(calculateMontantTotal(25000, 15000)).toBe(40000);
  });

  it('returns base when supplements is 0', () => {
    expect(calculateMontantTotal(25000, 0)).toBe(25000);
  });

  it('handles decimal amounts', () => {
    expect(calculateMontantTotal(25000.50, 15000.75)).toBe(40001.25);
  });
});
```

- [ ] **Step 7: Create factures validator tests**

Create `nephrosys/__tests__/validators/factures.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  generateFactureSchema,
  addLigneSchema,
  removeLigneSchema,
  enregistrerPaiementSchema,
  factureListSchema,
  updateTarifSchema,
} from '@/lib/validators/factures';

describe('generateFactureSchema', () => {
  it('accepts valid session UUID', () => {
    const result = generateFactureSchema.safeParse({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const result = generateFactureSchema.safeParse({
      sessionId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing sessionId', () => {
    const result = generateFactureSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('addLigneSchema', () => {
  it('accepts valid input with default quantite', () => {
    const result = addLigneSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      articleId: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantite).toBe(1);
    }
  });

  it('accepts explicit quantite', () => {
    const result = addLigneSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      articleId: '550e8400-e29b-41d4-a716-446655440001',
      quantite: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantite).toBe(3);
    }
  });

  it('rejects negative quantite', () => {
    const result = addLigneSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      articleId: '550e8400-e29b-41d4-a716-446655440001',
      quantite: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero quantite', () => {
    const result = addLigneSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      articleId: '550e8400-e29b-41d4-a716-446655440001',
      quantite: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('removeLigneSchema', () => {
  it('accepts valid ligne UUID', () => {
    const result = removeLigneSchema.safeParse({
      ligneId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const result = removeLigneSchema.safeParse({
      ligneId: 'not-valid',
    });
    expect(result.success).toBe(false);
  });
});

describe('enregistrerPaiementSchema', () => {
  it('accepts especes', () => {
    const result = enregistrerPaiementSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      modePaiement: 'especes',
    });
    expect(result.success).toBe(true);
  });

  it('accepts mobile_money', () => {
    const result = enregistrerPaiementSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      modePaiement: 'mobile_money',
    });
    expect(result.success).toBe(true);
  });

  it('accepts cheque', () => {
    const result = enregistrerPaiementSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      modePaiement: 'cheque',
    });
    expect(result.success).toBe(true);
  });

  it('accepts virement', () => {
    const result = enregistrerPaiementSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      modePaiement: 'virement',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid mode', () => {
    const result = enregistrerPaiementSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      modePaiement: 'bitcoin',
    });
    expect(result.success).toBe(false);
  });
});

describe('factureListSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = factureListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.perPage).toBe(20);
    }
  });

  it('accepts statut filter', () => {
    const result = factureListSchema.safeParse({ statut: 'brouillon' });
    expect(result.success).toBe(true);
  });

  it('accepts date range filter', () => {
    const result = factureListSchema.safeParse({
      dateDebut: '2026-01-01',
      dateFin: '2026-01-31',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format', () => {
    const result = factureListSchema.safeParse({
      dateDebut: '01/01/2026',
    });
    expect(result.success).toBe(false);
  });

  it('rejects perPage over 100', () => {
    const result = factureListSchema.safeParse({ perPage: 200 });
    expect(result.success).toBe(false);
  });

  it('accepts patientId filter', () => {
    const result = factureListSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });
});

describe('updateTarifSchema', () => {
  it('accepts valid update', () => {
    const result = updateTarifSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      montant: 30000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative montant', () => {
    const result = updateTarifSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      montant: -1000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero montant', () => {
    const result = updateTarifSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      montant: 0,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 8: Verify**

```bash
cd nephrosys && pnpm tsc --noEmit && pnpm test
```

---

### Task 5: Factures UI -- List page

**Files:**
- Create: `nephrosys/src/components/facturation/factures-list.tsx`
- Create: `nephrosys/src/app/(dashboard)/facturation/page.tsx`

**Interfaces:**
- Consumes: `factures.list`, `factures.stats`
- Produces: Factures list page at `/facturation`

- [ ] **Step 1: Create FacturesList client component**

Create `nephrosys/src/components/facturation/factures-list.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const STATUT_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'validee', label: 'Validee' },
  { value: 'payee', label: 'Payee' },
  { value: 'annulee', label: 'Annulee' },
];

const STATUT_BADGES: Record<string, { variant: 'default' | 'info' | 'success' | 'danger'; label: string }> = {
  brouillon: { variant: 'default', label: 'Brouillon' },
  validee: { variant: 'info', label: 'Validee' },
  payee: { variant: 'success', label: 'Payee' },
  annulee: { variant: 'danger', label: 'Annulee' },
};

export function FacturesList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statutFilter, setStatutFilter] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const { data, isLoading } = api.factures.list.useQuery({
    page,
    perPage: 20,
    statut: statutFilter ? (statutFilter as 'brouillon' | 'validee' | 'payee' | 'annulee') : undefined,
    dateDebut: dateDebut || undefined,
    dateFin: dateFin || undefined,
  });

  const { data: stats, isLoading: statsLoading } = api.factures.stats.useQuery();

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Facturation</h1>
      </div>

      {/* Stats cards */}
      {statsLoading ? (
        <Skeleton className="mb-6 h-24 w-full" />
      ) : stats ? (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CA du jour</p>
            <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">
              {stats.caJour.toLocaleString('fr-FR')} FCFA
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CA de la semaine</p>
            <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">
              {stats.caSemaine.toLocaleString('fr-FR')} FCFA
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CA du mois</p>
            <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">
              {stats.caMois.toLocaleString('fr-FR')} FCFA
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Impaye</p>
            <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">
              {stats.impaye.montant.toLocaleString('fr-FR')} FCFA
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stats.impaye.count} facture(s)
            </p>
          </Card>
        </div>
      ) : null}

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Select
            label="Statut"
            options={STATUT_OPTIONS}
            value={statutFilter}
            onChange={(e) => { setStatutFilter(e.target.value); setPage(1); }}
          />
          <Input
            label="Date debut"
            type="date"
            value={dateDebut}
            onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
          />
          <Input
            label="Date fin"
            type="date"
            value={dateFin}
            onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
          />
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Reference</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Patient</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Montant total</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Statut</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map(({ facture, patient }) => {
                  const badge = STATUT_BADGES[facture.statut] ?? STATUT_BADGES['brouillon']!;
                  return (
                    <tr
                      key={facture.id}
                      className="cursor-pointer border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                      onClick={() => router.push(`/facturation/${facture.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">
                        {facture.reference}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {patient.nom} {patient.prenom}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {facture.dateFacture}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {parseFloat(facture.montantTotal).toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/facturation/${facture.id}`);
                          }}
                        >
                          Voir
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Aucune facture trouvee
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} sur {totalPages} ({data?.total ?? 0} factures)
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Precedent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create facturation list page**

Create `nephrosys/src/app/(dashboard)/facturation/page.tsx`:

```typescript
import { FacturesList } from '@/components/facturation/factures-list';

export default function FacturationPage() {
  return <FacturesList />;
}
```

- [ ] **Step 3: Verify**

```bash
cd nephrosys && pnpm tsc --noEmit
```

---

### Task 6: Factures UI -- Detail page

**Files:**
- Create: `nephrosys/src/components/facturation/facture-detail.tsx`
- Create: `nephrosys/src/app/(dashboard)/facturation/[id]/page.tsx`

**Interfaces:**
- Consumes: `factures.getById`, `factures.addLigne`, `factures.removeLigne`, `factures.valider`, `factures.enregistrerPaiement`, `factures.annuler`, `articles.list`
- Produces: Facture detail page at `/facturation/[id]`

- [ ] **Step 1: Create FactureDetail client component**

Create `nephrosys/src/components/facturation/facture-detail.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const STATUT_BADGES: Record<string, { variant: 'default' | 'info' | 'success' | 'danger'; label: string }> = {
  brouillon: { variant: 'default', label: 'Brouillon' },
  validee: { variant: 'info', label: 'Validee' },
  payee: { variant: 'success', label: 'Payee' },
  annulee: { variant: 'danger', label: 'Annulee' },
};

const MODE_PAIEMENT_OPTIONS = [
  { value: 'especes', label: 'Especes' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'virement', label: 'Virement' },
  { value: 'mobile_money', label: 'Mobile Money' },
];

type Props = {
  factureId: string;
};

export function FactureDetail({ factureId }: Props) {
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [modePaiement, setModePaiement] = useState('especes');

  const utils = api.useUtils();

  const { data: facture, isLoading } = api.factures.getById.useQuery({ id: factureId });

  const { data: articlesList } = api.articles.list.useQuery(
    { activeOnly: true },
    { enabled: facture?.statut === 'brouillon' },
  );

  const addLigneMutation = api.factures.addLigne.useMutation({
    onSuccess: () => {
      utils.factures.getById.invalidate({ id: factureId });
      setSelectedArticleId('');
      setQuantite('1');
    },
  });

  const removeLigneMutation = api.factures.removeLigne.useMutation({
    onSuccess: () => utils.factures.getById.invalidate({ id: factureId }),
  });

  const validerMutation = api.factures.valider.useMutation({
    onSuccess: () => utils.factures.getById.invalidate({ id: factureId }),
  });

  const paiementMutation = api.factures.enregistrerPaiement.useMutation({
    onSuccess: () => utils.factures.getById.invalidate({ id: factureId }),
  });

  const annulerMutation = api.factures.annuler.useMutation({
    onSuccess: () => utils.factures.getById.invalidate({ id: factureId }),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!facture) return <p className="text-red-500">Facture non trouvee</p>;

  const badge = STATUT_BADGES[facture.statut] ?? STATUT_BADGES['brouillon']!;
  const isBrouillon = facture.statut === 'brouillon';
  const isValidee = facture.statut === 'validee';

  const articleOptions = (articlesList ?? []).map((a) => ({
    value: a.id,
    label: `${a.nom} — ${parseFloat(a.prixUnitaire).toLocaleString('fr-FR')} FCFA/${a.unite}`,
  }));

  function handleAddLigne() {
    if (!selectedArticleId) return;
    const qty = parseFloat(quantite);
    if (isNaN(qty) || qty <= 0) return;
    addLigneMutation.mutate({
      factureId,
      articleId: selectedArticleId,
      quantite: qty,
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Facture {facture.reference}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {facture.patient?.nom} {facture.patient?.prenom} | {facture.dateFacture}
            {facture.session && (
              <> | <Link href={`/seances/${facture.session.id}`} className="text-blue-600 hover:underline dark:text-blue-400">Seance du {facture.session.dateSeance}</Link></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>

          {isBrouillon && (
            <Button
              onClick={() => validerMutation.mutate({ factureId })}
              disabled={validerMutation.isPending}
            >
              Valider
            </Button>
          )}

          {isValidee && (
            <div className="flex items-center gap-2">
              <Select
                options={MODE_PAIEMENT_OPTIONS}
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value)}
              />
              <Button
                onClick={() =>
                  paiementMutation.mutate({
                    factureId,
                    modePaiement: modePaiement as 'especes' | 'cheque' | 'virement' | 'mobile_money',
                  })
                }
                disabled={paiementMutation.isPending}
              >
                Enregistrer le paiement
              </Button>
            </div>
          )}

          {(isBrouillon || isValidee) && (
            <Button
              variant="danger"
              onClick={() => annulerMutation.mutate({ factureId })}
              disabled={annulerMutation.isPending}
            >
              Annuler
            </Button>
          )}
        </div>
      </div>

      {/* Error messages */}
      {(validerMutation.error || paiementMutation.error || annulerMutation.error) && (
        <Card className="mb-4 border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">
            {validerMutation.error?.message || paiementMutation.error?.message || annulerMutation.error?.message}
          </p>
        </Card>
      )}

      {/* Montants */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Montant base (forfait)</p>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {parseFloat(facture.montantBase).toLocaleString('fr-FR')} FCFA
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Supplements</p>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {parseFloat(facture.montantSupplements).toLocaleString('fr-FR')} FCFA
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</p>
          <p className="mt-1 text-xl font-bold text-green-700 dark:text-green-300">
            {parseFloat(facture.montantTotal).toLocaleString('fr-FR')} FCFA
          </p>
        </Card>
      </div>

      {/* Payment info */}
      {facture.statut === 'payee' && facture.modePaiement && (
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Mode de paiement</p>
              <p className="text-gray-900 dark:text-white">
                {MODE_PAIEMENT_OPTIONS.find((o) => o.value === facture.modePaiement)?.label ?? facture.modePaiement}
              </p>
            </div>
            {facture.datePaiement && (
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Date de paiement</p>
                <p className="text-gray-900 dark:text-white">
                  {new Date(facture.datePaiement).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Lignes table */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Lignes de facturation
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Designation</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Quantite</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Prix unitaire</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Montant</th>
                {isBrouillon && (
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {facture.lignes.map((ligne) => (
                <tr key={ligne.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {ligne.designation}
                    {ligne.articleId === null && (
                      <Badge variant="info" className="ml-2">Forfait</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {parseFloat(ligne.quantite)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {parseFloat(ligne.prixUnitaire).toLocaleString('fr-FR')} FCFA
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {parseFloat(ligne.montant).toLocaleString('fr-FR')} FCFA
                  </td>
                  {isBrouillon && (
                    <td className="px-4 py-3">
                      {ligne.articleId !== null && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => removeLigneMutation.mutate({ ligneId: ligne.id })}
                          disabled={removeLigneMutation.isPending}
                        >
                          Supprimer
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add supplement form — only for brouillon */}
        {isBrouillon && (
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Ajouter un supplement
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[300px] flex-1">
                <Select
                  label="Article"
                  options={articleOptions}
                  value={selectedArticleId}
                  onChange={(e) => setSelectedArticleId(e.target.value)}
                  placeholder="Selectionner un article"
                />
              </div>
              <div className="w-24">
                <Input
                  label="Quantite"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                />
              </div>
              <Button
                onClick={handleAddLigne}
                disabled={addLigneMutation.isPending || !selectedArticleId}
              >
                Ajouter
              </Button>
            </div>
            {addLigneMutation.error && (
              <p className="mt-2 text-sm text-red-500">{addLigneMutation.error.message}</p>
            )}
          </div>
        )}
      </Card>

      {/* Notes */}
      {facture.notes && (
        <Card className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Notes</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{facture.notes}</p>
        </Card>
      )}

      {/* Created by */}
      {facture.createdByUser && (
        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          Creee par {facture.createdByUser.prenom} {facture.createdByUser.nom} le{' '}
          {new Date(facture.createdAt).toLocaleDateString('fr-FR')}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create facture detail page**

Create `nephrosys/src/app/(dashboard)/facturation/[id]/page.tsx`:

```typescript
'use client';

import { use } from 'react';
import { FactureDetail } from '@/components/facturation/facture-detail';

export default function FactureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <FactureDetail factureId={id} />;
}
```

- [ ] **Step 3: Verify**

```bash
cd nephrosys && pnpm tsc --noEmit
```

---

### Task 7: Facture button on session detail page + tarifs config UI

**Files:**
- Modify: `nephrosys/src/app/(dashboard)/seances/[id]/page.tsx`
- Create: `nephrosys/src/components/facturation/tarifs-config.tsx`
- Modify: `nephrosys/src/app/(dashboard)/admin/configuration/page.tsx`

**Interfaces:**
- Consumes: `factures.getBySessionId`, `factures.generate`, `factures.tarifsList`, `factures.tarifsUpdate`
- Produces: "Generer la facture" / "Voir la facture" button on session detail page
- Produces: Tarifs configuration widget in admin config page

- [ ] **Step 1: Add facture button to session detail page**

In `nephrosys/src/app/(dashboard)/seances/[id]/page.tsx`, add the facture imports and queries. Add after the existing imports:

```typescript
import Link from 'next/link';
```

Add after the `annulerMutation` declaration:

```typescript
  const { data: factureData } = api.factures.getBySessionId.useQuery(
    { sessionId: id },
    { enabled: !!session && session.statut === 'terminee' },
  );

  const generateFactureMutation = api.factures.generate.useMutation({
    onSuccess: (data) => {
      if (data) {
        window.location.href = `/facturation/${data.id}`;
      }
    },
  });
```

Add after the Annuler button block (after the closing `</Button>` of the annuler button and before the closing `</div>` of the button group), inside the same flex container:

```typescript
          {session.statut === 'terminee' && !factureData && (
            <Button
              variant="secondary"
              onClick={() => generateFactureMutation.mutate({ sessionId: id })}
              disabled={generateFactureMutation.isPending}
            >
              Generer la facture
            </Button>
          )}
          {session.statut === 'terminee' && factureData && (
            <Link href={`/facturation/${factureData.id}`}>
              <Button variant="outline">
                Voir la facture ({factureData.reference})
              </Button>
            </Link>
          )}
```

The full updated button group in the header should be:

```typescript
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
          {session.statut === 'terminee' && !factureData && (
            <Button
              variant="secondary"
              onClick={() => generateFactureMutation.mutate({ sessionId: id })}
              disabled={generateFactureMutation.isPending}
            >
              Generer la facture
            </Button>
          )}
          {session.statut === 'terminee' && factureData && (
            <Link href={`/facturation/${factureData.id}`}>
              <Button variant="outline">
                Voir la facture ({factureData.reference})
              </Button>
            </Link>
          )}
        </div>
```

- [ ] **Step 2: Create TarifsConfig component**

Create `nephrosys/src/components/facturation/tarifs-config.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export function TarifsConfig() {
  const [editId, setEditId] = useState<string | null>(null);
  const [editMontant, setEditMontant] = useState('');

  const utils = api.useUtils();

  const { data: tarifs, isLoading } = api.factures.tarifsList.useQuery();

  const updateMutation = api.factures.tarifsUpdate.useMutation({
    onSuccess: () => {
      utils.factures.tarifsList.invalidate();
      setEditId(null);
      setEditMontant('');
    },
  });

  function handleSave(id: string) {
    const montant = parseFloat(editMontant);
    if (isNaN(montant) || montant <= 0) return;
    updateMutation.mutate({ id, montant });
  }

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Tarifs de base
      </h2>
      <div className="space-y-3">
        {tarifs?.map((tarif) => (
          <div
            key={tarif.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
          >
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{tarif.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Code: {tarif.code}</p>
            </div>
            {editId === tarif.id ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={editMontant}
                  onChange={(e) => setEditMontant(e.target.value)}
                  className="w-32"
                />
                <Button size="sm" onClick={() => handleSave(tarif.id)} disabled={updateMutation.isPending}>
                  OK
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                  Annuler
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 dark:text-white">
                  {parseFloat(tarif.montant).toLocaleString('fr-FR')} FCFA
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditId(tarif.id);
                    setEditMontant(tarif.montant);
                  }}
                >
                  Modifier
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {updateMutation.error && (
        <p className="mt-2 text-sm text-red-500">{updateMutation.error.message}</p>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Add TarifsConfig to admin configuration page**

Read the current admin configuration page first, then add the TarifsConfig component. In `nephrosys/src/app/(dashboard)/admin/configuration/page.tsx`, import and render TarifsConfig alongside existing content.

Add at the top of the file:

```typescript
import { TarifsConfig } from '@/components/facturation/tarifs-config';
```

Add the `<TarifsConfig />` component below the existing configuration content (e.g., seuils cliniques section). The exact insertion point depends on the current page layout, but it should be rendered as an additional section:

```typescript
<div className="mt-6">
  <TarifsConfig />
</div>
```

- [ ] **Step 4: Verify**

```bash
cd nephrosys && pnpm tsc --noEmit
```

---

### Task 8: Dashboard Router (4 role-based stat procedures)

**Files:**
- Create: `nephrosys/src/server/trpc/routers/dashboard.router.ts`
- Modify: `nephrosys/src/server/trpc/router.ts`

**Interfaces:**
- Consumes: `dialysisSessions`, `patients`, `factures`, `bilans`, `postesDialyse`, `vitalSigns`, `lignesFacture`, `articles`
- Produces: `dashboardRouter` with `adminStats`, `medecinStats`, `infirmiereStats`, `secretaireStats`

- [ ] **Step 1: Create dashboard router**

Create `nephrosys/src/server/trpc/routers/dashboard.router.ts`:

```typescript
import { router, roleProcedure } from '@/server/trpc';
import {
  dialysisSessions,
  patients,
  factures,
  bilans,
  postesDialyse,
  vitalSigns,
  lignesFacture,
  articles,
  seuilsCliniques,
} from '@/server/db/schema';
import { eq, and, gte, lte, count, desc, sql, ne, isNotNull } from 'drizzle-orm';

export const dashboardRouter = router({
  adminStats: roleProcedure(['admin', 'facturation'])
    .query(async ({ ctx }) => {
      const now = new Date();
      const today = now.toISOString().split('T')[0]!;

      // Start of week (Monday)
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - diffToMonday);
      const weekStart = startOfWeek.toISOString().split('T')[0]!;

      // Start of month
      const monthStart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;

      // CA jour/semaine/mois
      const [caJour] = await ctx.db
        .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
        .from(factures)
        .where(and(eq(factures.dateFacture, today), eq(factures.statut, 'payee')));

      const [caSemaine] = await ctx.db
        .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
        .from(factures)
        .where(and(gte(factures.dateFacture, weekStart), eq(factures.statut, 'payee')));

      const [caMois] = await ctx.db
        .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
        .from(factures)
        .where(and(gte(factures.dateFacture, monthStart), eq(factures.statut, 'payee')));

      // Seances aujourd'hui par statut
      const seancesAujourdhui = await ctx.db
        .select({ statut: dialysisSessions.statut, count: count() })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.dateSeance, today))
        .groupBy(dialysisSessions.statut);

      // Taux d'occupation postes
      const [postesActifs] = await ctx.db
        .select({ total: count() })
        .from(postesDialyse)
        .where(eq(postesDialyse.isActive, true));

      const [seancesTotal] = await ctx.db
        .select({ total: count() })
        .from(dialysisSessions)
        .where(and(
          eq(dialysisSessions.dateSeance, today),
          ne(dialysisSessions.statut, 'annulee'),
        ));

      const nbPostesActifs = postesActifs?.total ?? 0;
      const nbSeancesJour = seancesTotal?.total ?? 0;
      const capaciteTotale = nbPostesActifs * 2; // 2 vacations
      const tauxOccupation = capaciteTotale > 0 ? Math.round((nbSeancesJour / capaciteTotale) * 100) : 0;

      // Factures impayees
      const [impaye] = await ctx.db
        .select({
          total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)`,
          count: count(),
        })
        .from(factures)
        .where(eq(factures.statut, 'validee'));

      // Top 5 articles factures ce mois
      const topArticles = await ctx.db
        .select({
          articleId: lignesFacture.articleId,
          designation: lignesFacture.designation,
          totalQuantite: sql<string>`SUM(${lignesFacture.quantite}::numeric)`,
          totalMontant: sql<string>`SUM(${lignesFacture.montant}::numeric)`,
        })
        .from(lignesFacture)
        .innerJoin(factures, eq(lignesFacture.factureId, factures.id))
        .where(and(
          isNotNull(lignesFacture.articleId),
          gte(factures.dateFacture, monthStart),
          ne(factures.statut, 'annulee'),
        ))
        .groupBy(lignesFacture.articleId, lignesFacture.designation)
        .orderBy(sql`SUM(${lignesFacture.montant}::numeric) DESC`)
        .limit(5);

      return {
        ca: {
          jour: parseFloat(caJour?.total ?? '0'),
          semaine: parseFloat(caSemaine?.total ?? '0'),
          mois: parseFloat(caMois?.total ?? '0'),
        },
        seancesAujourdhui: seancesAujourdhui.reduce(
          (acc, row) => ({ ...acc, [row.statut]: row.count }),
          {} as Record<string, number>,
        ),
        tauxOccupation,
        impaye: {
          montant: parseFloat(impaye?.total ?? '0'),
          count: impaye?.count ?? 0,
        },
        topArticles: topArticles.map((a) => ({
          designation: a.designation,
          totalQuantite: parseFloat(a.totalQuantite ?? '0'),
          totalMontant: parseFloat(a.totalMontant ?? '0'),
        })),
      };
    }),

  medecinStats: roleProcedure(['medecin'])
    .query(async ({ ctx }) => {
      const now = new Date();
      const today = now.toISOString().split('T')[0]!;
      const userId = ctx.session.user.id;

      // Mes seances du jour
      const mesSeances = await ctx.db
        .select({
          session: dialysisSessions,
          patient: { id: patients.id, nom: patients.nom, prenom: patients.prenom },
        })
        .from(dialysisSessions)
        .innerJoin(patients, eq(dialysisSessions.patientId, patients.id))
        .where(and(
          eq(dialysisSessions.dateSeance, today),
          eq(dialysisSessions.physicianId, userId),
        ))
        .orderBy(dialysisSessions.createdAt);

      // Patients avec Kt/V inadequat (3 dernieres seances toutes inadequate)
      // Step 1: get distinct patients with at least 3 terminee sessions
      const patientsAvecSeances = await ctx.db
        .select({
          patientId: dialysisSessions.patientId,
        })
        .from(dialysisSessions)
        .where(and(
          eq(dialysisSessions.physicianId, userId),
          eq(dialysisSessions.statut, 'terminee'),
          isNotNull(dialysisSessions.ktvStatus),
        ))
        .groupBy(dialysisSessions.patientId)
        .having(sql`COUNT(*) >= 3`);

      const patientsKtvInadequat: { patientId: string; nom: string; prenom: string }[] = [];

      for (const { patientId } of patientsAvecSeances) {
        const lastThree = await ctx.db
          .select({ ktvStatus: dialysisSessions.ktvStatus })
          .from(dialysisSessions)
          .where(and(
            eq(dialysisSessions.patientId, patientId),
            eq(dialysisSessions.statut, 'terminee'),
            isNotNull(dialysisSessions.ktvStatus),
          ))
          .orderBy(desc(dialysisSessions.dateSeance))
          .limit(3);

        if (lastThree.length === 3 && lastThree.every((s) => s.ktvStatus === 'inadequate')) {
          const [patient] = await ctx.db
            .select({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
            .from(patients)
            .where(eq(patients.id, patientId))
            .limit(1);
          if (patient) {
            patientsKtvInadequat.push(patient);
          }
        }
      }

      // Bilans hors seuils
      const bilansHorsSeuils = await ctx.db
        .select({
          bilanId: bilans.id,
          reference: bilans.reference,
          patientNom: patients.nom,
          patientPrenom: patients.prenom,
        })
        .from(bilans)
        .innerJoin(patients, eq(bilans.patientId, patients.id))
        .where(and(
          eq(bilans.physicianId, userId),
          sql`(
            ${bilans.hbStatut} IN ('low', 'high') OR
            ${bilans.potassiumStatut} IN ('low', 'high') OR
            ${bilans.phosphoreStatut} IN ('low', 'high') OR
            ${bilans.albumineStatut} IN ('low', 'high') OR
            ${bilans.pthStatut} IN ('low', 'high') OR
            ${bilans.caPStatut} IN ('low', 'high')
          )`,
        ))
        .orderBy(desc(bilans.dateBilan))
        .limit(10);

      // Taux d'adequation Kt/V global
      const [ktvStats] = await ctx.db
        .select({
          total: count(),
          adequate: sql<number>`SUM(CASE WHEN ${dialysisSessions.ktvStatus} = 'adequate' THEN 1 ELSE 0 END)`,
        })
        .from(dialysisSessions)
        .where(and(
          eq(dialysisSessions.physicianId, userId),
          eq(dialysisSessions.statut, 'terminee'),
          isNotNull(dialysisSessions.ktvStatus),
        ));

      const ktvTotal = ktvStats?.total ?? 0;
      const ktvAdequate = Number(ktvStats?.adequate ?? 0);
      const tauxAdequation = ktvTotal > 0 ? Math.round((ktvAdequate / ktvTotal) * 100) : 0;

      return {
        mesSeances: mesSeances.map(({ session, patient }) => ({
          id: session.id,
          dateSeance: session.dateSeance,
          statut: session.statut,
          patient,
        })),
        patientsKtvInadequat,
        bilansHorsSeuils: bilansHorsSeuils.map((b) => ({
          id: b.bilanId,
          reference: b.reference,
          patient: `${b.patientNom} ${b.patientPrenom}`,
        })),
        nbBilansHorsSeuils: bilansHorsSeuils.length,
        tauxAdequation,
      };
    }),

  infirmiereStats: roleProcedure(['infirmiere'])
    .query(async ({ ctx }) => {
      const now = new Date();
      const today = now.toISOString().split('T')[0]!;
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0]!;
      const userId = ctx.session.user.id;

      // Seances du jour (mes patients)
      const seancesJour = await ctx.db
        .select({
          session: {
            id: dialysisSessions.id,
            dateSeance: dialysisSessions.dateSeance,
            statut: dialysisSessions.statut,
          },
          patient: { id: patients.id, nom: patients.nom, prenom: patients.prenom },
        })
        .from(dialysisSessions)
        .innerJoin(patients, eq(dialysisSessions.patientId, patients.id))
        .where(and(
          eq(dialysisSessions.dateSeance, today),
          eq(dialysisSessions.nurseId, userId),
        ))
        .orderBy(dialysisSessions.createdAt);

      // Seances en cours necessitant constantes (derniere constante > 30 min)
      const seancesEnCours = await ctx.db
        .select({
          sessionId: dialysisSessions.id,
          patientNom: patients.nom,
          patientPrenom: patients.prenom,
        })
        .from(dialysisSessions)
        .innerJoin(patients, eq(dialysisSessions.patientId, patients.id))
        .where(and(
          eq(dialysisSessions.statut, 'en_cours'),
          eq(dialysisSessions.nurseId, userId),
        ));

      const seancesNeedingVitals: { sessionId: string; patient: string }[] = [];
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

      for (const s of seancesEnCours) {
        const [lastVital] = await ctx.db
          .select({ heureMesure: vitalSigns.heureMesure })
          .from(vitalSigns)
          .where(eq(vitalSigns.sessionId, s.sessionId))
          .orderBy(desc(vitalSigns.heureMesure))
          .limit(1);

        if (!lastVital || new Date(lastVital.heureMesure) < thirtyMinAgo) {
          seancesNeedingVitals.push({
            sessionId: s.sessionId,
            patient: `${s.patientNom} ${s.patientPrenom}`,
          });
        }
      }

      // Prochaines seances (aujourd'hui + demain) planifiees
      const prochaines = await ctx.db
        .select({
          session: {
            id: dialysisSessions.id,
            dateSeance: dialysisSessions.dateSeance,
            statut: dialysisSessions.statut,
          },
          patient: { id: patients.id, nom: patients.nom, prenom: patients.prenom },
        })
        .from(dialysisSessions)
        .innerJoin(patients, eq(dialysisSessions.patientId, patients.id))
        .where(and(
          sql`${dialysisSessions.dateSeance} IN (${today}, ${tomorrowStr})`,
          eq(dialysisSessions.statut, 'planifiee'),
          eq(dialysisSessions.nurseId, userId),
        ))
        .orderBy(dialysisSessions.dateSeance);

      return {
        seancesJour: seancesJour.map(({ session, patient }) => ({
          id: session.id,
          dateSeance: session.dateSeance,
          statut: session.statut,
          patient,
        })),
        seancesNeedingVitals,
        prochaines: prochaines.map(({ session, patient }) => ({
          id: session.id,
          dateSeance: session.dateSeance,
          patient,
        })),
      };
    }),

  secretaireStats: roleProcedure(['secretaire'])
    .query(async ({ ctx }) => {
      const now = new Date();
      const today = now.toISOString().split('T')[0]!;
      const monthStart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;

      // Start of week (Monday)
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - diffToMonday);
      const weekStart = startOfWeek.toISOString().split('T')[0]!;
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      const weekEnd = endOfWeek.toISOString().split('T')[0]!;

      // Seances du jour (vue d'ensemble)
      const seancesJour = await ctx.db
        .select({
          statut: dialysisSessions.statut,
          count: count(),
        })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.dateSeance, today))
        .groupBy(dialysisSessions.statut);

      // Patients actifs sans seance cette semaine
      const patientsActifs = await ctx.db
        .select({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
        .from(patients)
        .where(eq(patients.statut, 'actif'));

      const patientsSansSeance: { id: string; nom: string; prenom: string }[] = [];

      for (const patient of patientsActifs) {
        const [seanceCetteSemaine] = await ctx.db
          .select({ id: dialysisSessions.id })
          .from(dialysisSessions)
          .where(and(
            eq(dialysisSessions.patientId, patient.id),
            gte(dialysisSessions.dateSeance, weekStart),
            lte(dialysisSessions.dateSeance, weekEnd),
            ne(dialysisSessions.statut, 'annulee'),
          ))
          .limit(1);

        if (!seanceCetteSemaine) {
          patientsSansSeance.push(patient);
        }
      }

      // Nb nouveaux patients ce mois
      const [nouveauxPatients] = await ctx.db
        .select({ total: count() })
        .from(patients)
        .where(gte(patients.createdAt, new Date(monthStart)));

      return {
        seancesJour: seancesJour.reduce(
          (acc, row) => ({ ...acc, [row.statut]: row.count }),
          {} as Record<string, number>,
        ),
        patientsSansSeance,
        nbNouveauxPatientsMois: nouveauxPatients?.total ?? 0,
      };
    }),
});
```

- [ ] **Step 2: Register dashboard router**

In `nephrosys/src/server/trpc/router.ts`, add the dashboard import and registration. The final router.ts should be:

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
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Verify**

```bash
cd nephrosys && pnpm tsc --noEmit
```

---

### Task 9: Dashboard UI (4 role-specific components, replace placeholder page)

**Files:**
- Create: `nephrosys/src/components/dashboard/stat-card.tsx`
- Create: `nephrosys/src/components/dashboard/admin-dashboard.tsx`
- Create: `nephrosys/src/components/dashboard/medecin-dashboard.tsx`
- Create: `nephrosys/src/components/dashboard/infirmiere-dashboard.tsx`
- Create: `nephrosys/src/components/dashboard/secretaire-dashboard.tsx`
- Modify: `nephrosys/src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `dashboard.adminStats`, `dashboard.medecinStats`, `dashboard.infirmiereStats`, `dashboard.secretaireStats`
- Produces: Role-aware dashboard page at `/`

- [ ] **Step 1: Create StatCard component**

Create `nephrosys/src/components/dashboard/stat-card.tsx`:

```typescript
import { Card } from '@/components/ui/card';

type StatCardProps = {
  label: string;
  value: string | number;
  colorText?: string;
  subtitle?: string;
  href?: string;
};

export function StatCard({ label, value, colorText = 'text-gray-900 dark:text-white', subtitle }: StatCardProps) {
  return (
    <Card>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colorText}`}>{value}</p>
      {subtitle && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Create AdminDashboard component**

Create `nephrosys/src/components/dashboard/admin-dashboard.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './stat-card';

export function AdminDashboard() {
  const { data, isLoading } = api.dashboard.adminStats.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const totalSeances =
    Object.values(data.seancesAujourdhui).reduce((sum, n) => sum + n, 0);

  return (
    <div className="space-y-6">
      {/* CA row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="CA du jour"
          value={`${data.ca.jour.toLocaleString('fr-FR')} FCFA`}
          colorText="text-green-700 dark:text-green-300"
        />
        <StatCard
          label="CA de la semaine"
          value={`${data.ca.semaine.toLocaleString('fr-FR')} FCFA`}
          colorText="text-blue-700 dark:text-blue-300"
        />
        <StatCard
          label="CA du mois"
          value={`${data.ca.mois.toLocaleString('fr-FR')} FCFA`}
          colorText="text-blue-700 dark:text-blue-300"
        />
        <StatCard
          label="Impaye"
          value={`${data.impaye.montant.toLocaleString('fr-FR')} FCFA`}
          colorText="text-red-700 dark:text-red-300"
          subtitle={`${data.impaye.count} facture(s)`}
        />
      </div>

      {/* Activity row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Seances aujourd'hui"
          value={totalSeances}
          colorText="text-blue-700 dark:text-blue-300"
          subtitle={
            Object.entries(data.seancesAujourdhui)
              .map(([s, n]) => `${s}: ${n}`)
              .join(', ') || 'Aucune'
          }
        />
        <StatCard
          label="Taux d'occupation"
          value={`${data.tauxOccupation}%`}
          colorText={
            data.tauxOccupation >= 80
              ? 'text-green-700 dark:text-green-300'
              : data.tauxOccupation >= 50
                ? 'text-orange-700 dark:text-orange-300'
                : 'text-red-700 dark:text-red-300'
          }
        />
      </div>

      {/* Top articles */}
      {data.topArticles.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Top 5 articles factures ce mois
          </h3>
          <div className="space-y-2">
            {data.topArticles.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-2 dark:border-gray-800"
              >
                <span className="text-sm text-gray-900 dark:text-white">{a.designation}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Qty: {a.totalQuantite}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {a.totalMontant.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create MedecinDashboard component**

Create `nephrosys/src/components/dashboard/medecin-dashboard.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './stat-card';

const STATUT_BADGES: Record<string, { variant: 'default' | 'info' | 'success' | 'warning' | 'danger'; label: string }> = {
  planifiee: { variant: 'info', label: 'Planifiee' },
  en_cours: { variant: 'warning', label: 'En cours' },
  terminee: { variant: 'success', label: 'Terminee' },
  annulee: { variant: 'danger', label: 'Annulee' },
};

export function MedecinDashboard() {
  const { data, isLoading } = api.dashboard.medecinStats.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Mes seances du jour"
          value={data.mesSeances.length}
          colorText="text-blue-700 dark:text-blue-300"
        />
        <StatCard
          label="Taux d'adequation Kt/V"
          value={`${data.tauxAdequation}%`}
          colorText={
            data.tauxAdequation >= 80
              ? 'text-green-700 dark:text-green-300'
              : data.tauxAdequation >= 60
                ? 'text-orange-700 dark:text-orange-300'
                : 'text-red-700 dark:text-red-300'
          }
        />
        <StatCard
          label="Bilans hors seuils"
          value={data.nbBilansHorsSeuils}
          colorText={data.nbBilansHorsSeuils > 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}
        />
      </div>

      {/* Mes seances du jour */}
      <Card>
        <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Mes seances du jour
        </h3>
        {data.mesSeances.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Aucune seance aujourd&apos;hui</p>
        ) : (
          <div className="space-y-2">
            {data.mesSeances.map((s) => {
              const badge = STATUT_BADGES[s.statut] ?? STATUT_BADGES['planifiee']!;
              return (
                <Link
                  key={s.id}
                  href={`/seances/${s.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                >
                  <span className="text-sm text-gray-900 dark:text-white">
                    {s.patient.nom} {s.patient.prenom}
                  </span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Patients Kt/V inadequat */}
      {data.patientsKtvInadequat.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-red-700 dark:text-red-300">
            Patients Kt/V inadequat (3 dernieres seances)
          </h3>
          <div className="space-y-2">
            {data.patientsKtvInadequat.map((p) => (
              <Link
                key={p.patientId}
                href={`/patients/${p.patientId}`}
                className="block rounded-lg border border-red-100 p-3 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
              >
                <span className="text-sm text-gray-900 dark:text-white">
                  {p.nom} {p.prenom}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Bilans hors seuils */}
      {data.bilansHorsSeuils.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-orange-700 dark:text-orange-300">
            Bilans hors seuils
          </h3>
          <div className="space-y-2">
            {data.bilansHorsSeuils.map((b) => (
              <Link
                key={b.id}
                href={`/bilans/${b.id}`}
                className="flex items-center justify-between rounded-lg border border-orange-100 p-3 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-950"
              >
                <span className="text-sm text-gray-900 dark:text-white">{b.patient}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{b.reference}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create InfirmiereDashboard component**

Create `nephrosys/src/components/dashboard/infirmiere-dashboard.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './stat-card';

const STATUT_BADGES: Record<string, { variant: 'default' | 'info' | 'success' | 'warning' | 'danger'; label: string }> = {
  planifiee: { variant: 'info', label: 'Planifiee' },
  en_cours: { variant: 'warning', label: 'En cours' },
  terminee: { variant: 'success', label: 'Terminee' },
  annulee: { variant: 'danger', label: 'Annulee' },
};

export function InfirmiereDashboard() {
  const { data, isLoading } = api.dashboard.infirmiereStats.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Seances du jour"
          value={data.seancesJour.length}
          colorText="text-blue-700 dark:text-blue-300"
        />
        <StatCard
          label="Constantes a prendre"
          value={data.seancesNeedingVitals.length}
          colorText={
            data.seancesNeedingVitals.length > 0
              ? 'text-orange-700 dark:text-orange-300'
              : 'text-green-700 dark:text-green-300'
          }
        />
        <StatCard
          label="Seances planifiees a venir"
          value={data.prochaines.length}
          colorText="text-gray-700 dark:text-gray-300"
        />
      </div>

      {/* Seances necessitant constantes */}
      {data.seancesNeedingVitals.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-orange-700 dark:text-orange-300">
            Seances necessitant des constantes
          </h3>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            Derniere prise de constantes il y a plus de 30 minutes
          </p>
          <div className="space-y-2">
            {data.seancesNeedingVitals.map((s) => (
              <Link
                key={s.sessionId}
                href={`/seances/${s.sessionId}`}
                className="block rounded-lg border border-orange-100 p-3 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-950"
              >
                <span className="text-sm text-gray-900 dark:text-white">{s.patient}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Seances du jour */}
      <Card>
        <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Mes seances du jour
        </h3>
        {data.seancesJour.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Aucune seance aujourd&apos;hui</p>
        ) : (
          <div className="space-y-2">
            {data.seancesJour.map((s) => {
              const badge = STATUT_BADGES[s.statut] ?? STATUT_BADGES['planifiee']!;
              return (
                <Link
                  key={s.id}
                  href={`/seances/${s.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                >
                  <span className="text-sm text-gray-900 dark:text-white">
                    {s.patient.nom} {s.patient.prenom}
                  </span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Prochaines seances */}
      {data.prochaines.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Prochaines seances planifiees
          </h3>
          <div className="space-y-2">
            {data.prochaines.map((s) => (
              <Link
                key={s.id}
                href={`/seances/${s.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
              >
                <span className="text-sm text-gray-900 dark:text-white">
                  {s.patient.nom} {s.patient.prenom}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{s.dateSeance}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create SecretaireDashboard component**

Create `nephrosys/src/components/dashboard/secretaire-dashboard.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './stat-card';

export function SecretaireDashboard() {
  const { data, isLoading } = api.dashboard.secretaireStats.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const totalSeances = Object.values(data.seancesJour).reduce((sum, n) => sum + n, 0);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Seances du jour"
          value={totalSeances}
          colorText="text-blue-700 dark:text-blue-300"
          subtitle={
            Object.entries(data.seancesJour)
              .map(([s, n]) => `${s}: ${n}`)
              .join(', ') || 'Aucune'
          }
        />
        <StatCard
          label="Patients sans seance cette semaine"
          value={data.patientsSansSeance.length}
          colorText={
            data.patientsSansSeance.length > 0
              ? 'text-orange-700 dark:text-orange-300'
              : 'text-green-700 dark:text-green-300'
          }
        />
        <StatCard
          label="Nouveaux patients ce mois"
          value={data.nbNouveauxPatientsMois}
          colorText="text-blue-700 dark:text-blue-300"
        />
      </div>

      {/* Patients sans seance */}
      {data.patientsSansSeance.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-orange-700 dark:text-orange-300">
            Patients sans seance cette semaine
          </h3>
          <div className="space-y-2">
            {data.patientsSansSeance.map((p) => (
              <Link
                key={p.id}
                href={`/patients/${p.id}`}
                className="block rounded-lg border border-orange-100 p-3 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-950"
              >
                <span className="text-sm text-gray-900 dark:text-white">
                  {p.nom} {p.prenom}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Replace dashboard page**

Replace `nephrosys/src/app/(dashboard)/page.tsx` with the role-aware version:

```typescript
import { auth } from '@/server/auth';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Tableau de bord
      </h1>
      <p className="mt-2 mb-6 text-gray-500 dark:text-gray-400">
        Bienvenue, {user.prenom} {user.nom}
      </p>

      <DashboardClient role={user.role} />
    </div>
  );
}
```

- [ ] **Step 7: Create DashboardClient wrapper component**

Create `nephrosys/src/components/dashboard/dashboard-client.tsx`:

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

- [ ] **Step 8: Verify**

```bash
cd nephrosys && pnpm tsc --noEmit
```

---

### Task 10: Reports PDF

**Files:**
- Create: `nephrosys/src/app/api/reports/patient/[id]/route.ts`
- Create: `nephrosys/src/app/api/reports/monthly/[month]/route.ts`
- Create: `nephrosys/src/components/reports/export-pdf-button.tsx`
- Modify: `nephrosys/src/app/(dashboard)/patients/[id]/page.tsx`
- Create: `nephrosys/src/app/(dashboard)/admin/rapports/page.tsx`

**Interfaces:**
- Consumes: `patients`, `dialysisSessions`, `bilans`, `factures`, `postesDialyse` tables (direct DB access in API routes)
- Produces: PDF generation API routes, "Exporter PDF" button on patient detail, admin reports page

- [ ] **Step 1: Install @react-pdf/renderer**

```bash
cd nephrosys && pnpm add @react-pdf/renderer
```

- [ ] **Step 2: Create patient report API route**

Create `nephrosys/src/app/api/reports/patient/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { patients, dialysisSessions, bilans, postesDialyse, seuilsCliniques } from '@/server/db/schema';
import { eq, desc, and, isNotNull } from 'drizzle-orm';
import ReactPDF from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import React from 'react';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
    borderBottom: '1 solid #333',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  label: {
    width: '40%',
    color: '#555',
  },
  value: {
    width: '60%',
    fontWeight: 'bold',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#333',
    color: '#fff',
    padding: 5,
    fontSize: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #ddd',
    padding: 4,
    fontSize: 8,
  },
  tableCell: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
});

type PatientReportProps = {
  patient: {
    nom: string;
    prenom: string;
    dateNaissance: string | null;
    groupeSanguin: string | null;
    nephropathie: string | null;
    poidsSecKg: string | null;
  };
  sessions: {
    dateSeance: string;
    posteNom: string;
    dureeReelle: number | null;
    ktvCalculated: string | null;
    urrCalculated: string | null;
    arrivalWeight: string | null;
    departureWeight: string | null;
    toleranceGlobale: string | null;
  }[];
  bilan: Record<string, unknown> | null;
  seuils: Map<string, { seuilBas: number | null; seuilHaut: number | null }>;
  ktvHistory: { date: string; ktv: string }[];
};

function PatientReport({ patient, sessions, bilan, seuils, ktvHistory }: PatientReportProps) {
  const now = new Date().toLocaleDateString('fr-FR');

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, 'NephroSys — Fiche Patient'),
        React.createElement(Text, { style: styles.subtitle }, `Genere le ${now}`),
      ),
      // Patient info
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Informations patient'),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Nom complet'),
          React.createElement(Text, { style: styles.value }, `${patient.prenom} ${patient.nom}`),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Date de naissance'),
          React.createElement(Text, { style: styles.value }, patient.dateNaissance ?? 'Non renseignee'),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Groupe sanguin'),
          React.createElement(Text, { style: styles.value }, patient.groupeSanguin ?? 'Non renseigne'),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Nephropathie initiale'),
          React.createElement(Text, { style: styles.value }, patient.nephropathie ?? 'Non renseignee'),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Poids sec'),
          React.createElement(Text, { style: styles.value }, patient.poidsSecKg ? `${patient.poidsSecKg} kg` : 'Non renseigne'),
        ),
      ),
      // Last 10 sessions table
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, '10 dernieres seances'),
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: styles.tableCell }, 'Date'),
          React.createElement(Text, { style: styles.tableCell }, 'Poste'),
          React.createElement(Text, { style: styles.tableCell }, 'Duree'),
          React.createElement(Text, { style: styles.tableCell }, 'Kt/V'),
          React.createElement(Text, { style: styles.tableCell }, 'URR'),
          React.createElement(Text, { style: styles.tableCell }, 'Poids arr.'),
          React.createElement(Text, { style: styles.tableCell }, 'Poids dep.'),
          React.createElement(Text, { style: styles.tableCell }, 'Tolerance'),
        ),
        ...sessions.map((s, i) =>
          React.createElement(
            View,
            { key: i, style: styles.tableRow },
            React.createElement(Text, { style: styles.tableCell }, s.dateSeance),
            React.createElement(Text, { style: styles.tableCell }, s.posteNom),
            React.createElement(Text, { style: styles.tableCell }, s.dureeReelle ? `${s.dureeReelle}min` : '-'),
            React.createElement(Text, { style: styles.tableCell }, s.ktvCalculated ?? '-'),
            React.createElement(Text, { style: styles.tableCell }, s.urrCalculated ? `${s.urrCalculated}%` : '-'),
            React.createElement(Text, { style: styles.tableCell }, s.arrivalWeight ? `${s.arrivalWeight}kg` : '-'),
            React.createElement(Text, { style: styles.tableCell }, s.departureWeight ? `${s.departureWeight}kg` : '-'),
            React.createElement(Text, { style: styles.tableCell }, s.toleranceGlobale ?? '-'),
          ),
        ),
      ),
      // Kt/V evolution
      ktvHistory.length > 0
        ? React.createElement(
            View,
            { style: styles.section },
            React.createElement(Text, { style: styles.sectionTitle }, 'Evolution Kt/V (10 derniers)'),
            ...ktvHistory.map((k, i) =>
              React.createElement(
                View,
                { key: i, style: styles.row },
                React.createElement(Text, { style: styles.label }, k.date),
                React.createElement(Text, { style: styles.value }, k.ktv),
              ),
            ),
          )
        : null,
      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(Text, null, 'NephroSys — Document genere automatiquement — Confidentiel'),
      ),
    ),
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const role = session.user.role;
  if (!['admin', 'medecin', 'secretaire'].includes(role)) {
    return NextResponse.json({ error: 'Acces interdit' }, { status: 403 });
  }

  const { id } = await params;

  // Get patient
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, id))
    .limit(1);

  if (!patient) {
    return NextResponse.json({ error: 'Patient non trouve' }, { status: 404 });
  }

  // Get last 10 sessions
  const sessionsData = await db
    .select({
      dateSeance: dialysisSessions.dateSeance,
      posteId: dialysisSessions.posteId,
      dureeReelle: dialysisSessions.dureeReelle,
      ktvCalculated: dialysisSessions.ktvCalculated,
      urrCalculated: dialysisSessions.urrCalculated,
      arrivalWeight: dialysisSessions.arrivalWeight,
      departureWeight: dialysisSessions.departureWeight,
      toleranceGlobale: dialysisSessions.toleranceGlobale,
    })
    .from(dialysisSessions)
    .where(and(
      eq(dialysisSessions.patientId, id),
      eq(dialysisSessions.statut, 'terminee'),
    ))
    .orderBy(desc(dialysisSessions.dateSeance))
    .limit(10);

  // Get poste names
  const sessionsMapped = [];
  for (const s of sessionsData) {
    const [poste] = await db
      .select({ nom: postesDialyse.nom })
      .from(postesDialyse)
      .where(eq(postesDialyse.id, s.posteId))
      .limit(1);
    sessionsMapped.push({
      dateSeance: s.dateSeance,
      posteNom: poste?.nom ?? '-',
      dureeReelle: s.dureeReelle,
      ktvCalculated: s.ktvCalculated,
      urrCalculated: s.urrCalculated,
      arrivalWeight: s.arrivalWeight,
      departureWeight: s.departureWeight,
      toleranceGlobale: s.toleranceGlobale,
    });
  }

  // Get last bilan
  const [lastBilan] = await db
    .select()
    .from(bilans)
    .where(eq(bilans.patientId, id))
    .orderBy(desc(bilans.dateBilan))
    .limit(1);

  // Get seuils
  const seuilsRows = await db.select().from(seuilsCliniques);
  const seuilsMap = new Map<string, { seuilBas: number | null; seuilHaut: number | null }>();
  for (const row of seuilsRows) {
    seuilsMap.set(row.parametre, {
      seuilBas: row.seuilBas != null ? parseFloat(row.seuilBas) : null,
      seuilHaut: row.seuilHaut != null ? parseFloat(row.seuilHaut) : null,
    });
  }

  // Kt/V history
  const ktvHistory = await db
    .select({
      dateSeance: dialysisSessions.dateSeance,
      ktvCalculated: dialysisSessions.ktvCalculated,
    })
    .from(dialysisSessions)
    .where(and(
      eq(dialysisSessions.patientId, id),
      eq(dialysisSessions.statut, 'terminee'),
      isNotNull(dialysisSessions.ktvCalculated),
    ))
    .orderBy(desc(dialysisSessions.dateSeance))
    .limit(10);

  const pdfStream = await ReactPDF.renderToStream(
    React.createElement(PatientReport, {
      patient: {
        nom: patient.nom,
        prenom: patient.prenom,
        dateNaissance: patient.dateNaissance,
        groupeSanguin: patient.groupeSanguin,
        nephropathie: patient.nephropathie,
        poidsSecKg: patient.poidsSecKg,
      },
      sessions: sessionsMapped,
      bilan: lastBilan as Record<string, unknown> | null,
      seuils: seuilsMap,
      ktvHistory: ktvHistory.map((k) => ({
        date: k.dateSeance,
        ktv: k.ktvCalculated!,
      })),
    }),
  );

  const chunks: Uint8Array[] = [];
  for await (const chunk of pdfStream) {
    chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
  }
  const buffer = Buffer.concat(chunks);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="patient-${patient.nom}-${patient.prenom}.pdf"`,
    },
  });
}
```

- [ ] **Step 3: Create monthly report API route**

Create `nephrosys/src/app/api/reports/monthly/[month]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { dialysisSessions, patients, factures, postesDialyse } from '@/server/db/schema';
import { eq, and, gte, lte, count, ne, isNotNull, sql } from 'drizzle-orm';
import ReactPDF from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import React from 'react';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
    borderBottom: '1 solid #333',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '50%',
    color: '#555',
  },
  value: {
    width: '50%',
    fontWeight: 'bold',
  },
  bigValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
    marginBottom: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
});

const MOIS_FR = [
  '', 'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

type MonthlyReportProps = {
  mois: string;
  seances: { planifiees: number; realisees: number; annulees: number };
  tauxOccupation: number;
  ca: { payees: number; impayees: number; total: number };
  repartitionPaiement: { mode: string; montant: number }[];
  patientsActifs: number;
  tauxAdequation: number;
};

function MonthlyReport({
  mois,
  seances,
  tauxOccupation,
  ca,
  repartitionPaiement,
  patientsActifs,
  tauxAdequation,
}: MonthlyReportProps) {
  const now = new Date().toLocaleDateString('fr-FR');

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, `Rapport d'activite — ${mois}`),
        React.createElement(Text, { style: styles.subtitle }, `Genere le ${now}`),
      ),
      // Seances
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Seances de dialyse'),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Planifiees'),
          React.createElement(Text, { style: styles.value }, String(seances.planifiees)),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Realisees'),
          React.createElement(Text, { style: styles.value }, String(seances.realisees)),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Annulees'),
          React.createElement(Text, { style: styles.value }, String(seances.annulees)),
        ),
      ),
      // Occupation
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Taux d\'occupation moyen'),
        React.createElement(Text, { style: styles.bigValue }, `${tauxOccupation}%`),
      ),
      // CA
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Chiffre d\'affaires'),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Factures payees'),
          React.createElement(Text, { style: styles.value }, `${ca.payees.toLocaleString('fr-FR')} FCFA`),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Factures impayees'),
          React.createElement(Text, { style: styles.value }, `${ca.impayees.toLocaleString('fr-FR')} FCFA`),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Total'),
          React.createElement(Text, { style: { ...styles.value, fontSize: 14 } }, `${ca.total.toLocaleString('fr-FR')} FCFA`),
        ),
      ),
      // Repartition paiement
      repartitionPaiement.length > 0
        ? React.createElement(
            View,
            { style: styles.section },
            React.createElement(Text, { style: styles.sectionTitle }, 'Repartition par mode de paiement'),
            ...repartitionPaiement.map((r, i) =>
              React.createElement(
                View,
                { key: i, style: styles.row },
                React.createElement(Text, { style: styles.label }, r.mode),
                React.createElement(Text, { style: styles.value }, `${r.montant.toLocaleString('fr-FR')} FCFA`),
              ),
            ),
          )
        : null,
      // Patients actifs
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Patients'),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Patients actifs (au moins 1 seance)'),
          React.createElement(Text, { style: styles.value }, String(patientsActifs)),
        ),
      ),
      // Adequation Kt/V
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Adequation Kt/V'),
        React.createElement(Text, { style: styles.bigValue }, `${tauxAdequation}%`),
      ),
      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(Text, null, 'NephroSys — Document genere automatiquement — Confidentiel'),
      ),
    ),
  );
}

const MODE_LABELS: Record<string, string> = {
  especes: 'Especes',
  cheque: 'Cheque',
  virement: 'Virement',
  mobile_money: 'Mobile Money',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ month: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Acces interdit' }, { status: 403 });
  }

  const { month } = await params;

  // Validate format YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Format invalide. Utiliser YYYY-MM' }, { status: 400 });
  }

  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr!, 10);
  const monthNum = parseInt(monthStr!, 10);
  const moisLabel = `${MOIS_FR[monthNum]} ${year}`;

  const dateDebut = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const dateFin = `${month}-${lastDay.toString().padStart(2, '0')}`;

  // Count seances by status
  const seancesParStatut = await db
    .select({ statut: dialysisSessions.statut, count: count() })
    .from(dialysisSessions)
    .where(and(
      gte(dialysisSessions.dateSeance, dateDebut),
      lte(dialysisSessions.dateSeance, dateFin),
    ))
    .groupBy(dialysisSessions.statut);

  const seancesMap = seancesParStatut.reduce(
    (acc, row) => ({ ...acc, [row.statut]: row.count }),
    {} as Record<string, number>,
  );

  const planifiees = (seancesMap['planifiee'] ?? 0) + (seancesMap['en_cours'] ?? 0) +
    (seancesMap['terminee'] ?? 0) + (seancesMap['annulee'] ?? 0);
  const realisees = seancesMap['terminee'] ?? 0;
  const annulees = seancesMap['annulee'] ?? 0;

  // Taux d'occupation moyen
  const [postesActifs] = await db
    .select({ total: count() })
    .from(postesDialyse)
    .where(eq(postesDialyse.isActive, true));

  const nbPostes = postesActifs?.total ?? 0;
  const nbJoursMois = lastDay;
  const capaciteTotale = nbPostes * 2 * nbJoursMois; // 2 vacations per day

  const [seancesNonAnnulees] = await db
    .select({ total: count() })
    .from(dialysisSessions)
    .where(and(
      gte(dialysisSessions.dateSeance, dateDebut),
      lte(dialysisSessions.dateSeance, dateFin),
      ne(dialysisSessions.statut, 'annulee'),
    ));

  const tauxOccupation = capaciteTotale > 0
    ? Math.round(((seancesNonAnnulees?.total ?? 0) / capaciteTotale) * 100)
    : 0;

  // CA
  const [caPayees] = await db
    .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
    .from(factures)
    .where(and(
      gte(factures.dateFacture, dateDebut),
      lte(factures.dateFacture, dateFin),
      eq(factures.statut, 'payee'),
    ));

  const [caImpayees] = await db
    .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
    .from(factures)
    .where(and(
      gte(factures.dateFacture, dateDebut),
      lte(factures.dateFacture, dateFin),
      eq(factures.statut, 'validee'),
    ));

  const payees = parseFloat(caPayees?.total ?? '0');
  const impayees = parseFloat(caImpayees?.total ?? '0');

  // Repartition par mode de paiement
  const repartition = await db
    .select({
      mode: factures.modePaiement,
      total: sql<string>`SUM(${factures.montantTotal}::numeric)`,
    })
    .from(factures)
    .where(and(
      gte(factures.dateFacture, dateDebut),
      lte(factures.dateFacture, dateFin),
      eq(factures.statut, 'payee'),
      isNotNull(factures.modePaiement),
    ))
    .groupBy(factures.modePaiement);

  // Patients actifs
  const patientsActifsResult = await db
    .select({ patientId: dialysisSessions.patientId })
    .from(dialysisSessions)
    .where(and(
      gte(dialysisSessions.dateSeance, dateDebut),
      lte(dialysisSessions.dateSeance, dateFin),
      ne(dialysisSessions.statut, 'annulee'),
    ))
    .groupBy(dialysisSessions.patientId);

  const patientsActifsCount = patientsActifsResult.length;

  // Taux d'adequation Kt/V
  const [ktvStats] = await db
    .select({
      total: count(),
      adequate: sql<number>`SUM(CASE WHEN ${dialysisSessions.ktvStatus} = 'adequate' THEN 1 ELSE 0 END)`,
    })
    .from(dialysisSessions)
    .where(and(
      gte(dialysisSessions.dateSeance, dateDebut),
      lte(dialysisSessions.dateSeance, dateFin),
      eq(dialysisSessions.statut, 'terminee'),
      isNotNull(dialysisSessions.ktvStatus),
    ));

  const ktvTotal = ktvStats?.total ?? 0;
  const ktvAdequate = Number(ktvStats?.adequate ?? 0);
  const tauxAdequation = ktvTotal > 0 ? Math.round((ktvAdequate / ktvTotal) * 100) : 0;

  const pdfStream = await ReactPDF.renderToStream(
    React.createElement(MonthlyReport, {
      mois: moisLabel,
      seances: { planifiees, realisees, annulees },
      tauxOccupation,
      ca: { payees, impayees, total: payees + impayees },
      repartitionPaiement: repartition.map((r) => ({
        mode: MODE_LABELS[r.mode ?? ''] ?? (r.mode ?? 'Inconnu'),
        montant: parseFloat(r.total ?? '0'),
      })),
      patientsActifs: patientsActifsCount,
      tauxAdequation,
    }),
  );

  const chunks: Uint8Array[] = [];
  for await (const chunk of pdfStream) {
    chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
  }
  const buffer = Buffer.concat(chunks);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="rapport-${month}.pdf"`,
    },
  });
}
```

- [ ] **Step 4: Create ExportPdfButton component**

Create `nephrosys/src/components/reports/export-pdf-button.tsx`:

```typescript
'use client';

import { Button } from '@/components/ui/button';

type Props = {
  href: string;
  label?: string;
};

export function ExportPdfButton({ href, label = 'Exporter PDF' }: Props) {
  function handleClick() {
    window.open(href, '_blank');
  }

  return (
    <Button variant="outline" onClick={handleClick}>
      {label}
    </Button>
  );
}
```

- [ ] **Step 5: Add Export PDF button to patient detail page**

In `nephrosys/src/app/(dashboard)/patients/[id]/page.tsx`, add the import and button. Add at the top:

```typescript
import { ExportPdfButton } from '@/components/reports/export-pdf-button';
```

Add the button after the patient name heading, inside the existing div:

```typescript
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {patient.prenom} {patient.nom}
        </h1>
        <ExportPdfButton href={`/api/reports/patient/${id}`} label="Exporter PDF" />
      </div>
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
    </div>
  );
```

- [ ] **Step 6: Create admin rapports page**

Create `nephrosys/src/app/(dashboard)/admin/rapports/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function AdminRapportsPage() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  function handleGenerate() {
    if (!selectedMonth) return;
    window.open(`/api/reports/monthly/${selectedMonth}`, '_blank');
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Rapports
      </h1>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Rapport mensuel d&apos;activite
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label="Mois"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <Button onClick={handleGenerate} disabled={!selectedMonth}>
            Generer le rapport mensuel
          </Button>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Le rapport sera genere en PDF et ouvert dans un nouvel onglet.
          Il inclut les seances, le taux d&apos;occupation, le chiffre d&apos;affaires,
          et le taux d&apos;adequation Kt/V pour le mois selectionne.
        </p>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Verify**

```bash
cd nephrosys && pnpm tsc --noEmit && pnpm test
```
