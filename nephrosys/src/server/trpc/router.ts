import { router } from '@/server/trpc';
import { authRouter } from './routers/auth.router';
import { patientsRouter } from './routers/patients.router';

export const appRouter = router({
  auth: authRouter,
  patients: patientsRouter,
});

export type AppRouter = typeof appRouter;
