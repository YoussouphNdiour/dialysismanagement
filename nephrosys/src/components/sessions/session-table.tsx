'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const STATUT_BADGES: Record<string, { className: string; label: string }> = {
  planifiee: { className: 'bg-blue-100 text-blue-800', label: 'Planifiee' },
  en_cours: { className: 'bg-orange-100 text-orange-800', label: 'En cours' },
  terminee: { className: 'bg-green-100 text-green-800', label: 'Terminee' },
  annulee: { className: 'bg-red-100 text-red-800', label: 'Annulee' },
};

export function SessionTable() {
  const today = new Date().toISOString().split('T')[0]!;
  const [date, setDate] = useState(today);
  const [statut, setStatut] = useState<string>('');

  const { data, isLoading } = api.sessions.list.useQuery({
    date: date || undefined,
    statut: statut ? (statut as 'planifiee' | 'en_cours' | 'terminee' | 'annulee') : undefined,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-48"
        />
        <select
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="planifiee">Planifiee</option>
          <option value="en_cours">En cours</option>
          <option value="terminee">Terminee</option>
          <option value="annulee">Annulee</option>
        </select>
        <Link href="/seances/nouvelle">
          <Button>Nouvelle seance</Button>
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left">Patient</th>
              <th className="px-3 py-2 text-left">Poste</th>
              <th className="px-3 py-2 text-left">Medecin</th>
              <th className="px-3 py-2 text-center">Statut</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((row) => {
              const badge = STATUT_BADGES[row.session.statut] ?? STATUT_BADGES['planifiee']!;
              return (
                <tr key={row.session.id} className="border-b">
                  <td className="px-3 py-2">{row.patient.nom} {row.patient.prenom}</td>
                  <td className="px-3 py-2">{row.poste.nom}</td>
                  <td className="px-3 py-2">Dr {row.physician.nom}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Link href={`/seances/${row.session.id}`}>
                      <Button variant="outline" size="sm">Ouvrir</Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(!data?.data || data.data.length === 0) && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  Aucune seance trouvee
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data && (
        <p className="mt-2 text-xs text-gray-500">{data.total} seance(s) au total</p>
      )}
    </div>
  );
}
