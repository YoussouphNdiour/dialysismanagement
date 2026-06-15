// @ts-check
/**
 * Gestionnaire d'état partagé entre tous les fichiers de test.
 *
 * Les tests Playwright s'exécutent dans des processus séparés et ne peuvent pas
 * partager de variables en mémoire. Ce module utilise un fichier JSON sur disque
 * (tests/state.json) comme bus de données entre les specs :
 *   - 00_setup.spec.js écrit les IDs créés (utilisateurs, config, patient…)
 *   - Les specs suivants lisent ces IDs pour agir sur les bonnes ressources
 *
 * Toutes les fonctions sont synchrones pour être utilisables sans await.
 */

const fs   = require('fs');
const path = require('path');

/** Chemin absolu du fichier d'état (adjacent à ce helper) */
const STATE_FILE = path.resolve(__dirname, '..', 'state.json');

/**
 * Structure par défaut de l'état.
 * Toutes les valeurs sont null jusqu'à être renseignées par les tests.
 * @type {object}
 */
const DEFAULT_STATE = {
  users: {
    secretary:      null,  // id res.users — secrétaire/réceptionniste
    doctor:         null,  // id res.users — médecin néphrologue
    nurse:          null,  // id res.users — infirmière de dialyse
    billing:        null,  // id res.users — agent de facturation
    patient_portal: null,  // id res.users — compte portail patient
  },
  config: {
    station_id:          null,  // id acs.dialysis.station
    schedule_id:         null,  // id acs.nephrology.schedule
    vascular_access_id:  null,  // id acs.vascular.access
    dialyzer_id:         null,  // id acs.dialyzer
    dialysate_id:        null,  // id acs.dialysate
    pricing_rule_id:     null,  // id acs.dialysis.pricing.rule
    department_id:       null,  // id hr.department (type néphro)
    product_id:          null,  // id product.product — séance de dialyse
    appointment_type_id: null,  // id hms.appointment.type (peut rester null)
  },
  patient_id:             null,  // id hms.patient
  partner_id:             null,  // id res.partner du patient
  appointment_id:         null,  // id hms.appointment
  waiting_list_entry_id:  null,  // id acs.waiting.list.entry (ou équivalent)
  procedure_id:           null,  // id acs.patient.procedure
  prescription_id:        null,  // id hms.prescription
  bilan_pre_id:           null,  // id acs.nephrology.bilan (pré-séance)
  bilan_post_id:          null,  // id acs.nephrology.bilan (post-séance)
  complication_id:        null,  // id acs.dialysis.complication
  invoice_id:             null,  // id account.move (facture générée)
  payment_id:             null,  // id account.payment
};

// ---------------------------------------------------------------------------
// Fonctions publiques
// ---------------------------------------------------------------------------

/**
 * Lit le fichier state.json et retourne son contenu parsé.
 * Si le fichier n'existe pas ou est invalide, retourne l'état par défaut.
 *
 * @returns {object} L'état courant
 */
function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[state] Impossible de lire state.json : ${err.message}. Utilisation de l'état par défaut.`);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

/**
 * Écrase complètement le fichier state.json avec les données fournies.
 *
 * @param {object} data - L'état complet à persister
 */
function writeState(data) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[state] Erreur lors de l'écriture de state.json : ${err.message}`);
    throw err;
  }
}

/**
 * Fusionne un patch dans l'état courant et sauvegarde.
 * La fusion est profonde (deep merge) niveau 2 pour supporter les sous-objets
 * comme `users` et `config` sans écraser les clés non mentionnées.
 *
 * Exemples :
 *   updateState({ patient_id: 42 })
 *   updateState({ config: { station_id: 7 } })
 *   updateState({ users: { doctor: 5 } })
 *
 * @param {object} patch - Objet partiel à fusionner dans l'état
 * @returns {object} Le nouvel état complet
 */
function updateState(patch) {
  const current = readState();

  // Fusion profonde : pour chaque clé du patch
  for (const [key, value] of Object.entries(patch)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof current[key] === 'object' &&
      current[key] !== null &&
      !Array.isArray(current[key])
    ) {
      // Les deux sont des objets → fusionner les sous-clés
      current[key] = { ...current[key], ...value };
    } else {
      // Valeur primitive ou tableau → remplacement direct
      current[key] = value;
    }
  }

  writeState(current);
  return current;
}

module.exports = { readState, writeState, updateState };
