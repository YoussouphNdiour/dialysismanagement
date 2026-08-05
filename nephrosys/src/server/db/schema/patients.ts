import { pgTable, uuid, varchar, date, decimal, text, timestamp } from 'drizzle-orm/pg-core';
import { patientStatutEnum, sexeEnum } from './enums';
import { users } from './users';

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  nom: varchar('nom', { length: 100 }).notNull(),
  prenom: varchar('prenom', { length: 100 }).notNull(),
  dateNaissance: date('date_naissance'),
  sexe: sexeEnum('sexe'),
  telephone: varchar('telephone', { length: 20 }),
  groupeSanguin: varchar('groupe_sanguin', { length: 10 }),
  tailleCm: decimal('taille_cm', { precision: 5, scale: 1 }),
  poidsSecKg: decimal('poids_sec_kg', { precision: 5, scale: 1 }),
  nephropathie: text('nephropathie'),
  datePremiereDialyse: date('date_premiere_dialyse'),
  medecinRefId: uuid('medecin_ref_id').references(() => users.id),
  statut: patientStatutEnum('statut').notNull().default('actif'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
