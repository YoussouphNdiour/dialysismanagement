'use client';

import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const VACATIONS = ['matin', 'apres_midi'] as const;
const VACATION_LABELS: Record<string, string> = { matin: 'Matin (7H-11H)', apres_midi: 'Apres-midi (12H-16H)' };

export function PlanningGridView() {
  const [jourIndex, setJourIndex] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

  const { data: postes, isLoading: postesLoading } = api.postes.list.useQuery();
  const { data: planningData, isLoading: planningsLoading } = api.plannings.list.useQuery({
    jourSemaine: jourIndex,
  });

  const isLoading = postesLoading || planningsLoading;

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const activePostes = postes?.filter((p) => p.isActive) ?? [];

  // Build lookup: posteId+vacation -> planning
  const planningMap = new Map<string, NonNullable<typeof planningData>[number]>();
  for (const item of planningData ?? []) {
    const key = `${item.planning.posteId}-${item.planning.vacation}`;
    planningMap.set(key, item);
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setJourIndex((j) => (j === 0 ? 6 : j - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold">{JOURS[jourIndex]}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setJourIndex((j) => (j === 6 ? 0 : j + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2 text-left">Vacation</th>
              {activePostes.map((poste) => (
                <th
                  key={poste.id}
                  className={`px-3 py-2 text-center ${poste.isVip ? 'border-2 border-amber-400' : ''}`}
                >
                  {poste.nom}
                  {poste.isVip && <Badge className="ml-1 bg-amber-100 text-amber-800 text-xs">VIP</Badge>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VACATIONS.map((vacation) => (
              <tr key={vacation} className="border-b">
                <td className="px-3 py-4 font-medium">{VACATION_LABELS[vacation]}</td>
                {activePostes.map((poste) => {
                  const key = `${poste.id}-${vacation}`;
                  const item = planningMap.get(key);
                  return (
                    <td
                      key={poste.id}
                      className={`px-3 py-4 text-center ${
                        poste.isVip ? 'bg-amber-50 dark:bg-amber-950' : ''
                      } ${!item ? 'text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}`}
                    >
                      {item ? (
                        <div className="text-xs">
                          <p className="font-medium">{item.patient.nom} {item.patient.prenom}</p>
                          <p className="text-gray-500">Dr {item.medecin.nom}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
