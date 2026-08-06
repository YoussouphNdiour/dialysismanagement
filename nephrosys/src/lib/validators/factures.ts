import { z } from 'zod';

const statutFactureValues = ['brouillon', 'validee', 'payee', 'annulee'] as const;
const modePaiementValues = ['especes', 'cheque', 'virement', 'mobile_money'] as const;

export const generateFactureSchema = z.object({
  sessionId: z.string().uuid('Session ID invalide'),
});

export type GenerateFactureInput = z.infer<typeof generateFactureSchema>;

export const addLigneSchema = z.object({
  factureId: z.string().uuid('Facture ID invalide'),
  articleId: z.string().uuid('Article ID invalide'),
  quantite: z.number().positive('Quantite doit etre positive').default(1),
});

export type AddLigneInput = z.infer<typeof addLigneSchema>;

export const removeLigneSchema = z.object({
  ligneId: z.string().uuid('Ligne ID invalide'),
});

export type RemoveLigneInput = z.infer<typeof removeLigneSchema>;

export const validerFactureSchema = z.object({
  factureId: z.string().uuid('Facture ID invalide'),
});

export type ValiderFactureInput = z.infer<typeof validerFactureSchema>;

export const enregistrerPaiementSchema = z.object({
  factureId: z.string().uuid('Facture ID invalide'),
  modePaiement: z.enum(modePaiementValues, { message: 'Mode de paiement invalide' }),
});

export type EnregistrerPaiementInput = z.infer<typeof enregistrerPaiementSchema>;

export const annulerFactureSchema = z.object({
  factureId: z.string().uuid('Facture ID invalide'),
});

export type AnnulerFactureInput = z.infer<typeof annulerFactureSchema>;

export const factureListSchema = z.object({
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(20),
  statut: z.enum(statutFactureValues).optional(),
  dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide').optional(),
  dateFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide').optional(),
  patientId: z.string().uuid().optional(),
});

export type FactureListInput = z.infer<typeof factureListSchema>;

export const updateTarifSchema = z.object({
  id: z.string().uuid('ID invalide'),
  montant: z.number().positive('Montant doit etre positif'),
});

export type UpdateTarifInput = z.infer<typeof updateTarifSchema>;
