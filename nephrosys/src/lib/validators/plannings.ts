import { z } from 'zod';

export const createPlanningSchema = z.object({
  patientId: z.string().uuid('Patient ID invalide'),
  posteId: z.string().uuid('Poste ID invalide'),
  medecinId: z.string().uuid('Medecin ID invalide'),
  infirmierId: z.string().uuid('Infirmier ID invalide'),
  jourSemaine: z
    .number()
    .int('Jour entier requis')
    .min(0, 'Jour minimum : 0 (lundi)')
    .max(6, 'Jour maximum : 6 (dimanche)'),
  vacation: z.enum(['matin', 'apres_midi'] as const, {
    error: () => ({ message: 'Vacation invalide (matin ou apres_midi)' }),
  }),
  recurrence: z
    .enum(['hebdo', 'bihebdo', 'trihebdo'] as const, {
      error: () => ({ message: 'Recurrence invalide' }),
    })
    .optional()
    .default('hebdo'),
});

export type CreatePlanningInput = z.infer<typeof createPlanningSchema>;

export const updatePlanningSchema = createPlanningSchema.partial().extend({
  id: z.string().uuid('ID invalide'),
});

export type UpdatePlanningInput = z.infer<typeof updatePlanningSchema>;

export const planningListSchema = z.object({
  jourSemaine: z.number().int().min(0).max(6).optional(),
  posteId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
});

export type PlanningListInput = z.infer<typeof planningListSchema>;

export const generateWeekSessionsSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
});

export type GenerateWeekSessionsInput = z.infer<typeof generateWeekSessionsSchema>;
