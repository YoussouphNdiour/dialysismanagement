'use client';

import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const VACATION_LABELS: Record<string, string> = { matin: 'Matin', apres_midi: 'Apres-midi' };

export function PlanningListView() {
  const { data: allPlannings, isLoading } = api.plannings.list.useQuery({});

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  // Group by jour_semaine
  const grouped = new Map<number, NonNullable<typeof allPlannings>>();
  for (const item of allPlannings ?? []) {
    const jour = item.planning.jourSemaine;
    if (!grouped.has(jour)) grouped.set(jour, []);
    grouped.get(jour)!.push(item);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries())
        .sort(([a], [b]) => a - b)
        .map(([jour, items]) => {
          const matin = items.filter((i) => i.planning.vacation === 'matin');
          const apresmidi = items.filter((i) => i.planning.vacation === 'apres_midi');

          return (
            <div key={jour}>
              <h3 className="mb-2 text-lg font-semibold">
                {JOURS[jour]}{' '}
                <span className="text-sm font-normal text-gray-500">
                  ({matin.length} matin, {apresmidi.length} apres-midi)
                </span>
              </h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Vacation</th>
                    <th className="px-3 py-2 text-left">Poste</th>
                    <th className="px-3 py-2 text-left">Patient</th>
                    <th className="px-3 py-2 text-left">Medecin</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.planning.id} className="border-b">
                      <td className="px-3 py-2">{VACATION_LABELS[item.planning.vacation]}</td>
                      <td className="px-3 py-2">
                        {item.poste.nom}
                        {item.poste.isVip && (
                          <Badge className="ml-1 bg-amber-100 text-amber-800 text-xs">VIP</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">{item.patient.nom} {item.patient.prenom}</td>
                      <td className="px-3 py-2">Dr {item.medecin.nom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

      {grouped.size === 0 && (
        <p className="text-center text-gray-500 py-8">Aucune affectation trouvee</p>
      )}
    </div>
  );
}
