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
