'use client';

import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';

export function StockAlertes() {
  const { data, isLoading } = api.stock.alertes.useQuery();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alertes stock</h1>

      {/* Stock bas */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-orange-600 dark:text-orange-400">
          Articles en stock bas ({data?.stockBas.length ?? 0})
        </h2>
        {data?.stockBas.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun article en alerte stock bas</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-orange-200 dark:border-orange-900">
            <table className="w-full text-sm">
              <thead className="bg-orange-50 dark:bg-orange-950">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-orange-700 dark:text-orange-300">Article</th>
                  <th className="px-4 py-3 text-right font-medium text-orange-700 dark:text-orange-300">Stock actuel</th>
                  <th className="px-4 py-3 text-right font-medium text-orange-700 dark:text-orange-300">Seuil min</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100 dark:divide-orange-900">
                {data?.stockBas.map((a) => (
                  <tr key={a.id} className="bg-white dark:bg-gray-950">
                    <td className="px-4 py-3 font-medium">{a.nom}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">{a.stockActuel}</td>
                    <td className="px-4 py-3 text-right font-mono">{a.seuilMin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Peremption proche */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-red-600 dark:text-red-400">
          Lots a peremption proche — 30 jours ({data?.lotsPeremption.length ?? 0})
        </h2>
        {data?.lotsPeremption.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun lot expirant dans les 30 prochains jours</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-red-200 dark:border-red-900">
            <table className="w-full text-sm">
              <thead className="bg-red-50 dark:bg-red-950">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-red-700 dark:text-red-300">N° Lot</th>
                  <th className="px-4 py-3 text-left font-medium text-red-700 dark:text-red-300">Date peremption</th>
                  <th className="px-4 py-3 text-right font-medium text-red-700 dark:text-red-300">Quantite dispo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100 dark:divide-red-900">
                {data?.lotsPeremption.map((lot) => (
                  <tr key={lot.id} className="bg-white dark:bg-gray-950">
                    <td className="px-4 py-3 font-mono">{lot.numeroLot}</td>
                    <td className="px-4 py-3 text-red-600">{lot.datePeremption}</td>
                    <td className="px-4 py-3 text-right font-mono">{lot.quantiteDisponible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
