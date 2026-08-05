# NephroSys Phase 1 : Fondations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Next.js 15 application with PostgreSQL database, Auth.js v5 authentication with 6-role RBAC, responsive layout (sidebar + topbar), and full Patients CRUD — the foundation for all subsequent clinical features.

**Architecture:** Monolith Next.js 15 App Router with tRPC v11 for type-safe API, Drizzle ORM for database access, Auth.js v5 Credentials provider for authentication. All code in a single `nephrosys/` project directory created fresh.

**Tech Stack:** Next.js 15 (App Router), React 19, tRPC v11, Drizzle ORM, PostgreSQL 16, Auth.js v5, Tailwind CSS v4, Vitest, Playwright, TypeScript 5.x, pnpm

## Global Constraints

- Language: French for all UI labels, error messages, placeholders. Code (variables, functions, comments) in English.
- Node.js >= 20
- pnpm as package manager (not npm, not yarn)
- All IDs are UUIDs (crypto.randomUUID())
- All timestamps use UTC
- Passwords hashed with bcrypt (12 rounds)
- Every table has `created_at` and `updated_at` timestamps with defaults
- Drizzle ORM in "snake_case" for DB columns, camelCase for TypeScript
- tRPC procedures use Zod for input validation
- Tests: Vitest for unit/integration, Playwright for E2E
- Commit messages follow conventional commits (feat:, fix:, test:, chore:)

## File Structure

```
nephrosys/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── drizzle.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── .env.example
├── .env.local                        (gitignored)
├── docker-compose.yml                (dev PostgreSQL)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                (root layout, fonts, providers)
│   │   ├── globals.css               (Tailwind imports + custom vars)
│   │   │
│   │   ├── (auth)/
│   │   │   ├── layout.tsx            (centered, no sidebar)
│   │   │   └── login/
│   │   │       └── page.tsx          (login form)
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx            (sidebar + topbar + role guard)
│   │   │   ├── page.tsx              (dashboard home — placeholder)
│   │   │   └── patients/
│   │   │       ├── page.tsx          (list with search, pagination)
│   │   │       ├── nouveau/
│   │   │       │   └── page.tsx      (create patient form)
│   │   │       └── [id]/
│   │   │           └── page.tsx      (patient detail/edit form)
│   │   │
│   │   └── api/
│   │       ├── trpc/[trpc]/route.ts  (tRPC HTTP handler)
│   │       ├── auth/[...nextauth]/route.ts (Auth.js route)
│   │       └── health/route.ts       (health check)
│   │
│   ├── server/
│   │   ├── db/
│   │   │   ├── index.ts              (drizzle client instance)
│   │   │   ├── schema/
│   │   │   │   ├── index.ts          (re-exports all schemas)
│   │   │   │   ├── users.ts          (users table)
│   │   │   │   ├── patients.ts       (patients table)
│   │   │   │   ├── enums.ts          (shared pgEnum definitions)
│   │   │   │   └── relations.ts      (drizzle relations)
│   │   │   └── seed.ts               (seed script)
│   │   │
│   │   ├── auth/
│   │   │   ├── config.ts             (Auth.js configuration)
│   │   │   └── index.ts              (auth() helper export)
│   │   │
│   │   └── trpc/
│   │       ├── index.ts              (tRPC init, context, middleware)
│   │       ├── router.ts             (root router merging all routers)
│   │       └── routers/
│   │           ├── auth.router.ts    (me, changePassword)
│   │           ├── patients.router.ts (list, getById, create, update, search)
│   │           └── users.router.ts   (list, create, update, toggleActive)
│   │
│   ├── lib/
│   │   ├── trpc/
│   │   │   ├── client.ts            (tRPC React client hooks)
│   │   │   ├── server.ts            (tRPC server caller for RSC)
│   │   │   └── provider.tsx         (TRPCProvider wrapper)
│   │   ├── permissions.ts           (role-based access matrix)
│   │   ├── validators/
│   │   │   ├── auth.ts              (login schema)
│   │   │   ├── patients.ts          (patient create/update schemas)
│   │   │   └── users.ts             (user create/update schemas)
│   │   └── utils.ts                 (cn(), formatDateFR(), etc.)
│   │
│   ├── components/
│   │   ├── ui/                       (base UI components)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── card.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── toast.tsx
│   │   │   └── skeleton.tsx
│   │   ├── layout/
│   │   │   ├── sidebar.tsx           (navigation sidebar)
│   │   │   ├── topbar.tsx            (top navigation bar)
│   │   │   └── theme-toggle.tsx      (dark mode toggle)
│   │   ├── patients/
│   │   │   ├── patient-form.tsx      (create/edit form)
│   │   │   ├── patient-table.tsx     (list with columns)
│   │   │   └── patient-badge.tsx     (status badge)
│   │   └── providers.tsx             (session + trpc + theme providers)
│   │
│   ├── hooks/
│   │   └── use-debounce.ts
│   │
│   └── middleware.ts                 (auth + role route protection)
│
├── tests/
│   ├── unit/
│   │   ├── permissions.test.ts
│   │   ├── validators.test.ts
│   │   └── utils.test.ts
│   ├── integration/
│   │   ├── helpers/
│   │   │   └── setup.ts             (test DB setup, cleanup)
│   │   ├── auth.test.ts
│   │   ├── patients.test.ts
│   │   └── users.test.ts
│   └── e2e/
│       ├── auth/
│       │   └── login.spec.ts
│       └── patients/
│           └── crud.spec.ts
│
└── drizzle/                          (generated migrations)
    └── 0000_initial.sql
```

---

### Task 1: Project Scaffolding and Configuration

**Files:**
- Create: `nephrosys/package.json`
- Create: `nephrosys/tsconfig.json`
- Create: `nephrosys/next.config.ts`
- Create: `nephrosys/tailwind.config.ts`
- Create: `nephrosys/drizzle.config.ts`
- Create: `nephrosys/vitest.config.ts`
- Create: `nephrosys/.env.example`
- Create: `nephrosys/docker-compose.yml`
- Create: `nephrosys/src/app/layout.tsx`
- Create: `nephrosys/src/app/globals.css`
- Create: `nephrosys/src/lib/utils.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces:
  - `cn(...inputs: ClassValue[]): string` — Tailwind class merger
  - `formatDateFR(date: Date | string): string` — returns "DD/MM/YYYY"
  - Working Next.js dev server at http://localhost:3000
  - PostgreSQL dev container at localhost:5433

- [ ] **Step 1: Create project directory and initialize**

```bash
mkdir -p nephrosys
cd nephrosys
pnpm init
```

- [ ] **Step 2: Install core dependencies**

```bash
pnpm add next@latest react@latest react-dom@latest
pnpm add drizzle-orm postgres
pnpm add @trpc/server@next @trpc/client@next @trpc/react-query@next @tanstack/react-query
pnpm add next-auth@beta @auth/drizzle-adapter
pnpm add bcryptjs
pnpm add zod
pnpm add clsx tailwind-merge
pnpm add lucide-react
pnpm add react-hook-form @hookform/resolvers

pnpm add -D typescript @types/react @types/react-dom @types/node @types/bcryptjs
pnpm add -D tailwindcss @tailwindcss/postcss postcss
pnpm add -D drizzle-kit
pnpm add -D vitest @vitejs/plugin-react
pnpm add -D playwright @playwright/test
pnpm add -D eslint eslint-config-next
pnpm add -D tsx
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

- [ ] **Step 5: Create `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        nephro: {
          green: '#22c55e',
          red: '#ef4444',
          orange: '#f97316',
          blue: '#3b82f6',
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Create `src/app/globals.css`**

```css
@import 'tailwindcss';

