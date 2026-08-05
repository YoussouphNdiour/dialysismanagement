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
          ureePre: dialysisSessions.ureePre,
          ureePost: dialysisSessions.ureePost,
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

      // Auto-calculate Kt/V, URR — merge with existing values when only one uree is provided
      const ureePre =
        data.ureePre != null
          ? data.ureePre
          : existing.ureePre != null
            ? parseFloat(existing.ureePre)
            : null;
      const ureePost =
        data.ureePost != null
          ? data.ureePost
          : existing.ureePost != null
            ? parseFloat(existing.ureePost)
            : null;
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
