'use client';

import { use } from 'react';
import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function PortailSeanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading } = api.portail.seanceDetail.useQuery({ seanceId: id });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return <p className="text-red-500">Seance non trouvee</p>;

  const { session, poste, medecin, constantes } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/portail/seances" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Mes seances
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
          Seance du {session.dateSeance}
        </h1>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Poste</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{poste.nom}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Medecin</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              Dr {medecin.prenom} {medecin.nom}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Duree</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {session.dureeReelle ? `${session.dureeReelle} min` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Tolerance</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {session.toleranceGlobale ?? '—'}
            </dd>
          </div>
          {session.ktvCalculated && (
            <div>
              <dt className="text-sm text-gray-500">Kt/V</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {parseFloat(session.ktvCalculated).toFixed(2)}{' '}
                {session.ktvStatus && (
                  <Badge className={session.ktvStatus === 'adequate' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {session.ktvStatus === 'adequate' ? 'Adequat' : 'Inadequat'}
                  </Badge>
                )}
              </dd>
            </div>
          )}
          {session.urrCalculated && (
            <div>
              <dt className="text-sm text-gray-500">URR</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {parseFloat(session.urrCalculated).toFixed(1)}%
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Constantes */}
      {constantes.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Constantes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Heure</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">TA</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">FC</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Temp.</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">SpO2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {constantes.map((c) => (
                  <tr key={c.id} className="bg-white dark:bg-gray-950">
                    <td className="px-3 py-2">
                      {c.heureMesure
                        ? new Date(c.heureMesure).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2">{c.tensionArterielle ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{c.frequenceCardiaque ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{c.temperature ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{c.spo2 ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
