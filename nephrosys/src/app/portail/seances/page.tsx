'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const STATUT_BADGE: Record<string, string> = {
  planifiee: 'bg-blue-100 text-blue-800',
  en_cours: 'bg-orange-100 text-orange-800',
  terminee: 'bg-green-100 text-green-800',
  annulee: 'bg-red-100 text-red-800',
};

export default function PortailSeancesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = api.portail.mesSeances.useQuery({ page, perPage: 10 });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Mes seances</h1>
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Poste</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Duree (min)</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Kt/V</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {data?.map((s) => (
              <tr
                key={s.id}
                className="cursor-pointer bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900"
              >
                <td className="px-4 py-3">
                  <Link href={`/portail/seances/${s.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                    {s.dateSeance}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{s.poste.nom}</td>
                <td className="px-4 py-3 text-right font-mono">{s.dureeReelle ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {s.ktvCalculated ? parseFloat(s.ktvCalculated).toFixed(2) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge className={STATUT_BADGE[s.statut] ?? ''}>{s.statut}</Badge>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Aucune seance
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {(data?.length ?? 0) === 10 && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Precedent
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 text-sm"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
