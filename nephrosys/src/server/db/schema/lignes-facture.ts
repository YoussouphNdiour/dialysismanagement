import { decimal, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { factures } from './factures';
import { articles } from './articles';

export const lignesFacture = pgTable('lignes_facture', {
  id: uuid('id').primaryKey().defaultRandom(),
  factureId: uuid('facture_id')
    .notNull()
    .references(() => factures.id, { onDelete: 'cascade' }),
  articleId: uuid('article_id').references(() => articles.id),
  designation: varchar('designation', { length: 200 }).notNull(),
  quantite: decimal('quantite', { precision: 10, scale: 2 }).notNull().default('1'),
  prixUnitaire: decimal('prix_unitaire', { precision: 12, scale: 2 }).notNull(),
  montant: decimal('montant', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LigneFacture = typeof lignesFacture.$inferSelect;
export type NewLigneFacture = typeof lignesFacture.$inferInsert;
