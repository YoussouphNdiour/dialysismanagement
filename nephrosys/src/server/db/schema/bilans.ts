import {
  pgTable,
  uuid,
  varchar,
  decimal,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import {
  typeBilanEnum,
  serologieResultEnum,
  bioStatusEnum,
} from './enums';
import { patients } from './patients';
import { users } from './users';

export const bilans = pgTable('bilans', {
  // === En-tete ===
  id: uuid('id').primaryKey().defaultRandom(),
  reference: varchar('reference', { length: 50 }).notNull().unique(),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  physicianId: uuid('physician_id')
    .notNull()
    .references(() => users.id),
  dateBilan: timestamp('date_bilan', { withTimezone: true }).notNull(),
  typeBilan: typeBilanEnum('type_bilan').notNull(),
  notes: text('notes'),

  // === Hematologie ===
  hemoglobine: decimal('hemoglobine', { precision: 5, scale: 2 }),
  hematocrite: decimal('hematocrite', { precision: 5, scale: 2 }),
  globulesBlancs: decimal('globules_blancs', { precision: 8, scale: 2 }),
  plaquettes: decimal('plaquettes', { precision: 10, scale: 0 }),
  neutrophiles: decimal('neutrophiles', { precision: 5, scale: 2 }),
  eosinophiles: decimal('eosinophiles', { precision: 5, scale: 2 }),
  basophiles: decimal('basophiles', { precision: 5, scale: 2 }),
  lymphocytes: decimal('lymphocytes', { precision: 5, scale: 2 }),
  monocytes: decimal('monocytes', { precision: 5, scale: 2 }),
  ferritine: decimal('ferritine', { precision: 8, scale: 2 }),
  saturationTransferrine: decimal('saturation_transferrine', { precision: 5, scale: 2 }),
  vgm: decimal('vgm', { precision: 6, scale: 2 }),
  ccmh: decimal('ccmh', { precision: 5, scale: 2 }),

  // === Biochimie renale ===
  creatinine: decimal('creatinine', { precision: 8, scale: 2 }),
  ureePre: decimal('uree_pre', { precision: 8, scale: 2 }),
  ureePost: decimal('uree_post', { precision: 8, scale: 2 }),
  acideUrique: decimal('acide_urique', { precision: 6, scale: 2 }),
  uricemie: decimal('uricemie', { precision: 6, scale: 2 }),
  urrCalculated: decimal('urr_calculated', { precision: 5, scale: 2 }),
  dfgMdrd: decimal('dfg_mdrd', { precision: 6, scale: 2 }),

  // === Electrolytes ===
  sodium: decimal('sodium', { precision: 6, scale: 2 }),
  potassium: decimal('potassium', { precision: 5, scale: 2 }),
  chlore: decimal('chlore', { precision: 6, scale: 2 }),
  calcium: decimal('calcium', { precision: 5, scale: 2 }),
  phosphore: decimal('phosphore', { precision: 5, scale: 2 }),
  bicarbonateBilan: decimal('bicarbonate_bilan', { precision: 6, scale: 2 }),
  reserveAlcaline: decimal('reserve_alcaline', { precision: 6, scale: 2 }),
  produitCaP: decimal('produit_ca_p', { precision: 6, scale: 2 }),

  // === Mineraux / Os ===
  pth: decimal('pth', { precision: 8, scale: 2 }),
  vitamineD: decimal('vitamine_d', { precision: 6, scale: 2 }),
  phosphataseAlcaline: decimal('phosphatase_alcaline', { precision: 8, scale: 2 }),

  // === Bilan lipidique ===
  hdl: decimal('hdl', { precision: 6, scale: 2 }),
  ldl: decimal('ldl', { precision: 6, scale: 2 }),
  cholesterolTotal: decimal('cholesterol_total', { precision: 6, scale: 2 }),
  triglycerides: decimal('triglycerides', { precision: 6, scale: 2 }),

  // === Nutrition et inflammation ===
  albumine: decimal('albumine', { precision: 5, scale: 2 }),
  prealbumine: decimal('prealbumine', { precision: 5, scale: 2 }),
  proteinesTotales: decimal('proteines_totales', { precision: 6, scale: 2 }),
  proteidemie: decimal('proteidemie', { precision: 6, scale: 2 }),
  crp: decimal('crp', { precision: 6, scale: 2 }),

  // === Bilan hepatique ===
  alat: decimal('alat', { precision: 8, scale: 2 }),
  asat: decimal('asat', { precision: 8, scale: 2 }),
  gammaGt: decimal('gamma_gt', { precision: 8, scale: 2 }),
  ldhBilan: decimal('ldh', { precision: 8, scale: 2 }),
  cpk: decimal('cpk', { precision: 8, scale: 2 }),
  haptoglobine: decimal('haptoglobine', { precision: 6, scale: 2 }),
  bilirubineTotale: decimal('bilirubine_totale', { precision: 6, scale: 2 }),
  bilirubineIndirecte: decimal('bilirubine_indirecte', { precision: 6, scale: 2 }),
  schizocytes: varchar('schizocytes', { length: 50 }),
  rac: varchar('rac', { length: 50 }),

  // === Bilan martial ===
  cst: decimal('cst', { precision: 5, scale: 2 }),
  ferSerique: decimal('fer_serique', { precision: 6, scale: 2 }),

  // === Glycemie ===
  gaj: decimal('gaj', { precision: 5, scale: 2 }),
  hba1c: decimal('hba1c', { precision: 4, scale: 1 }),

  // === Urines ===
  pu24h: varchar('pu_24h', { length: 50 }),
  eppu: varchar('eppu', { length: 50 }),
  ecbu: varchar('ecbu', { length: 50 }),
  nau: decimal('nau', { precision: 6, scale: 2 }),
  ku: decimal('ku', { precision: 6, scale: 2 }),
  rapportNaK: decimal('rapport_na_k', { precision: 5, scale: 2 }),
  ureeUrinaire: decimal('uree_urinaire', { precision: 8, scale: 2 }),
  creatUrinaire: decimal('creat_urinaire', { precision: 8, scale: 2 }),

  // === PBR ===
  pbrResultat: text('pbr_resultat'),

  // === Serologies ===
  hbsAg: serologieResultEnum('hbs_ag'),
  antiHbs: serologieResultEnum('anti_hbs'),
  antiHbc: serologieResultEnum('anti_hbc'),
  antiHcv: serologieResultEnum('anti_hcv'),
  antiHiv: serologieResultEnum('anti_hiv'),
  tpha: serologieResultEnum('tpha'),
  vdrl: serologieResultEnum('vdrl'),

  // === Statuts calcules ===
  hbStatut: bioStatusEnum('hb_statut'),
  potassiumStatut: bioStatusEnum('potassium_statut'),
  phosphoreStatut: bioStatusEnum('phosphore_statut'),
  albumineStatut: bioStatusEnum('albumine_statut'),
  pthStatut: bioStatusEnum('pth_statut'),
  caPStatut: bioStatusEnum('ca_p_statut'),

  // === Timestamps ===
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Bilan = typeof bilans.$inferSelect;
export type NewBilan = typeof bilans.$inferInsert;
