import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'secretaire',
  'medecin',
  'infirmiere',
  'facturation',
  'patient',
  'gestionnaire_stock',
]);

export const patientStatutEnum = pgEnum('patient_statut', [
  'actif',
  'inactif',
  'transfere',
  'decede',
]);

export const sexeEnum = pgEnum('sexe', ['M', 'F']);

export const vacationEnum = pgEnum('vacation', ['matin', 'apres_midi']);

export const recurrenceEnum = pgEnum('recurrence', ['hebdo', 'bihebdo', 'trihebdo']);

export const statutSeanceEnum = pgEnum('statut_seance', [
  'planifiee',
  'en_cours',
  'terminee',
  'annulee',
]);

export const typeDialyseEnum = pgEnum('type_dialyse', [
  'hemodialyse',
  'hemodiafiltration',
  'dialyse_peritoneale',
]);

export const arrivalStatusEnum = pgEnum('arrival_status', ['stable', 'malade', 'urgence']);

export const toleranceEnum = pgEnum('tolerance', ['bonne', 'moyenne', 'mauvaise']);

export const typeBilanEnum = pgEnum('type_bilan', [
  'mensuel',
  'trimestriel',
  'semestriel',
  'annuel',
]);

export const serologieResultEnum = pgEnum('serologie_result', [
  'positif',
  'negatif',
  'non_fait',
]);

export const bioStatusEnum = pgEnum('bio_status', ['ok', 'low', 'high']);

export const ktvStatusEnum = pgEnum('ktv_status', ['adequate', 'inadequate']);

export const categorieArticleEnum = pgEnum('categorie_article', [
  'medicament',
  'consommable',
  'acte_medical',
]);

export const statutFactureEnum = pgEnum('statut_facture', [
  'brouillon',
  'validee',
  'payee',
  'annulee',
]);

export const modePaiementEnum = pgEnum('mode_paiement', [
  'especes',
  'cheque',
  'virement',
  'mobile_money',
]);

export const typeMouvementEnum = pgEnum('type_mouvement', [
  'entree',
  'sortie',
  'ajustement',
]);

export const statutPrescriptionEnum = pgEnum('statut_prescription', [
  'prescrite',
  'administree',
  'annulee',
]);
