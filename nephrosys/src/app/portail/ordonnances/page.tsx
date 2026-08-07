'use client';

import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';

export default function PortailOrdonnancesPage() {
  const { data, isLoading } = api.portail.mesOrdonnances.useQuery();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mes ordonnances</h1>
      {data?.length === 0 && (
        <p className="text-gray-400">Aucune ordonnance active</p>
      )}
      {data?.map((row) => (
        <div
          key={row.ordonnance.id}
          className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">{row.ordonnance.datePrescription}</span>
            <span className="text-sm text-gray-500">
              Dr {row.prescripteur.prenom} {row.prescripteur.nom}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
            {row.ordonnance.contenu}
          </p>
        </div>
      ))}
    </div>
  );
}
