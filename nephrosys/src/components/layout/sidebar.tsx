'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Activity,
  Calendar,
  FlaskConical,
  Receipt,
  Shield,
  Settings,
  Package,
  Warehouse,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/lib/permissions';
import { api } from '@/lib/trpc/client';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  LayoutDashboard,
  Users,
  Activity,
  Calendar,
  FlaskConical,
  Receipt,
  Shield,
  Settings,
  Package,
  Warehouse,
  AlertTriangle,
  FileText,
};

type SidebarProps = {
  items: MenuItem[];
};

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const hasStockItem = items.some((item) => item.href === '/stock');
  const { data: alertesData } = api.stock.alertesCount.useQuery(undefined, {
    enabled: hasStockItem,
    refetchInterval: 60_000,
  });
  const alertesCount = alertesData?.count ?? 0;

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-900',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
        {!collapsed && (
          <span className="text-xl font-bold text-blue-600">NephroSys</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={collapsed ? 'Ouvrir le menu' : 'Reduire le menu'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 p-2">
        {items.map((item) => {
          const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const showBadge = item.href === '/stock' && alertesCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} />
              {!collapsed && (
                <span className="flex-1">{item.label}</span>
              )}
              {!collapsed && showBadge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                  {alertesCount > 99 ? '99+' : alertesCount}
                </span>
              )}
              {collapsed && showBadge && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {alertesCount > 99 ? '99+' : alertesCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
