import { decimal, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const tarifsBase = pgTable('tarifs_base', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: varchar('label', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  montant: decimal('montant', { precision: 12, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TarifBase = typeof tarifsBase.$inferSelect;
export type NewTarifBase = typeof tarifsBase.$inferInsert;
