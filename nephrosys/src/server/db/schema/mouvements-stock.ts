import { pgTable, uuid, varchar, decimal, timestamp } from 'drizzle-orm/pg-core';
import { typeMouvementEnum } from './enums';
import { articles } from './articles';
import { lots } from './lots';
import { dialysisSessions } from './dialysis-sessions';
import { patients } from './patients';
import { users } from './users';

export const mouvementsStock = pgTable('mouvements_stock', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id').notNull().references(() => articles.id),
  lotId: uuid('lot_id').references(() => lots.id),
  typeMouvement: typeMouvementEnum('type_mouvement').notNull(),
  quantite: decimal('quantite', { precision: 10, scale: 2 }).notNull(),
  motif: varchar('motif', { length: 200 }),
  sessionId: uuid('session_id').references(() => dialysisSessions.id),
  patientId: uuid('patient_id').references(() => patients.id),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MouvementStock = typeof mouvementsStock.$inferSelect;
export type NewMouvementStock = typeof mouvementsStock.$inferInsert;
