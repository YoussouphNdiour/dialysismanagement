import { router } from '@/server/trpc';
import { authRouter } from './routers/auth.router';
import { patientsRouter } from './routers/patients.router';
import { usersRouter } from './routers/users.router';
import { postesRouter } from './routers/postes.router';
import { seuilsRouter } from './routers/seuils.router';
import { planningsRouter } from './routers/plannings.router';
import { sessionsRouter } from './routers/sessions.router';
import { vitalSignsRouter } from './routers/vital-signs.router';
import { bilansRouter } from './routers/bilans.router';
import { articlesRouter } from './routers/articles.router';
import { facturesRouter } from './routers/factures.router';

export const appRouter = router({
  auth: authRouter,
  patients: patientsRouter,
  users: usersRouter,
  postes: postesRouter,
  seuils: seuilsRouter,
  plannings: planningsRouter,
  sessions: sessionsRouter,
  vitalSigns: vitalSignsRouter,
  bilans: bilansRouter,
  articles: articlesRouter,
  factures: facturesRouter,
});

export type AppRouter = typeof appRouter;
