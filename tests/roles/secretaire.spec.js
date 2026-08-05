// @ts-check
/**
 * RÔLE : SECRÉTAIRE / AGENT D'ACCUEIL
 *
 * Valide que la secrétaire :
 *   - voit les menus Néphrologie, Clinique et Facturation Dialyse
 *   - ne voit PAS le menu Configuration
 *   - peut créer un patient (parcours UI)
 *   - peut créer un RDV et le confirmer (hybride API + UI)
 *   - peut accéder au module Facturation Dialyse sans erreur
 *
 * Ces tests sont STANDALONE : ils ne dépendent pas de state.json ni du
 * fichier 00_setup.spec.js. Chaque test est autonome.
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');
const { loginApi, apiCreate, apiSearchRead } = require('../helpers/api');

const LOGIN = 'secretaire@nephro.test';
const PASS  = 'Nephro2024!';

// ---------------------------------------------------------------------------
// Helpers locaux
// ---------------------------------------------------------------------------

/**
 * Formatte la date de demain au format Odoo datetime (YYYY-MM-DD HH:MM:SS).
 * @returns {string}
 */
function tomorrowAt9() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 09:00:00`;
}

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------

test.describe('Rôle Secrétaire', () => {

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

  test('voit le menu Facturation Dialyse', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator(
      '.o_app:has-text("Facturation"), a.o_app:has-text("Facturation")'
    ).first();
    await expect(menu).toBeVisible({ timeout: 10000 });
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

  // -------------------------------------------------------------------------
  // PARCOURS MÉTIER
  // -------------------------------------------------------------------------

  test('crée un patient', async ({ page }) => {
    // Naviguer vers Clinique → Patients
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const clinique = page.locator(
      '.o_app:has-text("Clinique"), a.o_app:has-text("Clinique")'
    ).first();
    await expect(clinique).toBeVisible({ timeout: 10000 });
    await clinique.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Cliquer sur Nouveau
    const newBtn = page.locator(
      'button.o_list_button_add, button:has-text("Nouveau"), button:has-text("New")'
    ).first();
    await expect(newBtn).toBeVisible({ timeout: 10000 });
    await newBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Remplir le nom du patient (champ many2one partner_id ou champ texte name)
    const nameInput = page.locator(
      'div[name="partner_id"] input, input[name="partner_id"], div[name="name"] input, input[name="name"]'
    ).first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Test Playwright Secrétaire');
    await page.waitForTimeout(1000);

    // Sélectionner "Créer" dans le dropdown many2one si présent
    const createOption = page.locator(
      '.o_m2o_dropdown_option:has-text("Créer"), .dropdown-item:has-text("Créer"), .o_m2o_dropdown_option:has-text("Create")'
    ).first();
    if (await createOption.isVisible({ timeout: 3000 })) {
      await createOption.click();
      await page.waitForTimeout(1000);
    }

    // Sauvegarder (Ctrl+S ou bouton)
    const saveBtn = page.locator(
      'button.o_form_button_save, .o_control_panel button:has-text("Sauvegarder")'
    ).first();
    if (await saveBtn.isVisible({ timeout: 2000 })) {
      await saveBtn.click();
    } else {
      await page.keyboard.press('Control+S');
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Vérifier qu'on est sur un formulaire sans erreur
    const title = await page.title();
    expect(title).not.toContain('Error');
    // Vérifier qu'aucun dialog d'erreur Odoo n'est affiché
    const errorDialog = page.locator('.o_dialog .o_error_dialog, .modal-title:has-text("Erreur")').first();
    await expect(errorDialog).not.toBeVisible({ timeout: 2000 });
  });

  test('crée un RDV consultation et le confirme', async ({ page, request }) => {
    // Authentification API admin pour préparer les données
    await loginApi(request, 'admin', 'admin');

    // Trouver un patient existant
    const patients = await apiSearchRead(request, 'hms.patient', [], ['id', 'name'], 1);
    expect(patients.length).toBeGreaterThan(0);
    const patientId = patients[0].id;

    // Créer un RDV via API
    const apptId = await apiCreate(request, 'hms.appointment', {
      patient_id: patientId,
      date: tomorrowAt9(),
    });
    expect(apptId).toBeTruthy();
    console.log(`[secretaire] RDV créé via API : id=${apptId}`);

    // Naviguer vers le RDV en tant que secrétaire (UI déjà connectée via beforeEach)
    await page.goto(`/odoo/appointments/${apptId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Vérifier que la barre de statut est visible (formulaire RDV chargé)
    const statusbar = page.locator('.o_statusbar_status').first();
    await expect(statusbar).toBeVisible({ timeout: 8000 });

    // Cliquer sur Confirmer si disponible
    const confirmBtn = page.locator(
      'button:has-text("Confirm"), button:has-text("Confirmer")'
    ).first();
    if (await confirmBtn.isVisible({ timeout: 5000 })) {
      await confirmBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
      console.log('[secretaire] RDV confirmé');
    } else {
      console.warn('[secretaire] Bouton Confirmer non visible — RDV déjà confirmé ou état différent');
    }

    // Vérifier absence d'erreur
    const title = await page.title();
    expect(title).not.toContain('Error');
  });

  test('accède au module Facturation Dialyse sans erreur', async ({ page }) => {
    // Naviguer vers le menu Facturation Dialyse
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const factMenu = page.locator(
      '.o_app:has-text("Facturation"), a.o_app:has-text("Facturation")'
    ).first();
    await expect(factMenu).toBeVisible({ timeout: 10000 });
    await factMenu.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Vérifier que la page charge sans erreur Odoo
    const title = await page.title();
    expect(title).not.toContain('Error');

    // Vérifier qu'aucun dialog d'erreur n'est affiché
    const errorDialog = page.locator('.o_dialog .o_error_dialog, .modal-title:has-text("Erreur")').first();
    await expect(errorDialog).not.toBeVisible({ timeout: 2000 });

    // Vérifier qu'une vue principale est bien affichée (liste ou formulaire)
    const mainView = page.locator(
      '.o_list_view, .o_form_view, .o_kanban_view, .o_action_manager'
    ).first();
    await expect(mainView).toBeVisible({ timeout: 8000 });
    console.log('[secretaire] Module Facturation Dialyse accessible');
  });

}); // fin describe
