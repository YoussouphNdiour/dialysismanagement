import {
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  boolean,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { dialysisSessions } from './dialysis-sessions';

export const vitalSigns = pgTable('vital_signs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => dialysisSessions.id),
  heureMesure: timestamp('heure_mesure', { withTimezone: true }).notNull(),
  tensionArterielle: varchar('tension_arterielle', { length: 20 }).notNull(),
  frequenceCardiaque: integer('frequence_cardiaque'),
  frequenceRespiratoire: integer('frequence_respiratoire'),
  spo2: decimal('spo2', { precision: 4, scale: 1 }),
  temperature: decimal('temperature', { precision: 4, scale: 1 }),
  glycemie: decimal('glycemie', { precision: 5, scale: 2 }),
  isHypotension: boolean('is_hypotension').notNull().default(false),
  notes: text('notes'),
});

export type VitalSign = typeof vitalSigns.$inferSelect;
export type NewVitalSign = typeof vitalSigns.$inferInsert;
