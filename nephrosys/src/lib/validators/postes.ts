import { z } from 'zod';

export const createPosteSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(100, 'Nom trop long'),
  numero: z.number().int('Numero entier requis').positive('Numero doit etre positif'),
  isVip: z.boolean().default(false),
  equipement: z.string().optional(),
});

export type CreatePosteInput = z.infer<typeof createPosteSchema>;

export const updatePosteSchema = createPosteSchema.partial().extend({
  id: z.string().uuid('ID invalide'),
});

export type UpdatePosteInput = z.infer<typeof updatePosteSchema>;
