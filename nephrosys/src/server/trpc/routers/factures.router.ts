import { router, roleProcedure } from '@/server/trpc';
import {
  factures,
  lignesFacture,
  articles,
  tarifsBase,
  dialysisSessions,
  patients,
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
        .where(
          and(eq(factures.sessionId, input.sessionId), ne(factures.statut, 'annulee')),
        )
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
          await ctx.db.insert(lignesFacture).values({
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
          message: "Impossible de modifier une facture qui n'est pas en brouillon",
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
          message: "Impossible de modifier une facture qui n'est pas en brouillon",
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

  stats: roleProcedure(['admin', 'facturation']).query(async ({ ctx }) => {
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
      .where(and(eq(factures.dateFacture, today), eq(factures.statut, 'payee')));

    // CA semaine
    const [caSemaine] = await ctx.db
      .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
      .from(factures)
      .where(and(gte(factures.dateFacture, weekStart), eq(factures.statut, 'payee')));

    // CA mois
    const [caMois] = await ctx.db
      .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
      .from(factures)
      .where(and(gte(factures.dateFacture, monthStart), eq(factures.statut, 'payee')));

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
      .select({
        total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)`,
        count: count(),
      })
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
  tarifsList: roleProcedure(['admin', 'facturation']).query(async ({ ctx }) => {
    const data = await ctx.db.select().from(tarifsBase).orderBy(tarifsBase.code);
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
  getBySessionId: roleProcedure([
    'admin',
    'facturation',
    'medecin',
    'infirmiere',
    'secretaire',
  ])
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [facture] = await ctx.db
        .select({ id: factures.id, reference: factures.reference, statut: factures.statut })
        .from(factures)
        .where(and(eq(factures.sessionId, input.sessionId), ne(factures.statut, 'annulee')))
        .limit(1);

      return facture ?? null;
    }),
});
