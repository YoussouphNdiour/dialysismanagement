import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import type { Session } from 'next-auth';
import type { UserRole } from '@/lib/permissions';

export type TRPCContext = {
  db: typeof db;
  session: Session | null;
};

export async function createContext(): Promise<TRPCContext> {
  const session = await auth();
  return { db, session };
}

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Non authentifié' });
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
        message: `Rôle "${userRole}" non autorisé. Rôles requis: ${roles.join(', ')}`,
      });
    }
    return next({ ctx });
  });
}
