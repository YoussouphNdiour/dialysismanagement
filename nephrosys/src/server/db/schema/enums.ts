import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'secretaire',
  'medecin',
  'infirmiere',
  'facturation',
  'patient',
]);

export const patientStatutEnum = pgEnum('patient_statut', [
  'actif',
  'inactif',
  'transfere',
  'decede',
]);

export const sexeEnum = pgEnum('sexe', ['M', 'F']);
