import { Card } from '@/components/ui/card';

type StatCardProps = {
  label: string;
  value: string | number;
  colorText?: string;
  subtitle?: string;
  href?: string;
};

export function StatCard({ label, value, colorText = 'text-gray-900 dark:text-white', subtitle }: StatCardProps) {
  return (
    <Card>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colorText}`}>{value}</p>
      {subtitle && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      )}
    </Card>
  );
}
