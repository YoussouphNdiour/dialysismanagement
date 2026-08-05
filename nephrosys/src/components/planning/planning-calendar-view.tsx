'use client';

import { api } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const VACATION_LABELS: Record<string, string> = { matin: 'M', apres_midi: 'AM' };

export function PlanningCalendarView() {
  const { data: postes, isLoading: postesLoading } = api.postes.list.useQuery();

  // Load plannings for all days 0-5 (lun-sam)
  const { data: allPlannings, isLoading: planningsLoading } = api.plannings.list.useQuery({});

  const isLoading = postesLoading || planningsLoading;

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const activePostes = postes?.filter((p) => p.isActive) ?? [];

  // Build lookup: jourSemaine+posteId+vacation -> planning
  const planningMap = new Map<string, NonNullable<typeof allPlannings>[number]>();
  for (const item of allPlannings ?? []) {
    const key = `${item.planning.jourSemaine}-${item.planning.posteId}-${item.planning.vacation}`;
    planningMap.set(key, item);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-2 text-left">Poste</th>
            {JOURS.map((jour, i) => (
              <th key={i} className="px-2 py-2 text-center">
                {jour}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activePostes.map((poste) => (
            <tr key={poste.id} className={`border-b ${poste.isVip ? 'bg-amber-50 dark:bg-amber-950' : ''}`}>
              <td className="px-2 py-2 font-medium whitespace-nowrap">
                {poste.nom}
                {poste.isVip && <Badge className="ml-1 bg-amber-100 text-amber-800 text-xs">VIP</Badge>}
              </td>
              {JOURS.map((_, jourIndex) => (
                <td key={jourIndex} className="px-1 py-1">
                  <div className="space-y-1">
                    {(['matin', 'apres_midi'] as const).map((vacation) => {
                      const key = `${jourIndex}-${poste.id}-${vacation}`;
                      const item = planningMap.get(key);
                      return (
                        <div
                          key={vacation}
                          className={`rounded px-1 py-0.5 text-center ${
                            item
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-gray-50 text-gray-300 dark:bg-gray-800'
                          }`}
                        >
                          {item ? (
                            <span className="truncate block">{VACATION_LABELS[vacation]}: {item.patient.nom}</span>
                          ) : (
                            <span>{VACATION_LABELS[vacation]}: —</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
