import { router, roleProcedure } from '@/server/trpc';
import { bilans, patients, users, seuilsCliniques } from '@/server/db/schema';
import { createBilanSchema, updateBilanSchema, bilanListSchema } from '@/lib/validators/bilans';
import { calculateBioStatus, calculateProductCaP, calculateURR } from '@/lib/clinical-calculations';
import { eq, and, gte, lte, count, desc } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { TRPCContext } from '@/server/trpc';

type Db = TRPCContext['db'];

/** Generate reference: BIO-YYYYMMDD-NNN */
async function generateReference(db: Db, dateBilan: Date): Promise<string> {
  const dateStr = dateBilan.toISOString().split('T')[0]!.replace(/-/g, '');
  const prefix = `BIO-${dateStr}-`;

  const startOfDay = new Date(dateBilan);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(dateBilan);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const [row] = await db
    .select({ total: count() })
    .from(bilans)
    .where(and(gte(bilans.dateBilan, startOfDay), lte(bilans.dateBilan, endOfDay)));

  const total = row?.total ?? 0;
  const num = (total + 1).toString().padStart(3, '0');
  return `${prefix}${num}`;
}

/** Load seuils into a map for quick lookup */
async function loadSeuils(
  db: Db,
): Promise<Map<string, { seuilBas: number | null; seuilHaut: number | null }>> {
  const rows = await db.select().from(seuilsCliniques);
  const map = new Map<string, { seuilBas: number | null; seuilHaut: number | null }>();
  for (const row of rows) {
    map.set(row.parametre, {
      seuilBas: row.seuilBas != null ? parseFloat(row.seuilBas) : null,
      seuilHaut: row.seuilHaut != null ? parseFloat(row.seuilHaut) : null,
    });
  }
  return map;
}

