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
