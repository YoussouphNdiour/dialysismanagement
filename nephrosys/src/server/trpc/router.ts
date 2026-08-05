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
