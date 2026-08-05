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
