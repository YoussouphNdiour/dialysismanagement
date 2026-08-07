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
async function resolvePatientId(
  ctx: TRPCContext & { session: NonNullable<TRPCContext['session']> },
): Promise<string> {
  const userId = ctx.session.user.id;
  const [patient] = await ctx.db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message:
        "PROFIL_NON_CONFIGURE: Votre profil patient n'est pas encore configure. Contactez l'administration.",
    });
  }
  return patient.id;
}

export const portailRouter = router({
  monProfil: roleProcedure(['patient']).query(async ({ ctx }) => {
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
        .orderBy(asc(vitalSigns.heureMesure));

      return { ...session, constantes };
    }),

  mesBilans: roleProcedure(['patient']).query(async ({ ctx }) => {
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

  mesFactures: roleProcedure(['patient']).query(async ({ ctx }) => {
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
      .where(and(eq(factures.patientId, patientId), ne(factures.statut, 'brouillon')))
      .orderBy(desc(factures.dateFacture));

    return data;
  }),

  mesOrdonnances: roleProcedure(['patient']).query(async ({ ctx }) => {
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
