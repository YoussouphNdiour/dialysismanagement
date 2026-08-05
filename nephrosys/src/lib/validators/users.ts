import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caracteres'),
  role: z.enum(['admin', 'secretaire', 'medecin', 'infirmiere', 'facturation', 'patient']),
  nom: z.string().min(1, 'Nom requis').max(100),
  prenom: z.string().min(1, 'Prenom requis').max(100),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'secretaire', 'medecin', 'infirmiere', 'facturation', 'patient']).optional(),
  nom: z.string().min(1).max(100).optional(),
  prenom: z.string().min(1).max(100).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
