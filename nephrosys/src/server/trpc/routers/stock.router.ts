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
