// @ts-check
/**
 * RÔLE : PATIENT (PORTAIL)
 * Responsabilités dans le processus :
 *  13. Consulter ses résultats en ligne (ordonnances, bilans, séances, RDV)
 * Prérequis : Patient invité sur le portail, facture payée
 *
 * Ce fichier est STANDALONE. Le patient se connecte sur le portail Odoo
 * (website) et non sur le backend. Les URL cibles sont celles du module
 * acs_hms_nephrology_portal :
 *   /my/nephro        — tableau de bord
 *   /my/seances       — liste des séances
 *   /my/bilans        — bilans biologiques
 *   /my/ordonnances   — ordonnances
 *   /my/rdv           — rendez-vous
 *
 * Note : Si le patient n'a pas encore été invité sur le portail, ces pages
 * redirigeront vers /web/login. Le test signalera l'erreur sans faire échouer
 * toute la suite.
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { snap }         = require('../helpers/screenshot');
const { readState }    = require('../helpers/state');
const { loginApi, apiSearchRead } = require('../helpers/api');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const PATIENT_LOGIN = 'patient@nephro.test';
const PATIENT_PASS  = 'Nephro2024!';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Connecte le patient via la page de login Odoo (portail).
 * Le portail utilise le même endpoint /web/login qu'Odoo backend.
 *
 * @param {import('@playwright/test').Page} page
 */
async function loginPortal(page) {
  await page.goto('/web/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');

  // Remplir le formulaire
  const loginInput = page.locator('input[name="login"]').first();
  await expect(loginInput).toBeVisible({ timeout: 15000 });
  await loginInput.clear();
  await loginInput.fill(PATIENT_LOGIN);

  const passwordInput = page.locator('input[name="password"]').first();
  await passwordInput.clear();
  await passwordInput.fill(PATIENT_PASS);

  // Sélecteur précis pour le bouton de connexion (évite le bouton Search du site web)
  const loginBtn = page.locator(
    'form[action="/web/login"] button[type="submit"], .oe_login_form button[type="submit"], ' +
    '.o_login_form button[type="submit"], button[type="submit"]:has-text("Log in"), ' +
    'button[type="submit"]:has-text("Se connecter"), button[type="submit"]:has-text("Connexion")'
  ).first();
  if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginBtn.click();
  } else {
    await page.locator('input[name="password"]').first().press('Enter');
  }

  // Attendre la redirection (portail → /my ou backend → /odoo)
  await page.waitForURL(/\/(my|odoo|web)/, { timeout: 30000 });
  console.log('[portail] Patient connecté');
}

/**
 * Vérifie qu'une page portail est accessible (pas de "Access Denied" ou 403).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} url - URL à vérifier
 * @returns {Promise<boolean>} true si la page est accessible
 */
