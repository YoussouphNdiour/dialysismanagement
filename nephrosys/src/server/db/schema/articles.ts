import { boolean, decimal, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { categorieArticleEnum } from './enums';

export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  nom: varchar('nom', { length: 200 }).notNull(),
  categorie: categorieArticleEnum('categorie').notNull(),
  prixUnitaire: decimal('prix_unitaire', { precision: 12, scale: 2 }).notNull(),
  unite: varchar('unite', { length: 50 }).notNull(),
  voieAdministration: varchar('voie_administration', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
