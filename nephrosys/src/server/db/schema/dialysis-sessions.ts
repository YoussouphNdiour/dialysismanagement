import {
  pgTable,
  uuid,
  date,
  integer,
  boolean,
  varchar,
  decimal,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import {
  statutSeanceEnum,
  typeDialyseEnum,
  arrivalStatusEnum,
  toleranceEnum,
  ktvStatusEnum,
} from './enums';
import { patients } from './patients';
import { plannings } from './plannings';
import { postesDialyse } from './postes-dialyse';
import { users } from './users';

export const dialysisSessions = pgTable('dialysis_sessions', {
  // === Identite ===
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  planningId: uuid('planning_id').references(() => plannings.id),
  posteId: uuid('poste_id')
    .notNull()
    .references(() => postesDialyse.id),
  physicianId: uuid('physician_id')
    .notNull()
    .references(() => users.id),
  nurseId: uuid('nurse_id')
    .notNull()
    .references(() => users.id),
  dateSeance: date('date_seance').notNull(),
  dialysisNumber: integer('dialysis_number'),
  isVip: boolean('is_vip').notNull().default(false),

  // === Pre-dialyse / Arrivee ===
  arrivalStatus: arrivalStatusEnum('arrival_status'),
  arrivalWeight: decimal('arrival_weight', { precision: 5, scale: 2 }),
  dryWeight: decimal('dry_weight', { precision: 5, scale: 2 }),
  interdialysisIncrease: decimal('interdialysis_increase', { precision: 5, scale: 2 }),
  taPreDialyse: varchar('ta_pre_dialyse', { length: 20 }),
  taDebout: varchar('ta_debout', { length: 20 }),
  taCoucher: varchar('ta_coucher', { length: 20 }),
  temperaturePre: decimal('temperature_pre', { precision: 4, scale: 1 }),

  // === Parametres machine / Dialysat ===
  typeDialyse: typeDialyseEnum('type_dialyse'),
  dialyzerType: varchar('dialyzer_type', { length: 100 }),
  typeAbordVasculaire: varchar('type_abord_vasculaire', { length: 100 }),
  debitSang: decimal('debit_sang', { precision: 6, scale: 1 }),
  debitDialysat: decimal('debit_dialysat', { precision: 6, scale: 1 }),
  ufPrescrite: decimal('uf_prescrite', { precision: 6, scale: 2 }),
  ufMax: decimal('uf_max', { precision: 6, scale: 2 }),
  dureePrescrite: integer('duree_prescrite'),
  conductivite: decimal('conductivite', { precision: 4, scale: 2 }),
  bainCalcium: decimal('bain_calcium', { precision: 4, scale: 2 }),
  bainPotassium: decimal('bain_potassium', { precision: 4, scale: 2 }),
  bainGlucose: decimal('bain_glucose', { precision: 4, scale: 2 }),
  bainSodium: varchar('bain_sodium', { length: 20 }),
  temperatureBain: decimal('temperature_bain', { precision: 4, scale: 1 }),
  bicarbonate: text('bicarbonate'),
  anticoagulation: text('anticoagulation'),
  aiguilleArterielle: varchar('aiguille_arterielle', { length: 50 }),
  aiguilleVeineuse: varchar('aiguille_veineuse', { length: 50 }),
  ponction: varchar('ponction', { length: 50 }),
  pressionArterielle: varchar('pression_arterielle', { length: 20 }),
  pressionVeineuse: varchar('pression_veineuse', { length: 20 }),
  ptm: varchar('ptm', { length: 20 }),

  // === Fin de seance ===
  departureWeight: decimal('departure_weight', { precision: 5, scale: 2 }),
  ufReelle: decimal('uf_reelle', { precision: 6, scale: 2 }),
  dureeReelle: integer('duree_reelle'),
  toleranceGlobale: toleranceEnum('tolerance_globale'),
  aspectRein: text('aspect_rein'),
  notesFin: text('notes_fin'),

  // === Adequation dialyse ===
  ureePre: decimal('uree_pre', { precision: 8, scale: 2 }),
  ureePost: decimal('uree_post', { precision: 8, scale: 2 }),
  ktvCalculated: decimal('ktv_calculated', { precision: 4, scale: 2 }),
  ktvStatus: ktvStatusEnum('ktv_status'),
  urrCalculated: decimal('urr_calculated', { precision: 5, scale: 2 }),

  // === Clinique divers ===
  traitementEnCours: text('traitement_en_cours'),
  hemoculture: text('hemoculture'),
  vaccination: text('vaccination'),
  transfusion: text('transfusion'),
  erythropoietine: varchar('erythropoietine', { length: 100 }),
  observations: text('observations'),

  // === Statut et verrouillage ===
  statut: statutSeanceEnum('statut').notNull().default('planifiee'),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DialysisSession = typeof dialysisSessions.$inferSelect;
export type NewDialysisSession = typeof dialysisSessions.$inferInsert;
