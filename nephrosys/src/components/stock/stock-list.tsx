'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIE_OPTIONS = [
  { value: '', label: 'Toutes categories' },
  { value: 'medicament', label: 'Medicament' },
  { value: 'consommable', label: 'Consommable' },
  { value: 'acte_medical', label: 'Acte medical' },
] as const;

const STATUT_BADGE: Record<string, string> = {
  normal: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  alerte: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  rupture: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const STATUT_LABEL: Record<string, string> = {
  normal: 'Normal',
  alerte: 'Alerte',
  rupture: 'Rupture',
};

export function StockList() {
  const [categorie, setCategorie] = useState<'medicament' | 'consommable' | 'acte_medical' | undefined>(undefined);
  const [seuilArticleId, setSeuilArticleId] = useState<string | null>(null);
  const [seuilValeur, setSeuilValeur] = useState('');

  const { data, isLoading, refetch } = api.stock.etatStock.useQuery(
    { categorie },
  );

  const setSeuilMutation = api.stock.setSeuil.useMutation({
    onSuccess: () => {
      setSeuilArticleId(null);
      setSeuilValeur('');
      void refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Etat du stock</h1>
        <Link href="/stock/alertes">
          <Button variant="outline">Voir les alertes</Button>
        </Link>
      </div>

      <div className="mb-4">
        <select
          value={categorie ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setCategorie(
              val === '' ? undefined : (val as 'medicament' | 'consommable' | 'acte_medical'),
            );
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          {CATEGORIE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Article</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Categorie</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Stock dispo</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Seuil min</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Statut</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {data?.map((row) => (
              <tr
                key={row.id}
                className="bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/stock/${row.id}`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {row.nom}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.categorie}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {row.stockActuel} {row.unite}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {row.seuilMin !== null ? `${row.seuilMin} ${row.unite}` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge className={STATUT_BADGE[row.statut] ?? ''}>
                    {STATUT_LABEL[row.statut] ?? row.statut}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  {seuilArticleId === row.id ? (
                    <div className="flex items-center gap-2 justify-center">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={seuilValeur}
                        onChange={(e) => setSeuilValeur(e.target.value)}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                        placeholder="Seuil"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          const val = parseFloat(seuilValeur);
                          if (!isNaN(val) && val > 0) {
                            setSeuilMutation.mutate({ articleId: row.id, seuilMin: val });
                          }
                        }}
                        disabled={setSeuilMutation.isPending}
                      >
                        OK
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSeuilArticleId(null)}
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSeuilArticleId(row.id);
                        setSeuilValeur(row.seuilMin !== null ? String(row.seuilMin) : '');
                      }}
                    >
                      Definir seuil
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Aucun article
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
