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

export function MedecinDashboard() {
  const { data, isLoading } = api.dashboard.medecinStats.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
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
          label="Mes seances du jour"
          value={data.mesSeances.length}
          colorText="text-blue-700 dark:text-blue-300"
        />
        <StatCard
          label="Taux d'adequation Kt/V"
          value={`${data.tauxAdequation}%`}
          colorText={
            data.tauxAdequation >= 80
              ? 'text-green-700 dark:text-green-300'
              : data.tauxAdequation >= 60
                ? 'text-orange-700 dark:text-orange-300'
                : 'text-red-700 dark:text-red-300'
          }
        />
        <StatCard
          label="Bilans hors seuils"
          value={data.nbBilansHorsSeuils}
          colorText={data.nbBilansHorsSeuils > 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}
        />
      </div>

      {/* Mes seances du jour */}
      <Card>
        <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Mes seances du jour
        </h3>
        {data.mesSeances.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Aucune seance aujourd&apos;hui</p>
        ) : (
          <div className="space-y-2">
            {data.mesSeances.map((s) => {
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

      {/* Patients Kt/V inadequat */}
      {data.patientsKtvInadequat.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-red-700 dark:text-red-300">
            Patients Kt/V inadequat (3 dernieres seances)
          </h3>
          <div className="space-y-2">
            {data.patientsKtvInadequat.map((p) => (
              <Link
                key={p.id}
                href={`/patients/${p.id}`}
                className="block rounded-lg border border-red-100 p-3 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
              >
                <span className="text-sm text-gray-900 dark:text-white">
                  {p.nom} {p.prenom}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Bilans hors seuils */}
      {data.bilansHorsSeuils.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-orange-700 dark:text-orange-300">
            Bilans hors seuils
          </h3>
          <div className="space-y-2">
            {data.bilansHorsSeuils.map((b) => (
              <Link
                key={b.id}
                href={`/bilans/${b.id}`}
                className="flex items-center justify-between rounded-lg border border-orange-100 p-3 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-950"
              >
                <span className="text-sm text-gray-900 dark:text-white">{b.patient}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{b.reference}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
