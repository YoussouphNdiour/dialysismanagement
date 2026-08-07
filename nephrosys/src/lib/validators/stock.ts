import { z } from 'zod';

export const entreeStockSchema = z.object({
  articleId: z.string().uuid('Article ID invalide'),
  numeroLot: z.string().min(1, 'Numero de lot requis').max(100, 'Numero de lot trop long'),
  datePeremption: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
  quantite: z.number().positive('La quantite doit etre positive'),
});

export type EntreeStockInput = z.infer<typeof entreeStockSchema>;

export const sortieManuelleSchema = z.object({
  articleId: z.string().uuid('Article ID invalide'),
  quantite: z.number().positive('La quantite doit etre positive'),
  motif: z.string().min(1, 'Motif requis').max(200, 'Motif trop long'),
});

export type SortieManuelleInput = z.infer<typeof sortieManuelleSchema>;

export const ajustementSchema = z.object({
  articleId: z.string().uuid('Article ID invalide'),
  lotId: z.string().uuid('Lot ID invalide').optional(),
  quantite: z.number().refine((v) => v !== 0, { message: 'La quantite ne peut pas etre zero' }),
  motif: z.string().min(1, 'Motif requis').max(200, 'Motif trop long'),
});

export type AjustementInput = z.infer<typeof ajustementSchema>;

export const setSeuilSchema = z.object({
  articleId: z.string().uuid('Article ID invalide'),
  seuilMin: z.number().positive('Le seuil doit etre positif'),
});

export type SetSeuilInput = z.infer<typeof setSeuilSchema>;
