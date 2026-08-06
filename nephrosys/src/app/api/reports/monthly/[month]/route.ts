import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { dialysisSessions, factures, postesDialyse } from '@/server/db/schema';
import { eq, and, gte, lte, count, ne, isNotNull, sql } from 'drizzle-orm';
import ReactPDF from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import React from 'react';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
    borderBottom: '1 solid #333',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '50%',
    color: '#555',
  },
  value: {
    width: '50%',
    fontWeight: 'bold',
  },
  bigValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
    marginBottom: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
});

const MOIS_FR = [
  '', 'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

type MonthlyReportProps = {
  mois: string;
  seances: { planifiees: number; realisees: number; annulees: number };
  tauxOccupation: number;
  ca: { payees: number; impayees: number; total: number };
  repartitionPaiement: { mode: string; montant: number }[];
  patientsActifs: number;
  tauxAdequation: number;
};

function MonthlyReport({
  mois,
  seances,
  tauxOccupation,
  ca,
  repartitionPaiement,
  patientsActifs,
  tauxAdequation,
}: MonthlyReportProps) {
  const now = new Date().toLocaleDateString('fr-FR');

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, `Rapport d'activite \u2014 ${mois}`),
        React.createElement(Text, { style: styles.subtitle }, `Genere le ${now}`),
      ),
      // Seances
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Seances de dialyse'),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Planifiees'),
          React.createElement(Text, { style: styles.value }, String(seances.planifiees)),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Realisees'),
          React.createElement(Text, { style: styles.value }, String(seances.realisees)),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Annulees'),
          React.createElement(Text, { style: styles.value }, String(seances.annulees)),
        ),
      ),
      // Occupation
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Taux d'occupation moyen"),
        React.createElement(Text, { style: styles.bigValue }, `${tauxOccupation}%`),
      ),
      // CA
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Chiffre d'affaires"),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Factures payees'),
          React.createElement(Text, { style: styles.value }, `${ca.payees.toLocaleString('fr-FR')} FCFA`),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Factures impayees'),
          React.createElement(Text, { style: styles.value }, `${ca.impayees.toLocaleString('fr-FR')} FCFA`),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Total'),
          React.createElement(Text, { style: { ...styles.value, fontSize: 14 } }, `${ca.total.toLocaleString('fr-FR')} FCFA`),
        ),
      ),
      // Repartition paiement
      repartitionPaiement.length > 0
        ? React.createElement(
            View,
            { style: styles.section },
            React.createElement(Text, { style: styles.sectionTitle }, 'Repartition par mode de paiement'),
            ...repartitionPaiement.map((r, i) =>
              React.createElement(
                View,
                { key: i, style: styles.row },
                React.createElement(Text, { style: styles.label }, r.mode),
                React.createElement(Text, { style: styles.value }, `${r.montant.toLocaleString('fr-FR')} FCFA`),
              ),
            ),
          )
        : null,
      // Patients actifs
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Patients'),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Patients actifs (au moins 1 seance)'),
          React.createElement(Text, { style: styles.value }, String(patientsActifs)),
        ),
      ),
      // Adequation Kt/V
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Adequation Kt/V'),
        React.createElement(Text, { style: styles.bigValue }, `${tauxAdequation}%`),
      ),
      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(Text, null, 'NephroSys \u2014 Document genere automatiquement \u2014 Confidentiel'),
      ),
    ),
  );
}

