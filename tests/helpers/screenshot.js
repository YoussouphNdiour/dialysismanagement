// @ts-check
/**
 * Helper de capture d'écran pour la suite E2E.
 *
 * Chaque appel à `snap()` produit un fichier PNG nommé avec un compteur
 * auto-incrémenté à 3 chiffres pour garantir l'ordre alphabétique/chronologique
 * dans le répertoire de screenshots.
 *
 * Format du nom de fichier : NNN_stepName.png
 * Exemple : 001_login_admin.png, 002_liste_patients.png
 *
 * Le compteur est une variable de module (mémoire du processus Node).
 * Il repart de 1 à chaque exécution de la suite. Pour un ordre global stable
 * sur toute la suite, appeler snap() depuis un seul worker (workers: 1 dans la config).
 *
 * Le répertoire cible est tests/screenshots/ (créé automatiquement si absent).
 */

const fs   = require('fs');
const path = require('path');

/** Répertoire de destination des screenshots */
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'screenshots');

/** Compteur auto-incrémenté (variable de module — persiste entre appels dans le même process) */
let counter = 0;

// ---------------------------------------------------------------------------
// Fonction publique
// ---------------------------------------------------------------------------

/**
 * Capture l'état courant de la page et sauvegarde l'image dans tests/screenshots/.
 *
 * @param {import('@playwright/test').Page} page     - Instance de page Playwright
 * @param {string}                          stepName - Nom descriptif de l'étape (sans extension)
 *                                                     Ex: 'login_admin', 'form_patient_cree'
 * @returns {Promise<string>} Le chemin absolu du fichier PNG créé
 *
 * @example
 * await snap(page, 'dashboard_infirmiere');
 * // → sauvegarde  tests/screenshots/003_dashboard_infirmiere.png
 */
async function snap(page, stepName) {
  // Créer le répertoire de screenshots si nécessaire
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  // Incrémenter le compteur et formater sur 3 chiffres (001, 042, 100…)
  counter++;
  const paddedCounter = String(counter).padStart(3, '0');

  // Nettoyer le nom de l'étape pour un nom de fichier valide
  // (remplacer espaces et caractères spéciaux par des underscores)
  const safeName = stepName
    .replace(/[^a-zA-Z0-9À-ÿ\-_]/g, '_')
    .replace(/_+/g, '_')         // éviter les underscores multiples
    .replace(/^_|_$/g, '');      // retirer les underscores en début/fin

  const filename    = `${paddedCounter}_${safeName}.png`;
  const filePath    = path.join(SCREENSHOTS_DIR, filename);

  // Capture pleine page
  await page.screenshot({
    path:     filePath,
    fullPage: false,  // viewport uniquement — plus rapide et plus lisible
  });

  console.log(`[screenshot] Sauvegardé : screenshots/${filename}`);

  return filePath;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = { snap };
