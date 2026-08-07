import { router, roleProcedure } from '@/server/trpc';
import { users, patients } from '@/server/db/schema';
import { createUserSchema, updateUserSchema } from '@/lib/validators/users';
import { eq, sql } from 'drizzle-orm';
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

  listPatientsDisponibles: roleProcedure(['admin'])
    .input(z.object({ currentPatientId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      // Retourne les users role=patient non encore lies a un dossier patient,
      // plus le user actuellement lie au patient en cours d'edition (s'il existe)
      const result = await ctx.db
        .select({
          id: users.id,
          email: users.email,
          nom: users.nom,
          prenom: users.prenom,
          patientUserId: patients.userId,
          patientId: patients.id,
        })
        .from(users)
        .leftJoin(patients, eq(patients.userId, users.id))
        .where(eq(users.role, 'patient'))
        .orderBy(users.nom);

      return result
        .filter((u) => {
          // Inclure si non lie (patientId null) OU lie au patient courant
          const nonLie = u.patientId === null;
          const lieeAuPatientCourant =
            input.currentPatientId !== undefined && u.patientId === input.currentPatientId;
          return nonLie || lieeAuPatientCourant;
        })
        .map(({ patientUserId: _pu, patientId: _pi, ...u }) => u);
    }),

  toggleActive: roleProcedure(['admin'])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set({ isActive: sql`NOT ${users.isActive}`, updatedAt: new Date() })
        .where(eq(users.id, input.id))
        .returning({
          id: users.id,
          email: users.email,
          isActive: users.isActive,
        });

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Utilisateur non trouve' });
      }

      return updated;
    }),
});
