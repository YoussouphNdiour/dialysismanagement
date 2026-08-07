import { pgTable, uuid, varchar, date, decimal, timestamp } from 'drizzle-orm/pg-core';
import { articles } from './articles';
import { users } from './users';

export const lots = pgTable('lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id').notNull().references(() => articles.id),
  numeroLot: varchar('numero_lot', { length: 100 }).notNull(),
  datePeremption: date('date_peremption').notNull(),
  quantiteInitiale: decimal('quantite_initiale', { precision: 10, scale: 2 }).notNull(),
  quantiteDisponible: decimal('quantite_disponible', { precision: 10, scale: 2 }).notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Lot = typeof lots.$inferSelect;
export type NewLot = typeof lots.$inferInsert;
