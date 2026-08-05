import { pgTable, uuid, integer, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { vacationEnum, recurrenceEnum } from './enums';
import { patients } from './patients';
import { postesDialyse } from './postes-dialyse';
import { users } from './users';

export const plannings = pgTable(
  'plannings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    posteId: uuid('poste_id')
      .notNull()
      .references(() => postesDialyse.id),
    medecinId: uuid('medecin_id')
      .notNull()
      .references(() => users.id),
    infirmierId: uuid('infirmier_id')
      .notNull()
      .references(() => users.id),
    jourSemaine: integer('jour_semaine').notNull(), // 0=lundi ... 6=dimanche
    vacation: vacationEnum('vacation').notNull(),
    recurrence: recurrenceEnum('recurrence').notNull().default('hebdo'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('plannings_poste_jour_vacation_unique').on(
      table.posteId,
      table.jourSemaine,
      table.vacation,
    ),
  ],
);

export type Planning = typeof plannings.$inferSelect;
export type NewPlanning = typeof plannings.$inferInsert;
