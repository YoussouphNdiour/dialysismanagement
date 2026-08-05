import { Badge } from '@/components/ui/badge';

const STATUT_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  actif: { label: 'Actif', variant: 'success' },
  inactif: { label: 'Inactif', variant: 'default' },
  transfere: { label: 'Transfere', variant: 'warning' },
  decede: { label: 'Decede', variant: 'danger' },
};

export function PatientBadge({ statut }: { statut: string }) {
  const config = STATUT_CONFIG[statut] || { label: statut, variant: 'default' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
