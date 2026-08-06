'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const STATUT_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'validee', label: 'Validee' },
  { value: 'payee', label: 'Payee' },
  { value: 'annulee', label: 'Annulee' },
];

const STATUT_BADGES: Record<string, { variant: 'default' | 'info' | 'success' | 'danger'; label: string }> = {
  brouillon: { variant: 'default', label: 'Brouillon' },
  validee: { variant: 'info', label: 'Validee' },
  payee: { variant: 'success', label: 'Payee' },
  annulee: { variant: 'danger', label: 'Annulee' },
};

export function FacturesList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statutFilter, setStatutFilter] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const { data, isLoading } = api.factures.list.useQuery({
    page,
    perPage: 20,
    statut: statutFilter ? (statutFilter as 'brouillon' | 'validee' | 'payee' | 'annulee') : undefined,
    dateDebut: dateDebut || undefined,
    dateFin: dateFin || undefined,
  });

  const { data: stats, isLoading: statsLoading } = api.factures.stats.useQuery();

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Facturation</h1>
      </div>

      {/* Stats cards */}
      {statsLoading ? (
        <Skeleton className="mb-6 h-24 w-full" />
      ) : stats ? (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CA du jour</p>
            <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">
              {stats.caJour.toLocaleString('fr-FR')} FCFA
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CA de la semaine</p>
            <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">
              {stats.caSemaine.toLocaleString('fr-FR')} FCFA
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CA du mois</p>
            <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">
              {stats.caMois.toLocaleString('fr-FR')} FCFA
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Impaye</p>
            <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">
              {stats.impaye.montant.toLocaleString('fr-FR')} FCFA
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stats.impaye.count} facture(s)
            </p>
          </Card>
        </div>
      ) : null}

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Select
            label="Statut"
            options={STATUT_OPTIONS}
            value={statutFilter}
            onChange={(e) => { setStatutFilter(e.target.value); setPage(1); }}
          />
          <Input
            label="Date debut"
            type="date"
            value={dateDebut}
            onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
          />
          <Input
            label="Date fin"
            type="date"
            value={dateFin}
            onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
          />
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Reference</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Patient</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Montant total</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Statut</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map(({ facture, patient }) => {
                  const badge = STATUT_BADGES[facture.statut] ?? STATUT_BADGES['brouillon']!;
                  return (
                    <tr
                      key={facture.id}
                      className="cursor-pointer border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                      onClick={() => router.push(`/facturation/${facture.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">
                        {facture.reference}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {patient.nom} {patient.prenom}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {facture.dateFacture}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {parseFloat(facture.montantTotal).toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/facturation/${facture.id}`);
                          }}
                        >
                          Voir
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Aucune facture trouvee
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} sur {totalPages} ({data?.total ?? 0} factures)
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Precedent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
