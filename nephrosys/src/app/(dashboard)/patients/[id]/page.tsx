'use client';

import { use } from 'react';
import { api } from '@/lib/trpc/client';
import { PatientForm } from '@/components/patients/patient-form';
import { Skeleton } from '@/components/ui/skeleton';

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: patient, isLoading } = api.patients.getById.useQuery({ id });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <p className="text-red-500">Patient non trouve</p>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        {patient.prenom} {patient.nom}
      </h1>
      <PatientForm
        mode="edit"
        defaultValues={{
          id: patient.id,
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
        }}
      />
    </div>
  );
}
