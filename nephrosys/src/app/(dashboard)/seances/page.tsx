'use client';

import { SessionTable } from '@/components/sessions/session-table';

export default function SeancesPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Seances de dialyse
      </h1>
      <SessionTable />
    </div>
  );
}
