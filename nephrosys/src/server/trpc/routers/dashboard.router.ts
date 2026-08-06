import { router, roleProcedure } from '@/server/trpc';
import {
  dialysisSessions,
  patients,
  factures,
  bilans,
  postesDialyse,
  vitalSigns,
  lignesFacture,
} from '@/server/db/schema';
import { eq, and, gte, lte, count, desc, sql, ne, isNotNull } from 'drizzle-orm';

export const dashboardRouter = router({
  adminStats: roleProcedure(['admin', 'facturation'])
    .query(async ({ ctx }) => {
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

      // CA jour/semaine/mois
      const [caJour] = await ctx.db
        .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
        .from(factures)
        .where(and(eq(factures.dateFacture, today), eq(factures.statut, 'payee')));

      const [caSemaine] = await ctx.db
        .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
        .from(factures)
        .where(and(gte(factures.dateFacture, weekStart), eq(factures.statut, 'payee')));

      const [caMois] = await ctx.db
        .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
        .from(factures)
        .where(and(gte(factures.dateFacture, monthStart), eq(factures.statut, 'payee')));

      // Seances aujourd'hui par statut
      const seancesAujourdhui = await ctx.db
        .select({ statut: dialysisSessions.statut, count: count() })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.dateSeance, today))
        .groupBy(dialysisSessions.statut);

      // Taux d'occupation postes
      const [postesActifs] = await ctx.db
        .select({ total: count() })
        .from(postesDialyse)
        .where(eq(postesDialyse.isActive, true));

      const [seancesTotal] = await ctx.db
        .select({ total: count() })
        .from(dialysisSessions)
        .where(and(
          eq(dialysisSessions.dateSeance, today),
          ne(dialysisSessions.statut, 'annulee'),
        ));

      const nbPostesActifs = postesActifs?.total ?? 0;
      const nbSeancesJour = seancesTotal?.total ?? 0;
      const capaciteTotale = nbPostesActifs * 2; // 2 vacations
      const tauxOccupation = capaciteTotale > 0 ? Math.round((nbSeancesJour / capaciteTotale) * 100) : 0;

      // Factures impayees
      const [impaye] = await ctx.db
        .select({
          total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)`,
          count: count(),
        })
        .from(factures)
        .where(eq(factures.statut, 'validee'));

      // Top 5 articles factures ce mois
      const topArticles = await ctx.db
        .select({
          articleId: lignesFacture.articleId,
          designation: lignesFacture.designation,
          totalQuantite: sql<string>`SUM(${lignesFacture.quantite}::numeric)`,
          totalMontant: sql<string>`SUM(${lignesFacture.montant}::numeric)`,
        })
        .from(lignesFacture)
        .innerJoin(factures, eq(lignesFacture.factureId, factures.id))
        .where(and(
          isNotNull(lignesFacture.articleId),
          gte(factures.dateFacture, monthStart),
          ne(factures.statut, 'annulee'),
        ))
        .groupBy(lignesFacture.articleId, lignesFacture.designation)
        .orderBy(sql`SUM(${lignesFacture.montant}::numeric) DESC`)
        .limit(5);

      return {
        ca: {
          jour: parseFloat(caJour?.total ?? '0'),
          semaine: parseFloat(caSemaine?.total ?? '0'),
          mois: parseFloat(caMois?.total ?? '0'),
        },
        seancesAujourdhui: seancesAujourdhui.reduce(
          (acc, row) => ({ ...acc, [row.statut]: row.count }),
          {} as Record<string, number>,
        ),
        tauxOccupation,
        impaye: {
          montant: parseFloat(impaye?.total ?? '0'),
          count: impaye?.count ?? 0,
        },
        topArticles: topArticles.map((a) => ({
          designation: a.designation,
          totalQuantite: parseFloat(a.totalQuantite ?? '0'),
          totalMontant: parseFloat(a.totalMontant ?? '0'),
        })),
      };
    }),

  medecinStats: roleProcedure(['medecin'])
    .query(async ({ ctx }) => {
      const now = new Date();
      const today = now.toISOString().split('T')[0]!;
      const userId = ctx.session.user.id;

      // Mes seances du jour
      const mesSeances = await ctx.db
        .select({
          session: dialysisSessions,
          patient: { id: patients.id, nom: patients.nom, prenom: patients.prenom },
        })
        .from(dialysisSessions)
        .innerJoin(patients, eq(dialysisSessions.patientId, patients.id))
        .where(and(
          eq(dialysisSessions.dateSeance, today),
          eq(dialysisSessions.physicianId, userId),
        ))
        .orderBy(dialysisSessions.createdAt);

      // Patients avec Kt/V inadequat (3 dernieres seances toutes inadequate)
      // Step 1: get distinct patients with at least 3 terminee sessions
      const patientsAvecSeances = await ctx.db
        .select({
          patientId: dialysisSessions.patientId,
        })
        .from(dialysisSessions)
        .where(and(
          eq(dialysisSessions.physicianId, userId),
          eq(dialysisSessions.statut, 'terminee'),
          isNotNull(dialysisSessions.ktvStatus),
        ))
        .groupBy(dialysisSessions.patientId)
        .having(sql`COUNT(*) >= 3`);

      const patientsKtvInadequat: { id: string; nom: string; prenom: string }[] = [];

      for (const { patientId } of patientsAvecSeances) {
        const lastThree = await ctx.db
          .select({ ktvStatus: dialysisSessions.ktvStatus })
          .from(dialysisSessions)
          .where(and(
            eq(dialysisSessions.patientId, patientId),
            eq(dialysisSessions.statut, 'terminee'),
            isNotNull(dialysisSessions.ktvStatus),
          ))
          .orderBy(desc(dialysisSessions.dateSeance))
          .limit(3);

        if (lastThree.length === 3 && lastThree.every((s) => s.ktvStatus === 'inadequate')) {
          const [patient] = await ctx.db
            .select({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
            .from(patients)
            .where(eq(patients.id, patientId))
            .limit(1);
          if (patient) {
            patientsKtvInadequat.push(patient);
          }
        }
      }

      // Bilans hors seuils
      const bilansHorsSeuils = await ctx.db
        .select({
          bilanId: bilans.id,
          reference: bilans.reference,
          patientNom: patients.nom,
          patientPrenom: patients.prenom,
        })
        .from(bilans)
        .innerJoin(patients, eq(bilans.patientId, patients.id))
        .where(and(
          eq(bilans.physicianId, userId),
          sql`(
            ${bilans.hbStatut} IN ('low', 'high') OR
            ${bilans.potassiumStatut} IN ('low', 'high') OR
            ${bilans.phosphoreStatut} IN ('low', 'high') OR
            ${bilans.albumineStatut} IN ('low', 'high') OR
            ${bilans.pthStatut} IN ('low', 'high') OR
            ${bilans.caPStatut} IN ('low', 'high')
          )`,
        ))
        .orderBy(desc(bilans.dateBilan))
        .limit(10);

      // Taux d'adequation Kt/V global
      const [ktvStats] = await ctx.db
        .select({
          total: count(),
          adequate: sql<number>`SUM(CASE WHEN ${dialysisSessions.ktvStatus} = 'adequate' THEN 1 ELSE 0 END)`,
        })
        .from(dialysisSessions)
        .where(and(
          eq(dialysisSessions.physicianId, userId),
          eq(dialysisSessions.statut, 'terminee'),
          isNotNull(dialysisSessions.ktvStatus),
        ));

      const ktvTotal = ktvStats?.total ?? 0;
      const ktvAdequate = Number(ktvStats?.adequate ?? 0);
      const tauxAdequation = ktvTotal > 0 ? Math.round((ktvAdequate / ktvTotal) * 100) : 0;

      return {
        mesSeances: mesSeances.map(({ session, patient }) => ({
          id: session.id,
          dateSeance: session.dateSeance,
          statut: session.statut,
          patient,
        })),
        patientsKtvInadequat,
        bilansHorsSeuils: bilansHorsSeuils.map((b) => ({
          id: b.bilanId,
          reference: b.reference,
          patient: `${b.patientNom} ${b.patientPrenom}`,
        })),
        nbBilansHorsSeuils: bilansHorsSeuils.length,
        tauxAdequation,
      };
    }),

  infirmiereStats: roleProcedure(['infirmiere'])
    .query(async ({ ctx }) => {
      const now = new Date();
      const today = now.toISOString().split('T')[0]!;
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0]!;
      const userId = ctx.session.user.id;

      // Seances du jour (mes patients)
      const seancesJour = await ctx.db
        .select({
          session: {
            id: dialysisSessions.id,
            dateSeance: dialysisSessions.dateSeance,
            statut: dialysisSessions.statut,
          },
          patient: { id: patients.id, nom: patients.nom, prenom: patients.prenom },
        })
        .from(dialysisSessions)
        .innerJoin(patients, eq(dialysisSessions.patientId, patients.id))
        .where(and(
          eq(dialysisSessions.dateSeance, today),
          eq(dialysisSessions.nurseId, userId),
        ))
        .orderBy(dialysisSessions.createdAt);

      // Seances en cours necessitant constantes (derniere constante > 30 min)
      const seancesEnCours = await ctx.db
        .select({
          sessionId: dialysisSessions.id,
          patientNom: patients.nom,
          patientPrenom: patients.prenom,
        })
        .from(dialysisSessions)
        .innerJoin(patients, eq(dialysisSessions.patientId, patients.id))
        .where(and(
          eq(dialysisSessions.statut, 'en_cours'),
          eq(dialysisSessions.nurseId, userId),
        ));

      const seancesNeedingVitals: { sessionId: string; patient: string }[] = [];
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

      for (const s of seancesEnCours) {
        const [lastVital] = await ctx.db
          .select({ heureMesure: vitalSigns.heureMesure })
          .from(vitalSigns)
          .where(eq(vitalSigns.sessionId, s.sessionId))
          .orderBy(desc(vitalSigns.heureMesure))
          .limit(1);

        if (!lastVital || new Date(lastVital.heureMesure) < thirtyMinAgo) {
          seancesNeedingVitals.push({
            sessionId: s.sessionId,
            patient: `${s.patientNom} ${s.patientPrenom}`,
          });
        }
      }

      // Prochaines seances (aujourd'hui + demain) planifiees
      const prochaines = await ctx.db
        .select({
          session: {
            id: dialysisSessions.id,
            dateSeance: dialysisSessions.dateSeance,
            statut: dialysisSessions.statut,
          },
          patient: { id: patients.id, nom: patients.nom, prenom: patients.prenom },
        })
        .from(dialysisSessions)
        .innerJoin(patients, eq(dialysisSessions.patientId, patients.id))
        .where(and(
          sql`${dialysisSessions.dateSeance} IN (${today}, ${tomorrowStr})`,
          eq(dialysisSessions.statut, 'planifiee'),
          eq(dialysisSessions.nurseId, userId),
        ))
        .orderBy(dialysisSessions.dateSeance);

      return {
        seancesJour: seancesJour.map(({ session, patient }) => ({
          id: session.id,
          dateSeance: session.dateSeance,
          statut: session.statut,
          patient,
        })),
        seancesNeedingVitals,
        prochaines: prochaines.map(({ session, patient }) => ({
          id: session.id,
          dateSeance: session.dateSeance,
          patient,
        })),
      };
    }),

  secretaireStats: roleProcedure(['secretaire'])
    .query(async ({ ctx }) => {
      const now = new Date();
      const today = now.toISOString().split('T')[0]!;
      const monthStart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;

      // Start of week (Monday)
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - diffToMonday);
      const weekStart = startOfWeek.toISOString().split('T')[0]!;
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      const weekEnd = endOfWeek.toISOString().split('T')[0]!;

      // Seances du jour (vue d'ensemble)
      const seancesJour = await ctx.db
        .select({
          statut: dialysisSessions.statut,
          count: count(),
        })
        .from(dialysisSessions)
        .where(eq(dialysisSessions.dateSeance, today))
        .groupBy(dialysisSessions.statut);

      // Patients actifs sans seance cette semaine
      const patientsActifs = await ctx.db
        .select({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
        .from(patients)
        .where(eq(patients.statut, 'actif'));

      const patientsSansSeance: { id: string; nom: string; prenom: string }[] = [];

      for (const patient of patientsActifs) {
        const [seanceCetteSemaine] = await ctx.db
          .select({ id: dialysisSessions.id })
          .from(dialysisSessions)
          .where(and(
            eq(dialysisSessions.patientId, patient.id),
            gte(dialysisSessions.dateSeance, weekStart),
            lte(dialysisSessions.dateSeance, weekEnd),
            ne(dialysisSessions.statut, 'annulee'),
          ))
          .limit(1);

        if (!seanceCetteSemaine) {
          patientsSansSeance.push(patient);
        }
      }

      // Nb nouveaux patients ce mois
      const [nouveauxPatients] = await ctx.db
        .select({ total: count() })
        .from(patients)
        .where(gte(patients.createdAt, new Date(monthStart)));

      return {
        seancesJour: seancesJour.reduce(
          (acc, row) => ({ ...acc, [row.statut]: row.count }),
          {} as Record<string, number>,
        ),
        patientsSansSeance,
        nbNouveauxPatientsMois: nouveauxPatients?.total ?? 0,
      };
    }),
});
