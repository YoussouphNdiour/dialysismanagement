import { date, decimal, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { statutFactureEnum, modePaiementEnum } from './enums';
import { dialysisSessions } from './dialysis-sessions';
import { patients } from './patients';
import { users } from './users';

export const factures = pgTable('factures', {
  id: uuid('id').primaryKey().defaultRandom(),
  reference: varchar('reference', { length: 30 }).notNull().unique(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => dialysisSessions.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  dateFacture: date('date_facture').notNull(),
  montantBase: decimal('montant_base', { precision: 12, scale: 2 }).notNull(),
  montantSupplements: decimal('montant_supplements', { precision: 12, scale: 2 }).notNull().default('0'),
  montantTotal: decimal('montant_total', { precision: 12, scale: 2 }).notNull(),
  statut: statutFactureEnum('statut').notNull().default('brouillon'),
  modePaiement: modePaiementEnum('mode_paiement'),
  datePaiement: timestamp('date_paiement', { withTimezone: true }),
  notes: text('notes'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Facture = typeof factures.$inferSelect;
export type NewFacture = typeof factures.$inferInsert;
