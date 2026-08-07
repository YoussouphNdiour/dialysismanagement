'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Props = { articleId: string };

export function StockDetail({ articleId }: Props) {
  const utils = api.useUtils();

  const { data: lots, isLoading: lotsLoading } = api.stock.lotsByArticle.useQuery({ articleId });
  const { data: mouvements, isLoading: mouvementsLoading } = api.stock.mouvements.useQuery({
    articleId,
    page: 1,
    perPage: 20,
  });

  // Formulaire entree
  const [entreeForm, setEntreeForm] = useState({ numeroLot: '', datePeremption: '', quantite: '' });
  const entreeMutation = api.stock.entree.useMutation({
    onSuccess: () => {
      setEntreeForm({ numeroLot: '', datePeremption: '', quantite: '' });
      void utils.stock.lotsByArticle.invalidate({ articleId });
      void utils.stock.mouvements.invalidate({ articleId });
    },
  });

  // Formulaire sortie
  const [sortieForm, setSortieForm] = useState({ quantite: '', motif: '' });
  const sortieMutation = api.stock.sortieManuelle.useMutation({
    onSuccess: () => {
      setSortieForm({ quantite: '', motif: '' });
      void utils.stock.lotsByArticle.invalidate({ articleId });
      void utils.stock.mouvements.invalidate({ articleId });
    },
  });

  // Formulaire ajustement
  const [ajustForm, setAjustForm] = useState({ lotId: '', quantite: '', motif: '' });
  const ajustMutation = api.stock.ajustement.useMutation({
    onSuccess: () => {
      setAjustForm({ lotId: '', quantite: '', motif: '' });
      void utils.stock.lotsByArticle.invalidate({ articleId });
      void utils.stock.mouvements.invalidate({ articleId });
    },
  });

  if (lotsLoading || mouvementsLoading) return <Skeleton className="h-96 w-full" />;

  const aujourd = new Date().toISOString().slice(0, 10);
  const dans30j = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Tableau des lots */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Lots en stock</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">N° Lot</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Peremption</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Qte initiale</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Qte dispo</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {lots?.map((lot) => {
                const estPerime = lot.datePeremption <= aujourd;
                const expireProche = lot.datePeremption <= dans30j && !estPerime;
                return (
                  <tr key={lot.id} className="bg-white dark:bg-gray-950">
                    <td className="px-4 py-3 font-mono">{lot.numeroLot}</td>
                    <td className="px-4 py-3">{lot.datePeremption}</td>
                    <td className="px-4 py-3 text-right font-mono">{lot.quantiteInitiale}</td>
                    <td className="px-4 py-3 text-right font-mono">{lot.quantiteDisponible}</td>
                    <td className="px-4 py-3 text-center">
                      {estPerime && (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                          Perime
                        </Badge>
                      )}
                      {expireProche && (
                        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                          Expire bientot
                        </Badge>
                      )}
                      {!estPerime && !expireProche && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                          OK
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {lots?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Aucun lot
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Formulaire entree */}
      <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Nouvelle entree</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">N° Lot</label>
            <input
              type="text"
              value={entreeForm.numeroLot}
              onChange={(e) => setEntreeForm((f) => ({ ...f, numeroLot: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="LOT-2024-001"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Date peremption</label>
            <input
              type="date"
              value={entreeForm.datePeremption}
              onChange={(e) => setEntreeForm((f) => ({ ...f, datePeremption: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Quantite</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={entreeForm.quantite}
              onChange={(e) => setEntreeForm((f) => ({ ...f, quantite: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </div>
        {entreeMutation.error && (
          <p className="mt-2 text-sm text-red-600">{entreeMutation.error.message}</p>
        )}
        <Button
          className="mt-4"
          onClick={() => {
            const q = parseFloat(entreeForm.quantite);
            if (!entreeForm.numeroLot || !entreeForm.datePeremption || isNaN(q)) return;
            entreeMutation.mutate({
              articleId,
              numeroLot: entreeForm.numeroLot,
              datePeremption: entreeForm.datePeremption,
              quantite: q,
            });
          }}
          disabled={entreeMutation.isPending}
        >
          Enregistrer l'entree
        </Button>
      </section>

      {/* Formulaire sortie manuelle */}
      <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Sortie manuelle</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Quantite</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={sortieForm.quantite}
              onChange={(e) => setSortieForm((f) => ({ ...f, quantite: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Motif</label>
            <input
              type="text"
              value={sortieForm.motif}
              onChange={(e) => setSortieForm((f) => ({ ...f, motif: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Raison de la sortie"
            />
          </div>
        </div>
        {sortieMutation.error && (
          <p className="mt-2 text-sm text-red-600">{sortieMutation.error.message}</p>
        )}
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            const q = parseFloat(sortieForm.quantite);
            if (isNaN(q) || !sortieForm.motif) return;
            sortieMutation.mutate({ articleId, quantite: q, motif: sortieForm.motif });
          }}
          disabled={sortieMutation.isPending}
        >
          Enregistrer la sortie
        </Button>
      </section>

      {/* Formulaire ajustement */}
      <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Ajustement d'inventaire</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              Lot (requis si positif)
            </label>
            <select
              value={ajustForm.lotId}
              onChange={(e) => setAjustForm((f) => ({ ...f, lotId: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">-- Choisir un lot --</option>
              {lots?.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.numeroLot} (exp. {lot.datePeremption})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              Quantite (negatif = perte)
            </label>
            <input
              type="number"
              step="0.01"
              value={ajustForm.quantite}
              onChange={(e) => setAjustForm((f) => ({ ...f, quantite: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Motif</label>
            <input
              type="text"
              value={ajustForm.motif}
              onChange={(e) => setAjustForm((f) => ({ ...f, motif: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Correction inventaire"
            />
          </div>
        </div>
        {ajustMutation.error && (
          <p className="mt-2 text-sm text-red-600">{ajustMutation.error.message}</p>
        )}
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            const q = parseFloat(ajustForm.quantite);
            if (isNaN(q) || q === 0 || !ajustForm.motif) return;
            ajustMutation.mutate({
              articleId,
              lotId: ajustForm.lotId || undefined,
              quantite: q,
              motif: ajustForm.motif,
            });
          }}
          disabled={ajustMutation.isPending}
        >
          Enregistrer l'ajustement
        </Button>
      </section>

      {/* Historique mouvements */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Historique des mouvements
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Type</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Quantite</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Motif</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {mouvements?.map((m) => (
                <tr key={m.id} className="bg-white dark:bg-gray-950">
                  <td className="px-4 py-3 capitalize">{m.typeMouvement}</td>
                  <td className={`px-4 py-3 text-right font-mono ${parseFloat(m.quantite) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {parseFloat(m.quantite) >= 0 ? '+' : ''}{m.quantite}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{m.motif ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(m.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
              {mouvements?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    Aucun mouvement
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