@theme {
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;
  --color-primary-950: #172554;

  --color-nephro-green: #22c55e;
  --color-nephro-red: #ef4444;
  --color-nephro-orange: #f97316;
  --color-nephro-blue: #3b82f6;
}

body {
  @apply bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100;
}
```

- [ ] **Step 7: Create `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NephroSys',
  description: 'Systeme de gestion de nephrologie',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Create `src/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDateFR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function generateReference(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${y}${m}${d}-${rand}`;
}
```

- [ ] **Step 9: Create `drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 10: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 11: Create `.env.example`**

```env
# Database
DATABASE_URL=postgresql://nephrosys:nephrosys_dev@localhost:5433/nephrosys

# Auth.js
AUTH_SECRET=generate-a-random-secret-here
AUTH_URL=http://localhost:3000

# App
NODE_ENV=development
```

- [ ] **Step 12: Create `docker-compose.yml` for dev PostgreSQL**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: nephrosys
      POSTGRES_USER: nephrosys
      POSTGRES_PASSWORD: nephrosys_dev
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 13: Add scripts to `package.json`**

Add these scripts to the `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . && tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:seed": "tsx src/server/db/seed.ts"
  }
}
```

- [ ] **Step 14: Create `.env.local` from example, start DB, verify dev server**

```bash
cp .env.example .env.local
docker compose up -d
pnpm dev
```

Open http://localhost:3000 — should show the default Next.js page.

- [ ] **Step 15: Write unit test for utils**

Create `tests/unit/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { cn, formatDateFR, generateReference } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('resolves Tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'end')).toBe('base end');
  });
});

describe('formatDateFR', () => {
  it('formats Date object to DD/MM/YYYY', () => {
    const date = new Date('2026-08-05T00:00:00Z');
    expect(formatDateFR(date)).toBe('05/08/2026');
  });

  it('formats ISO string to DD/MM/YYYY', () => {
    expect(formatDateFR('2026-01-15T00:00:00Z')).toBe('15/01/2026');
  });
});

describe('generateReference', () => {
  it('starts with given prefix', () => {
    const ref = generateReference('PAT');
    expect(ref).toMatch(/^PAT-\d{8}-[A-Z0-9]{4}$/);
  });
});
```

- [ ] **Step 16: Run tests**

```bash
pnpm test
```

Expected: 5 tests PASS.

- [ ] **Step 17: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 project with Tailwind, Drizzle, Vitest config"
```

---

### Task 2: Database Schema and Migrations

**Files:**
- Create: `nephrosys/src/server/db/schema/enums.ts`
- Create: `nephrosys/src/server/db/schema/users.ts`
- Create: `nephrosys/src/server/db/schema/patients.ts`
- Create: `nephrosys/src/server/db/schema/relations.ts`
- Create: `nephrosys/src/server/db/schema/index.ts`
- Create: `nephrosys/src/server/db/index.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` from `.env.local`, PostgreSQL container from Task 1
- Produces:
  - `db` — Drizzle client instance (`import { db } from '@/server/db'`)
  - `users` table schema with columns: id, email, passwordHash, role, nom, prenom, isActive, createdAt, updatedAt
  - `patients` table schema with all columns from spec section 3.2
  - `userRoleEnum` — pgEnum with values: `admin`, `secretaire`, `medecin`, `infirmiere`, `facturation`, `patient`
  - `patientStatutEnum` — pgEnum with values: `actif`, `inactif`, `transfere`, `decede`
  - `sexeEnum` — pgEnum with values: `M`, `F`
  - Type exports: `User`, `NewUser`, `Patient`, `NewPatient`

- [ ] **Step 1: Create `src/server/db/schema/enums.ts`**

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'secretaire',
  'medecin',
  'infirmiere',
  'facturation',
  'patient',
]);

export const patientStatutEnum = pgEnum('patient_statut', [
  'actif',
  'inactif',
  'transfere',
  'decede',
]);

export const sexeEnum = pgEnum('sexe', ['M', 'F']);
```

- [ ] **Step 2: Create `src/server/db/schema/users.ts`**

