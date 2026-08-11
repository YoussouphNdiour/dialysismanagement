// @ts-check
/**
 * 99 — Captures d'écran pour la documentation
 *
 * Ce test navigue dans toutes les pages importantes pour chaque rôle
 * et capture des screenshots dans docs/screenshots/.
 * Les captures sont nommées par rôle pour faciliter l'intégration dans les guides HTML.
 */

const { test, expect } = require('@playwright/test');
const { readState } = require('../helpers/state');
const { loginUI } = require('../helpers/auth');
const { loginApi, apiSearchRead } = require('../helpers/api');
const path = require('path');
const fs = require('fs');

const TEST_PASSWORD = 'Nephro2024!';
const DOCS_DIR = path.resolve(__dirname, '..', '..', 'docs', 'screenshots');

// Compteur global
let shotCounter = 0;

async function docSnap(page, name) {
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
  shotCounter++;
  const filename = `${String(shotCounter).padStart(3, '0')}_${name}.png`;
  const filePath = path.join(DOCS_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`[doc-screenshot] ${filename}`);
  return filename;
}

test.describe('99 — Screenshots documentation', () => {
  test.describe.configure({ timeout: 300000 });

  // ═══════════════════════════════════════════════════════════════════
  // SECRÉTAIRE
  // ═══════════════════════════════════════════════════════════════════
  test('Secrétaire — captures d\'écran', async ({ page, request }) => {
    await loginUI(page, 'secretaire@nephro.test', TEST_PASSWORD);

    // 1. Page d'accueil (apps)
    await page.waitForTimeout(2000);
    await docSnap(page, 'sec_accueil');

    // 2. Naviguer vers Néphrologie
    await page.click('.o_navbar_apps_menu button, .o_menu_toggle');
    await page.waitForTimeout(1000);
    const nephroApp = page.locator('.o_app:has-text("Néphrologie")').first();
    if (await nephroApp.isVisible()) {
      await nephroApp.click();
      await page.waitForTimeout(2000);
    }
    await docSnap(page, 'sec_menu_nephro');

    // 3. Liste patients
    await page.click('.o_navbar_apps_menu button, .o_menu_toggle');
    await page.waitForTimeout(500);
    const patientApp = page.locator('.o_app:has-text("Patient")').first();
    if (await patientApp.isVisible()) {
      await patientApp.click();
      await page.waitForTimeout(2000);
    }
    await docSnap(page, 'sec_patients_liste');

    // 4. Fiche patient (ouvrir le premier)
    const firstPatient = page.locator('.o_data_row').first();
    if (await firstPatient.isVisible()) {
      await firstPatient.click();
      await page.waitForTimeout(2000);
      await docSnap(page, 'sec_patient_fiche');

      // 5. Smart buttons visibles
      await docSnap(page, 'sec_patient_smartbuttons');
    }

    // 6. Rendez-vous
    await loginApi(request, 'admin', 'admin');
    const rdvActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'hms.appointment']], ['id', 'name'], 10,
    );
    const rdvAction = rdvActions.find(a => /rendez|appointment/i.test(a.name));
    if (rdvAction) {
      await page.goto(`/odoo/action-${rdvAction.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'sec_rendez_vous_liste');
    }

    // 7. Générer séances en masse
    const genActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'nephrology.session.generator']], ['id', 'name'], 5,
    );
    if (genActions.length > 0) {
      await page.goto(`/odoo/action-${genActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'sec_generer_seances_liste');

      // Ouvrir le wizard (nouveau)
      const newBtn = page.locator('.o_list_button_add, button:has-text("New"), button:has-text("Nouveau")').first();
      if (await newBtn.isVisible()) {
        await newBtn.click();
        await page.waitForTimeout(2000);
        await docSnap(page, 'sec_generer_seances_wizard');
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // MÉDECIN
  // ═══════════════════════════════════════════════════════════════════
  test('Médecin — captures d\'écran', async ({ page, request }) => {
    await loginUI(page, 'medecin@nephro.test', TEST_PASSWORD);

    // 1. Accueil
    await page.waitForTimeout(2000);
    await docSnap(page, 'med_accueil');

    // 2. Module Néphrologie
    await page.click('.o_navbar_apps_menu button, .o_menu_toggle');
    await page.waitForTimeout(1000);
    const nephroApp = page.locator('.o_app:has-text("Néphrologie")').first();
    if (await nephroApp.isVisible()) {
      await nephroApp.click();
      await page.waitForTimeout(2000);
    }
    await docSnap(page, 'med_nephro_accueil');

    // 3. Liste patients
    await loginApi(request, 'admin', 'admin');
    const patActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'hms.patient']], ['id', 'name'], 10,
    );
    const patAction = patActions.find(a => /patient/i.test(a.name));
    if (patAction) {
      await page.goto(`/odoo/action-${patAction.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'med_patients_liste');
    }

    // 4. Fiche patient
    const firstPatient = page.locator('.o_data_row').first();
    if (await firstPatient.isVisible()) {
      await firstPatient.click();
      await page.waitForTimeout(2000);
      await docSnap(page, 'med_patient_fiche');
    }

    // 5. Hémodialyses (procédures)
    const procActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.patient.procedure']], ['id', 'name'], 20,
    );
    const nephroProc = procActions.find(a => /n[eé]phro|dialys|h[eé]mo/i.test(a.name));
    const procActionId = nephroProc ? nephroProc.id : procActions[0]?.id;
    if (procActionId) {
      await page.goto(`/odoo/action-${procActionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'med_hemodialyses_liste');

      // Ouvrir une séance
      const firstProc = page.locator('.o_data_row').first();
      if (await firstProc.isVisible()) {
        await firstProc.click();
        await page.waitForTimeout(2000);
        await docSnap(page, 'med_seance_formulaire');
      }
    }

    // 6. Ordonnances
    const ordActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'prescription.order']], ['id', 'name'], 10,
    );
    if (ordActions.length > 0) {
      await page.goto(`/odoo/action-${ordActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'med_ordonnances_liste');
    }

    // 7. Générer séances en masse
    const genActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'nephrology.session.generator']], ['id', 'name'], 5,
    );
    if (genActions.length > 0) {
      await page.goto(`/odoo/action-${genActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'med_generer_seances_liste');

      const newBtn = page.locator('.o_list_button_add, button:has-text("New"), button:has-text("Nouveau")').first();
      if (await newBtn.isVisible()) {
        await newBtn.click();
        await page.waitForTimeout(2000);
        await docSnap(page, 'med_generer_seances_wizard');
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // INFIRMIÈRE
  // ═══════════════════════════════════════════════════════════════════
  test('Infirmière — captures d\'écran', async ({ page, request }) => {
    await loginUI(page, 'infirmiere@nephro.test', TEST_PASSWORD);

    // 1. Accueil
    await page.waitForTimeout(2000);
    await docSnap(page, 'inf_accueil');

    // 2. Néphrologie
    await page.click('.o_navbar_apps_menu button, .o_menu_toggle');
    await page.waitForTimeout(1000);
    const nephroApp = page.locator('.o_app:has-text("Néphrologie")').first();
    if (await nephroApp.isVisible()) {
      await nephroApp.click();
      await page.waitForTimeout(2000);
    }
    await docSnap(page, 'inf_nephro_accueil');

    // 3. Liste patients
    await loginApi(request, 'admin', 'admin');
    const patActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'hms.patient']], ['id', 'name'], 10,
    );
    const patAction = patActions.find(a => /patient/i.test(a.name));
    if (patAction) {
      await page.goto(`/odoo/action-${patAction.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'inf_patients_liste');
    }

    // 4. Hémodialyses
    const procActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.patient.procedure']], ['id', 'name'], 20,
    );
    const nephroProc = procActions.find(a => /n[eé]phro|dialys|h[eé]mo/i.test(a.name));
    const procActionId = nephroProc ? nephroProc.id : procActions[0]?.id;
    if (procActionId) {
      await page.goto(`/odoo/action-${procActionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'inf_hemodialyses_liste');

      // Ouvrir une séance
      const firstProc = page.locator('.o_data_row').first();
      if (await firstProc.isVisible()) {
        await firstProc.click();
        await page.waitForTimeout(2000);
        await docSnap(page, 'inf_seance_formulaire');

        // Scroll pour voir les champs cliniques
        await page.evaluate(() => window.scrollTo(0, 500));
        await page.waitForTimeout(500);
        await docSnap(page, 'inf_seance_champs_cliniques');
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // FACTURATION
  // ═══════════════════════════════════════════════════════════════════
  test('Facturation — captures d\'écran', async ({ page, request }) => {
    await loginUI(page, 'facturation@nephro.test', TEST_PASSWORD);

    // 1. Accueil
    await page.waitForTimeout(2000);
    await docSnap(page, 'fac_accueil');

    // 2. Apps disponibles
    await page.click('.o_navbar_apps_menu button, .o_menu_toggle');
    await page.waitForTimeout(1000);
    await docSnap(page, 'fac_apps');

    // 3. Module Facturation
    const facApp = page.locator('.o_app:has-text("Facturation"), .o_app:has-text("Invoicing"), .o_app:has-text("Accounting")').first();
    if (await facApp.isVisible()) {
      await facApp.click();
      await page.waitForTimeout(2000);
      await docSnap(page, 'fac_facturation_accueil');
    }

    // 4. Factures
    await loginApi(request, 'admin', 'admin');
    const invActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'account.move'], ['name', 'ilike', 'facture']], ['id', 'name'], 10,
    );
    if (invActions.length > 0) {
      await page.goto(`/odoo/action-${invActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'fac_factures_liste');
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // PATIENT PORTAIL
  // ═══════════════════════════════════════════════════════════════════
  test('Patient portail — captures d\'écran', async ({ page }) => {
    // Récupérer les infos du patient portail depuis state.json
    const state = readState();
    const portalLogin = (state.users && state.users.patient_portal && state.users.patient_portal.login)
      || 'patient@nephro.test';

    await loginUI(page, portalLogin, TEST_PASSWORD);

    // 1. Page d'accueil portail
    await page.goto('/my', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await docSnap(page, 'pat_portail_accueil');

    // 2. Mes séances
    await page.goto('/my/nephro/seances', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);
    await docSnap(page, 'pat_mes_seances');

    // 3. Mes bilans
    await page.goto('/my/nephro/bilans', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);
    await docSnap(page, 'pat_mes_bilans');

    // 4. Mes ordonnances
    await page.goto('/my/nephro/ordonnances', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);
    await docSnap(page, 'pat_mes_ordonnances');

    // 5. Mes factures
    await page.goto('/my/invoices', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);
    await docSnap(page, 'pat_mes_factures');

    // 6. Mes rendez-vous
    await page.goto('/my/nephro/rdv', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);
    await docSnap(page, 'pat_mes_rdv');
  });

  // ═══════════════════════════════════════════════════════════════════
  // ADMINISTRATEUR (Configuration)
  // ═══════════════════════════════════════════════════════════════════
  test('Administrateur — captures d\'écran', async ({ page, request }) => {
    await loginUI(page, 'admin', 'admin');

    // 1. Accueil admin
    await page.waitForTimeout(2000);
    await docSnap(page, 'adm_accueil');

    // 2. Module Néphrologie
    await page.click('.o_navbar_apps_menu button, .o_menu_toggle');
    await page.waitForTimeout(1000);
    const nephroApp = page.locator('.o_app:has-text("Néphrologie")').first();
    if (await nephroApp.isVisible()) {
      await nephroApp.click();
      await page.waitForTimeout(2000);
    }
    await docSnap(page, 'adm_nephro_accueil');

    // 3. Configuration — Horaire de dialyse
    await loginApi(request, 'admin', 'admin');
    const schedActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.nephrology.schedule']], ['id', 'name'], 5,
    );
    if (schedActions.length > 0) {
      await page.goto(`/odoo/action-${schedActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'adm_config_planning');
    }

    // 4. Configuration — Postes de dialyse
    const stationActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.dialysis.station']], ['id', 'name'], 5,
    );
    if (stationActions.length > 0) {
      await page.goto(`/odoo/action-${stationActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'adm_config_postes');
    }

    // 5. Configuration — Accès vasculaire
    const vascActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.vascular.access']], ['id', 'name'], 5,
    );
    if (vascActions.length > 0) {
      await page.goto(`/odoo/action-${vascActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'adm_config_acces_vasculaire');
    }

    // 6. Configuration — Dialyseurs
    const dialyzerActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.dialyzer']], ['id', 'name'], 5,
    );
    if (dialyzerActions.length > 0) {
      await page.goto(`/odoo/action-${dialyzerActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'adm_config_dialyseurs');
    }

    // 7. Configuration — Jours fériés
    const holidayActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.nephrology.holiday']], ['id', 'name'], 5,
    );
    if (holidayActions.length > 0) {
      await page.goto(`/odoo/action-${holidayActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await docSnap(page, 'adm_config_jours_feries');
    }

    // 8. Tous les menus visibles (menu Néphrologie complet pour admin)
    await page.click('.o_navbar_apps_menu button, .o_menu_toggle');
    await page.waitForTimeout(500);
    const nephroApp2 = page.locator('.o_app:has-text("Néphrologie")').first();
    if (await nephroApp2.isVisible()) {
      await nephroApp2.click();
      await page.waitForTimeout(2000);
      await docSnap(page, 'adm_menu_complet');
    }
  });
});