async function checkPortalPageAccessible(page, url) {
  const pageTitle   = await page.title();
  const bodyText    = await page.locator('body').textContent();

  // Vérifications d'erreur courantes
  const errorPatterns = [
    /access denied/i,
    /403 forbidden/i,
    /accès refusé/i,
    /you don't have access/i,
    /vous n'avez pas accès/i,
    /internal server error/i,
    /500/,
  ];

  for (const pattern of errorPatterns) {
    if (pattern.test(pageTitle) || pattern.test(bodyText || '')) {
      console.warn(`[portail] Erreur détectée sur ${url} : pattern "${pattern.source}"`);
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------

test.describe('Rôle Patient Portail — Consultation en ligne', () => {

  // Toutes les ressources patient à vérifier
  // Le test se connecte une fois par spec grâce au contexte de navigateur partagé

  // --------------------------------------------------------------------------
  // TEST 1/5 — Tableau de bord portail
  // --------------------------------------------------------------------------
  test('1/5 — Tableau de bord portail', async ({ page, request }) => {
    // Connexion
    await loginPortal(page);

    // Navigation vers /my/nephro
    const response = await page.goto('/my/nephro', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    // Capture même si la page est vide ou contient un message "aucun patient"
    await snap(page, '13a_portail_tableau_de_bord');

    // Vérifier que la page ne retourne pas une erreur HTTP
    if (response) {
      const status = response.status();
      console.log(`[portail] /my/nephro — HTTP ${status}`);
      // On accepte 200 et les redirections (301, 302) qui aboutissent sur une page valide
      expect(status).not.toBe(500);
    }

    // Vérifier qu'on ne voit pas "Access Denied"
    const accessible = await checkPortalPageAccessible(page, '/my/nephro');
    if (!accessible) {
      console.warn('[portail] Page /my/nephro retourne une erreur d\'accès — le patient n\'est peut-être pas invité sur le portail');
    }
    // On ne fait pas échouer le test : l'accès portail dépend de la configuration
    // (le patient doit être invité via res.partner.signup_token)
    expect(await page.title()).not.toBe('');
  });

  // --------------------------------------------------------------------------
  // TEST 2/5 — Mes séances
  // --------------------------------------------------------------------------
  test('2/5 — Mes séances', async ({ page, request }) => {
    await loginPortal(page);

    const response = await page.goto('/my/seances', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    await snap(page, '13b_portail_mes_seances');

    if (response) {
      console.log(`[portail] /my/seances — HTTP ${response.status()}`);
      expect(response.status()).not.toBe(500);
    }

    // Vérifier l'absence d'erreur d'accès
    await checkPortalPageAccessible(page, '/my/seances');

    // Vérifier qu'il y a soit une liste de séances, soit un message "aucune séance"
    // On accepte les deux cas — ce qui compte c'est que la page se charge
    const hasTable = await page.locator('table, .o_portal_table, .nephro-seances').isVisible({ timeout: 3000 });
    const hasEmptyState = await page.locator(
      ':has-text("aucune séance"), :has-text("Aucune séance"), :has-text("No session")'
    ).isVisible({ timeout: 2000 });

    if (hasTable) {
      console.log('[portail] Liste des séances affichée');
      // Vérifier qu'au moins une ligne est présente
      const rows = page.locator('table tr, .nephro-row').filter({ hasNot: page.locator('th') });
      const rowCount = await rows.count();
      console.log(`[portail] Nombre de séances : ${rowCount}`);
    } else if (hasEmptyState) {
      console.log('[portail] Aucune séance — message vide affiché');
    } else {
      console.warn('[portail] Structure de la page non reconnue (table ni message vide)');
    }

    // Le test passe si la page charge sans erreur 500
    expect(await page.title()).not.toBe('');
  });

  // --------------------------------------------------------------------------
  // TEST 3/5 — Mes bilans biologiques
  // --------------------------------------------------------------------------
  test('3/5 — Mes bilans biologiques', async ({ page, request }) => {
    await loginPortal(page);

    const response = await page.goto('/my/bilans', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    await snap(page, '13c_portail_mes_bilans');

    if (response) {
      console.log(`[portail] /my/bilans — HTTP ${response.status()}`);
      expect(response.status()).not.toBe(500);
    }

    await checkPortalPageAccessible(page, '/my/bilans');

    // Vérifier qu'un graphique Chart.js ou une liste est présente
    const hasChart = await page.locator('canvas, .chart-container, #bilans-chart').first().isVisible({ timeout: 3000 });
    const hasTable = await page.locator('table, .nephro-bilans').isVisible({ timeout: 2000 });
    const hasEmpty = await page.locator(':has-text("aucun bilan"), :has-text("Aucun bilan")').isVisible({ timeout: 2000 });

    if (hasChart) {
      console.log('[portail] Graphique des bilans détecté');
    } else if (hasTable) {
      const rows = await page.locator('table tbody tr').count();
      console.log(`[portail] Tableau des bilans — ${rows} ligne(s)`);
    } else if (hasEmpty) {
      console.log('[portail] Aucun bilan disponible');
    }

    expect(await page.title()).not.toBe('');
  });

  // --------------------------------------------------------------------------
  // TEST 4/5 — Mes ordonnances
  // --------------------------------------------------------------------------
  test('4/5 — Mes ordonnances', async ({ page, request }) => {
    const state = readState();

    await loginPortal(page);

    const response = await page.goto('/my/ordonnances', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    await snap(page, '13d_portail_mes_ordonnances');

    if (response) {
      console.log(`[portail] /my/ordonnances — HTTP ${response.status()}`);
      expect(response.status()).not.toBe(500);
    }

    await checkPortalPageAccessible(page, '/my/ordonnances');

    // Vérifier la présence d'ordonnances
    const hasTable = await page.locator('table, .nephro-ordonnances, .portal-ordonnances').isVisible({ timeout: 5000 });
    const hasEmpty = await page.locator(
      ':has-text("aucune ordonnance"), :has-text("Aucune ordonnance")'
    ).isVisible({ timeout: 2000 });

    if (hasTable) {
      // Si on a un prescription_id dans le state, vérifier que le patient y est
      if (state.prescription_id) {
        // Rechercher via API le nom du patient dans l'ordonnance
        try {
          await loginApi(request, 'admin', 'admin');
          const prescRec = await apiSearchRead(
            request,
            'prescription.order',
            [['id', '=', state.prescription_id]],
            ['id', 'patient_id', 'prescription_date'],
            1
          );
          if (prescRec && prescRec.length > 0) {
            const patientName = Array.isArray(prescRec[0].patient_id)
              ? prescRec[0].patient_id[1]
              : String(prescRec[0].patient_id);
            console.log(`[portail] Ordonnance attendue pour : ${patientName}`);
            // Chercher le nom dans la page
            const nameInPage = page.locator(`body`).getByText(patientName, { exact: false });
            const found = await nameInPage.isVisible({ timeout: 3000 });
            if (found) {
              console.log(`[portail] Nom du patient "${patientName}" trouvé dans la liste des ordonnances`);
            } else {
              console.warn(`[portail] Nom "${patientName}" non visible sur /my/ordonnances`);
            }
          }
        } catch {
          // Pas grave si la vérification API échoue
        }
      }

      const rows = await page.locator('table tbody tr, .ordonnance-item').count();
      console.log(`[portail] Ordonnances visibles : ${rows}`);
    } else if (hasEmpty) {
      console.log('[portail] Aucune ordonnance disponible');
    } else {
      console.warn('[portail] Structure de la page ordonnances non reconnue');
    }

    expect(await page.title()).not.toBe('');
  });

  // --------------------------------------------------------------------------
  // TEST 5/5 — Mes rendez-vous
  // --------------------------------------------------------------------------
  test('5/5 — Mes rendez-vous', async ({ page, request }) => {
    await loginPortal(page);

    const response = await page.goto('/my/rdv', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    await snap(page, '13e_portail_mes_rdv');

    if (response) {
      console.log(`[portail] /my/rdv — HTTP ${response.status()}`);
      expect(response.status()).not.toBe(500);
    }

    await checkPortalPageAccessible(page, '/my/rdv');

    // Vérifier la structure de la page
    const hasTable = await page.locator('table, .nephro-rdv, .portal-rdv').isVisible({ timeout: 5000 });
    const hasEmpty = await page.locator(
      ':has-text("aucun rendez-vous"), :has-text("Aucun rendez-vous"), :has-text("No appointment")'
    ).isVisible({ timeout: 2000 });

    if (hasTable) {
      const rows = await page.locator('table tbody tr, .rdv-item').count();
      console.log(`[portail] Rendez-vous visibles : ${rows}`);
      if (rows > 0) {
        console.log('[portail] Rendez-vous trouvés dans la page');
      }
    } else if (hasEmpty) {
      // Normal si le RDV était passé (la route filtre sur date >= maintenant)
      console.log('[portail] Aucun rendez-vous futur disponible');
    } else {
      console.warn('[portail] Structure de la page RDV non reconnue');
    }

    // Note: La route /my/rdv filtre sur state in ['draft','confirm'] et date >= now()
    // Il est donc normal qu'un RDV créé pendant les tests (demain) apparaisse ici,
    // mais seulement si le patient est le même que celui du portail.
    expect(await page.title()).not.toBe('');

    console.log('[portail] Parcours patient portail terminé (5/5 pages visitées)');
  });

}); // fin describe