```typescript
import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('patient'),
  nom: varchar('nom', { length: 100 }).notNull(),
  prenom: varchar('prenom', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 3: Create `src/server/db/schema/patients.ts`**

```typescript
import { pgTable, uuid, varchar, date, decimal, text, timestamp } from 'drizzle-orm/pg-core';
import { patientStatutEnum, sexeEnum } from './enums';
import { users } from './users';

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  nom: varchar('nom', { length: 100 }).notNull(),
  prenom: varchar('prenom', { length: 100 }).notNull(),
  dateNaissance: date('date_naissance'),
  sexe: sexeEnum('sexe'),
  telephone: varchar('telephone', { length: 20 }),
  groupeSanguin: varchar('groupe_sanguin', { length: 10 }),
  tailleCm: decimal('taille_cm', { precision: 5, scale: 1 }),
  poidsSecKg: decimal('poids_sec_kg', { precision: 5, scale: 1 }),
  nephropathie: text('nephropathie'),
  datePremiereDialyse: date('date_premiere_dialyse'),
  medecinRefId: uuid('medecin_ref_id').references(() => users.id),
  statut: patientStatutEnum('statut').notNull().default('actif'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
```

- [ ] **Step 4: Create `src/server/db/schema/relations.ts`**

```typescript
import { relations } from 'drizzle-orm';
import { users } from './users';
import { patients } from './patients';

export const usersRelations = relations(users, ({ many }) => ({
  patientsAsMedecin: many(patients, { relationName: 'medecinRef' }),
}));

export const patientsRelations = relations(patients, ({ one }) => ({
  user: one(users, {
    fields: [patients.userId],
    references: [users.id],
    relationName: 'portalUser',
  }),
  medecinRef: one(users, {
    fields: [patients.medecinRefId],
    references: [users.id],
    relationName: 'medecinRef',
  }),
}));
```

- [ ] **Step 5: Create `src/server/db/schema/index.ts`**

```typescript
export * from './enums';
export * from './users';
export * from './patients';
export * from './relations';
```

- [ ] **Step 6: Create `src/server/db/index.ts`**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

- [ ] **Step 7: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:push
```

Verify tables exist:

```bash
docker exec -it $(docker ps -q -f ancestor=postgres:16-alpine) psql -U nephrosys -d nephrosys -c "\dt"
```

Expected: tables `users`, `patients` listed.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(db): add users and patients schema with Drizzle ORM migrations"
```

---

### Task 3: Authentication (Auth.js v5 + RBAC Middleware)

**Files:**
- Create: `nephrosys/src/server/auth/config.ts`
- Create: `nephrosys/src/server/auth/index.ts`
- Create: `nephrosys/src/lib/permissions.ts`
- Create: `nephrosys/src/lib/validators/auth.ts`
- Create: `nephrosys/src/middleware.ts`
- Create: `nephrosys/src/server/db/seed.ts`
- Create: `nephrosys/src/app/(auth)/layout.tsx`
- Create: `nephrosys/src/app/(auth)/login/page.tsx`
- Create: `nephrosys/src/app/api/auth/[...nextauth]/route.ts`
- Test: `nephrosys/tests/unit/permissions.test.ts`
- Test: `nephrosys/tests/unit/validators.test.ts`

**Interfaces:**
- Consumes:
  - `db` from `@/server/db`
  - `users` table from `@/server/db/schema`
  - `AUTH_SECRET`, `AUTH_URL` env vars
- Produces:
  - `auth()` — returns session with `user.id`, `user.role`, `user.nom`, `user.prenom`, `user.email`
  - `canAccess(role: UserRole, path: string): boolean` — checks route permissions
  - `ROLE_MENU_ITEMS` — map of role to allowed sidebar menu items
  - `loginSchema` — Zod schema `{ email: string, password: string }`
  - Next.js middleware protecting all routes under `/(dashboard)` and `/(portail)`
  - Login page at `/login`
  - Seed script creating 6 test users (1 per role)

- [ ] **Step 1: Create `src/lib/validators/auth.ts`**

```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(8, 'Minimum 8 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmation requise'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
```

- [ ] **Step 2: Create `src/lib/permissions.ts`**

```typescript
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
  { path: '/seances', roles: ['admin', 'medecin', 'infirmiere', 'secretaire'] },
  { path: '/bilans', roles: ['admin', 'medecin', 'infirmiere'] },
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
  { label: 'Tableau de bord', href: '/', icon: 'LayoutDashboard', roles: ['admin', 'medecin', 'infirmiere', 'secretaire', 'facturation'] },
  { label: 'Patients', href: '/patients', icon: 'Users', roles: ['admin', 'medecin', 'infirmiere', 'secretaire', 'facturation'] },
  { label: 'Seances', href: '/seances', icon: 'Activity', roles: ['admin', 'medecin', 'infirmiere', 'secretaire'] },
  { label: 'Planning', href: '/planning', icon: 'Calendar', roles: ['admin', 'medecin', 'infirmiere', 'secretaire'] },
  { label: 'Bilans', href: '/bilans', icon: 'FlaskConical', roles: ['admin', 'medecin', 'infirmiere'] },
  { label: 'Facturation', href: '/facturation', icon: 'Receipt', roles: ['admin', 'facturation'] },
  { label: 'Utilisateurs', href: '/admin/utilisateurs', icon: 'Shield', roles: ['admin'] },
  { label: 'Configuration', href: '/admin/configuration', icon: 'Settings', roles: ['admin'] },
];

export function getMenuItemsForRole(role: UserRole): MenuItem[] {
  return ALL_MENU_ITEMS
    .filter((item) => item.roles.includes(role))
    .map(({ label, href, icon }) => ({ label, href, icon }));
}
```

- [ ] **Step 3: Write permissions unit test**

Create `tests/unit/permissions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { canAccess, getMenuItemsForRole } from '@/lib/permissions';

describe('canAccess', () => {
  it('admin can access everything except portail', () => {
    expect(canAccess('admin', '/patients')).toBe(true);
    expect(canAccess('admin', '/admin')).toBe(true);
    expect(canAccess('admin', '/facturation')).toBe(true);
    expect(canAccess('admin', '/portail')).toBe(false);
  });

  it('secretaire can access patients and planning', () => {
    expect(canAccess('secretaire', '/patients')).toBe(true);
    expect(canAccess('secretaire', '/planning')).toBe(true);
  });

  it('secretaire cannot access facturation or admin', () => {
    expect(canAccess('secretaire', '/facturation')).toBe(false);
    expect(canAccess('secretaire', '/admin')).toBe(false);
  });

  it('infirmiere can access seances but not facturation', () => {
    expect(canAccess('infirmiere', '/seances')).toBe(true);
    expect(canAccess('infirmiere', '/facturation')).toBe(false);
  });

  it('facturation can access facturation but not seances', () => {
    expect(canAccess('facturation', '/facturation')).toBe(true);
    expect(canAccess('facturation', '/seances')).toBe(false);
  });

  it('patient can only access portail', () => {
    expect(canAccess('patient', '/portail')).toBe(true);
    expect(canAccess('patient', '/patients')).toBe(false);
    expect(canAccess('patient', '/seances')).toBe(false);
  });

  it('medecin can access bilans', () => {
    expect(canAccess('medecin', '/bilans')).toBe(true);
  });
});

describe('getMenuItemsForRole', () => {
  it('admin sees all menu items', () => {
    const items = getMenuItemsForRole('admin');
    expect(items.length).toBe(8);
  });

  it('infirmiere sees 5 items', () => {
    const items = getMenuItemsForRole('infirmiere');
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Patients');
    expect(labels).toContain('Seances');
    expect(labels).toContain('Bilans');
    expect(labels).not.toContain('Facturation');
    expect(labels).not.toContain('Utilisateurs');
  });

  it('facturation sees 3 items', () => {
    const items = getMenuItemsForRole('facturation');
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Facturation');
    expect(labels).toContain('Patients');
    expect(labels).not.toContain('Seances');
  });
});
```

- [ ] **Step 4: Write validators unit test**

Create `tests/unit/validators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { loginSchema, changePasswordSchema } from '@/lib/validators/auth';

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'admin@nephro.test',
      password: 'Nephro2024!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'Nephro2024!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'admin@nephro.test',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts matching passwords >= 8 chars', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'Different456',
    });
    expect(result.success).toBe(false);
  });

  it('rejects new password < 8 chars', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 5: Run unit tests**

```bash
pnpm test
```

Expected: all tests PASS (permissions + validators + utils).

- [ ] **Step 6: Create `src/server/auth/config.ts`**

```typescript
import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { loginSchema } from '@/lib/validators/auth';

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.prenom} ${user.nom}`,
          role: user.role,
          nom: user.nom,
          prenom: user.prenom,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.nom = (user as { nom: string }).nom;
        token.prenom = (user as { prenom: string }).prenom;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.nom = token.nom as string;
        session.user.prenom = token.prenom as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
};
```

- [ ] **Step 7: Create `src/server/auth/index.ts`**

```typescript
import NextAuth from 'next-auth';
import { authConfig } from './config';

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

- [ ] **Step 8: Create Auth.js types augmentation**

Create `nephrosys/src/types/next-auth.d.ts`:

```typescript
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      nom: string;
      prenom: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    nom: string;
    prenom: string;
  }
}
```

- [ ] **Step 9: Create `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from '@/server/auth';

export const { GET, POST } = handlers;
```

- [ ] **Step 10: Create `src/middleware.ts`**

```typescript
import { auth } from '@/server/auth';
import { canAccess, type UserRole } from '@/lib/permissions';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Not authenticated → redirect to login
  if (!req.auth?.user) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth.user.role as UserRole;

  // Patient role → force to portail
  if (role === 'patient' && !pathname.startsWith('/portail') && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/portail', req.nextUrl.origin));
  }

  // Backend roles → block portail access
  if (role !== 'patient' && pathname.startsWith('/portail')) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  // Check route permissions
  if (!canAccess(role, pathname)) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 11: Create login page**

Create `src/app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      {children}
    </div>
  );
}
```

Create `src/app/(auth)/login/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Email ou mot de passe incorrect');
      setLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-900">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary-600">NephroSys</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Systeme de gestion de nephrologie
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="admin@nephro.test"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Create seed script**

Create `src/server/db/seed.ts`:

