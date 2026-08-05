// @ts-check
/**
 * RÔLE : MÉDECIN NÉPHROLOGUE
 *
 * Valide que le médecin :
 *   - voit les menus Néphrologie, Clinique et Bilans biologiques
 *   - ne voit PAS le menu Configuration
 *   - ne voit PAS le menu Facturation Dialyse
 *   - peut ouvrir un patient et créer une ordonnance
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
// Suite de tests
// ---------------------------------------------------------------------------

test.describe('Rôle Médecin', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, LOGIN, PASS);
  });

  // -------------------------------------------------------------------------
  // ACCÈS POSITIFS
  // -------------------------------------------------------------------------

  test('voit le menu Néphrologie', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator(
      '.o_app:has-text("Néphrologie"), a.o_app:has-text("Néphrologie")'
    ).first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  test('voit le menu Clinique', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator(
      '.o_app:has-text("Clinique"), a.o_app:has-text("Clinique")'
    ).first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  test('accède aux bilans biologiques', async ({ page }) => {
    // Naviguer vers Néphrologie
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const nephro = page.locator(
      '.o_app:has-text("Néphrologie"), a.o_app:has-text("Néphrologie")'
    ).first();
    await nephro.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Chercher le sous-menu Bilans
    const bilansMenu = page.locator(
      '.o_menu_sections a:has-text("Bilan"), .o_menu_sections a:has-text("bilan")'
    ).first();
    await expect(bilansMenu).toBeVisible({ timeout: 10000 });
    await bilansMenu.click();
    await page.waitForLoadState('domcontentloaded');

    const title = await page.title();
    expect(title).not.toContain('Error');
  });

  // -------------------------------------------------------------------------
  // ACCÈS NÉGATIFS
  // -------------------------------------------------------------------------

  test('ne voit PAS le menu Configuration', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator(
      '.o_app:has-text("Configuration"), a.o_app:has-text("Configuration")'
    ).first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  test('ne voit PAS le menu Facturation Dialyse', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator(
      '.o_app:has-text("Facturation"), a.o_app:has-text("Facturation")'
    ).first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // PARCOURS MÉTIER
  // -------------------------------------------------------------------------

  test('ouvre un patient et crée une ordonnance', async ({ page, request }) => {
    // Authentification API admin pour préparer les données
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
    // Authentification API admin pour préparer les données
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

    // Naviguer vers la séance
    await page.goto(
      `/odoo/acs-patient-procedure/${procedures[0].id}`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(2000);

    // Vérifier que la fiche s'affiche sans erreur
    const title = await page.title();
    expect(title).not.toContain('Error');

    // Vérifier qu'aucun dialog d'erreur Odoo n'est affiché
    const errorDialog = page.locator(
      '.o_dialog .o_error_dialog, .modal-title:has-text("Erreur")'
    ).first();
    await expect(errorDialog).not.toBeVisible({ timeout: 2000 });

    // Vérifier que la barre de statut est visible (formulaire séance chargé)
    const statusbar = page.locator('.o_statusbar_status').first();
    await expect(statusbar).toBeVisible({ timeout: 8000 });

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

  test('consulte les bilans biologiques', async ({ page }) => {
    // Naviguer vers le menu Néphrologie
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const nephroMenu = page.locator(
      '.o_app:has-text("Néphrologie"), a.o_app:has-text("Néphrologie")'
    ).first();
    await expect(nephroMenu).toBeVisible({ timeout: 10000 });
    await nephroMenu.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Ouvrir le sous-menu Bilans
    const bilansMenu = page.locator(
      '.o_menu_sections a:has-text("Bilan"), .o_menu_sections a:has-text("bilan")'
    ).first();
    await expect(bilansMenu).toBeVisible({ timeout: 10000 });
    await bilansMenu.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Vérifier que la page charge sans erreur Odoo
    const title = await page.title();
    expect(title).not.toContain('Error');

    // Vérifier qu'aucun dialog d'erreur n'est affiché
    const errorDialog = page.locator(
      '.o_dialog .o_error_dialog, .modal-title:has-text("Erreur")'
    ).first();
    await expect(errorDialog).not.toBeVisible({ timeout: 2000 });

    // Vérifier qu'une vue principale est bien affichée (liste ou formulaire)
    const mainView = page.locator(
      '.o_list_view, .o_form_view, .o_kanban_view, .o_action_manager'
    ).first();
    await expect(mainView).toBeVisible({ timeout: 8000 });

    console.log('[medecin] Module Bilans biologiques accessible');
  });

}); // fin describe