export const bilansRouter = router({
  list: roleProcedure(['admin', 'medecin', 'infirmiere'])
    .input(bilanListSchema)
    .query(async ({ ctx, input }) => {
      const { page, perPage, patientId, typeBilan, dateDebut, dateFin } = input;
      const offset = (page - 1) * perPage;

      const conditions = [];

      if (patientId) {
        conditions.push(eq(bilans.patientId, patientId));
      }
      if (typeBilan) {
        conditions.push(eq(bilans.typeBilan, typeBilan));
      }
      if (dateDebut) {
        conditions.push(gte(bilans.dateBilan, new Date(dateDebut)));
      }
      if (dateFin) {
        conditions.push(lte(bilans.dateBilan, new Date(dateFin)));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [data, totalRows] = await Promise.all([
        ctx.db
          .select({
            bilan: bilans,
            patient: { id: patients.id, nom: patients.nom, prenom: patients.prenom },
            physician: { id: users.id, nom: users.nom, prenom: users.prenom },
          })
          .from(bilans)
          .innerJoin(patients, eq(bilans.patientId, patients.id))
          .innerJoin(users, eq(bilans.physicianId, users.id))
          .where(where)
          .orderBy(desc(bilans.dateBilan))
          .limit(perPage)
          .offset(offset),
        ctx.db.select({ total: count() }).from(bilans).where(where),
      ]);

      const total = totalRows[0]?.total ?? 0;

      return { data, total };
    }),

  getById: roleProcedure(['admin', 'medecin', 'infirmiere'])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [bilan] = await ctx.db
        .select()
        .from(bilans)
        .where(eq(bilans.id, input.id))
        .limit(1);

      if (!bilan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bilan non trouve' });
      }

      const [patient] = await ctx.db
        .select({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
        .from(patients)
        .where(eq(patients.id, bilan.patientId))
        .limit(1);

      const [physician] = await ctx.db
        .select({ id: users.id, nom: users.nom, prenom: users.prenom })
        .from(users)
        .where(eq(users.id, bilan.physicianId))
        .limit(1);

      return { ...bilan, patient, physician };
    }),

  create: roleProcedure(['admin', 'medecin'])
    .input(createBilanSchema)
    .mutation(async ({ ctx, input }) => {
      const dateBilan = new Date(input.dateBilan);
      const reference = await generateReference(ctx.db, dateBilan);

      const [bilan] = await ctx.db
        .insert(bilans)
        .values({
          reference,
          patientId: input.patientId,
          physicianId: input.physicianId,
          dateBilan,
          typeBilan: input.typeBilan,
          notes: input.notes ?? null,
        })
        .returning();

      return bilan;
    }),

  update: roleProcedure(['admin', 'medecin'])
    .input(updateBilanSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [existing] = await ctx.db
        .select()
        .from(bilans)
        .where(eq(bilans.id, id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bilan non trouve' });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      // Decimal fields — convert number to string for Drizzle decimal columns
      const decimalFields = [
        'hemoglobine', 'hematocrite', 'globulesBlancs', 'plaquettes',
        'neutrophiles', 'eosinophiles', 'basophiles', 'lymphocytes', 'monocytes',
        'ferritine', 'saturationTransferrine', 'vgm', 'ccmh',
        'creatinine', 'ureePre', 'ureePost', 'acideUrique', 'uricemie', 'dfgMdrd',
        'sodium', 'potassium', 'chlore', 'calcium', 'phosphore',
        'bicarbonateBilan', 'reserveAlcaline',
        'pth', 'vitamineD', 'phosphataseAlcaline',
        'hdl', 'ldl', 'cholesterolTotal', 'triglycerides',
        'albumine', 'prealbumine', 'proteinesTotales', 'proteidemie', 'crp',
        'alat', 'asat', 'gammaGt', 'ldhBilan', 'cpk',
        'haptoglobine', 'bilirubineTotale', 'bilirubineIndirecte',
        'cst', 'ferSerique',
        'gaj', 'hba1c',
        'nau', 'ku', 'rapportNaK', 'ureeUrinaire', 'creatUrinaire',
      ] as const;

      for (const field of decimalFields) {
        const value = (data as Record<string, unknown>)[field];
        if (value !== undefined) {
          updateData[field] = value != null ? String(value) : null;
        }
      }

      // String fields
      const stringFields = [
        'notes', 'schizocytes', 'rac', 'pu24h', 'eppu', 'ecbu', 'pbrResultat',
      ] as const;

      for (const field of stringFields) {
        const value = (data as Record<string, unknown>)[field];
        if (value !== undefined) {
          updateData[field] = value ?? null;
        }
      }

      // Serologie enum fields
      const serologieFields = [
        'hbsAg', 'antiHbs', 'antiHbc', 'antiHcv', 'antiHiv', 'tpha', 'vdrl',
      ] as const;

      for (const field of serologieFields) {
        const value = (data as Record<string, unknown>)[field];
        if (value !== undefined) {
          updateData[field] = value ?? null;
        }
      }

      // Auto-calculate produit Ca x P
      const caInput = data.calcium;
      const pInput = data.phosphore;
      const ca =
        caInput != null
          ? caInput
          : existing.calcium != null
            ? parseFloat(existing.calcium)
            : null;
      const p =
        pInput != null
          ? pInput
          : existing.phosphore != null
            ? parseFloat(existing.phosphore)
            : null;
      const produit = calculateProductCaP(ca, p);
      if (produit != null) {
        updateData.produitCaP = produit.toString();
      }

      // Auto-calculate URR
      const urrePreInput = data.ureePre;
      const ureePostInput = data.ureePost;
      const ureePre =
        urrePreInput != null
          ? urrePreInput
          : existing.ureePre != null
            ? parseFloat(existing.ureePre)
            : null;
      const ureePost =
        ureePostInput != null
          ? ureePostInput
          : existing.ureePost != null
            ? parseFloat(existing.ureePost)
            : null;
      const urr = calculateURR(ureePre, ureePost);
      if (urr != null) {
        updateData.urrCalculated = urr.toString();
      }

      // Auto-calculate bio statuses from configurable seuils
      const seuils = await loadSeuils(ctx.db);

      const statusMappings: {
        field: string;
        parametre: string;
        getValue: () => number | null;
      }[] = [
        {
          field: 'hbStatut',
          parametre: 'hemoglobine',
          getValue: () =>
            data.hemoglobine != null
              ? data.hemoglobine
              : existing.hemoglobine != null
                ? parseFloat(existing.hemoglobine)
                : null,
        },
        {
          field: 'potassiumStatut',
          parametre: 'potassium',
          getValue: () =>
            data.potassium != null
              ? data.potassium
              : existing.potassium != null
                ? parseFloat(existing.potassium)
                : null,
        },
        {
          field: 'phosphoreStatut',
          parametre: 'phosphore',
          getValue: () =>
            data.phosphore != null
              ? data.phosphore
              : existing.phosphore != null
                ? parseFloat(existing.phosphore)
                : null,
        },
        {
          field: 'albumineStatut',
          parametre: 'albumine',
          getValue: () =>
            data.albumine != null
              ? data.albumine
              : existing.albumine != null
                ? parseFloat(existing.albumine)
                : null,
        },
        {
          field: 'pthStatut',
          parametre: 'pth',
          getValue: () =>
            data.pth != null
              ? data.pth
              : existing.pth != null
                ? parseFloat(existing.pth)
                : null,
        },
        {
          field: 'caPStatut',
          parametre: 'produit_ca_p',
          getValue: () => produit,
        },
      ];

      for (const mapping of statusMappings) {
        const seuil = seuils.get(mapping.parametre);
        if (!seuil) continue;
        const value = mapping.getValue();
        const status = calculateBioStatus(value, seuil.seuilBas, seuil.seuilHaut);
        updateData[mapping.field] = status;
      }

      const [bilan] = await ctx.db
        .update(bilans)
        .set(updateData)
        .where(eq(bilans.id, id))
        .returning();

      return bilan;
    }),

  delete: roleProcedure(['admin'])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [bilan] = await ctx.db
        .delete(bilans)
        .where(eq(bilans.id, input.id))
        .returning();

      if (!bilan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bilan non trouve' });
      }
      return bilan;
    }),
});
