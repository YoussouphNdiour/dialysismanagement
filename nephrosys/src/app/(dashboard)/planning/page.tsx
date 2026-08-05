'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/trpc/client';
import { PlanningGridView } from '@/components/planning/planning-grid-view';
import { PlanningCalendarView } from '@/components/planning/planning-calendar-view';
import { PlanningListView } from '@/components/planning/planning-list-view';
import { Grid3X3, Calendar, List } from 'lucide-react';

type ViewMode = 'grille' | 'calendrier' | 'liste';

export default function PlanningPage() {
  const [view, setView] = useState<ViewMode>('grille');
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  });

  const generateMutation = api.plannings.generateWeekSessions.useMutation();

  const handleGenerate = () => {
    if (!weekStart) return;
    generateMutation.mutate({ weekStart });
  };


  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Planning
        </h1>

        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex rounded-lg border">
            <Button
              variant={view === 'grille' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('grille')}
            >
              <Grid3X3 className="mr-1 h-4 w-4" /> Grille
            </Button>
            <Button
              variant={view === 'calendrier' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('calendrier')}
            >
              <Calendar className="mr-1 h-4 w-4" /> Calendrier
            </Button>
            <Button
              variant={view === 'liste' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('liste')}
            >
              <List className="mr-1 h-4 w-4" /> Liste
            </Button>
          </div>
        </div>
      </div>

      {/* Session generation */}
      <div className="mb-6 flex items-center gap-3 rounded-lg border p-3">
        <label className="text-sm font-medium">Generer les seances de la semaine du :</label>
        <input
          type="date"
          className="rounded border px-2 py-1 text-sm"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
        />
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={!weekStart || generateMutation.isPending}
        >
          {generateMutation.isPending ? 'Generation...' : 'Generer'}
        </Button>
        {generateMutation.data && (
          <span className="text-sm text-green-600">{generateMutation.data.message}</span>
        )}
      </div>

      {/* Current view */}
      {view === 'grille' && <PlanningGridView />}
      {view === 'calendrier' && <PlanningCalendarView />}
      {view === 'liste' && <PlanningListView />}
    </div>
  );
}
