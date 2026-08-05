import { pgTable, uuid, varchar, integer, boolean, text, timestamp } from 'drizzle-orm/pg-core';

export const postesDialyse = pgTable('postes_dialyse', {
  id: uuid('id').primaryKey().defaultRandom(),
  nom: varchar('nom', { length: 100 }).notNull(),
  numero: integer('numero').notNull(),
  isVip: boolean('is_vip').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  equipement: text('equipement'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PosteDialyse = typeof postesDialyse.$inferSelect;
export type NewPosteDialyse = typeof postesDialyse.$inferInsert;
