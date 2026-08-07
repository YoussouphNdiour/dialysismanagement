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
          message: "Impossible d'annuler une prescription d'une seance terminee ou annulee",
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
            message:
              "PROFIL_NON_CONFIGURE: Votre profil patient n'est pas encore configure. Contactez l'administration.",
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
