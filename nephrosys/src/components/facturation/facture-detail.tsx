'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const STATUT_BADGES: Record<string, { variant: 'default' | 'info' | 'success' | 'danger'; label: string }> = {
  brouillon: { variant: 'default', label: 'Brouillon' },
  validee: { variant: 'info', label: 'Validee' },
  payee: { variant: 'success', label: 'Payee' },
  annulee: { variant: 'danger', label: 'Annulee' },
};

const MODE_PAIEMENT_OPTIONS = [
  { value: 'especes', label: 'Especes' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'virement', label: 'Virement' },
  { value: 'mobile_money', label: 'Mobile Money' },
];

type Props = {
  factureId: string;
};

export function FactureDetail({ factureId }: Props) {
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [modePaiement, setModePaiement] = useState('especes');

  const utils = api.useUtils();

  const { data: facture, isLoading } = api.factures.getById.useQuery({ id: factureId });

  const { data: articlesList } = api.articles.list.useQuery(
    { activeOnly: true },
    { enabled: facture?.statut === 'brouillon' },
  );

  const addLigneMutation = api.factures.addLigne.useMutation({
    onSuccess: () => {
      void utils.factures.getById.invalidate({ id: factureId });
      setSelectedArticleId('');
      setQuantite('1');
    },
  });

  const removeLigneMutation = api.factures.removeLigne.useMutation({
    onSuccess: () => void utils.factures.getById.invalidate({ id: factureId }),
  });

  const validerMutation = api.factures.valider.useMutation({
    onSuccess: () => void utils.factures.getById.invalidate({ id: factureId }),
  });

  const paiementMutation = api.factures.enregistrerPaiement.useMutation({
    onSuccess: () => void utils.factures.getById.invalidate({ id: factureId }),
  });

  const annulerMutation = api.factures.annuler.useMutation({
    onSuccess: () => void utils.factures.getById.invalidate({ id: factureId }),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!facture) return <p className="text-red-500">Facture non trouvee</p>;

  const badge = STATUT_BADGES[facture.statut] ?? STATUT_BADGES['brouillon']!;
  const isBrouillon = facture.statut === 'brouillon';
  const isValidee = facture.statut === 'validee';

  const articleOptions = (articlesList ?? []).map((a) => ({
    value: a.id,
    label: `${a.nom} — ${parseFloat(a.prixUnitaire).toLocaleString('fr-FR')} FCFA/${a.unite}`,
  }));

  function handleAddLigne() {
    if (!selectedArticleId) return;
    const qty = parseFloat(quantite);
    if (isNaN(qty) || qty <= 0) return;
    addLigneMutation.mutate({
      factureId,
      articleId: selectedArticleId,
      quantite: qty,
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Facture {facture.reference}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {facture.patient?.nom} {facture.patient?.prenom} | {facture.dateFacture}
            {facture.session && (
              <>
                {' '}
                |{' '}
                <Link
                  href={`/seances/${facture.session.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Seance du {facture.session.dateSeance}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>

          {isBrouillon && (
            <Button
              onClick={() => validerMutation.mutate({ factureId })}
              disabled={validerMutation.isPending}
            >
              Valider
            </Button>
          )}

          {isValidee && (
            <div className="flex items-center gap-2">
              <Select
                options={MODE_PAIEMENT_OPTIONS}
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value)}
              />
              <Button
                onClick={() =>
                  paiementMutation.mutate({
                    factureId,
                    modePaiement: modePaiement as 'especes' | 'cheque' | 'virement' | 'mobile_money',
                  })
                }
                disabled={paiementMutation.isPending}
              >
                Enregistrer le paiement
              </Button>
            </div>
          )}

          {(isBrouillon || isValidee) && (
            <Button
              variant="danger"
              onClick={() => annulerMutation.mutate({ factureId })}
              disabled={annulerMutation.isPending}
            >
              Annuler
            </Button>
          )}
        </div>
      </div>

      {/* Error messages */}
      {(validerMutation.error ?? paiementMutation.error ?? annulerMutation.error) && (
        <Card className="mb-4 border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">
            {validerMutation.error?.message ??
              paiementMutation.error?.message ??
              annulerMutation.error?.message}
          </p>
        </Card>
      )}

      {/* Montants */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Montant base (forfait)</p>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {parseFloat(facture.montantBase).toLocaleString('fr-FR')} FCFA
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Supplements</p>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {parseFloat(facture.montantSupplements).toLocaleString('fr-FR')} FCFA
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</p>
          <p className="mt-1 text-xl font-bold text-green-700 dark:text-green-300">
            {parseFloat(facture.montantTotal).toLocaleString('fr-FR')} FCFA
          </p>
        </Card>
      </div>

      {/* Payment info */}
      {facture.statut === 'payee' && facture.modePaiement && (
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Mode de paiement</p>
              <p className="text-gray-900 dark:text-white">
                {MODE_PAIEMENT_OPTIONS.find((o) => o.value === facture.modePaiement)?.label ??
                  facture.modePaiement}
              </p>
            </div>
            {facture.datePaiement && (
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Date de paiement</p>
                <p className="text-gray-900 dark:text-white">
                  {new Date(facture.datePaiement).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Lignes table */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Lignes de facturation
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Designation</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Quantite</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Prix unitaire</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Montant</th>
                {isBrouillon && (
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {facture.lignes.map((ligne) => (
                <tr key={ligne.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {ligne.designation}
                    {ligne.articleId === null && (
                      <Badge variant="info" className="ml-2">
                        Forfait
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {parseFloat(ligne.quantite)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {parseFloat(ligne.prixUnitaire).toLocaleString('fr-FR')} FCFA
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {parseFloat(ligne.montant).toLocaleString('fr-FR')} FCFA
                  </td>
                  {isBrouillon && (
                    <td className="px-4 py-3">
                      {ligne.articleId !== null && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => removeLigneMutation.mutate({ ligneId: ligne.id })}
                          disabled={removeLigneMutation.isPending}
                        >
                          Supprimer
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add supplement form — only for brouillon */}
        {isBrouillon && (
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Ajouter un supplement
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[300px] flex-1">
                <Select
                  label="Article"
                  options={articleOptions}
                  value={selectedArticleId}
                  onChange={(e) => setSelectedArticleId(e.target.value)}
                  placeholder="Selectionner un article"
                />
              </div>
              <div className="w-24">
                <Input
                  label="Quantite"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                />
              </div>
              <Button
                onClick={handleAddLigne}
                disabled={addLigneMutation.isPending || !selectedArticleId}
              >
                Ajouter
              </Button>
            </div>
            {addLigneMutation.error && (
              <p className="mt-2 text-sm text-red-500">{addLigneMutation.error.message}</p>
            )}
          </div>
        )}
      </Card>

      {/* Notes */}
      {facture.notes && (
        <Card className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Notes</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{facture.notes}</p>
        </Card>
      )}

      {/* Created by */}
      {facture.createdByUser && (
        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          Creee par {facture.createdByUser.prenom} {facture.createdByUser.nom} le{' '}
          {new Date(facture.createdAt).toLocaleDateString('fr-FR')}
        </p>
      )}
    </div>
  );
}
