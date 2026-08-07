import { relations } from 'drizzle-orm';
import { users } from './users';
import { patients } from './patients';
import { postesDialyse } from './postes-dialyse';
import { plannings } from './plannings';
import { dialysisSessions } from './dialysis-sessions';
import { vitalSigns } from './vital-signs';
import { bilans } from './bilans';
import { articles } from './articles';
import { factures } from './factures';
import { lignesFacture } from './lignes-facture';
import { lots } from './lots';
import { mouvementsStock } from './mouvements-stock';
import { seuilsStock } from './seuils-stock';
import { prescriptionsSeance } from './prescriptions-seance';
import { ordonnances } from './ordonnances';

export const usersRelations = relations(users, ({ many }) => ({
  patientsAsMedecin: many(patients, { relationName: 'medecinRef' }),
  planningsAsMedecin: many(plannings, { relationName: 'planningMedecin' }),
  planningsAsInfirmier: many(plannings, { relationName: 'planningInfirmier' }),
  sessionsAsPhysician: many(dialysisSessions, { relationName: 'sessionPhysician' }),
  sessionsAsNurse: many(dialysisSessions, { relationName: 'sessionNurse' }),
  bilansAsPhysician: many(bilans, { relationName: 'bilanPhysician' }),
  facturesAsCreator: many(factures, { relationName: 'factureCreator' }),
  lotsCreated: many(lots),
  mouvementsCreated: many(mouvementsStock),
  prescriptionsCreated: many(prescriptionsSeance),
  ordonnancesCreated: many(ordonnances),
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
  factures: many(factures),
  prescriptionsSeance: many(prescriptionsSeance),
  ordonnances: many(ordonnances),
  mouvementsStock: many(mouvementsStock),
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
  factures: many(factures),
  prescriptionsSeance: many(prescriptionsSeance),
  mouvementsStock: many(mouvementsStock),
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

export const articlesRelations = relations(articles, ({ many }) => ({
  lignesFacture: many(lignesFacture),
  lots: many(lots),
  seuilStock: many(seuilsStock),
  prescriptionsSeance: many(prescriptionsSeance),
  mouvementsStock: many(mouvementsStock),
}));

export const facturesRelations = relations(factures, ({ one, many }) => ({
  session: one(dialysisSessions, {
    fields: [factures.sessionId],
    references: [dialysisSessions.id],
  }),
  patient: one(patients, {
    fields: [factures.patientId],
    references: [patients.id],
  }),
  createdByUser: one(users, {
    fields: [factures.createdBy],
    references: [users.id],
    relationName: 'factureCreator',
  }),
  lignes: many(lignesFacture),
}));

export const lignesFactureRelations = relations(lignesFacture, ({ one }) => ({
  facture: one(factures, {
    fields: [lignesFacture.factureId],
    references: [factures.id],
  }),
  article: one(articles, {
    fields: [lignesFacture.articleId],
    references: [articles.id],
  }),
}));

export const lotsRelations = relations(lots, ({ one, many }) => ({
  article: one(articles, {
    fields: [lots.articleId],
    references: [articles.id],
  }),
  createdByUser: one(users, {
    fields: [lots.createdBy],
    references: [users.id],
  }),
  mouvementsStock: many(mouvementsStock),
  prescriptionsSeance: many(prescriptionsSeance),
}));

export const mouvementsStockRelations = relations(mouvementsStock, ({ one }) => ({
  article: one(articles, {
    fields: [mouvementsStock.articleId],
    references: [articles.id],
  }),
  lot: one(lots, {
    fields: [mouvementsStock.lotId],
    references: [lots.id],
  }),
  session: one(dialysisSessions, {
    fields: [mouvementsStock.sessionId],
    references: [dialysisSessions.id],
  }),
  patient: one(patients, {
    fields: [mouvementsStock.patientId],
    references: [patients.id],
  }),
  createdByUser: one(users, {
    fields: [mouvementsStock.createdBy],
    references: [users.id],
  }),
}));

export const seuilsStockRelations = relations(seuilsStock, ({ one }) => ({
  article: one(articles, {
    fields: [seuilsStock.articleId],
    references: [articles.id],
  }),
}));

export const prescriptionsSeanceRelations = relations(prescriptionsSeance, ({ one }) => ({
  session: one(dialysisSessions, {
    fields: [prescriptionsSeance.sessionId],
    references: [dialysisSessions.id],
  }),
  article: one(articles, {
    fields: [prescriptionsSeance.articleId],
    references: [articles.id],
  }),
  patient: one(patients, {
    fields: [prescriptionsSeance.patientId],
    references: [patients.id],
  }),
  lot: one(lots, {
    fields: [prescriptionsSeance.lotId],
    references: [lots.id],
  }),
  prescritParUser: one(users, {
    fields: [prescriptionsSeance.prescritPar],
    references: [users.id],
  }),
}));

export const ordonnancesRelations = relations(ordonnances, ({ one }) => ({
  patient: one(patients, {
    fields: [ordonnances.patientId],
    references: [patients.id],
  }),
  prescritParUser: one(users, {
    fields: [ordonnances.prescritPar],
    references: [users.id],
  }),
}));