const MODE_LABELS: Record<string, string> = {
  especes: 'Especes',
  cheque: 'Cheque',
  virement: 'Virement',
  mobile_money: 'Mobile Money',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ month: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Acces interdit' }, { status: 403 });
  }

  const { month } = await params;

  // Validate format YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Format invalide. Utiliser YYYY-MM' }, { status: 400 });
  }

  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr!, 10);
  const monthNum = parseInt(monthStr!, 10);
  const moisLabel = `${MOIS_FR[monthNum] ?? ''} ${year}`;

  const dateDebut = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const dateFin = `${month}-${lastDay.toString().padStart(2, '0')}`;

  // Count seances by status
  const seancesParStatut = await db
    .select({ statut: dialysisSessions.statut, count: count() })
    .from(dialysisSessions)
    .where(and(
      gte(dialysisSessions.dateSeance, dateDebut),
      lte(dialysisSessions.dateSeance, dateFin),
    ))
    .groupBy(dialysisSessions.statut);

  const seancesMap = seancesParStatut.reduce(
    (acc, row) => ({ ...acc, [row.statut]: row.count }),
    {} as Record<string, number>,
  );

  const planifiees = (seancesMap['planifiee'] ?? 0) + (seancesMap['en_cours'] ?? 0) +
    (seancesMap['terminee'] ?? 0) + (seancesMap['annulee'] ?? 0);
  const realisees = seancesMap['terminee'] ?? 0;
  const annulees = seancesMap['annulee'] ?? 0;

  // Taux d'occupation moyen
  const [postesActifs] = await db
    .select({ total: count() })
    .from(postesDialyse)
    .where(eq(postesDialyse.isActive, true));

  const nbPostes = postesActifs?.total ?? 0;
  const nbJoursMois = lastDay;
  const capaciteTotale = nbPostes * 2 * nbJoursMois; // 2 vacations per day

  const [seancesNonAnnulees] = await db
    .select({ total: count() })
    .from(dialysisSessions)
    .where(and(
      gte(dialysisSessions.dateSeance, dateDebut),
      lte(dialysisSessions.dateSeance, dateFin),
      ne(dialysisSessions.statut, 'annulee'),
    ));

  const tauxOccupation = capaciteTotale > 0
    ? Math.round(((seancesNonAnnulees?.total ?? 0) / capaciteTotale) * 100)
    : 0;

  // CA
  const [caPayees] = await db
    .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
    .from(factures)
    .where(and(
      gte(factures.dateFacture, dateDebut),
      lte(factures.dateFacture, dateFin),
      eq(factures.statut, 'payee'),
    ));

  const [caImpayees] = await db
    .select({ total: sql<string>`COALESCE(SUM(${factures.montantTotal}::numeric), 0)` })
    .from(factures)
    .where(and(
      gte(factures.dateFacture, dateDebut),
      lte(factures.dateFacture, dateFin),
      eq(factures.statut, 'validee'),
    ));

  const payees = parseFloat(caPayees?.total ?? '0');
  const impayees = parseFloat(caImpayees?.total ?? '0');

  // Repartition par mode de paiement
  const repartition = await db
    .select({
      mode: factures.modePaiement,
      total: sql<string>`SUM(${factures.montantTotal}::numeric)`,
    })
    .from(factures)
    .where(and(
      gte(factures.dateFacture, dateDebut),
      lte(factures.dateFacture, dateFin),
      eq(factures.statut, 'payee'),
      isNotNull(factures.modePaiement),
    ))
    .groupBy(factures.modePaiement);

  // Patients actifs
  const patientsActifsResult = await db
    .select({ patientId: dialysisSessions.patientId })
    .from(dialysisSessions)
    .where(and(
      gte(dialysisSessions.dateSeance, dateDebut),
      lte(dialysisSessions.dateSeance, dateFin),
      ne(dialysisSessions.statut, 'annulee'),
    ))
    .groupBy(dialysisSessions.patientId);

  const patientsActifsCount = patientsActifsResult.length;

  // Taux d'adequation Kt/V
  const [ktvStats] = await db
    .select({
      total: count(),
      adequate: sql<number>`SUM(CASE WHEN ${dialysisSessions.ktvStatus} = 'adequate' THEN 1 ELSE 0 END)`,
    })
    .from(dialysisSessions)
    .where(and(
      gte(dialysisSessions.dateSeance, dateDebut),
      lte(dialysisSessions.dateSeance, dateFin),
      eq(dialysisSessions.statut, 'terminee'),
      isNotNull(dialysisSessions.ktvStatus),
    ));

  const ktvTotal = ktvStats?.total ?? 0;
  const ktvAdequate = Number(ktvStats?.adequate ?? 0);
  const tauxAdequation = ktvTotal > 0 ? Math.round((ktvAdequate / ktvTotal) * 100) : 0;

  const docElement = MonthlyReport({
    mois: moisLabel,
    seances: { planifiees, realisees, annulees },
    tauxOccupation,
    ca: { payees, impayees, total: payees + impayees },
    repartitionPaiement: repartition.map((r) => ({
      mode: MODE_LABELS[r.mode ?? ''] ?? (r.mode ?? 'Inconnu'),
      montant: parseFloat(r.total ?? '0'),
    })),
    patientsActifs: patientsActifsCount,
    tauxAdequation,
  });

  const pdfStream = await ReactPDF.renderToStream(docElement);

  const chunks: Uint8Array[] = [];
  for await (const chunk of pdfStream) {
    chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
  }
  const buffer = Buffer.concat(chunks);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="rapport-${month}.pdf"`,
    },
  });
}
