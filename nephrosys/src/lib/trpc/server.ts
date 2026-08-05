import 'server-only';

import { appRouter } from '@/server/trpc/router';
import { createContext, createCallerFactory } from '@/server/trpc';

const createCaller = createCallerFactory(appRouter);

export async function getServerApi() {
  const ctx = await createContext();
  return createCaller(ctx);
}
