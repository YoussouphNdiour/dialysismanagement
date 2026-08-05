import { z } from 'zod';

export const updateSeuilSchema = z.object({
  id: z.string().uuid('ID invalide'),
  seuilBas: z.number().nullable().optional(),
  seuilHaut: z.number().nullable().optional(),
  unite: z.string().max(20, 'Unite trop longue').optional(),
});

export type UpdateSeuilInput = z.infer<typeof updateSeuilSchema>;
