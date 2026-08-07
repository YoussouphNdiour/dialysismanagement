'use client';

import { use } from 'react';
import { api } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function PortailBilanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: bilan, isLoading } = api.portail.bilanDetail.useQuery({ bilanId: id });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!bilan) return <p className="text-red-500">Bilan non trouve</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portail/bilans" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Mes bilans
        </Link>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
          Bilan du {bilan.dateBilan}
        </h1>
        <p className="mb-6 text-sm text-gray-500">Ref: {bilan.reference} — {bilan.typeBilan}</p>
        <p className="text-sm text-gray-500 italic">
          Detail des valeurs biologiques disponible dans votre dossier medical.
          Consultez votre medecin pour les interpretations.
        </p>
      </div>
    </div>
  );
}
