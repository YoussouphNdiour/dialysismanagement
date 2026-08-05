import { router, roleProcedure } from '@/server/trpc';
import { postesDialyse } from '@/server/db/schema';
import { createPosteSchema, updatePosteSchema } from '@/lib/validators/postes';
import { eq } from 'drizzle-orm';
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
