import { z } from 'zod';

export const createPatientSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(100),
  prenom: z.string().min(1, 'Prénom requis').max(100),
  dateNaissance: z.string().optional(),
  sexe: z.enum(['M', 'F']).optional(),
  telephone: z.string().max(20).optional(),
  groupeSanguin: z.string().max(10).optional(),
  tailleCm: z.number().positive().optional(),
  poidsSecKg: z.number().positive().optional(),
  nephropathie: z.string().optional(),
  datePremiereDialyse: z.string().optional(),
  medecinRefId: z.string().uuid().optional(),
  statut: z.enum(['actif', 'inactif', 'transfere', 'decede']).optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = createPatientSchema.partial().extend({
  id: z.string().uuid(),
});

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export const patientListSchema = z.object({
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  statut: z.enum(['actif', 'inactif', 'transfere', 'decede']).optional(),
});

export type PatientListInput = z.infer<typeof patientListSchema>;
