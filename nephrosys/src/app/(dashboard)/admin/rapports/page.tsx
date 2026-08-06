'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function AdminRapportsPage() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  function handleGenerate() {
    if (!selectedMonth) return;
    window.open(`/api/reports/monthly/${selectedMonth}`, '_blank');
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Rapports
      </h1>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Rapport mensuel d&apos;activite
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label="Mois"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <Button onClick={handleGenerate} disabled={!selectedMonth}>
            Generer le rapport mensuel
          </Button>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Le rapport sera genere en PDF et ouvert dans un nouvel onglet.
          Il inclut les seances, le taux d&apos;occupation, le chiffre d&apos;affaires,
          et le taux d&apos;adequation Kt/V pour le mois selectionne.
        </p>
      </Card>
    </div>
  );
}
