'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

type StatusBadgeProps = { label: string; status: string | null };

function StatusBadge({ label, status }: StatusBadgeProps) {
  if (!status) return null;
  const className =
    status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  return <Badge className={`${className} text-xs`}>{label}</Badge>;
}

export function BilanTable() {
  const [typeBilan, setTypeBilan] = useState('');

  const { data, isLoading } = api.bilans.list.useQuery({
    typeBilan: typeBilan ? (typeBilan as 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel') : undefined,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={typeBilan}
          onChange={(e) => setTypeBilan(e.target.value)}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">Tous les types</option>
          <option value="mensuel">Mensuel</option>
          <option value="trimestriel">Trimestriel</option>
          <option value="semestriel">Semestriel</option>
          <option value="annuel">Annuel</option>
        </select>
        <Link href="/bilans/nouveau">
          <Button>Nouveau bilan</Button>
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-left">Patient</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-center">Statuts</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((row) => (
              <tr key={row.bilan.id} className="border-b dark:border-gray-700">
                <td className="px-3 py-2 font-mono text-xs">{row.bilan.reference}</td>
                <td className="px-3 py-2">
                  {row.patient.nom} {row.patient.prenom}
                </td>
                <td className="px-3 py-2">
                  {new Date(row.bilan.dateBilan).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-3 py-2 capitalize">{row.bilan.typeBilan}</td>
                <td className="px-3 py-2 text-center">
                  <div className="flex flex-wrap justify-center gap-1">
                    <StatusBadge label="Hb" status={row.bilan.hbStatut} />
                    <StatusBadge label="K+" status={row.bilan.potassiumStatut} />
                    <StatusBadge label="PO4" status={row.bilan.phosphoreStatut} />
                    <StatusBadge label="Alb" status={row.bilan.albumineStatut} />
                    <StatusBadge label="PTH" status={row.bilan.pthStatut} />
                    <StatusBadge label="CaP" status={row.bilan.caPStatut} />
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <Link href={`/bilans/${row.bilan.id}`}>
                    <Button variant="outline" size="sm">
                      Ouvrir
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
            {(!data?.data || data.data.length === 0) && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  Aucun bilan trouve
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data && (
        <p className="mt-2 text-xs text-gray-500">{data.total} bilan(s) au total</p>
      )}
    </div>
  );
}
