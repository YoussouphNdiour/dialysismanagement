import { z } from 'zod';

const categorieValues = ['medicament', 'consommable', 'acte_medical'] as const;

export const createArticleSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(200, 'Nom trop long'),
  categorie: z.enum(categorieValues, { message: 'Categorie invalide' }),
  prixUnitaire: z.number().positive('Prix doit etre positif'),
  unite: z.string().min(1, 'Unite requise').max(50, 'Unite trop longue'),
  voieAdministration: z.string().max(50, 'Voie trop longue').optional(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;

export const updateArticleSchema = createArticleSchema.partial().extend({
  id: z.string().uuid('ID invalide'),
});

export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

export const articleListSchema = z.object({
  categorie: z.enum(categorieValues).optional(),
  activeOnly: z.boolean().default(true),
});

export type ArticleListInput = z.infer<typeof articleListSchema>;
