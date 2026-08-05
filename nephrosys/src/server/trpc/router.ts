import { router } from '@/server/trpc';
import { authRouter } from './routers/auth.router';
import { patientsRouter } from './routers/patients.router';
import { usersRouter } from './routers/users.router';
import { postesRouter } from './routers/postes.router';
import { seuilsRouter } from './routers/seuils.router';

export const appRouter = router({
  auth: authRouter,
  patients: patientsRouter,
  users: usersRouter,
  postes: postesRouter,
  seuils: seuilsRouter,
});

export type AppRouter = typeof appRouter;
