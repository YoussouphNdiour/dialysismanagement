import { router, roleProcedure } from '@/server/trpc';
import { patients, users } from '@/server/db/schema';
import {
  createPatientSchema,
  updatePatientSchema,
  patientListSchema,
} from '@/lib/validators/patients';
import { eq, ilike, or, count, and } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const patientsRouter = router({
  list: roleProcedure(['admin', 'medecin', 'infirmiere', 'secretaire', 'facturation'])
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

  getById: roleProcedure(['admin', 'medecin', 'infirmiere', 'secretaire', 'facturation'])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .select()
        .from(patients)
        .where(eq(patients.id, input.id))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Patient non trouvé' });
      }

      let medecinRef = null;
      if (patient.medecinRefId) {
        const [med] = await ctx.db
          .select({ id: users.id, nom: users.nom, prenom: users.prenom })
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
          dateNaissance: input.dateNaissance ?? null,
          sexe: input.sexe ?? null,
          telephone: input.telephone ?? null,
          groupeSanguin: input.groupeSanguin ?? null,
          tailleCm: input.tailleCm?.toString() ?? null,
          poidsSecKg: input.poidsSecKg?.toString() ?? null,
          nephropathie: input.nephropathie ?? null,
          datePremiereDialyse: input.datePremiereDialyse ?? null,
          medecinRefId: input.medecinRefId ?? null,
          statut: input.statut ?? 'actif',
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
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Patient non trouvé' });
      }

      return patient;
    }),
});
