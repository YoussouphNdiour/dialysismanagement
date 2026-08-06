'use client';

import { AdminDashboard } from './admin-dashboard';
import { MedecinDashboard } from './medecin-dashboard';
import { InfirmiereDashboard } from './infirmiere-dashboard';
import { SecretaireDashboard } from './secretaire-dashboard';

type Props = {
  role: string;
};

export function DashboardClient({ role }: Props) {
  switch (role) {
    case 'admin':
    case 'facturation':
      return <AdminDashboard />;
    case 'medecin':
      return <MedecinDashboard />;
    case 'infirmiere':
      return <InfirmiereDashboard />;
    case 'secretaire':
      return <SecretaireDashboard />;
    case 'patient':
      return (
        <div className="rounded-xl border border-gray-200 p-8 text-center dark:border-gray-800">
          <p className="text-lg text-gray-500 dark:text-gray-400">
            Portail patient bientot disponible
          </p>
        </div>
      );
    default:
      return null;
  }
}
