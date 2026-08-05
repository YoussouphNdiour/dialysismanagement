import { z } from 'zod';

export const createVitalSignSchema = z.object({
  sessionId: z.string().uuid('Session ID invalide'),
  heureMesure: z.string().datetime({ message: 'Heure invalide' }),
  tensionArterielle: z.string().min(1, 'Tension arterielle requise').max(20),
  frequenceCardiaque: z.number().int().positive().optional(),
  frequenceRespiratoire: z.number().int().positive().optional(),
  spo2: z.number().min(0).max(100).optional(),
  temperature: z.number().min(30).max(45).optional(),
  glycemie: z.number().positive().optional(),
  isHypotension: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export type CreateVitalSignInput = z.infer<typeof createVitalSignSchema>;

export const updateVitalSignSchema = createVitalSignSchema
  .omit({ sessionId: true })
  .partial()
  .extend({
    id: z.string().uuid('ID invalide'),
  });

export type UpdateVitalSignInput = z.infer<typeof updateVitalSignSchema>;
