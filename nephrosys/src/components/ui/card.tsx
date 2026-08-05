import { cn } from '@/lib/utils';

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900',
        className,
      )}
    >
      {children}
    </div>
  );
}
