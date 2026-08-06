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