```typescript
import { db } from './index';
import { users } from './schema';
import bcrypt from 'bcryptjs';

const SEED_USERS = [
  { email: 'admin@nephro.test', role: 'admin' as const, nom: 'Admin', prenom: 'Super' },
  { email: 'medecin@nephro.test', role: 'medecin' as const, nom: 'Diallo', prenom: 'Mamadou' },
  { email: 'infirmiere@nephro.test', role: 'infirmiere' as const, nom: 'Ndiaye', prenom: 'Fatou' },
  { email: 'secretaire@nephro.test', role: 'secretaire' as const, nom: 'Sow', prenom: 'Aminata' },
  { email: 'facturation@nephro.test', role: 'facturation' as const, nom: 'Ba', prenom: 'Ousmane' },
  { email: 'patient@nephro.test', role: 'patient' as const, nom: 'Fall', prenom: 'Ibrahima' },
];

async function seed() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('Nephro2024!', 12);

  for (const u of SEED_USERS) {
    await db
      .insert(users)
      .values({
        email: u.email,
        passwordHash,
        role: u.role,
        nom: u.nom,
        prenom: u.prenom,
      })
      .onConflictDoNothing({ target: users.email });

    console.log(`  User: ${u.email} (${u.role})`);
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

- [ ] **Step 13: Run seed**

```bash
pnpm db:seed
```

Expected: 6 users created.

- [ ] **Step 14: Create health check endpoint**

Create `src/app/api/health/route.ts`:

```typescript
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
```

- [ ] **Step 15: Test login manually**

```bash
pnpm dev
```

1. Open http://localhost:3000 — should redirect to `/login`
2. Login with `admin@nephro.test` / `Nephro2024!` — should redirect to `/`
3. Open http://localhost:3000/api/health — should return `{"status":"ok"}`

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat(auth): Auth.js v5 login, RBAC middleware, permissions, seed script"
```

---

### Task 4: tRPC Setup and Providers

**Files:**
- Create: `nephrosys/src/server/trpc/index.ts`
- Create: `nephrosys/src/server/trpc/router.ts`
- Create: `nephrosys/src/server/trpc/routers/auth.router.ts`
- Create: `nephrosys/src/app/api/trpc/[trpc]/route.ts`
- Create: `nephrosys/src/lib/trpc/client.ts`
- Create: `nephrosys/src/lib/trpc/server.ts`
- Create: `nephrosys/src/lib/trpc/provider.tsx`
- Create: `nephrosys/src/components/providers.tsx`
- Modify: `nephrosys/src/app/layout.tsx` (wrap with providers)

**Interfaces:**
- Consumes:
  - `auth()` from `@/server/auth`
  - `db` from `@/server/db`
  - `users` from `@/server/db/schema`
- Produces:
  - `publicProcedure` — no auth required
  - `protectedProcedure` — requires valid session, ctx includes `session.user`
  - `roleProcedure(roles: UserRole[])` — requires session with matching role
  - `appRouter` — root tRPC router (type: `AppRouter`)
  - `api` — React client hooks (`api.auth.me.useQuery()`, etc.)
  - `serverApi` — server-side caller for RSC (`const data = await serverApi.auth.me()`)

- [ ] **Step 1: Create `src/server/trpc/index.ts`**

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import type { UserRole } from '@/lib/permissions';

export type TRPCContext = {
  db: typeof db;
  session: Awaited<ReturnType<typeof auth>> | null;
};

export async function createContext(): Promise<TRPCContext> {
  const session = await auth();
  return { db, session };
}

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Non authentifie' });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

