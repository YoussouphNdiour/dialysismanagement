'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  patientId: string;
  canEdit: boolean; // true si role medecin
};

export function OrdonnancesTab({ patientId, canEdit }: Props) {
  const utils = api.useUtils();

  const { data: rows, isLoading } = api.prescriptions.ordonnancesList.useQuery({ patientId });
  const [contenu, setContenu] = useState('');

  const createMutation = api.prescriptions.ordonnanceCreate.useMutation({
    onSuccess: () => {
      setContenu('');
      void utils.prescriptions.ordonnancesList.invalidate({ patientId });
    },
  });

  const toggleMutation = api.prescriptions.ordonnanceToggle.useMutation({
    onSuccess: () => {
      void utils.prescriptions.ordonnancesList.invalidate({ patientId });
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      {/* Liste des ordonnances */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Contenu</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Prescripteur</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Statut</th>
              {canEdit && (
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {rows?.map((row) => (
              <tr key={row.ordonnance.id} className="bg-white dark:bg-gray-950">
                <td className="px-4 py-3 whitespace-nowrap">
                  {row.ordonnance.datePrescription}
                </td>
                <td className="max-w-xs px-4 py-3">
                  <p className="truncate text-gray-700 dark:text-gray-300">
                    {row.ordonnance.contenu}
                  </p>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  Dr {row.prescripteur.prenom} {row.prescripteur.nom}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.ordonnance.isActive ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      Active
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      Inactive
                    </Badge>
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        toggleMutation.mutate({ ordonnanceId: row.ordonnance.id })
                      }
                      disabled={toggleMutation.isPending}
                    >
                      {row.ordonnance.isActive ? 'Desactiver' : 'Activer'}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-gray-400">
                  Aucune ordonnance
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Formulaire creation (medecin seulement) */}
      {canEdit && (
        <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            Nouvelle ordonnance
          </h3>
          <textarea
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="Contenu de l'ordonnance..."
          />
          {createMutation.error && (
            <p className="mt-2 text-sm text-red-600">{createMutation.error.message}</p>
          )}
          <Button
            className="mt-3"
            onClick={() => {
              if (!contenu.trim()) return;
              createMutation.mutate({ patientId, contenu });
            }}
            disabled={createMutation.isPending}
          >
            Enregistrer l'ordonnance
          </Button>
        </section>
      )}
    </div>
  );
}
