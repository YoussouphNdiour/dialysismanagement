import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { patients, dialysisSessions, bilans, postesDialyse, seuilsCliniques } from '@/server/db/schema';
import { eq, desc, and, isNotNull } from 'drizzle-orm';
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
    marginBottom: 3,
  },
  label: {
    width: '40%',
    color: '#555',
  },
  value: {
    width: '60%',
    fontWeight: 'bold',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#333',
    color: '#fff',
    padding: 5,
    fontSize: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #ddd',
    padding: 4,
    fontSize: 8,
  },
  tableCell: {
    flex: 1,
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

type PatientReportProps = {
  patient: {
    nom: string;
    prenom: string;
    dateNaissance: string | null;
    groupeSanguin: string | null;
    nephropathie: string | null;
    poidsSecKg: string | null;
  };
  sessions: {
    dateSeance: string;
    posteNom: string;
    dureeReelle: number | null;
    ktvCalculated: string | null;
    urrCalculated: string | null;
    arrivalWeight: string | null;
    departureWeight: string | null;
    toleranceGlobale: string | null;
  }[];
  bilan: Record<string, unknown> | null;
  seuils: Map<string, { seuilBas: number | null; seuilHaut: number | null }>;
  ktvHistory: { date: string; ktv: string }[];
};

// Numeric bilan fields with their display labels
const BILAN_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: 'hemoglobine', label: 'Hemoglobine', unit: 'g/dL' },
  { key: 'hematocrite', label: 'Hematocrite', unit: '%' },
  { key: 'globulesBlancs', label: 'Globules blancs', unit: 'G/L' },
  { key: 'plaquettes', label: 'Plaquettes', unit: 'G/L' },
  { key: 'ferritine', label: 'Ferritine', unit: 'ng/mL' },
  { key: 'saturationTransferrine', label: 'Saturation transferrine', unit: '%' },
  { key: 'creatinine', label: 'Creatinine', unit: 'µmol/L' },
  { key: 'ureePre', label: 'Uree pre', unit: 'mmol/L' },
  { key: 'ureePost', label: 'Uree post', unit: 'mmol/L' },
  { key: 'sodium', label: 'Sodium', unit: 'mmol/L' },
  { key: 'potassium', label: 'Potassium', unit: 'mmol/L' },
  { key: 'calcium', label: 'Calcium', unit: 'mmol/L' },
  { key: 'phosphore', label: 'Phosphore', unit: 'mmol/L' },
  { key: 'bicarbonateBilan', label: 'Bicarbonates', unit: 'mmol/L' },
  { key: 'produitCaP', label: 'Produit Ca x P', unit: 'mmol²/L²' },
  { key: 'pth', label: 'PTH', unit: 'pg/mL' },
  { key: 'vitamineD', label: 'Vitamine D', unit: 'ng/mL' },
  { key: 'albumine', label: 'Albumine', unit: 'g/L' },
  { key: 'crp', label: 'CRP', unit: 'mg/L' },
  { key: 'hdl', label: 'HDL', unit: 'mmol/L' },
  { key: 'ldl', label: 'LDL', unit: 'mmol/L' },
  { key: 'cholesterolTotal', label: 'Cholesterol total', unit: 'mmol/L' },
  { key: 'triglycerides', label: 'Triglycerides', unit: 'mmol/L' },
  { key: 'gaj', label: 'Glycemie a jeun', unit: 'mmol/L' },
  { key: 'hba1c', label: 'HbA1c', unit: '%' },
];

function getBilanStatus(
  value: number,
  seuil: { seuilBas: number | null; seuilHaut: number | null } | undefined,
): string {
  if (!seuil) return '-';
  if (seuil.seuilBas !== null && value < seuil.seuilBas) return 'Bas';
  if (seuil.seuilHaut !== null && value > seuil.seuilHaut) return 'Haut';
  return 'Normal';
}

