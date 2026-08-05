'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Check } from 'lucide-react';

type EditingState = {
  id: string;
  seuilBas: string;
  seuilHaut: string;
  unite: string;
} | null;

export function SeuilsTable() {
  const [editing, setEditing] = useState<EditingState>(null);
  const utils = api.useUtils();

  const { data: seuils, isLoading } = api.seuils.list.useQuery();
  const updateMutation = api.seuils.update.useMutation({
    onSuccess: () => {
      utils.seuils.list.invalidate();
      setEditing(null);
    },
  });

  const startEdit = (seuil: NonNullable<typeof seuils>[number]) => {
    setEditing({
      id: seuil.id,
      seuilBas: seuil.seuilBas ?? '',
      seuilHaut: seuil.seuilHaut ?? '',
      unite: seuil.unite,
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      seuilBas: editing.seuilBas === '' ? null : parseFloat(editing.seuilBas),
      seuilHaut: editing.seuilHaut === '' ? null : parseFloat(editing.seuilHaut),
      unite: editing.unite,
    });
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Parametre</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Seuil bas</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Seuil haut</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Unite</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {seuils?.map((seuil) => (
            <tr key={seuil.id}>
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{seuil.label}</td>
              {editing?.id === seuil.id ? (
                <>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={editing.seuilBas}
                      onChange={(e) => setEditing({ ...editing, seuilBas: e.target.value })}
                      className="w-24"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={editing.seuilHaut}
                      onChange={(e) => setEditing({ ...editing, seuilHaut: e.target.value })}
                      className="w-24"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      value={editing.unite}
                      onChange={(e) => setEditing({ ...editing, unite: e.target.value })}
                      className="w-24"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={updateMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{seuil.seuilBas ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{seuil.seuilHaut ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{seuil.unite}</td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" onClick={() => startEdit(seuil)}>
                      Modifier
                    </Button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
