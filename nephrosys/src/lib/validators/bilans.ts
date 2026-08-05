import { z } from 'zod';

const serologieEnum = z.enum(['positif', 'negatif', 'non_fait']);

const typeBilanValues = ['mensuel', 'trimestriel', 'semestriel', 'annuel'] as const;

export const createBilanSchema = z.object({
  patientId: z.string().uuid('Patient ID invalide'),
  physicianId: z.string().uuid('Medecin ID invalide'),
  dateBilan: z.string().datetime({ message: 'Date invalide' }),
  typeBilan: z.enum(typeBilanValues),
  notes: z.string().optional(),
});

export type CreateBilanInput = z.infer<typeof createBilanSchema>;

export const updateBilanSchema = z.object({
  id: z.string().uuid('ID invalide'),

  // En-tete
  notes: z.string().optional(),

  // Hematologie
  hemoglobine: z.number().positive().optional(),
  hematocrite: z.number().positive().optional(),
  globulesBlancs: z.number().positive().optional(),
  plaquettes: z.number().positive().optional(),
  neutrophiles: z.number().min(0).optional(),
  eosinophiles: z.number().min(0).optional(),
  basophiles: z.number().min(0).optional(),
  lymphocytes: z.number().min(0).optional(),
  monocytes: z.number().min(0).optional(),
  ferritine: z.number().positive().optional(),
  saturationTransferrine: z.number().min(0).max(100).optional(),
  vgm: z.number().positive().optional(),
  ccmh: z.number().positive().optional(),

  // Biochimie renale
  creatinine: z.number().positive().optional(),
  ureePre: z.number().min(0).optional(),
  ureePost: z.number().min(0).optional(),
  acideUrique: z.number().positive().optional(),
  uricemie: z.number().positive().optional(),
  dfgMdrd: z.number().positive().optional(),

  // Electrolytes
  sodium: z.number().positive().optional(),
  potassium: z.number().positive().optional(),
  chlore: z.number().positive().optional(),
  calcium: z.number().positive().optional(),
  phosphore: z.number().positive().optional(),
  bicarbonateBilan: z.number().positive().optional(),
  reserveAlcaline: z.number().positive().optional(),

  // Mineraux / Os
  pth: z.number().positive().optional(),
  vitamineD: z.number().positive().optional(),
  phosphataseAlcaline: z.number().positive().optional(),

  // Lipides
  hdl: z.number().positive().optional(),
  ldl: z.number().positive().optional(),
  cholesterolTotal: z.number().positive().optional(),
  triglycerides: z.number().positive().optional(),

  // Nutrition / Inflammation
  albumine: z.number().positive().optional(),
  prealbumine: z.number().positive().optional(),
  proteinesTotales: z.number().positive().optional(),
  proteidemie: z.number().positive().optional(),
  crp: z.number().min(0).optional(),

  // Hepatique
  alat: z.number().positive().optional(),
  asat: z.number().positive().optional(),
  gammaGt: z.number().positive().optional(),
  ldhBilan: z.number().positive().optional(),
  cpk: z.number().positive().optional(),
  haptoglobine: z.number().positive().optional(),
  bilirubineTotale: z.number().positive().optional(),
  bilirubineIndirecte: z.number().positive().optional(),
  schizocytes: z.string().max(50).optional(),
  rac: z.string().max(50).optional(),

  // Martial
  cst: z.number().min(0).max(100).optional(),
  ferSerique: z.number().positive().optional(),

  // Glycemie
  gaj: z.number().positive().optional(),
  hba1c: z.number().min(0).max(20).optional(),

  // Urines
  pu24h: z.string().max(50).optional(),
  eppu: z.string().max(50).optional(),
  ecbu: z.string().max(50).optional(),
  nau: z.number().positive().optional(),
  ku: z.number().positive().optional(),
  rapportNaK: z.number().positive().optional(),
  ureeUrinaire: z.number().positive().optional(),
  creatUrinaire: z.number().positive().optional(),

  // PBR
  pbrResultat: z.string().optional(),

  // Serologies
  hbsAg: serologieEnum.optional(),
  antiHbs: serologieEnum.optional(),
  antiHbc: serologieEnum.optional(),
  antiHcv: serologieEnum.optional(),
  antiHiv: serologieEnum.optional(),
  tpha: serologieEnum.optional(),
  vdrl: serologieEnum.optional(),
});

export type UpdateBilanInput = z.infer<typeof updateBilanSchema>;

export const bilanListSchema = z.object({
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(20),
  patientId: z.string().uuid().optional(),
  typeBilan: z.enum(typeBilanValues).optional(),
  dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide').optional(),
  dateFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide').optional(),
});

export type BilanListInput = z.infer<typeof bilanListSchema>;
