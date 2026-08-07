import { pgTable, uuid, decimal, timestamp } from 'drizzle-orm/pg-core';
import { articles } from './articles';

export const seuilsStock = pgTable('seuils_stock', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id').notNull().unique().references(() => articles.id),
  seuilMin: decimal('seuil_min', { precision: 10, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SeuilStock = typeof seuilsStock.$inferSelect;
export type NewSeuilStock = typeof seuilsStock.$inferInsert;
