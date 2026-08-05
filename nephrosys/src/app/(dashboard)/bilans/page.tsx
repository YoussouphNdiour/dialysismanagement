'use client';

import { BilanTable } from '@/components/bilans/bilan-table';

export default function BilansPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Bilans biologiques
      </h1>
      <BilanTable />
    </div>
  );
}
