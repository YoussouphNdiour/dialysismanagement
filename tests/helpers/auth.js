// @ts-check
/**
 * Helpers d'authentification UI pour Playwright.
 *
 * Ces fonctions manipulent l'interface web d'Odoo 19 via le navigateur.
 * Elles sont utilisées par les specs qui testent les fonctionnalités
 * accessibles à chaque rôle utilisateur (secrétaire, médecin, infirmière…).
 *
 * Différence avec helpers/api.js :
 *  - api.js  → requêtes JSON-RPC sans navigateur (setup, vérifications rapides)
 *  - auth.js → navigation UI réelle dans Playwright (tests fonctionnels)
 */

// ---------------------------------------------------------------------------
// Connexion UI
// ---------------------------------------------------------------------------

/**
 * Connecte un utilisateur via la page de login Odoo dans le navigateur.
 *
 * Étapes :
 *  1. Navigation vers /web/login
 *  2. Remplissage du formulaire (login + mot de passe)
 *  3. Clic sur le bouton de connexion
 *  4. Attente que l'URL contienne /odoo/ (redirection post-login réussie)
 *
 * @param {import('@playwright/test').Page} page     - Instance de page Playwright
 * @param {string}                          login    - Identifiant utilisateur Odoo
 * @param {string}                          password - Mot de passe
 * @returns {Promise<void>}
 * @throws {Error} Si la redirection vers /odoo/ ne se produit pas dans le délai imparti
 */
async function loginUI(page, login, password) {
  // Déconnexion préalable de toute session active
  await page.goto('/web/session/logout', { waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(500);

  // Navigation vers la page de connexion
  await page.goto('/web/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Attendre qu'un champ de saisie login soit visible
  // Odoo 19 : le champ s'appelle name="login" ou id="login"
  // Si le champ est présent mais caché (JS en cours de rendu), attendre qu'il devienne visible
  await page.waitForSelector('input[name="login"], input[id="login"]', {
    state: 'attached', timeout: 15000,
  }).catch(() => {});
  // Forcer la visibilité si besoin (certaines versions d'Odoo cachent le champ brièvement)
  await page.evaluate(() => {
    const inp = document.querySelector('input[name="login"], input[id="login"]');
    if (inp) { inp.style.display = ''; inp.style.visibility = ''; inp.style.opacity = ''; }
  }).catch(() => {});
  await page.waitForSelector('input[name="login"], input[id="login"]', {
    state: 'visible', timeout: 10000,
  });

  // Remplir login et mot de passe
  await page.fill('input[name="login"]', login);
  // Le champ password peut être name="password" ou type="password"
  await page.fill('input[name="password"], input[type="password"]', password);

  // Cibler spécifiquement le bouton principal du formulaire de login Odoo
  // La page Odoo 19 contient 3 <form>, le login form a action="/web/login"
  // On cible le btn-primary dans ce form (évite de matcher le btn "Log in as superuser")
  const loginForm = page.locator('form[action*="/web/login"]');
  await loginForm.locator('button.btn-primary[type="submit"]').click();

  // Attendre la redirection : /odoo/ (backend) ou /my/ (portail)
  await page.waitForURL(/\/(odoo|my)\//, { timeout: 30000 });

  console.log(`[auth] loginUI : "${login}" connecté → ${page.url()}`);
}

// ---------------------------------------------------------------------------
// Déconnexion UI
// ---------------------------------------------------------------------------

/**
 * Déconnecte l'utilisateur courant en naviguant vers l'endpoint de logout.
 *
 * Odoo 19 invalide la session côté serveur via GET /web/session/logout.
 * Cette approche est plus fiable que de cliquer sur le menu utilisateur
 * car elle ne dépend pas de la structure DOM du menu.
 *
 * @param {import('@playwright/test').Page} page - Instance de page Playwright
 * @returns {Promise<void>}
 */
async function logoutUI(page) {
  // La navigation vers cet endpoint invalide la session et redirige vers /web/login
  await page.goto('/web/session/logout', { waitUntil: 'networkidle' });

  console.log('[auth] logoutUI : session terminée');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { loginUI, logoutUI };
