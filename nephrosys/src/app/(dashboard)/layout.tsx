import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { getMenuItemsForRole, type UserRole } from '@/lib/permissions';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const role = session.user.role as UserRole;

  if (role === 'patient') {
    redirect('/portail');
  }

  const menuItems = getMenuItemsForRole(role);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar items={menuItems} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          user={{
            nom: session.user.nom,
            prenom: session.user.prenom,
            role: session.user.role,
          }}
        />
        <main className="flex-1 overflow-auto bg-gray-50 p-6 dark:bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  );
}
