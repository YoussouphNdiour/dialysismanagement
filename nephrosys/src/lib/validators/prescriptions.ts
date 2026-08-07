import { z } from 'zod';

export const addPrescriptionSchema = z.object({
  sessionId: z.string().uuid('Session ID invalide'),
  articleId: z.string().uuid('Article ID invalide'),
  quantite: z.number().positive('La quantite doit etre positive'),
  posologie: z.string().max(200, 'Posologie trop longue').optional(),
});

export type AddPrescriptionInput = z.infer<typeof addPrescriptionSchema>;

export const cancelPrescriptionSchema = z.object({
  prescriptionId: z.string().uuid('Prescription ID invalide'),
});

export type CancelPrescriptionInput = z.infer<typeof cancelPrescriptionSchema>;

export const ordonnanceCreateSchema = z.object({
  patientId: z.string().uuid('Patient ID invalide'),
  contenu: z.string().min(1, 'Contenu requis'),
});

export type OrdonnanceCreateInput = z.infer<typeof ordonnanceCreateSchema>;

export const ordonnanceToggleSchema = z.object({
  ordonnanceId: z.string().uuid('Ordonnance ID invalide'),
});

export type OrdonnanceToggleInput = z.infer<typeof ordonnanceToggleSchema>;
