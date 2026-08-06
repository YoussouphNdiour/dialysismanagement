'use client';

import { use } from 'react';
import { FactureDetail } from '@/components/facturation/facture-detail';

export default function FactureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <FactureDetail factureId={id} />;
}
