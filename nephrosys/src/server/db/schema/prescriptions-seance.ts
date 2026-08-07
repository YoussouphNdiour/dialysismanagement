import { pgTable, uuid, varchar, decimal, timestamp } from 'drizzle-orm/pg-core';
import { statutPrescriptionEnum } from './enums';
import { dialysisSessions } from './dialysis-sessions';
import { articles } from './articles';
import { patients } from './patients';
import { lots } from './lots';
import { users } from './users';

export const prescriptionsSeance = pgTable('prescriptions_seance', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => dialysisSessions.id),
  articleId: uuid('article_id').notNull().references(() => articles.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  quantite: decimal('quantite', { precision: 10, scale: 2 }).notNull(),
  posologie: varchar('posologie', { length: 200 }),
  statut: statutPrescriptionEnum('statut').notNull().default('prescrite'),
  lotId: uuid('lot_id').references(() => lots.id),
  prescritPar: uuid('prescrit_par').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PrescriptionSeance = typeof prescriptionsSeance.$inferSelect;
export type NewPrescriptionSeance = typeof prescriptionsSeance.$inferInsert;
