'use client';

import { api } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './stat-card';

export function AdminDashboard() {
  const { data, isLoading } = api.dashboard.adminStats.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const totalSeances =
    Object.values(data.seancesAujourdhui).reduce((sum, n) => sum + n, 0);

  return (
    <div className="space-y-6">
      {/* CA row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="CA du jour"
          value={`${data.ca.jour.toLocaleString('fr-FR')} FCFA`}
          colorText="text-green-700 dark:text-green-300"
        />
        <StatCard
          label="CA de la semaine"
          value={`${data.ca.semaine.toLocaleString('fr-FR')} FCFA`}
          colorText="text-blue-700 dark:text-blue-300"
        />
        <StatCard
          label="CA du mois"
          value={`${data.ca.mois.toLocaleString('fr-FR')} FCFA`}
          colorText="text-blue-700 dark:text-blue-300"
        />
        <StatCard
          label="Impaye"
          value={`${data.impaye.montant.toLocaleString('fr-FR')} FCFA`}
          colorText="text-red-700 dark:text-red-300"
          subtitle={`${data.impaye.count} facture(s)`}
        />
      </div>

      {/* Activity row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Seances aujourd'hui"
          value={totalSeances}
          colorText="text-blue-700 dark:text-blue-300"
          subtitle={
            Object.entries(data.seancesAujourdhui)
              .map(([s, n]) => `${s}: ${n}`)
              .join(', ') || 'Aucune'
          }
        />
        <StatCard
          label="Taux d'occupation"
          value={`${data.tauxOccupation}%`}
          colorText={
            data.tauxOccupation >= 80
              ? 'text-green-700 dark:text-green-300'
              : data.tauxOccupation >= 50
                ? 'text-orange-700 dark:text-orange-300'
                : 'text-red-700 dark:text-red-300'
          }
        />
      </div>

      {/* Top articles */}
      {data.topArticles.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Top 5 articles factures ce mois
          </h3>
          <div className="space-y-2">
            {data.topArticles.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-2 dark:border-gray-800"
              >
                <span className="text-sm text-gray-900 dark:text-white">{a.designation}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Qty: {a.totalQuantite}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {a.totalMontant.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
