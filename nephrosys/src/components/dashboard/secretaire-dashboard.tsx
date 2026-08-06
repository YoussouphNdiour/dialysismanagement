'use client';

import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './stat-card';

export function SecretaireDashboard() {
  const { data, isLoading } = api.dashboard.secretaireStats.useQuery();

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

  const totalSeances = Object.values(data.seancesJour).reduce((sum, n) => sum + n, 0);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Seances du jour"
          value={totalSeances}
          colorText="text-blue-700 dark:text-blue-300"
          subtitle={
            Object.entries(data.seancesJour)
              .map(([s, n]) => `${s}: ${n}`)
              .join(', ') || 'Aucune'
          }
        />
        <StatCard
          label="Patients sans seance cette semaine"
          value={data.patientsSansSeance.length}
          colorText={
            data.patientsSansSeance.length > 0
              ? 'text-orange-700 dark:text-orange-300'
              : 'text-green-700 dark:text-green-300'
          }
        />
        <StatCard
          label="Nouveaux patients ce mois"
          value={data.nbNouveauxPatientsMois}
          colorText="text-blue-700 dark:text-blue-300"
        />
      </div>

      {/* Patients sans seance */}
      {data.patientsSansSeance.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-orange-700 dark:text-orange-300">
            Patients sans seance cette semaine
          </h3>
          <div className="space-y-2">
            {data.patientsSansSeance.map((p) => (
              <Link
                key={p.id}
                href={`/patients/${p.id}`}
                className="block rounded-lg border border-orange-100 p-3 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-950"
              >
                <span className="text-sm text-gray-900 dark:text-white">
                  {p.nom} {p.prenom}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
