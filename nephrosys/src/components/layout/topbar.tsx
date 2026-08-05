'use client';

import { signOut } from 'next-auth/react';
import { LogOut, User } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';

type TopbarProps = {
  user: {
    nom: string;
    prenom: string;
    role: string;
  };
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  medecin: 'Medecin',
  infirmiere: 'Infirmiere',
  secretaire: 'Secretaire',
  facturation: 'Facturation',
  patient: 'Patient',
};

export function Topbar({ user }: TopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900">
      <div />

      <div className="flex items-center gap-4">
        <ThemeToggle />

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            <User size={18} />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {user.prenom} {user.nom}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Se deconnecter"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
