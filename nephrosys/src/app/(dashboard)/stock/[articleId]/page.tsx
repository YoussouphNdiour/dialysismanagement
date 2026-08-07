import { use } from 'react';
import { StockDetail } from '@/components/stock/stock-detail';

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = use(params);
  return <StockDetail articleId={articleId} />;
}
