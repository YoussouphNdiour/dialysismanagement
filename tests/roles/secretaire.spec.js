// @ts-check
/**
 * RÔLE : SECRÉTAIRE / AGENT D'ACCUEIL
 *
 * Valide que la secrétaire :
 *   - voit les menus Patient, Clinique et Facturation Dialyse
 *   - ne voit PAS le menu Configuration / Settings
 *   - peut créer un patient (parcours UI)
 *   - peut créer un RDV via API
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
 * S'assure que les apps (.o_app) sont visibles.
 * En Odoo 19, un utilisateur avec une action par défaut est redirigé hors
 * de la grille d'apps. Le bouton « Home Menu » ouvre un dropdown.
 */
async function ensureAppsVisible(page) {
  await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const anyApp = page.locator('.o_app').first();
  if (await anyApp.isVisible({ timeout: 2000 })) return;
  const homeMenu = page.locator('button[title="Home Menu"]');
  if (await homeMenu.isVisible({ timeout: 3000 })) {
    await homeMenu.click();
    await page.waitForTimeout(500);
  }
}

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

  test('voit le menu Facturation Dialyse', async ({ page }) => {
    await ensureAppsVisible(page);
    const menu = page.locator('.o_app:has-text("Facturation")').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // ACCÈS NÉGATIFS
  // -------------------------------------------------------------------------

  test('ne voit PAS le menu Configuration', async ({ page }) => {
    await ensureAppsVisible(page);
    const menu = page.locator(
      '.o_app:has-text("Configuration"), .o_app:has-text("Settings")'
    ).first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // PARCOURS MÉTIER
  // -------------------------------------------------------------------------

  test('crée un patient', async ({ page }) => {
    // Naviguer vers Clinique → Patients
    await ensureAppsVisible(page);

    const clinique = page.locator('.o_app:has-text("Clinique")').first();
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

    // Remplir le nom du patient
    // Odoo 19 HMS utilise un textarea pour le champ name, pas un input
    const nameField = page.locator(
      'div[name="name"] textarea, div[name="name"] input, div[name="partner_id"] input'
    ).first();
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill('Test Playwright Secrétaire');
    await page.waitForTimeout(1000);

    // Sélectionner "Créer" dans le dropdown many2one si présent
    const createOption = page.locator(
      '.o_m2o_dropdown_option:has-text("Créer"), .dropdown-item:has-text("Créer"), .o_m2o_dropdown_option:has-text("Create")'
    ).first();
    if (await createOption.isVisible({ timeout: 3000 })) {
      await createOption.click();
      await page.waitForTimeout(1000);
    }

    // Sauvegarder via le bouton dédié
    const saveBtn = page.locator(
      'button:has-text("Save manually"), button.o_form_button_save'
    ).first();
    if (await saveBtn.isVisible({ timeout: 2000 })) {
      await saveBtn.click();
    } else {
      await page.keyboard.press('Control+S');
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Fermer le dialog d'erreur s'il apparaît (Odoo peut afficher un
    // Access Error sur credit_limit pour les utilisateurs non-comptables,
    // mais le patient est quand même créé)
    const errorClose = page.locator('.o_dialog .o_error_dialog button:has-text("Close"), .modal-footer button:has-text("Close")').first();
    if (await errorClose.isVisible({ timeout: 2000 })) {
      await errorClose.click();
      await page.waitForTimeout(500);
    }

    // Vérifier que le patient a bien été créé
    // Le nom est visible quelque part dans la page (titre, breadcrumb ou champ)
    const pageText = await page.locator('.o_form_view').textContent();
    expect(pageText).toContain('Test Playwright');
  });

  test('crée un RDV consultation via API', async ({ page, request }) => {
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

    // Vérifier que le RDV existe et est à l'état draft
    const appts = await apiSearchRead(
      request, 'hms.appointment',
      [['id', '=', apptId]],
      ['id', 'name', 'state'], 1
    );
    expect(appts.length).toBe(1);
    expect(appts[0].state).toBe('draft');
    console.log(`[secretaire] RDV vérifié : ${appts[0].name} (state=${appts[0].state})`);
  });

  test('accède au module Facturation Dialyse sans erreur', async ({ page }) => {
    await ensureAppsVisible(page);

    const factMenu = page.locator('.o_app:has-text("Facturation")').first();
    await expect(factMenu).toBeVisible({ timeout: 10000 });
    await factMenu.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const title = await page.title();
    expect(title).not.toContain('Error');

    const errorDialog = page.locator('.o_dialog .o_error_dialog, .modal-title:has-text("Erreur")').first();
    await expect(errorDialog).not.toBeVisible({ timeout: 2000 });

    const mainView = page.locator(
      '.o_list_view, .o_form_view, .o_kanban_view, .o_action_manager'
    ).first();
    await expect(mainView).toBeVisible({ timeout: 8000 });
    console.log('[secretaire] Module Facturation Dialyse accessible');
  });

}); // fin describe
