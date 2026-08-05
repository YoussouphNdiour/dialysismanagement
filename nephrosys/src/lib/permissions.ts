export const USER_ROLES = [
  'admin',
  'secretaire',
  'medecin',
  'infirmiere',
  'facturation',
  'patient',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

type RoutePermission = {
  path: string;
  roles: UserRole[];
};

const ROUTE_PERMISSIONS: RoutePermission[] = [
  { path: '/patients', roles: ['admin', 'medecin', 'infirmiere', 'secretaire', 'facturation'] },
  { path: '/seances/nouvelle', roles: ['admin', 'medecin', 'secretaire'] },
  { path: '/seances', roles: ['admin', 'medecin', 'infirmiere', 'secretaire'] },
  { path: '/bilans/nouveau', roles: ['admin', 'medecin'] },
  { path: '/bilans', roles: ['admin', 'medecin', 'infirmiere'] },
  { path: '/planning/postes', roles: ['admin', 'medecin', 'secretaire'] },
  { path: '/planning', roles: ['admin', 'medecin', 'infirmiere', 'secretaire'] },
  { path: '/facturation', roles: ['admin', 'facturation'] },
  { path: '/admin', roles: ['admin'] },
  { path: '/portail', roles: ['patient'] },
];

export function canAccess(role: UserRole, path: string): boolean {
  if (role === 'admin' && !path.startsWith('/portail')) return true;

  const permission = ROUTE_PERMISSIONS.find((p) => path.startsWith(p.path));
  if (!permission) return true; // dashboard home — all backend roles
  return permission.roles.includes(role);
}

export type MenuItem = {
  label: string;
  href: string;
  icon: string; // lucide icon name
};

const ALL_MENU_ITEMS: (MenuItem & { roles: UserRole[] })[] = [
  {
    label: 'Tableau de bord',
    href: '/',
    icon: 'LayoutDashboard',
    roles: ['admin', 'medecin', 'infirmiere', 'secretaire', 'facturation'],
  },
  {
    label: 'Patients',
    href: '/patients',
    icon: 'Users',
    roles: ['admin', 'medecin', 'infirmiere', 'secretaire', 'facturation'],
  },
  {
    label: 'Seances',
    href: '/seances',
    icon: 'Activity',
    roles: ['admin', 'medecin', 'infirmiere', 'secretaire'],
  },
  {
    label: 'Planning',
    href: '/planning',
    icon: 'Calendar',
    roles: ['admin', 'medecin', 'infirmiere', 'secretaire'],
  },
  {
    label: 'Bilans',
    href: '/bilans',
    icon: 'FlaskConical',
    roles: ['admin', 'medecin', 'infirmiere'],
  },
  {
    label: 'Facturation',
    href: '/facturation',
    icon: 'Receipt',
    roles: ['admin', 'facturation'],
  },
  {
    label: 'Utilisateurs',
    href: '/admin/utilisateurs',
    icon: 'Shield',
    roles: ['admin'],
  },
  {
    label: 'Configuration',
    href: '/admin/configuration',
    icon: 'Settings',
    roles: ['admin'],
  },
];

export function getMenuItemsForRole(role: UserRole): MenuItem[] {
  return ALL_MENU_ITEMS.filter((item) => item.roles.includes(role)).map(
    ({ label, href, icon }) => ({ label, href, icon }),
  );
}

export const ROLE_MENU_ITEMS: Record<UserRole, MenuItem[]> = {
  admin: getMenuItemsForRole('admin'),
  secretaire: getMenuItemsForRole('secretaire'),
  medecin: getMenuItemsForRole('medecin'),
  infirmiere: getMenuItemsForRole('infirmiere'),
  facturation: getMenuItemsForRole('facturation'),
  patient: getMenuItemsForRole('patient'),
};
