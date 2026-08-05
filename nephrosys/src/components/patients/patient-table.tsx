'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/trpc/client';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { PatientBadge } from './patient-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateFR } from '@/lib/utils';

export function PatientTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const perPage = 20;

  const { data, isLoading } = api.patients.list.useQuery({
    page,
    perPage,
    search: debouncedSearch || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / perPage) : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher un patient..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white sm:w-80"
          />
        </div>
        <Link href="/patients/nouveau">
          <Button>
            <Plus size={16} />
            Nouveau patient
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Nom</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Prenom</th>
              <th className="hidden px-4 py-3 font-medium text-gray-600 dark:text-gray-400 md:table-cell">Telephone</th>
              <th className="hidden px-4 py-3 font-medium text-gray-600 dark:text-gray-400 lg:table-cell">Date naissance</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="hidden px-4 py-3 md:table-cell"><Skeleton className="h-4 w-28" /></td>
                  <td className="hidden px-4 py-3 lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                </tr>
              ))}

            {data?.data.map((patient) => (
              <tr
                key={patient.id}
                className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td className="px-4 py-3">
                  <Link href={`/patients/${patient.id}`} className="font-medium text-gray-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400">
                    {patient.nom}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{patient.prenom}</td>
                <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 md:table-cell">{patient.telephone || '—'}</td>
                <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 lg:table-cell">
                  {patient.dateNaissance ? formatDateFR(patient.dateNaissance) : '—'}
                </td>
                <td className="px-4 py-3">
                  <PatientBadge statut={patient.statut} />
                </td>
              </tr>
            ))}

            {data && data.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  Aucun patient trouve
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data?.total} patient(s) au total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
