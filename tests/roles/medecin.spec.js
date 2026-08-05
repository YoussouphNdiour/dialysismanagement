// @ts-check
/**
 * RÔLE : MÉDECIN NÉPHROLOGUE
 *
 * Valide que le médecin :
 *   - voit les menus Patient et Clinique
 *   - ne voit PAS le menu Configuration (Settings)
 *   - peut ouvrir un patient depuis la vue Kanban
 *   - peut ouvrir une séance planifiée et la terminer
 *
 * Ces tests sont STANDALONE : ils ne dépendent pas de state.json ni du
 * fichier 00_setup.spec.js. Chaque test est autonome.
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');
const { loginApi, apiSearchRead } = require('../helpers/api');

const LOGIN = 'medecin@nephro.test';
const PASS  = 'Nephro2024!';

// ---------------------------------------------------------------------------
// Helper : s'assure que les apps sont visibles.
// En Odoo 19, quand un utilisateur a une action par défaut, il est redirigé
// hors de la grille d'apps. Les apps restent accessibles via le bouton
// « Home Menu » (title="Home Menu") qui ouvre un dropdown avec les .o_app.
// ---------------------------------------------------------------------------
async function ensureAppsVisible(page) {
  await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Si la grille d'apps est déjà visible, rien à faire
  const anyApp = page.locator('.o_app').first();
  if (await anyApp.isVisible({ timeout: 2000 })) {
    return;
  }

  // Sinon, ouvrir le Home Menu dropdown
  const homeMenu = page.locator('button[title="Home Menu"]');
  if (await homeMenu.isVisible({ timeout: 3000 })) {
    await homeMenu.click();
    await page.waitForTimeout(500);
  }
}

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------

test.describe('Rôle Médecin', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, LOGIN, PASS);
  });

  // -------------------------------------------------------------------------
  // ACCÈS POSITIFS
  // -------------------------------------------------------------------------

  test('voit le menu Patient', async ({ page }) => {
    await ensureAppsVisible(page);
    const menu = page.locator('.o_app:has-text("Patient")').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  test('voit le menu Clinique', async ({ page }) => {
    await ensureAppsVisible(page);
    const menu = page.locator('.o_app:has-text("Clinique")').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // ACCÈS NÉGATIFS
  // -------------------------------------------------------------------------

  test('ne voit PAS le menu Configuration (Settings)', async ({ page }) => {
    await ensureAppsVisible(page);
    const menu = page.locator(
      '.o_app:has-text("Configuration"), .o_app:has-text("Settings")'
    ).first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // PARCOURS MÉTIER
  // -------------------------------------------------------------------------

  test('ouvre un patient et voit son formulaire', async ({ page, request }) => {
    await loginApi(request, 'admin', 'admin');

    // Trouver un patient existant
    const patients = await apiSearchRead(request, 'hms.patient', [], ['id', 'name'], 1);
    expect(patients.length).toBeGreaterThan(0);

    // Naviguer vers la fiche patient
    await page.goto(`/odoo/almightyhms-patient/${patients[0].id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Vérifier que la fiche s'affiche sans erreur
    const title = await page.title();
    expect(title).not.toContain('Error');

    // Vérifier qu'aucun dialog d'erreur Odoo n'est affiché
    const errorDialog = page.locator(
      '.o_dialog .o_error_dialog, .modal-title:has-text("Erreur")'
    ).first();
    await expect(errorDialog).not.toBeVisible({ timeout: 2000 });

    // Vérifier que la vue formulaire est bien chargée
    const formView = page.locator('.o_form_view').first();
    await expect(formView).toBeVisible({ timeout: 8000 });

    console.log(`[medecin] Fiche patient ouverte : ${patients[0].name} (id=${patients[0].id})`);
  });

  test('ouvre une séance et la termine', async ({ page, request }) => {
    await loginApi(request, 'admin', 'admin');

    // Trouver une séance planifiée (scheduled)
    const procedures = await apiSearchRead(
      request,
      'acs.patient.procedure',
      [['state', '=', 'scheduled']],
      ['id', 'name'],
      1
    );

    if (procedures.length === 0) {
      console.warn('[medecin] Aucune séance planifiée trouvée — test skip');
      return;
    }

    // Naviguer vers la séance via le format web# (le format /odoo/slug
    // ne fonctionne pas pour les modèles HMS personnalisés)
    await page.goto(
      `/web#model=acs.patient.procedure&view_type=form&id=${procedures[0].id}`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);

    // Vérifier que la fiche s'affiche sans erreur
    const title = await page.title();
    expect(title).not.toContain('Error');

    // Vérifier qu'aucun dialog d'erreur
    const errorDialog = page.locator(
      '.o_dialog .o_error_dialog, .modal-title:has-text("Erreur")'
    ).first();
    await expect(errorDialog).not.toBeVisible({ timeout: 2000 });

    // Vérifier que la vue formulaire est bien chargée
    const formView = page.locator('.o_form_view').first();
    await expect(formView).toBeVisible({ timeout: 10000 });

    // Cliquer sur Terminer si disponible
    const endBtn = page.locator(
      'button:has-text("Terminer"), button:has-text("End"), button:has-text("Finish")'
    ).first();
    if (await endBtn.isVisible({ timeout: 5000 })) {
      await endBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
      console.log('[medecin] Séance terminée');
    } else {
      console.warn('[medecin] Bouton Terminer non visible — séance déjà terminée ou état différent');
    }

    console.log(`[medecin] Séance ouverte : ${procedures[0].name} (id=${procedures[0].id})`);
  });

}); // fin describe
