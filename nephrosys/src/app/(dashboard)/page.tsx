import { auth } from '@/server/auth';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Tableau de bord
      </h1>
      <p className="mt-2 mb-6 text-gray-500 dark:text-gray-400">
        Bienvenue, {user.prenom} {user.nom}
      </p>

      <DashboardClient role={user.role} />
    </div>
  );
}
