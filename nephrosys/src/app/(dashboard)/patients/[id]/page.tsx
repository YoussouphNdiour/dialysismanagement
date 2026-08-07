'use client';

import { use, useState } from 'react';
import { api } from '@/lib/trpc/client';
import { PatientForm } from '@/components/patients/patient-form';
import { OrdonnancesTab } from '@/components/patients/ordonnances-tab';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportPdfButton } from '@/components/reports/export-pdf-button';

const TABS = ['Dossier', 'Ordonnances'] as const;

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState(0);
  const { data: patient, isLoading } = api.patients.getById.useQuery({ id });

  const { data: me } = api.auth.me.useQuery();
  const canEdit = me?.role === 'medecin' || me?.role === 'admin';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient) {
    return <p className="text-red-500">Patient non trouve</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {patient.prenom} {patient.nom}
        </h1>
        <ExportPdfButton href={`/api/reports/patient/${id}`} label="Exporter PDF" />
      </div>

      {/* Tab navigation */}
      <div className="mb-4 flex border-b border-gray-200 dark:border-gray-800">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === i
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 0 && (
        <PatientForm
          mode="edit"
          patientId={patient.id}
          isAdmin={me?.role === 'admin'}
          defaultValues={{
            nom: patient.nom,
            prenom: patient.prenom,
            dateNaissance: patient.dateNaissance || undefined,
            sexe: patient.sexe || undefined,
            telephone: patient.telephone || undefined,
            groupeSanguin: patient.groupeSanguin || undefined,
            tailleCm: patient.tailleCm ? parseFloat(patient.tailleCm) : undefined,
            poidsSecKg: patient.poidsSecKg ? parseFloat(patient.poidsSecKg) : undefined,
            nephropathie: patient.nephropathie || undefined,
            datePremiereDialyse: patient.datePremiereDialyse || undefined,
            medecinRefId: patient.medecinRefId || undefined,
            statut: patient.statut || undefined,
            userId: patient.userId || undefined,
          }}
        />
      )}
      {activeTab === 1 && (
        <OrdonnancesTab patientId={id} canEdit={canEdit} />
      )}
    </div>
  );
}
