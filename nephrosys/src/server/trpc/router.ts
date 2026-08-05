import { router } from '@/server/trpc';
import { authRouter } from './routers/auth.router';

export const appRouter = router({
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