export function roleProcedure(roles: UserRole[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    const userRole = ctx.session.user.role as UserRole;
    if (!roles.includes(userRole)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Role "${userRole}" non autorise. Roles requis: ${roles.join(', ')}`,
      });
    }
    return next({ ctx });
  });
}
```

- [ ] **Step 2: Create `src/server/trpc/routers/auth.router.ts`**

```typescript
import { router, protectedProcedure } from '@/server/trpc';
import { changePasswordSchema } from '@/lib/validators/auth';
import { eq } from 'drizzle-orm';
import { users } from '@/server/db/schema';
import bcrypt from 'bcryptjs';
import { TRPCError } from '@trpc/server';

export const authRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    return {
      id: ctx.session.user.id,
      email: ctx.session.user.email,
      role: ctx.session.user.role,
      nom: ctx.session.user.nom,
      prenom: ctx.session.user.prenom,
    };
  }),

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, ctx.session.user.id))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Utilisateur non trouve' });
      }

      const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Mot de passe actuel incorrect' });
      }

      const newHash = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, user.id));

      return { success: true };
    }),
});
```

- [ ] **Step 3: Create `src/server/trpc/router.ts`**

```typescript
import { router } from '@/server/trpc';
import { authRouter } from './routers/auth.router';

export const appRouter = router({
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 4: Create `src/app/api/trpc/[trpc]/route.ts`**

```typescript
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/trpc/router';
import { createContext } from '@/server/trpc';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

- [ ] **Step 5: Create `src/lib/trpc/client.ts`**

```typescript
'use client';

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/trpc/router';

export const api = createTRPCReact<AppRouter>();
```

- [ ] **Step 6: Create `src/lib/trpc/server.ts`**

```typescript
import 'server-only';

import { createCallerFactory } from '@trpc/server';
import { appRouter } from '@/server/trpc/router';
import { createContext } from '@/server/trpc';

const createCaller = createCallerFactory(appRouter);

export async function getServerApi() {
  const ctx = await createContext();
  return createCaller(ctx);
}
```

- [ ] **Step 7: Create `src/lib/trpc/provider.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { api } from './client';

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
    }),
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}
```

- [ ] **Step 8: Create `src/components/providers.tsx`**

```tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import { TRPCProvider } from '@/lib/trpc/provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCProvider>{children}</TRPCProvider>
    </SessionProvider>
  );
}
```

- [ ] **Step 9: Update `src/app/layout.tsx` to use providers**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NephroSys',
  description: 'Systeme de gestion de nephrologie',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 10: Verify tRPC works**

```bash
pnpm dev
```

Open http://localhost:3000/api/health — should work.
Login as admin, then open http://localhost:3000/api/trpc/auth.me — should return user data as JSON.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(trpc): tRPC v11 setup with auth router, React client, RSC caller"
```

---

### Task 5: Dashboard Layout (Sidebar + Topbar)

**Files:**
- Create: `nephrosys/src/components/layout/sidebar.tsx`
- Create: `nephrosys/src/components/layout/topbar.tsx`
- Create: `nephrosys/src/components/layout/theme-toggle.tsx`
- Create: `nephrosys/src/app/(dashboard)/layout.tsx`
- Create: `nephrosys/src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes:
  - `getMenuItemsForRole(role)` from `@/lib/permissions`
  - `auth()` from `@/server/auth` (for server-side session in layout)
  - `cn()` from `@/lib/utils`
  - Lucide React icons
- Produces:
  - `Sidebar` component — collapsible, role-filtered menu, active page indicator
  - `Topbar` component — logo, user avatar, dark mode toggle
  - `ThemeToggle` component — dark/light switch persisted in localStorage
  - Dashboard layout wrapping all `/(dashboard)/*` routes

- [ ] **Step 1: Create `src/components/layout/theme-toggle.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      aria-label="Changer le theme"
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
```

- [ ] **Step 2: Create `src/components/layout/sidebar.tsx`**

```tsx
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/lib/permissions';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  LayoutDashboard,
  Users,
  Activity,
  Calendar,
  FlaskConical,
  Receipt,
  Shield,
  Settings,
};

type SidebarProps = {
  items: MenuItem[];
};

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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
          <span className="text-xl font-bold text-primary-600">NephroSys</span>
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
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Create `src/components/layout/topbar.tsx`**

```tsx
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
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
            <User size={18} />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {user.prenom} {user.nom}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {ROLE_LABELS[user.role] || user.role}
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
```

- [ ] **Step 4: Create `src/app/(dashboard)/layout.tsx`**

```tsx
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
```

- [ ] **Step 5: Create `src/app/(dashboard)/page.tsx`**

```tsx
import { auth } from '@/server/auth';

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
        {[
          { label: 'Patients actifs', value: '—', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
          { label: 'Seances du jour', value: '—', color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
          { label: 'Bilans en attente', value: '—', color: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
          { label: 'Alertes', value: '—', color: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {stat.label}
            </p>
            <p className={`mt-2 text-3xl font-bold ${stat.color.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Test layout manually**

```bash
pnpm dev
```

1. Login as `admin@nephro.test` — should see sidebar with 8 items, topbar with user name, 4 stat cards
2. Toggle dark mode — should switch theme
3. Collapse sidebar — should show icons only
4. Login as `infirmiere@nephro.test` — should see 5 sidebar items (no Facturation, no admin items)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(layout): dashboard layout with collapsible sidebar, topbar, dark mode"
```

---

### Task 6: Patients tRPC Router + Validators

**Files:**
- Create: `nephrosys/src/lib/validators/patients.ts`
- Create: `nephrosys/src/server/trpc/routers/patients.router.ts`
- Modify: `nephrosys/src/server/trpc/router.ts` (add patients router)
- Test: `nephrosys/tests/unit/validators.test.ts` (add patient validators)

**Interfaces:**
- Consumes:
  - `protectedProcedure`, `roleProcedure` from `@/server/trpc`
  - `db`, `patients`, `users` from `@/server/db/schema`
- Produces:
  - `patientsRouter` with procedures:
    - `list(input: { page: number, perPage: number, search?: string, statut?: string }): { data: Patient[], total: number }`
    - `getById(input: { id: string }): Patient & { medecinRef: { nom, prenom } | null }`
    - `create(input: CreatePatientInput): Patient`
    - `update(input: UpdatePatientInput): Patient`
  - `createPatientSchema` — Zod schema for patient creation
  - `updatePatientSchema` — Zod schema for patient update

- [ ] **Step 1: Create `src/lib/validators/patients.ts`**

```typescript
import { z } from 'zod';

export const createPatientSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(100),
  prenom: z.string().min(1, 'Prenom requis').max(100),
  dateNaissance: z.string().optional(),
  sexe: z.enum(['M', 'F']).optional(),
  telephone: z.string().max(20).optional(),
  groupeSanguin: z.string().max(10).optional(),
  tailleCm: z.number().positive().optional(),
  poidsSecKg: z.number().positive().optional(),
  nephropathie: z.string().optional(),
  datePremiereDialyse: z.string().optional(),
  medecinRefId: z.string().uuid().optional(),
  statut: z.enum(['actif', 'inactif', 'transfere', 'decede']).optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = createPatientSchema.partial().extend({
  id: z.string().uuid(),
});

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export const patientListSchema = z.object({
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  statut: z.enum(['actif', 'inactif', 'transfere', 'decede']).optional(),
});

export type PatientListInput = z.infer<typeof patientListSchema>;
```

- [ ] **Step 2: Add patient validator tests**

Append to `tests/unit/validators.test.ts`:

```typescript
import { createPatientSchema, updatePatientSchema, patientListSchema } from '@/lib/validators/patients';

describe('createPatientSchema', () => {
  it('accepts valid patient data', () => {
    const result = createPatientSchema.safeParse({
      nom: 'Fall',
      prenom: 'Ibrahima',
      sexe: 'M',
      telephone: '+221771234567',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty nom', () => {
    const result = createPatientSchema.safeParse({
      nom: '',
      prenom: 'Ibrahima',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sexe', () => {
    const result = createPatientSchema.safeParse({
      nom: 'Fall',
      prenom: 'Ibrahima',
      sexe: 'X',
    });
    expect(result.success).toBe(false);
  });
});

describe('updatePatientSchema', () => {
  it('requires id', () => {
    const result = updatePatientSchema.safeParse({ nom: 'Fall' });
    expect(result.success).toBe(false);
  });

  it('accepts partial update with id', () => {
    const result = updatePatientSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      telephone: '+221771234567',
    });
    expect(result.success).toBe(true);
  });
});

describe('patientListSchema', () => {
  it('provides defaults for page and perPage', () => {
    const result = patientListSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
  });

  it('rejects perPage > 100', () => {
    const result = patientListSchema.safeParse({ perPage: 200 });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 4: Create `src/server/trpc/routers/patients.router.ts`**

```typescript
import { router, protectedProcedure, roleProcedure } from '@/server/trpc';
import { patients, users } from '@/server/db/schema';
import {
  createPatientSchema,
  updatePatientSchema,
  patientListSchema,
} from '@/lib/validators/patients';
import { eq, ilike, or, sql, count, and } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const patientsRouter = router({
  list: protectedProcedure
    .input(patientListSchema)
    .query(async ({ ctx, input }) => {
      const { page, perPage, search, statut } = input;
      const offset = (page - 1) * perPage;

      const conditions = [];

      if (search) {
        conditions.push(
          or(
            ilike(patients.nom, `%${search}%`),
            ilike(patients.prenom, `%${search}%`),
            ilike(patients.telephone, `%${search}%`),
          ),
        );
      }

      if (statut) {
        conditions.push(eq(patients.statut, statut));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [data, [{ total }]] = await Promise.all([
        ctx.db
          .select()
          .from(patients)
          .where(where)
          .orderBy(patients.nom)
          .limit(perPage)
          .offset(offset),
        ctx.db
          .select({ total: count() })
          .from(patients)
          .where(where),
      ]);

      return { data, total };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .select()
        .from(patients)
        .where(eq(patients.id, input.id))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Patient non trouve' });
      }

      let medecinRef = null;
      if (patient.medecinRefId) {
        const [med] = await ctx.db
          .select({ nom: users.nom, prenom: users.prenom, id: users.id })
          .from(users)
          .where(eq(users.id, patient.medecinRefId))
          .limit(1);
        medecinRef = med || null;
      }

      return { ...patient, medecinRef };
    }),

  create: roleProcedure(['admin', 'medecin', 'secretaire'])
    .input(createPatientSchema)
    .mutation(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .insert(patients)
        .values({
          nom: input.nom,
          prenom: input.prenom,
          dateNaissance: input.dateNaissance || null,
          sexe: input.sexe || null,
          telephone: input.telephone || null,
          groupeSanguin: input.groupeSanguin || null,
          tailleCm: input.tailleCm?.toString() || null,
          poidsSecKg: input.poidsSecKg?.toString() || null,
          nephropathie: input.nephropathie || null,
          datePremiereDialyse: input.datePremiereDialyse || null,
          medecinRefId: input.medecinRefId || null,
          statut: input.statut || 'actif',
        })
        .returning();

      return patient;
    }),

  update: roleProcedure(['admin', 'medecin', 'secretaire'])
    .input(updatePatientSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      if (data.nom !== undefined) updateData.nom = data.nom;
      if (data.prenom !== undefined) updateData.prenom = data.prenom;
      if (data.dateNaissance !== undefined) updateData.dateNaissance = data.dateNaissance;
      if (data.sexe !== undefined) updateData.sexe = data.sexe;
      if (data.telephone !== undefined) updateData.telephone = data.telephone;
      if (data.groupeSanguin !== undefined) updateData.groupeSanguin = data.groupeSanguin;
      if (data.tailleCm !== undefined) updateData.tailleCm = data.tailleCm?.toString();
      if (data.poidsSecKg !== undefined) updateData.poidsSecKg = data.poidsSecKg?.toString();
      if (data.nephropathie !== undefined) updateData.nephropathie = data.nephropathie;
      if (data.datePremiereDialyse !== undefined) updateData.datePremiereDialyse = data.datePremiereDialyse;
      if (data.medecinRefId !== undefined) updateData.medecinRefId = data.medecinRefId;
      if (data.statut !== undefined) updateData.statut = data.statut;

      const [patient] = await ctx.db
        .update(patients)
        .set(updateData)
        .where(eq(patients.id, id))
        .returning();

      if (!patient) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Patient non trouve' });
      }

      return patient;
    }),
});
```

- [ ] **Step 5: Add patients router to root router**

Update `src/server/trpc/router.ts`:

```typescript
import { router } from '@/server/trpc';
import { authRouter } from './routers/auth.router';
import { patientsRouter } from './routers/patients.router';

export const appRouter = router({
  auth: authRouter,
  patients: patientsRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(patients): tRPC patients router with list, getById, create, update"
```

---

### Task 7: Patients UI (List, Create, Detail)

**Files:**
- Create: `nephrosys/src/components/ui/button.tsx`
- Create: `nephrosys/src/components/ui/input.tsx`
- Create: `nephrosys/src/components/ui/select.tsx`
- Create: `nephrosys/src/components/ui/badge.tsx`
- Create: `nephrosys/src/components/ui/card.tsx`
- Create: `nephrosys/src/components/ui/skeleton.tsx`
- Create: `nephrosys/src/components/patients/patient-table.tsx`
- Create: `nephrosys/src/components/patients/patient-form.tsx`
- Create: `nephrosys/src/components/patients/patient-badge.tsx`
- Create: `nephrosys/src/hooks/use-debounce.ts`
- Create: `nephrosys/src/app/(dashboard)/patients/page.tsx`
- Create: `nephrosys/src/app/(dashboard)/patients/nouveau/page.tsx`
- Create: `nephrosys/src/app/(dashboard)/patients/[id]/page.tsx`

**Interfaces:**
- Consumes:
  - `api.patients.list.useQuery()` from tRPC client
  - `api.patients.create.useMutation()` from tRPC client
  - `api.patients.getById.useQuery()` from tRPC client
  - `api.patients.update.useMutation()` from tRPC client
  - `createPatientSchema`, `updatePatientSchema` from `@/lib/validators/patients`
  - `cn()` from `@/lib/utils`
- Produces:
  - Patients list page with search, pagination, status badges
  - Patient creation form with validation
  - Patient detail page with edit capability

- [ ] **Step 1: Create base UI components**

Create `src/components/ui/button.tsx`:

```tsx
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500': variant === 'primary',
            'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 focus:ring-gray-500': variant === 'secondary',
            'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 focus:ring-gray-500': variant === 'outline',
            'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 focus:ring-gray-500': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500': variant === 'danger',
          },
          {
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
          },
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
```

Create `src/components/ui/input.tsx`:

```tsx
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-lg border px-4 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500/20',
            error
              ? 'border-red-500 focus:border-red-500'
              : 'border-gray-300 focus:border-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white',
            className,
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
```

Create `src/components/ui/select.tsx`:

```tsx
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, placeholder, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-lg border px-4 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500/20',
            error
              ? 'border-red-500 focus:border-red-500'
              : 'border-gray-300 focus:border-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white',
            className,
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
```

Create `src/components/ui/badge.tsx`:

```tsx
import { cn } from '@/lib/utils';

type BadgeProps = {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
  className?: string;
};

const VARIANTS = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  warning: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
```

Create `src/components/ui/card.tsx`:

```tsx
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
```

Create `src/components/ui/skeleton.tsx`:

```tsx
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800', className)}
    />
  );
}
```

- [ ] **Step 2: Create `src/hooks/use-debounce.ts`**

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
```

- [ ] **Step 3: Create `src/components/patients/patient-badge.tsx`**

```tsx
import { Badge } from '@/components/ui/badge';

const STATUT_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  actif: { label: 'Actif', variant: 'success' },
  inactif: { label: 'Inactif', variant: 'default' },
  transfere: { label: 'Transfere', variant: 'warning' },
  decede: { label: 'Decede', variant: 'danger' },
};

export function PatientBadge({ statut }: { statut: string }) {
  const config = STATUT_CONFIG[statut] || { label: statut, variant: 'default' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
```

- [ ] **Step 4: Create `src/components/patients/patient-table.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/trpc/client';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { PatientBadge } from './patient-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateFR } from '@/lib/utils';

export function PatientTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const perPage = 20;

  const { data, isLoading } = api.patients.list.useQuery({
    page,
    perPage,
    search: debouncedSearch || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / perPage) : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher un patient..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white sm:w-80"
          />
        </div>
        <Link href="/patients/nouveau">
          <Button>
            <Plus size={16} />
            Nouveau patient
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Nom</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Prenom</th>
              <th className="hidden px-4 py-3 font-medium text-gray-600 dark:text-gray-400 md:table-cell">Telephone</th>
              <th className="hidden px-4 py-3 font-medium text-gray-600 dark:text-gray-400 lg:table-cell">Date naissance</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="hidden px-4 py-3 md:table-cell"><Skeleton className="h-4 w-28" /></td>
                  <td className="hidden px-4 py-3 lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                </tr>
              ))}

            {data?.data.map((patient) => (
              <tr
                key={patient.id}
                className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td className="px-4 py-3">
                  <Link href={`/patients/${patient.id}`} className="font-medium text-gray-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400">
                    {patient.nom}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{patient.prenom}</td>
                <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 md:table-cell">{patient.telephone || '—'}</td>
                <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 lg:table-cell">
                  {patient.dateNaissance ? formatDateFR(patient.dateNaissance) : '—'}
                </td>
                <td className="px-4 py-3">
                  <PatientBadge statut={patient.statut} />
                </td>
              </tr>
            ))}

            {data && data.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  Aucun patient trouve
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data?.total} patient(s) au total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/patients/patient-form.tsx`**

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { createPatientSchema, type CreatePatientInput } from '@/lib/validators/patients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';

type PatientFormProps = {
  defaultValues?: Partial<CreatePatientInput> & { id?: string };
  mode: 'create' | 'edit';
};

export function PatientForm({ defaultValues, mode }: PatientFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePatientInput>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: defaultValues || {},
  });

  const utils = api.useUtils();
  const createMutation = api.patients.create.useMutation({
    onSuccess: () => {
      utils.patients.list.invalidate();
      router.push('/patients');
    },
  });
  const updateMutation = api.patients.update.useMutation({
    onSuccess: () => {
      utils.patients.list.invalidate();
      utils.patients.getById.invalidate({ id: defaultValues?.id });
      router.push(`/patients/${defaultValues?.id}`);
    },
  });

  const onSubmit = (data: CreatePatientInput) => {
    if (mode === 'edit' && defaultValues?.id) {
      updateMutation.mutate({ ...data, id: defaultValues.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const error = createMutation.error || updateMutation.error;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error.message}
        </div>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Identite
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Nom *"
            id="nom"
            {...register('nom')}
            error={errors.nom?.message}
          />
          <Input
            label="Prenom *"
            id="prenom"
            {...register('prenom')}
            error={errors.prenom?.message}
          />
          <Input
            label="Date de naissance"
            id="dateNaissance"
            type="date"
            {...register('dateNaissance')}
            error={errors.dateNaissance?.message}
          />
          <Select
            label="Sexe"
            id="sexe"
            {...register('sexe')}
            error={errors.sexe?.message}
            placeholder="Selectionner"
            options={[
              { value: 'M', label: 'Masculin' },
              { value: 'F', label: 'Feminin' },
            ]}
          />
          <Input
            label="Telephone"
            id="telephone"
            {...register('telephone')}
            error={errors.telephone?.message}
          />
          <Select
            label="Groupe sanguin"
            id="groupeSanguin"
            {...register('groupeSanguin')}
            placeholder="Selectionner"
            options={[
              { value: 'A+', label: 'A+' },
              { value: 'A-', label: 'A-' },
              { value: 'B+', label: 'B+' },
              { value: 'B-', label: 'B-' },
              { value: 'AB+', label: 'AB+' },
              { value: 'AB-', label: 'AB-' },
              { value: 'O+', label: 'O+' },
              { value: 'O-', label: 'O-' },
            ]}
          />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Donnees cliniques
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Taille (cm)"
            id="tailleCm"
            type="number"
            step="0.1"
            {...register('tailleCm', { valueAsNumber: true })}
            error={errors.tailleCm?.message}
          />
          <Input
            label="Poids sec (kg)"
            id="poidsSecKg"
            type="number"
            step="0.1"
            {...register('poidsSecKg', { valueAsNumber: true })}
            error={errors.poidsSecKg?.message}
          />
          <Input
            label="Date 1ere dialyse"
            id="datePremiereDialyse"
            type="date"
            {...register('datePremiereDialyse')}
          />
          <Select
            label="Statut"
            id="statut"
            {...register('statut')}
            placeholder="Selectionner"
            options={[
              { value: 'actif', label: 'Actif' },
              { value: 'inactif', label: 'Inactif' },
              { value: 'transfere', label: 'Transfere' },
              { value: 'decede', label: 'Decede' },
            ]}
          />
        </div>
        <div className="mt-4">
          <label htmlFor="nephropathie" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nephropathie
          </label>
          <textarea
            id="nephropathie"
            rows={3}
            {...register('nephropathie')}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Enregistrement...'
            : mode === 'create'
              ? 'Creer le patient'
              : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 6: Create patient pages**

Create `src/app/(dashboard)/patients/page.tsx`:

```tsx
'use client';

import { PatientTable } from '@/components/patients/patient-table';

export default function PatientsPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Patients
      </h1>
      <PatientTable />
    </div>
  );
}
```

Create `src/app/(dashboard)/patients/nouveau/page.tsx`:

```tsx
import { PatientForm } from '@/components/patients/patient-form';

export default function NouveauPatientPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Nouveau patient
      </h1>
      <PatientForm mode="create" />
    </div>
  );
}
```

Create `src/app/(dashboard)/patients/[id]/page.tsx`:

```tsx
'use client';

import { use } from 'react';
import { api } from '@/lib/trpc/client';
import { PatientForm } from '@/components/patients/patient-form';
import { Skeleton } from '@/components/ui/skeleton';

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: patient, isLoading } = api.patients.getById.useQuery({ id });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <p className="text-red-500">Patient non trouve</p>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        {patient.prenom} {patient.nom}
      </h1>
      <PatientForm
        mode="edit"
        defaultValues={{
          id: patient.id,
          nom: patient.nom,
          prenom: patient.prenom,
          dateNaissance: patient.dateNaissance || undefined,
          sexe: patient.sexe || undefined,
          telephone: patient.telephone || undefined,
          groupeSanguin: patient.groupeSanguin || undefined,
          tailleCm: patient.tailleCm ? parseFloat(patient.tailleCm) : undefined,
          poidsSecKg: patient.poidsSecKg ? parseFloat(patient.poidsSecKg) : undefined,
          nephropathie: patient.nephropathie || undefined,
          datePremiereDialyse: patient.datePremiereDialyse || undefined,
          medecinRefId: patient.medecinRefId || undefined,
          statut: patient.statut || undefined,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 7: Add patients to seed script**

Append to the `seed()` function in `src/server/db/seed.ts`, after the users loop:

```typescript
import { patients } from './schema';

// Inside seed() function, after users seeding:

const SEED_PATIENTS = [
  { nom: 'Diop', prenom: 'Moussa', sexe: 'M' as const, telephone: '+221771000001', statut: 'actif' as const },
  { nom: 'Niang', prenom: 'Aissatou', sexe: 'F' as const, telephone: '+221771000002', statut: 'actif' as const },
  { nom: 'Sarr', prenom: 'Abdoulaye', sexe: 'M' as const, telephone: '+221771000003', statut: 'actif' as const },
  { nom: 'Gueye', prenom: 'Mariama', sexe: 'F' as const, telephone: '+221771000004', statut: 'actif' as const },
  { nom: 'Mbaye', prenom: 'Cheikh', sexe: 'M' as const, telephone: '+221771000005', statut: 'inactif' as const },
  { nom: 'Faye', prenom: 'Sokhna', sexe: 'F' as const, telephone: '+221771000006', statut: 'actif' as const },
  { nom: 'Seck', prenom: 'Oumar', sexe: 'M' as const, telephone: '+221771000007', statut: 'actif' as const },
  { nom: 'Thiam', prenom: 'Ndey', sexe: 'F' as const, telephone: '+221771000008', statut: 'transfere' as const },
  { nom: 'Dia', prenom: 'Mamadou', sexe: 'M' as const, telephone: '+221771000009', statut: 'actif' as const },
  { nom: 'Kane', prenom: 'Fatimata', sexe: 'F' as const, telephone: '+221771000010', statut: 'actif' as const },
];

for (const p of SEED_PATIENTS) {
  await db
    .insert(patients)
    .values(p)
    .onConflictDoNothing();
  console.log(`  Patient: ${p.prenom} ${p.nom}`);
}
```

- [ ] **Step 8: Re-seed and test manually**

```bash
pnpm db:seed
pnpm dev
```

1. Login as `admin@nephro.test`
2. Click "Patients" in sidebar — should see 10 patients in table
3. Search "Diop" — should filter to 1 result
4. Click "Nouveau patient" — fill form and submit — should redirect to list with new patient
5. Click a patient name — should open edit form with pre-filled data
6. Login as `infirmiere@nephro.test` — should see Patients in sidebar but "Nouveau patient" button should work (read-only roles enforced by tRPC, not UI — UI shows the button but tRPC rejects the mutation)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(patients): patients UI with list, search, create, detail/edit pages"
```

---

### Task 8: Users Admin Router + UI

**Files:**
- Create: `nephrosys/src/lib/validators/users.ts`
- Create: `nephrosys/src/server/trpc/routers/users.router.ts`
- Modify: `nephrosys/src/server/trpc/router.ts` (add users router)
- Create: `nephrosys/src/app/(dashboard)/admin/utilisateurs/page.tsx`

**Interfaces:**
- Consumes:
  - `roleProcedure(['admin'])` from `@/server/trpc`
  - `db`, `users` from `@/server/db/schema`
- Produces:
  - `usersRouter` with procedures:
    - `list(): User[]` (without passwordHash)
    - `create(input): User`
    - `update(input): User`
    - `toggleActive(input: { id: string }): User`

- [ ] **Step 1: Create `src/lib/validators/users.ts`**

```typescript
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caracteres'),
  role: z.enum(['admin', 'secretaire', 'medecin', 'infirmiere', 'facturation', 'patient']),
  nom: z.string().min(1, 'Nom requis').max(100),
  prenom: z.string().min(1, 'Prenom requis').max(100),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'secretaire', 'medecin', 'infirmiere', 'facturation', 'patient']).optional(),
  nom: z.string().min(1).max(100).optional(),
  prenom: z.string().min(1).max(100).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

- [ ] **Step 2: Create `src/server/trpc/routers/users.router.ts`**

```typescript
import { router, roleProcedure } from '@/server/trpc';
import { users } from '@/server/db/schema';
import { createUserSchema, updateUserSchema } from '@/lib/validators/users';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';

export const usersRouter = router({
  list: roleProcedure(['admin']).query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        nom: users.nom,
        prenom: users.prenom,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.nom);

    return result;
  }),

  create: roleProcedure(['admin'])
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Cet email est deja utilise' });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      const [user] = await ctx.db
        .insert(users)
        .values({
          email: input.email,
          passwordHash,
          role: input.role,
          nom: input.nom,
          prenom: input.prenom,
        })
        .returning({
          id: users.id,
          email: users.email,
          role: users.role,
          nom: users.nom,
          prenom: users.prenom,
          isActive: users.isActive,
        });

      return user;
    }),

  update: roleProcedure(['admin'])
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [user] = await ctx.db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          email: users.email,
          role: users.role,
          nom: users.nom,
          prenom: users.prenom,
          isActive: users.isActive,
        });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Utilisateur non trouve' });
      }

      return user;
    }),

  toggleActive: roleProcedure(['admin'])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ isActive: users.isActive })
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Utilisateur non trouve' });
      }

      const [user] = await ctx.db
        .update(users)
        .set({ isActive: !existing.isActive, updatedAt: new Date() })
        .where(eq(users.id, input.id))
        .returning({
          id: users.id,
          email: users.email,
          isActive: users.isActive,
        });

      return user;
    }),
});
```

- [ ] **Step 3: Add users router to root router**

Update `src/server/trpc/router.ts`:

```typescript
import { router } from '@/server/trpc';
import { authRouter } from './routers/auth.router';
import { patientsRouter } from './routers/patients.router';
import { usersRouter } from './routers/users.router';

