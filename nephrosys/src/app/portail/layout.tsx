import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import Link from 'next/link';
import { SignOutButton } from '@/components/auth/sign-out-button';

const NAV_LINKS = [
  { href: '/portail', label: 'Accueil' },
  { href: '/portail/seances', label: 'Mes seances' },
  { href: '/portail/bilans', label: 'Mes bilans' },
  { href: '/portail/factures', label: 'Mes factures' },
  { href: '/portail/ordonnances', label: 'Mes ordonnances' },
];

export default async function PortailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'patient') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="text-xl font-bold text-blue-600">NephroSys</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {session.user.prenom} {session.user.nom}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl gap-1 px-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="border-b-2 border-transparent px-3 py-3 text-sm font-medium text-gray-600 transition hover:border-blue-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Contenu */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
