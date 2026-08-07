'use client';

import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function PortailAccueilPage() {
  const { data: profil, isLoading: profilLoading } = api.portail.monProfil.useQuery();
  const { data: seances, isLoading: seancesLoading } = api.portail.mesSeances.useQuery({
    page: 1,
    perPage: 3,
  });
  const { data: ordonnances, isLoading: ordLoading } = api.portail.mesOrdonnances.useQuery();

  const isLoading = profilLoading || seancesLoading || ordLoading;

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const prochainesSeances = seances?.filter((s) => s.statut === 'planifiee') ?? [];
  const derniereOrdonnance = ordonnances?.[0] ?? null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Bienvenue, {profil?.prenom} {profil?.nom}
      </h1>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Card prochaines seances */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Prochaines seances
          </h2>
          {prochainesSeances.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune seance planifiee</p>
          ) : (
            <ul className="space-y-2">
              {prochainesSeances.slice(0, 3).map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{s.dateSeance}</span>
                  <span className="text-gray-500">{s.poste.nom}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/portail/seances"
            className="mt-4 block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Voir toutes mes seances →
          </Link>
        </div>

        {/* Card derniere ordonnance */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Derniere ordonnance active
          </h2>
          {derniereOrdonnance ? (
            <div>
              <p className="text-sm text-gray-500">{derniereOrdonnance.ordonnance.datePrescription}</p>
              <p className="mt-2 line-clamp-3 text-sm text-gray-700 dark:text-gray-300">
                {derniereOrdonnance.ordonnance.contenu}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aucune ordonnance active</p>
          )}
          <Link
            href="/portail/ordonnances"
            className="mt-4 block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Voir toutes mes ordonnances →
          </Link>
        </div>
      </div>
    </div>
  );
}
