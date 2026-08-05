'use client';

import { SeuilsTable } from '@/components/configuration/seuils-table';

export default function ConfigurationPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Configuration — Seuils cliniques
      </h1>
      <p className="mb-4 text-gray-600 dark:text-gray-400">
        Definissez les seuils de reference pour les parametres biologiques. Les statuts des bilans seront calcules automatiquement en fonction de ces seuils.
      </p>
      <SeuilsTable />
    </div>
  );
}
