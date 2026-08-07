'use client';

import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const STATUT_BADGE: Record<string, string> = {
  validee: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  payee: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  annulee: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const STATUT_LABEL: Record<string, string> = {
  validee: 'Validee',
  payee: 'Payee',
  annulee: 'Annulee',
};

export default function PortailFacturesPage() {
  const { data, isLoading } = api.portail.mesFactures.useQuery();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Mes factures</h1>
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Reference</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Montant (FCFA)</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {data?.map((f) => (
              <tr key={f.id} className="bg-white dark:bg-gray-950">
                <td className="px-4 py-3 font-mono">{f.reference}</td>
                <td className="px-4 py-3">{f.dateFacture}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {parseFloat(f.montantTotal).toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge className={STATUT_BADGE[f.statut] ?? ''}>
                    {STATUT_LABEL[f.statut] ?? f.statut}
                  </Badge>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Aucune facture
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
