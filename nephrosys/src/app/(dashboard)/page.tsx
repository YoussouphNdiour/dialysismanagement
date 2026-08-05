import { auth } from '@/server/auth';

const STAT_CARDS = [
  {
    label: 'Patients actifs',
    value: '—',
    colorText: 'text-blue-700 dark:text-blue-300',
    colorBg: 'bg-white dark:bg-gray-900',
  },
  {
    label: 'Seances du jour',
    value: '—',
    colorText: 'text-green-700 dark:text-green-300',
    colorBg: 'bg-white dark:bg-gray-900',
  },
  {
    label: 'Bilans en attente',
    value: '—',
    colorText: 'text-orange-700 dark:text-orange-300',
    colorBg: 'bg-white dark:bg-gray-900',
  },
  {
    label: 'Alertes',
    value: '—',
    colorText: 'text-red-700 dark:text-red-300',
    colorBg: 'bg-white dark:bg-gray-900',
  },
];

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Tableau de bord
      </h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        Bienvenue, {user.prenom} {user.nom}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border border-gray-200 p-6 dark:border-gray-800 ${stat.colorBg}`}
          >
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {stat.label}
            </p>
            <p className={`mt-2 text-3xl font-bold ${stat.colorText}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
