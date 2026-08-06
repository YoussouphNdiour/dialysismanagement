'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export function TarifsConfig() {
  const [editId, setEditId] = useState<string | null>(null);
  const [editMontant, setEditMontant] = useState('');

  const utils = api.useUtils();

  const { data: tarifs, isLoading } = api.factures.tarifsList.useQuery();

  const updateMutation = api.factures.tarifsUpdate.useMutation({
    onSuccess: () => {
      void utils.factures.tarifsList.invalidate();
      setEditId(null);
      setEditMontant('');
    },
  });

  function handleSave(id: string) {
    const montant = parseFloat(editMontant);
    if (isNaN(montant) || montant <= 0) return;
    updateMutation.mutate({ id, montant });
  }

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card className="p-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Tarifs de base
      </h2>
      <div className="space-y-3">
        {tarifs?.map((tarif) => (
          <div
            key={tarif.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
          >
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{tarif.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Code: {tarif.code}</p>
            </div>
            {editId === tarif.id ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={editMontant}
                  onChange={(e) => setEditMontant(e.target.value)}
                  className="w-32"
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(tarif.id)}
                  disabled={updateMutation.isPending}
                >
                  OK
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                  Annuler
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 dark:text-white">
                  {parseFloat(tarif.montant).toLocaleString('fr-FR')} FCFA
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditId(tarif.id);
                    setEditMontant(tarif.montant);
                  }}
                >
                  Modifier
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {updateMutation.error && (
        <p className="mt-2 text-sm text-red-500">{updateMutation.error.message}</p>
      )}
    </Card>
  );
}