export const appRouter = router({
  auth: authRouter,
  patients: patientsRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 4: Create admin users page**

Create `src/app/(dashboard)/admin/utilisateurs/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema, type CreateUserInput } from '@/lib/validators/users';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'medecin', label: 'Medecin' },
  { value: 'infirmiere', label: 'Infirmiere' },
  { value: 'secretaire', label: 'Secretaire' },
  { value: 'facturation', label: 'Facturation' },
  { value: 'patient', label: 'Patient' },
];

export default function UtilisateursPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: usersList, isLoading } = api.users.list.useQuery();
  const utils = api.useUtils();

  const createMutation = api.users.create.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setShowForm(false);
      reset();
    },
  });

  const toggleMutation = api.users.toggleActive.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Utilisateurs
        </h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Annuler' : 'Nouvel utilisateur'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            {createMutation.error && (
              <p className="text-sm text-red-500">{createMutation.error.message}</p>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Input label="Prenom" id="prenom" {...register('prenom')} error={errors.prenom?.message} />
              <Input label="Nom" id="nom" {...register('nom')} error={errors.nom?.message} />
              <Select label="Role" id="role" {...register('role')} error={errors.role?.message} options={ROLE_OPTIONS} placeholder="Selectionner" />
              <Input label="Email" id="email" type="email" {...register('email')} error={errors.email?.message} />
              <Input label="Mot de passe" id="password" type="password" {...register('password')} error={errors.password?.message} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creation...' : 'Creer'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Nom</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Email</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Role</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Statut</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-8 w-24" /></td>
                </tr>
              ))}

            {usersList?.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {user.prenom} {user.nom}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge variant="info">
                    {ROLE_OPTIONS.find((r) => r.value === user.role)?.label || user.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.isActive ? 'success' : 'danger'}>
                    {user.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: user.id })}
                    disabled={toggleMutation.isPending}
                  >
                    {user.isActive ? 'Desactiver' : 'Activer'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Test manually**

```bash
pnpm dev
```

1. Login as `admin@nephro.test` → click "Utilisateurs" in sidebar
2. Should see 6 seeded users
3. Click "Nouvel utilisateur" → fill form → create
4. Click "Desactiver" on a user → badge should change to "Inactif"
5. Login as `medecin@nephro.test` → should NOT see "Utilisateurs" in sidebar
6. Navigate to `/admin/utilisateurs` directly → should redirect to dashboard

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(admin): users CRUD with role management and active toggle"
```

---

### Task 9: E2E Tests (Login + Patients)

**Files:**
- Create: `nephrosys/playwright.config.ts`
- Create: `nephrosys/tests/e2e/auth/login.spec.ts`
- Create: `nephrosys/tests/e2e/patients/crud.spec.ts`

**Interfaces:**
- Consumes: Running app at http://localhost:3000, seeded database
- Produces: E2E test suite validating login flow and patients CRUD for multiple roles

- [ ] **Step 1: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 2: Create `tests/e2e/auth/login.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/web/session/logout').catch(() => {});
  });

  test('page de login affichee pour utilisateur non connecte', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1:has-text("NephroSys")')).toBeVisible();
  });

  test('login admin reussi', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[id="email"]', 'admin@nephro.test');
    await page.fill('input[id="password"]', 'Nephro2024!');
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 10000 });
    await expect(page.locator('text=Tableau de bord')).toBeVisible();
  });

  test('login echoue avec mauvais mot de passe', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[id="email"]', 'admin@nephro.test');
    await page.fill('input[id="password"]', 'wrong');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Email ou mot de passe incorrect')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('medecin ne voit pas le menu Admin', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[id="email"]', 'medecin@nephro.test');
    await page.fill('input[id="password"]', 'Nephro2024!');
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 10000 });
    await expect(page.locator('nav >> text=Utilisateurs')).not.toBeVisible();
    await expect(page.locator('nav >> text=Patients')).toBeVisible();
  });
});
```

- [ ] **Step 3: Create `tests/e2e/patients/crud.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', 'Nephro2024!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Patients CRUD', () => {
  test('admin voit la liste des patients', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Patients');
    await expect(page.locator('h1:has-text("Patients")')).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
  });

  test('admin cree un nouveau patient', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Patients');
    await page.click('text=Nouveau patient');

    await page.fill('input[id="nom"]', 'TestE2E');
    await page.fill('input[id="prenom"]', 'Patient');
    await page.selectOption('select[id="sexe"]', 'M');
    await page.fill('input[id="telephone"]', '+221770000000');

    await page.click('button:has-text("Creer le patient")');

    await page.waitForURL('/patients', { timeout: 10000 });
    await expect(page.locator('text=TestE2E')).toBeVisible({ timeout: 5000 });
  });

  test('recherche filtre les patients', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Patients');
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder="Rechercher un patient..."]', 'Diop');
    await page.waitForTimeout(500);

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toContainText('Diop');
  });

  test('secretaire peut creer un patient', async ({ page }) => {
    await loginAs(page, 'secretaire@nephro.test');
    await page.click('nav >> text=Patients');
    await page.click('text=Nouveau patient');

    await page.fill('input[id="nom"]', 'SecrTest');
    await page.fill('input[id="prenom"]', 'Patient');

    await page.click('button:has-text("Creer le patient")');

    await page.waitForURL('/patients', { timeout: 10000 });
  });
});
```

- [ ] **Step 4: Run E2E tests**

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Expected: all E2E tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(e2e): Playwright tests for auth login and patients CRUD"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] Database schema (users, patients) — Task 2
- [x] Auth.js v5 + RBAC — Task 3
- [x] tRPC setup + auth router — Task 4
- [x] Layout (sidebar, topbar, dark mode) — Task 5
- [x] Patients CRUD (tRPC + UI) — Tasks 6-7
- [x] Admin user management — Task 8
- [x] E2E tests — Task 9
- [x] Unit tests — Tasks 1, 3, 6
- [x] Seed script — Tasks 3, 7
- [ ] Seances, bilans, planning, facturation, portail — Phase 2 & 3 (out of scope)

**2. Placeholder scan:** No TBD, TODO, or "implement later" found.

**3. Type consistency:**
- `canAccess(role, path)` — same signature in permissions.ts and middleware.ts
- `createPatientSchema` / `updatePatientSchema` — same names in validators and router
- `api.patients.list.useQuery()` — matches `patientsRouter.list` procedure
- `User`, `Patient` types — consistent from schema through router to UI
