import { z } from 'zod';

export const createSessionSchema = z.object({
  patientId: z.string().uuid('Patient ID invalide'),
  posteId: z.string().uuid('Poste ID invalide'),
  physicianId: z.string().uuid('Medecin ID invalide'),
  nurseId: z.string().uuid('Infirmier ID invalide'),
  dateSeance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
  planningId: z.string().uuid().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updatePreDialyseSchema = z.object({
  id: z.string().uuid('ID invalide'),
  arrivalStatus: z.enum(['stable', 'malade', 'urgence'] as const, {
    error: () => ({ message: 'Statut arrivee invalide' }),
  }).optional(),
  arrivalWeight: z.number().positive('Poids doit etre positif').optional(),
  dryWeight: z.number().positive('Poids sec doit etre positif').optional(),
  taPreDialyse: z.string().max(20).optional(),
  taDebout: z.string().max(20).optional(),
  taCoucher: z.string().max(20).optional(),
  temperaturePre: z.number().min(30).max(45).optional(),
});

export type UpdatePreDialyseInput = z.infer<typeof updatePreDialyseSchema>;

export const updateMachineSchema = z.object({
  id: z.string().uuid('ID invalide'),
  typeDialyse: z.enum(['hemodialyse', 'hemodiafiltration', 'dialyse_peritoneale'] as const, {
    error: () => ({ message: 'Type de dialyse invalide' }),
  }).optional(),
  dialyzerType: z.string().max(100).optional(),
  typeAbordVasculaire: z.string().max(100).optional(),
  debitSang: z.number().positive().optional(),
  debitDialysat: z.number().positive().optional(),
  ufPrescrite: z.number().min(0).optional(),
  ufMax: z.number().min(0).optional(),
  dureePrescrite: z.number().int().positive().optional(),
  conductivite: z.number().positive().optional(),
  bainCalcium: z.number().min(0).optional(),
  bainPotassium: z.number().min(0).optional(),
  bainGlucose: z.number().min(0).optional(),
  bainSodium: z.string().max(20).optional(),
  temperatureBain: z.number().min(30).max(42).optional(),
  bicarbonate: z.string().optional(),
  anticoagulation: z.string().optional(),
  aiguilleArterielle: z.string().max(50).optional(),
  aiguilleVeineuse: z.string().max(50).optional(),
  ponction: z.string().max(50).optional(),
  pressionArterielle: z.string().max(20).optional(),
  pressionVeineuse: z.string().max(20).optional(),
  ptm: z.string().max(20).optional(),
});

export type UpdateMachineInput = z.infer<typeof updateMachineSchema>;

export const updateFinSeanceSchema = z.object({
  id: z.string().uuid('ID invalide'),
  departureWeight: z.number().positive('Poids depart doit etre positif').optional(),
  ufReelle: z.number().min(0).optional(),
  dureeReelle: z.number().int().positive().optional(),
  toleranceGlobale: z.enum(['bonne', 'moyenne', 'mauvaise'] as const, {
    error: () => ({ message: 'Tolerance invalide' }),
  }).optional(),
  aspectRein: z.string().optional(),
  notesFin: z.string().optional(),
  ureePre: z.number().min(0).optional(),
  ureePost: z.number().min(0).optional(),
  traitementEnCours: z.string().optional(),
  hemoculture: z.string().optional(),
  vaccination: z.string().optional(),
  transfusion: z.string().optional(),
  erythropoietine: z.string().max(100).optional(),
  observations: z.string().optional(),
});

export type UpdateFinSeanceInput = z.infer<typeof updateFinSeanceSchema>;

export const sessionListSchema = z.object({
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  posteId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  statut: z.enum(['planifiee', 'en_cours', 'terminee', 'annulee'] as const).optional(),
});

export type SessionListInput = z.infer<typeof sessionListSchema>;
