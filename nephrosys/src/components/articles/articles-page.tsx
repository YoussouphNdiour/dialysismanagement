'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIE_OPTIONS = [
  { value: '', label: 'Toutes les categories' },
  { value: 'medicament', label: 'Medicament' },
  { value: 'consommable', label: 'Consommable' },
  { value: 'acte_medical', label: 'Acte medical' },
];

const CATEGORIE_BADGES: Record<string, { variant: 'info' | 'success' | 'default'; label: string }> = {
  medicament: { variant: 'info', label: 'Medicament' },
  consommable: { variant: 'success', label: 'Consommable' },
  acte_medical: { variant: 'default', label: 'Acte medical' },
};

const UNITE_OPTIONS = [
  { value: 'unite', label: 'Unite' },
  { value: 'mg', label: 'mg' },
  { value: 'ml', label: 'ml' },
  { value: 'UI', label: 'UI' },
  { value: 'seance', label: 'Seance' },
];

const VOIE_OPTIONS = [
  { value: '', label: 'Aucune' },
  { value: 'IV', label: 'IV' },
  { value: 'SC', label: 'SC' },
  { value: 'PO', label: 'PO' },
  { value: 'IM', label: 'IM' },
];

type FormData = {
  nom: string;
  categorie: 'medicament' | 'consommable' | 'acte_medical';
  prixUnitaire: string;
  unite: string;
  voieAdministration: string;
};

const EMPTY_FORM: FormData = {
  nom: '',
  categorie: 'medicament',
  prixUnitaire: '',
  unite: 'unite',
  voieAdministration: '',
};

export function ArticlesPage() {
  const [categorieFilter, setCategorieFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const utils = api.useUtils();

  const { data: articlesList, isLoading } = api.articles.list.useQuery({
    categorie: categorieFilter ? (categorieFilter as 'medicament' | 'consommable' | 'acte_medical') : undefined,
    activeOnly: false,
  });

  const createMutation = api.articles.create.useMutation({
    onSuccess: () => {
      void utils.articles.list.invalidate();
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  const updateMutation = api.articles.update.useMutation({
    onSuccess: () => {
      void utils.articles.list.invalidate();
      setEditId(null);
      setForm(EMPTY_FORM);
    },
  });

  const toggleMutation = api.articles.toggleActive.useMutation({
    onSuccess: () => void utils.articles.list.invalidate(),
  });

  function handleSubmit() {
    const prixUnitaire = parseFloat(form.prixUnitaire);
    if (isNaN(prixUnitaire) || prixUnitaire <= 0) return;

    if (editId) {
      updateMutation.mutate({
        id: editId,
        nom: form.nom,
        categorie: form.categorie,
        prixUnitaire,
        unite: form.unite,
        voieAdministration: form.voieAdministration || undefined,
      });
    } else {
      createMutation.mutate({
        nom: form.nom,
        categorie: form.categorie,
        prixUnitaire,
        unite: form.unite,
        voieAdministration: form.voieAdministration || undefined,
      });
    }
  }

  function startEdit(article: NonNullable<typeof articlesList>[number]) {
    setEditId(article.id);
    setForm({
      nom: article.nom,
      categorie: article.categorie,
      prixUnitaire: article.prixUnitaire,
      unite: article.unite,
      voieAdministration: article.voieAdministration ?? '',
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Catalogue d&apos;articles
        </h1>
        <div className="flex items-center gap-3">
          <Select
            options={CATEGORIE_OPTIONS}
            value={categorieFilter}
            onChange={(e) => setCategorieFilter(e.target.value)}
            placeholder="Filtrer par categorie"
          />
          <Button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}>
            Nouvel article
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            {editId ? 'Modifier l\'article' : 'Nouvel article'}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Nom"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
            />
            <Select
              label="Categorie"
              options={CATEGORIE_OPTIONS.slice(1)}
              value={form.categorie}
              onChange={(e) => setForm({ ...form, categorie: e.target.value as FormData['categorie'] })}
            />
            <Input
              label="Prix unitaire (FCFA)"
              type="number"
              value={form.prixUnitaire}
              onChange={(e) => setForm({ ...form, prixUnitaire: e.target.value })}
            />
            <Select
              label="Unite"
              options={UNITE_OPTIONS}
              value={form.unite}
              onChange={(e) => setForm({ ...form, unite: e.target.value })}
            />
            <Select
              label="Voie d'administration"
              options={VOIE_OPTIONS}
              value={form.voieAdministration}
              onChange={(e) => setForm({ ...form, voieAdministration: e.target.value })}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editId ? 'Enregistrer' : 'Creer'}
            </Button>
            <Button variant="outline" onClick={cancelForm}>
              Annuler
            </Button>
          </div>
          {(createMutation.error ?? updateMutation.error) && (
            <p className="mt-2 text-sm text-red-500">
              {createMutation.error?.message ?? updateMutation.error?.message}
            </p>
          )}
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Nom</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Categorie</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Prix unitaire</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Unite</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Statut</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {articlesList?.map((article) => {
                  const catBadge = CATEGORIE_BADGES[article.categorie] ?? CATEGORIE_BADGES['medicament']!;
                  return (
                    <tr key={article.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{article.nom}</td>
                      <td className="px-4 py-3">
                        <Badge variant={catBadge.variant}>{catBadge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {parseFloat(article.prixUnitaire).toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{article.unite}</td>
                      <td className="px-4 py-3">
                        <Badge variant={article.isActive ? 'success' : 'danger'}>
                          {article.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(article)}>
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleMutation.mutate({ id: article.id })}
                            disabled={toggleMutation.isPending}
                          >
                            {article.isActive ? 'Desactiver' : 'Activer'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {articlesList?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Aucun article trouve
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
