'use client';

import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './stat-card';

const STATUT_BADGES: Record<string, { variant: 'default' | 'info' | 'success' | 'warning' | 'danger'; label: string }> = {
  planifiee: { variant: 'info', label: 'Planifiee' },
  en_cours: { variant: 'warning', label: 'En cours' },
  terminee: { variant: 'success', label: 'Terminee' },
  annulee: { variant: 'danger', label: 'Annulee' },
};

export function InfirmiereDashboard() {
  const { data, isLoading } = api.dashboard.infirmiereStats.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Seances du jour"
          value={data.seancesJour.length}
          colorText="text-blue-700 dark:text-blue-300"
        />
        <StatCard
          label="Constantes a prendre"
          value={data.seancesNeedingVitals.length}
          colorText={
            data.seancesNeedingVitals.length > 0
              ? 'text-orange-700 dark:text-orange-300'
              : 'text-green-700 dark:text-green-300'
          }
        />
        <StatCard
          label="Seances planifiees a venir"
          value={data.prochaines.length}
          colorText="text-gray-700 dark:text-gray-300"
        />
      </div>

      {/* Seances necessitant constantes */}
      {data.seancesNeedingVitals.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-orange-700 dark:text-orange-300">
            Seances necessitant des constantes
          </h3>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            Derniere prise de constantes il y a plus de 30 minutes
          </p>
          <div className="space-y-2">
            {data.seancesNeedingVitals.map((s) => (
              <Link
                key={s.sessionId}
                href={`/seances/${s.sessionId}`}
                className="block rounded-lg border border-orange-100 p-3 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-950"
              >
                <span className="text-sm text-gray-900 dark:text-white">{s.patient}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Seances du jour */}
      <Card>
        <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Mes seances du jour
        </h3>
        {data.seancesJour.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Aucune seance aujourd&apos;hui</p>
        ) : (
          <div className="space-y-2">
            {data.seancesJour.map((s) => {
              const badge = STATUT_BADGES[s.statut] ?? STATUT_BADGES['planifiee']!;
              return (
                <Link
                  key={s.id}
                  href={`/seances/${s.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                >
                  <span className="text-sm text-gray-900 dark:text-white">
                    {s.patient.nom} {s.patient.prenom}
                  </span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Prochaines seances */}
      {data.prochaines.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Prochaines seances planifiees
          </h3>
          <div className="space-y-2">
            {data.prochaines.map((s) => (
              <Link
                key={s.id}
                href={`/seances/${s.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
              >
                <span className="text-sm text-gray-900 dark:text-white">
                  {s.patient.nom} {s.patient.prenom}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{s.dateSeance}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
