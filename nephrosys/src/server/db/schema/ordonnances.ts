import { pgTable, uuid, text, date, boolean, timestamp } from 'drizzle-orm/pg-core';
import { patients } from './patients';
import { users } from './users';

export const ordonnances = pgTable('ordonnances', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  contenu: text('contenu').notNull(),
  datePrescription: date('date_prescription').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  prescritPar: uuid('prescrit_par').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Ordonnance = typeof ordonnances.$inferSelect;
export type NewOrdonnance = typeof ordonnances.$inferInsert;
