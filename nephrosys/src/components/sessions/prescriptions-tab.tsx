'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  sessionId: string;
  sessionStatut: string;
  isLocked: boolean;
};

const STATUT_BADGE: Record<string, string> = {
  prescrite: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  administree: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  annulee: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const STATUT_LABEL: Record<string, string> = {
  prescrite: 'Prescrite',
  administree: 'Administree',
  annulee: 'Annulee',
};

export function PrescriptionsTab({ sessionId, sessionStatut, isLocked }: Props) {
  const utils = api.useUtils();

  const { data: prescriptions, isLoading } = api.prescriptions.listBySession.useQuery({
    sessionId,
  });

  const { data: articlesData } = api.articles.list.useQuery({
    activeOnly: true,
  });

  const articles = articlesData?.filter(
    (a) => a.categorie === 'medicament' || a.categorie === 'acte_medical',
  ) ?? [];

  const [form, setForm] = useState({ articleId: '', quantite: '', posologie: '' });

  const addMutation = api.prescriptions.addToSession.useMutation({
    onSuccess: () => {
      setForm({ articleId: '', quantite: '', posologie: '' });
      void utils.prescriptions.listBySession.invalidate({ sessionId });
    },
  });

  const cancelMutation = api.prescriptions.cancelPrescription.useMutation({
    onSuccess: () => {
      void utils.prescriptions.listBySession.invalidate({ sessionId });
    },
  });

  const peutAjouter =
    !isLocked &&
    (sessionStatut === 'planifiee' || sessionStatut === 'en_cours');

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      {/* Tableau des prescriptions */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Article</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Quantite</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Posologie</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Statut</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Lot</th>
              {peutAjouter && (
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {prescriptions?.map((row) => (
              <tr key={row.prescription.id} className="bg-white dark:bg-gray-950">
                <td className="px-4 py-3 font-medium">{row.article.nom}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {row.prescription.quantite} {row.article.unite}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {row.prescription.posologie ?? '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge className={STATUT_BADGE[row.prescription.statut] ?? ''}>
                    {STATUT_LABEL[row.prescription.statut] ?? row.prescription.statut}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-gray-500">
                  {row.lot?.numeroLot ?? '—'}
                </td>
                {peutAjouter && (
                  <td className="px-4 py-3 text-center">
                    {row.prescription.statut === 'prescrite' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() =>
                          cancelMutation.mutate({ prescriptionId: row.prescription.id })
                        }
                        disabled={cancelMutation.isPending}
                      >
                        Annuler
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {prescriptions?.length === 0 && (
              <tr>
                <td
                  colSpan={peutAjouter ? 6 : 5}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  Aucune prescription pour cette seance
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Formulaire d'ajout (medecin seulement, seance non terminee) */}
      {peutAjouter && (
        <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            Ajouter une prescription
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Article</label>
              <select
                value={form.articleId}
                onChange={(e) => setForm((f) => ({ ...f, articleId: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">-- Choisir --</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom} ({a.categorie})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Quantite</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantite}
                onChange={(e) => setForm((f) => ({ ...f, quantite: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
                Posologie (optionnel)
              </label>
              <input
                type="text"
                value={form.posologie}
                onChange={(e) => setForm((f) => ({ ...f, posologie: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Instructions d'administration"
              />
            </div>
          </div>
          {addMutation.error && (
            <p className="mt-2 text-sm text-red-600">{addMutation.error.message}</p>
          )}
          <Button
            className="mt-4"
            onClick={() => {
              const q = parseFloat(form.quantite);
              if (!form.articleId || isNaN(q)) return;
              addMutation.mutate({
                sessionId,
                articleId: form.articleId,
                quantite: q,
                posologie: form.posologie || undefined,
              });
            }}
            disabled={addMutation.isPending}
          >
            Ajouter la prescription
          </Button>
        </section>
      )}
    </div>
  );
}
