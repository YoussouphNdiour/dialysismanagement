'use client';

import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function PortailBilansPage() {
  const { data, isLoading } = api.portail.mesBilans.useQuery();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Mes bilans</h1>
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Reference</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {data?.map((b) => (
              <tr key={b.id} className="bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900">
                <td className="px-4 py-3">
                  <Link href={`/portail/bilans/${b.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                    {b.dateBilan}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-gray-500">{b.reference}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{b.typeBilan}</td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  Aucun bilan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