function PatientReport({ patient, sessions, bilan, seuils, ktvHistory }: PatientReportProps) {
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
        React.createElement(Text, { style: styles.title }, 'NephroSys \u2014 Fiche Patient'),
        React.createElement(Text, { style: styles.subtitle }, `Genere le ${now}`),
      ),
      // Patient info
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Informations patient'),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Nom complet'),
          React.createElement(Text, { style: styles.value }, `${patient.prenom} ${patient.nom}`),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Date de naissance'),
          React.createElement(Text, { style: styles.value }, patient.dateNaissance ?? 'Non renseignee'),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Groupe sanguin'),
          React.createElement(Text, { style: styles.value }, patient.groupeSanguin ?? 'Non renseigne'),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Nephropathie initiale'),
          React.createElement(Text, { style: styles.value }, patient.nephropathie ?? 'Non renseignee'),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Poids sec'),
          React.createElement(Text, { style: styles.value }, patient.poidsSecKg ? `${patient.poidsSecKg} kg` : 'Non renseigne'),
        ),
      ),
      // Last 10 sessions table
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, '10 dernieres seances'),
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: styles.tableCell }, 'Date'),
          React.createElement(Text, { style: styles.tableCell }, 'Poste'),
          React.createElement(Text, { style: styles.tableCell }, 'Duree'),
          React.createElement(Text, { style: styles.tableCell }, 'Kt/V'),
          React.createElement(Text, { style: styles.tableCell }, 'URR'),
          React.createElement(Text, { style: styles.tableCell }, 'Poids arr.'),
          React.createElement(Text, { style: styles.tableCell }, 'Poids dep.'),
          React.createElement(Text, { style: styles.tableCell }, 'Tolerance'),
        ),
        ...sessions.map((s, i) =>
          React.createElement(
            View,
            { key: i, style: styles.tableRow },
            React.createElement(Text, { style: styles.tableCell }, s.dateSeance),
            React.createElement(Text, { style: styles.tableCell }, s.posteNom),
            React.createElement(Text, { style: styles.tableCell }, s.dureeReelle ? `${s.dureeReelle}min` : '-'),
            React.createElement(Text, { style: styles.tableCell }, s.ktvCalculated ?? '-'),
            React.createElement(Text, { style: styles.tableCell }, s.urrCalculated ? `${s.urrCalculated}%` : '-'),
            React.createElement(Text, { style: styles.tableCell }, s.arrivalWeight ? `${s.arrivalWeight}kg` : '-'),
            React.createElement(Text, { style: styles.tableCell }, s.departureWeight ? `${s.departureWeight}kg` : '-'),
            React.createElement(Text, { style: styles.tableCell }, s.toleranceGlobale ?? '-'),
          ),
        ),
      ),
      // Kt/V evolution
      ktvHistory.length > 0
        ? React.createElement(
            View,
            { style: styles.section },
            React.createElement(Text, { style: styles.sectionTitle }, 'Evolution Kt/V (10 derniers)'),
            ...ktvHistory.map((k, i) =>
              React.createElement(
                View,
                { key: i, style: styles.row },
                React.createElement(Text, { style: styles.label }, k.date),
                React.createElement(Text, { style: styles.value }, k.ktv),
              ),
            ),
          )
        : null,
      // Dernier bilan biologique
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Dernier bilan biologique'),
        bilan === null || bilan === undefined
          ? React.createElement(Text, { style: { fontSize: 9, color: '#888' } }, 'Aucun bilan disponible')
          : React.createElement(
              View,
              null,
              // Table header
              React.createElement(
                View,
                { style: styles.tableHeader },
                React.createElement(Text, { style: [styles.tableCell, { flex: 2 }] }, 'Parametre'),
                React.createElement(Text, { style: styles.tableCell }, 'Valeur'),
                React.createElement(Text, { style: [styles.tableCell, { flex: 2 }] }, 'Seuils'),
                React.createElement(Text, { style: styles.tableCell }, 'Statut'),
              ),
              // Table rows — only fields that have a value in this bilan
              ...BILAN_FIELDS.filter((f) => bilan[f.key] !== null && bilan[f.key] !== undefined).map((f, i) => {
                const rawVal = bilan[f.key] as string | number;
                const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal as string);
                const seuil = seuils.get(f.key);
                const seuilLabel =
                  seuil
                    ? `${seuil.seuilBas !== null ? seuil.seuilBas : '?'} - ${seuil.seuilHaut !== null ? seuil.seuilHaut : '?'}`
                    : '-';
                const status = !isNaN(numVal) ? getBilanStatus(numVal, seuil) : '-';
                const statusColor =
                  status === 'Bas' ? '#c0392b' : status === 'Haut' ? '#e67e22' : '#27ae60';
                return React.createElement(
                  View,
                  { key: i, style: styles.tableRow },
                  React.createElement(Text, { style: [styles.tableCell, { flex: 2 }] }, `${f.label} (${f.unit})`),
                  React.createElement(Text, { style: styles.tableCell }, isNaN(numVal) ? String(rawVal) : String(numVal)),
                  React.createElement(Text, { style: [styles.tableCell, { flex: 2 }] }, seuilLabel),
                  React.createElement(Text, { style: [styles.tableCell, { color: statusColor }] }, status),
                );
              }),
            ),
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (!role || !['admin', 'medecin', 'secretaire'].includes(role)) {
    return NextResponse.json({ error: 'Acces interdit' }, { status: 403 });
  }

  const { id } = await params;

  // Get patient
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, id))
    .limit(1);

  if (!patient) {
    return NextResponse.json({ error: 'Patient non trouve' }, { status: 404 });
  }

  // Get last 10 sessions
  const sessionsData = await db
    .select({
      dateSeance: dialysisSessions.dateSeance,
      posteId: dialysisSessions.posteId,
      dureeReelle: dialysisSessions.dureeReelle,
      ktvCalculated: dialysisSessions.ktvCalculated,
      urrCalculated: dialysisSessions.urrCalculated,
      arrivalWeight: dialysisSessions.arrivalWeight,
      departureWeight: dialysisSessions.departureWeight,
      toleranceGlobale: dialysisSessions.toleranceGlobale,
    })
    .from(dialysisSessions)
    .where(and(
      eq(dialysisSessions.patientId, id),
      eq(dialysisSessions.statut, 'terminee'),
    ))
    .orderBy(desc(dialysisSessions.dateSeance))
    .limit(10);

  // Get poste names
  const sessionsMapped = [];
  for (const s of sessionsData) {
    const [poste] = await db
      .select({ nom: postesDialyse.nom })
      .from(postesDialyse)
      .where(eq(postesDialyse.id, s.posteId))
      .limit(1);
    sessionsMapped.push({
      dateSeance: s.dateSeance,
      posteNom: poste?.nom ?? '-',
      dureeReelle: s.dureeReelle,
      ktvCalculated: s.ktvCalculated,
      urrCalculated: s.urrCalculated,
      arrivalWeight: s.arrivalWeight,
      departureWeight: s.departureWeight,
      toleranceGlobale: s.toleranceGlobale,
    });
  }

  // Get last bilan
  const [lastBilan] = await db
    .select()
    .from(bilans)
    .where(eq(bilans.patientId, id))
    .orderBy(desc(bilans.dateBilan))
    .limit(1);

  // Get seuils
  const seuilsRows = await db.select().from(seuilsCliniques);
  const seuilsMap = new Map<string, { seuilBas: number | null; seuilHaut: number | null }>();
  for (const row of seuilsRows) {
    seuilsMap.set(row.parametre, {
      seuilBas: row.seuilBas != null ? parseFloat(row.seuilBas) : null,
      seuilHaut: row.seuilHaut != null ? parseFloat(row.seuilHaut) : null,
    });
  }

  // Kt/V history
  const ktvHistory = await db
    .select({
      dateSeance: dialysisSessions.dateSeance,
      ktvCalculated: dialysisSessions.ktvCalculated,
    })
    .from(dialysisSessions)
    .where(and(
      eq(dialysisSessions.patientId, id),
      eq(dialysisSessions.statut, 'terminee'),
      isNotNull(dialysisSessions.ktvCalculated),
    ))
    .orderBy(desc(dialysisSessions.dateSeance))
    .limit(10);

  const docElement = PatientReport({
    patient: {
      nom: patient.nom,
      prenom: patient.prenom,
      dateNaissance: patient.dateNaissance,
      groupeSanguin: patient.groupeSanguin,
      nephropathie: patient.nephropathie,
      poidsSecKg: patient.poidsSecKg,
    },
    sessions: sessionsMapped,
    bilan: lastBilan as Record<string, unknown> | null ?? null,
    seuils: seuilsMap,
    ktvHistory: ktvHistory.map((k) => ({
      date: k.dateSeance,
      ktv: k.ktvCalculated!,
    })),
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
      'Content-Disposition': `inline; filename="patient-${patient.nom}-${patient.prenom}.pdf"`,
    },
  });
}
