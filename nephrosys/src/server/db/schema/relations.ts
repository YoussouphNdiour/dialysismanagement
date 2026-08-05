import { relations } from 'drizzle-orm';
import { users } from './users';
import { patients } from './patients';

export const usersRelations = relations(users, ({ many }) => ({
  patientsAsMedecin: many(patients, { relationName: 'medecinRef' }),
}));

export const patientsRelations = relations(patients, ({ one }) => ({
  user: one(users, {
    fields: [patients.userId],
    references: [users.id],
    relationName: 'portalUser',
  }),
  medecinRef: one(users, {
    fields: [patients.medecinRefId],
    references: [users.id],
    relationName: 'medecinRef',
  }),
}));
