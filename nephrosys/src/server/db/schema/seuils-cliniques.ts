import { pgTable, uuid, varchar, decimal, timestamp } from 'drizzle-orm/pg-core';

export const seuilsCliniques = pgTable('seuils_cliniques', {
  id: uuid('id').primaryKey().defaultRandom(),
  parametre: varchar('parametre', { length: 50 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  seuilBas: decimal('seuil_bas', { precision: 8, scale: 2 }),
  seuilHaut: decimal('seuil_haut', { precision: 8, scale: 2 }),
  unite: varchar('unite', { length: 20 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SeuilClinique = typeof seuilsCliniques.$inferSelect;
export type NewSeuilClinique = typeof seuilsCliniques.$inferInsert;
