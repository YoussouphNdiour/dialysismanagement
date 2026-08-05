import { relations } from 'drizzle-orm';
import { users } from './users';
import { patients } from './patients';
import { postesDialyse } from './postes-dialyse';
import { plannings } from './plannings';
import { dialysisSessions } from './dialysis-sessions';
import { vitalSigns } from './vital-signs';
import { bilans } from './bilans';

export const usersRelations = relations(users, ({ many }) => ({
  patientsAsMedecin: many(patients, { relationName: 'medecinRef' }),
  planningsAsMedecin: many(plannings, { relationName: 'planningMedecin' }),
  planningsAsInfirmier: many(plannings, { relationName: 'planningInfirmier' }),
  sessionsAsPhysician: many(dialysisSessions, { relationName: 'sessionPhysician' }),
  sessionsAsNurse: many(dialysisSessions, { relationName: 'sessionNurse' }),
  bilansAsPhysician: many(bilans, { relationName: 'bilanPhysician' }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
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
  plannings: many(plannings),
  dialysisSessions: many(dialysisSessions),
  bilans: many(bilans),
}));

export const postesDialyseRelations = relations(postesDialyse, ({ many }) => ({
  plannings: many(plannings),
  dialysisSessions: many(dialysisSessions),
}));

export const planningsRelations = relations(plannings, ({ one, many }) => ({
  patient: one(patients, {
    fields: [plannings.patientId],
    references: [patients.id],
  }),
  poste: one(postesDialyse, {
    fields: [plannings.posteId],
    references: [postesDialyse.id],
  }),
  medecin: one(users, {
    fields: [plannings.medecinId],
    references: [users.id],
    relationName: 'planningMedecin',
  }),
  infirmier: one(users, {
    fields: [plannings.infirmierId],
    references: [users.id],
    relationName: 'planningInfirmier',
  }),
  dialysisSessions: many(dialysisSessions),
}));

export const dialysisSessionsRelations = relations(dialysisSessions, ({ one, many }) => ({
  patient: one(patients, {
    fields: [dialysisSessions.patientId],
    references: [patients.id],
  }),
  planning: one(plannings, {
    fields: [dialysisSessions.planningId],
    references: [plannings.id],
  }),
  poste: one(postesDialyse, {
    fields: [dialysisSessions.posteId],
    references: [postesDialyse.id],
  }),
  physician: one(users, {
    fields: [dialysisSessions.physicianId],
    references: [users.id],
    relationName: 'sessionPhysician',
  }),
  nurse: one(users, {
    fields: [dialysisSessions.nurseId],
    references: [users.id],
    relationName: 'sessionNurse',
  }),
  vitalSigns: many(vitalSigns),
}));

export const vitalSignsRelations = relations(vitalSigns, ({ one }) => ({
  session: one(dialysisSessions, {
    fields: [vitalSigns.sessionId],
    references: [dialysisSessions.id],
  }),
}));

export const bilansRelations = relations(bilans, ({ one }) => ({
  patient: one(patients, {
    fields: [bilans.patientId],
    references: [patients.id],
  }),
  physician: one(users, {
    fields: [bilans.physicianId],
    references: [users.id],
    relationName: 'bilanPhysician',
  }),
}));
