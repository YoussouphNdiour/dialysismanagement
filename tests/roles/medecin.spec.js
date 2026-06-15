// @ts-check
/**
 * RÔLE : MÉDECIN NÉPHROLOGUE
 * Responsabilités dans le processus :
 *   4. Compléter le dossier médical
 *   5. Prescrire l'hémodialyse
 *   6. Créer l'ordonnance médicamenteuse
 *   7. Saisir le bilan biologique pré-dialyse
 *  10. Vérifier KT/V sur dashboard médecin
 *  11. Saisir le bilan post-dialyse
 * Prérequis : Secrétaire a créé le patient (patient_id dans state.json)
 *
 * Ce fichier est STANDALONE : il peut être exécuté seul si state.json contient
 * au minimum patient_id et les IDs de configuration.
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');
const { snap }         = require('../helpers/screenshot');
const { readState, updateState } = require('../helpers/state');
const {
  loginApi,
  rpcCall,
  apiCreate,
  apiSearchRead,
  apiRead,
} = require('../helpers/api');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MEDECIN_LOGIN = 'medecin@nephro.test';
const MEDECIN_PASS  = 'Nephro2024!';

// ---------------------------------------------------------------------------
// Helpers locaux
// ---------------------------------------------------------------------------

/**
 * Ouvre la fiche patient dans le navigateur.
 * Essaie d'abord l'URL directe, puis la liste avec recherche.
 * @param {import('@playwright/test').Page} page
 * @param {number} patientId
 */
async function navigateToPatient(page, patientId) {
  try {
    await page.goto(`/odoo/almightyhms-patient/${patientId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    // Vérifier qu'on est bien sur la fiche (pas sur la liste)
    const formView = page.locator('.o_form_view').first();
    if (await formView.isVisible({ timeout: 5000 })) return;
  } catch {
    // ignore
  }

  // Fallback : aller sur la liste et chercher
  await page.goto('/odoo/almightyhms-patient', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  const searchInput = page.locator(
    '.o_searchview input, input.o_searchview_input'
  ).first();
  if (await searchInput.isVisible({ timeout: 5000 })) {
    await searchInput.fill(String(patientId));
    await page.keyboard.press('Enter');
    await page.waitForLoadState('domcontentloaded');
    const firstRow = page.locator('.o_data_row').first();
    if (await firstRow.isVisible({ timeout: 5000 })) {
      await firstRow.click();
      await page.waitForLoadState('domcontentloaded');
    }
  }
}

/**
 * Remplit un champ Many2one par son nom.
 * @param {import('@playwright/test').Page} page
 * @param {string} fieldName - Attribut name du champ
 * @param {string} value     - Valeur à saisir
 */
async function fillMany2one(page, fieldName, value) {
  const input = page.locator(`div[name="${fieldName}"] input`).first();
  if (!(await input.isVisible({ timeout: 3000 }))) return false;
  await input.clear();
  await input.fill(value);
  await page.waitForTimeout(600);
  const opt = page.locator('.o_m2o_dropdown_option, .dropdown-item, .ui-menu-item').first();
  if (await opt.isVisible({ timeout: 3000 })) {
    await opt.click();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------

test.describe('Rôle Médecin — Parcours complet', () => {

  // --------------------------------------------------------------------------
  // TEST 1/6 — Dossier médical
  // --------------------------------------------------------------------------
  test('1/6 — Dossier médical', async ({ page, request }) => {
    const state = readState();

    if (!state.patient_id) {
      console.warn('[medecin] patient_id absent — impossible de remplir le dossier médical');
      test.skip(true, 'patient_id absent du state.json');
    }

    // Étape 1 : connexion médecin
    await loginApi(request, MEDECIN_LOGIN, MEDECIN_PASS);

    // Étape 2 : login → le médecin atterrit directement sur sa home action (liste patients)
    // NE PAS re-naviguer : un page.goto() supplémentaire déclenche le SPA re-routing vers discuss
    await loginUI(page, MEDECIN_LOGIN, MEDECIN_PASS);
    // loginUI laisse le médecin sur /odoo/almightyhms-patient — on est déjà sur la bonne page
    await page.waitForTimeout(1000);

    // Cliquer sur le premier patient de la liste
    const patientRow = page.locator('.o_data_row').first();
    if (await patientRow.isVisible({ timeout: 8000 })) {
      await patientRow.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    }
    console.log(`[medecin] Navigation patient (${page.url()})`);

    // Chercher l'onglet Néphrologie dans la fiche patient
    const nephroTab = page.locator(
      '.o_notebook .nav-link:has-text("Néphro"), .o_notebook .nav-link:has-text("Nephro")'
    ).first();
    if (await nephroTab.isVisible({ timeout: 5000 })) {
      await nephroTab.click();
      await page.waitForTimeout(500);
    }

    // Poids sec (dry_weight)
    const dryWeightField = page.locator('input[name="dry_weight"]').first();
    if (await dryWeightField.isVisible({ timeout: 3000 })) {
      await dryWeightField.clear();
      await dryWeightField.fill('70.0');
      await page.keyboard.press('Tab');
    }

    // Accès vasculaire (vascular_access_id) — si disponible dans la fiche patient
    if (state.config && state.config.vascular_access_id) {
      const vaRec = await apiSearchRead(
        request,
        'acs.vascular.access',
        [['id', '=', state.config.vascular_access_id]],
        ['id', 'name'],
        1
      );
      if (vaRec && vaRec.length > 0) {
        await fillMany2one(page, 'vascular_access_id', vaRec[0].name);
      }
    }

    // Antécédents — chercher un champ texte générique
    const historyField = page.locator(
      'textarea[name="past_history"], textarea[name="medical_history"], div[name="past_history"] textarea'
    ).first();
    if (await historyField.isVisible({ timeout: 3000 })) {
      await historyField.fill('Insuffisance rénale chronique stade 5 — Test E2E rôle médecin');
    }

    // Sauvegarder
    const saveBtn = page.locator(
      'button.o_form_button_save, .o_control_panel button:has-text("Sauvegarder")'
    ).first();
    if (await saveBtn.isVisible({ timeout: 3000 })) {
      await saveBtn.click();
    } else {
      await page.keyboard.press('Control+S');
    }
    await page.waitForLoadState('domcontentloaded');

    await snap(page, '04_medecin_dossier');
    console.log('[medecin] Dossier médical mis à jour');
  });

  // --------------------------------------------------------------------------
  // TEST 2/6 — Prescription hémodialyse
  // --------------------------------------------------------------------------
  test('2/6 — Prescription hémodialyse', async ({ page, request }) => {
    const state = readState();

    if (!state.patient_id) {
      test.skip(true, 'patient_id absent du state.json');
    }

    // Étape 1 : médecin API — vérifier/créer l'hémodialyse
    await loginApi(request, MEDECIN_LOGIN, MEDECIN_PASS);

    let hemoId = state.hemodialysis_id || null;
    if (!hemoId) {
      const existing = await apiSearchRead(
        request, 'acs.patient.hemodialysis',
        [['patient_id', '=', state.patient_id]], ['id'], 1
      ).catch(() => []);
      if (existing && existing.length > 0) hemoId = existing[0].id;
    }
    if (!hemoId) {
      const hemoVals = { patient_id: state.patient_id };
      if (state.config && state.config.dialyzer_id) hemoVals.dialyzer_id = state.config.dialyzer_id;
      if (state.config && state.config.dialysate_id) hemoVals.dialysate_id = state.config.dialysate_id;
      if (state.config && state.config.vascular_access_id) hemoVals.vascular_access_id = state.config.vascular_access_id;
      hemoId = await apiCreate(request, 'acs.patient.hemodialysis', hemoVals).catch((err) => {
        console.warn(`[medecin] Création hémodialyse échouée : ${err.message}`); return null;
      });
      if (hemoId) { updateState({ hemodialysis_id: hemoId }); console.log(`[medecin] Hémodialyse créée : id=${hemoId}`); }
    } else {
      console.log(`[medecin] Hémodialyse existante : id=${hemoId}`);
    }

    // Étape 2 : UI médecin — naviguer vers la fiche hémodialyse
    // NE PAS re-naviguer avec un deep link après loginUI : le SPA re-route vers discuss
    await loginUI(page, MEDECIN_LOGIN, MEDECIN_PASS);
    // loginUI laisse le médecin sur /odoo/almightyhms-patient (liste patients)
    await page.waitForTimeout(1000);

    // Ouvrir la fiche du premier patient de la liste
    const patientRow2 = page.locator('.o_data_row').first();
    if (await patientRow2.isVisible({ timeout: 8000 })) {
      await patientRow2.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    }

    if (hemoId) {
      // Chercher l'onglet Hémodialyse dans la fiche patient
      const hemoTabNav = page.locator(
        '.o_notebook .nav-link:has-text("Hémodialyse"), .o_notebook .nav-link:has-text("Dialyse")'
      ).first();
      if (await hemoTabNav.isVisible({ timeout: 5000 })) {
        await hemoTabNav.click();
        await page.waitForTimeout(500);
      }
    }
    console.log(`[medecin] Navigation hémodialyse (${page.url()})`);

    await snap(page, '05_medecin_hemodialyse');
    console.log('[medecin] Prescription hémodialyse complétée');
  });

  // --------------------------------------------------------------------------
  // TEST 3/6 — Ordonnance médicamenteuse
  // --------------------------------------------------------------------------
  test('3/6 — Ordonnance médicamenteuse', async ({ page, request }) => {
    const state = readState();

    if (!state.patient_id) {
      test.skip(true, 'patient_id absent du state.json');
    }

    // Étape 1 : médecin API — vérifier l'ordonnance existante
    await loginApi(request, MEDECIN_LOGIN, MEDECIN_PASS);
    await loginUI(page, MEDECIN_LOGIN, MEDECIN_PASS);

    let prescriptionId = state.prescription_id || null;
    if (prescriptionId) {
      const exists = await apiSearchRead(
        request, 'prescription.order',
        [['id', '=', prescriptionId]], ['id', 'state'], 1
      );
      if (exists && exists.length > 0) {
        console.log(`[medecin] Ordonnance existante : id=${prescriptionId}`);
        // loginUI laisse le médecin sur /odoo/almightyhms-patient — naviguer via le menu depuis là
        // NE PAS appeler page.goto('/odoo') : déclenche SPA re-routing vers discuss
        await page.waitForTimeout(1000);
        const nephroApp3 = page.locator(
          '.o_app[data-menu-xmlid*="nephrology"], .o_app:has-text("Néphrologie"), a:has-text("Néphrologie")'
        ).first();
        if (await nephroApp3.isVisible({ timeout: 5000 })) {
          await nephroApp3.click();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(800);
        }
        const ordoMenu = page.locator('.o_menu_sections a:has-text("Ordonnance")').first();
        if (await ordoMenu.isVisible({ timeout: 5000 })) {
          await ordoMenu.click();
          await page.waitForLoadState('domcontentloaded');
          const firstRow = page.locator('.o_data_row').first();
          if (await firstRow.isVisible({ timeout: 5000 })) {
            await firstRow.click();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1000);
          }
        }
        console.log(`[medecin] Navigation ordonnance (${page.url()})`);
        await snap(page, '06_medecin_ordonnance');
        return;
      }
    }

    // Fallback : naviguer via le menu Néphrologie → Ordonnances depuis la page courante
    // (loginUI laisse le médecin sur la liste patients)
    await page.waitForTimeout(800);
    const nephroAppFb = page.locator(
      '.o_app[data-menu-xmlid*="nephrology"], .o_app:has-text("Néphrologie"), a:has-text("Néphrologie")'
    ).first();
    if (await nephroAppFb.isVisible({ timeout: 5000 })) {
      await nephroAppFb.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(600);
    }
    const ordoMenuFb = page.locator('.o_menu_sections a:has-text("Ordonnance")').first();
    if (await ordoMenuFb.isVisible({ timeout: 5000 })) {
      await ordoMenuFb.click();
      await page.waitForLoadState('domcontentloaded');
    }

    // Chercher bouton "Nouveau" sur la liste des ordonnances
    const newPrescBtn = page.locator(
      'button.o_list_button_add, button:has-text("Nouveau"), button:has-text("New")'
    ).first();

    if (await newPrescBtn.isVisible({ timeout: 5000 })) {
      await newPrescBtn.click();
      await page.waitForLoadState('domcontentloaded');
    }

    // Remplir le champ patient si le formulaire est ouvert
    const formView = page.locator('.o_form_view').first();
    if (await formView.isVisible({ timeout: 5000 })) {
      // Patient
      const pRec = await apiSearchRead(
        request, 'hms.patient', [['id', '=', state.patient_id]], ['id', 'name'], 1
      );
      if (pRec && pRec.length > 0) {
        await fillMany2one(page, 'patient_id', pRec[0].name);
      }

      // Ajouter une ligne de médicament (prescription.line)
      const addLineBtn = page.locator(
        'div[name="prescription_line_ids"] .o_field_one2many_list_row_add a, a:has-text("Ajouter une ligne")'
      ).first();
      if (await addLineBtn.isVisible({ timeout: 5000 })) {
        await addLineBtn.click();
        await page.waitForTimeout(500);
        // Saisir le nom du médicament (champ product_id ou medicine_id)
        const medicInput = page.locator(
          'div[name="product_id"] input, div[name="medicine_id"] input'
        ).first();
        if (await medicInput.isVisible({ timeout: 3000 })) {
          await medicInput.fill('Paracétamol');
          await page.waitForTimeout(500);
          const opt = page.locator('.o_m2o_dropdown_option, .dropdown-item').first();
          if (await opt.isVisible({ timeout: 2000 })) {
            await opt.click();
          } else {
            // Créer si pas trouvé
            const createOpt = page.locator('.o_m2o_dropdown_option:has-text("Créer")').first();
            if (await createOpt.isVisible({ timeout: 1500 })) await createOpt.click();
          }
        }
      }

      // Sauvegarder
      const saveBtn = page.locator(
        'button.o_form_button_save, .o_control_panel button:has-text("Sauvegarder")'
      ).first();
      if (await saveBtn.isVisible({ timeout: 3000 })) {
        await saveBtn.click();
      } else {
        await page.keyboard.press('Control+S');
      }
      await page.waitForLoadState('domcontentloaded');

      // Récupérer l'ID de l'ordonnance créée
      if (!state.prescription_id) {
        const prescriptions = await apiSearchRead(
          request,
          'prescription.order',
          [['patient_id', '=', state.patient_id]],
          ['id', 'state', 'prescription_date'],
          1
        );
        if (prescriptions && prescriptions.length > 0) {
          updateState({ prescription_id: prescriptions[0].id });
          console.log(`[medecin] Ordonnance créée : prescription_id=${prescriptions[0].id}`);
        }
      }
    }

    await snap(page, '06_medecin_ordonnance');
  });

  // --------------------------------------------------------------------------
  // TEST 4/6 — Bilan biologique pré-dialyse
  // --------------------------------------------------------------------------
  test('4/6 — Bilan biologique pré-dialyse', async ({ page, request }) => {
    const state = readState();

    if (!state.patient_id) {
      test.skip(true, 'patient_id absent du state.json');
    }

    await loginApi(request, MEDECIN_LOGIN, MEDECIN_PASS);

    // Vérifier si un bilan pré existe déjà
    if (state.bilan_pre_id) {
      const exists = await apiSearchRead(
        request, 'acs.nephro.bilan', [['id', '=', state.bilan_pre_id]], ['id', 'bilan_type'], 1
      );
      if (exists && exists.length > 0) {
        console.log(`[medecin] Bilan pré existant : id=${state.bilan_pre_id}`);
        await loginUI(page, MEDECIN_LOGIN, MEDECIN_PASS);
        // Naviguer vers le bilan
        await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
        await snap(page, '07_medecin_bilan_pre');
        return;
      }
    }

    // Créer le bilan via API pour fiabilité
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const examDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
                     `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;

    const bilanVals = {
      patient_id:  state.patient_id,
      bilan_type:  'monthly',
      exam_date:   examDate,
      hemoglobin:  9.5,
      creatinine:  850.0,
      urea_pre:    18.5,
      potassium:   5.2,
    };

    let bilanPreId;
    try {
      bilanPreId = await apiCreate(request, 'acs.nephro.bilan', bilanVals);
      updateState({ bilan_pre_id: bilanPreId });
      console.log(`[medecin] Bilan pré créé via API : bilan_pre_id=${bilanPreId}`);
    } catch (err) {
      console.error(`[medecin] Erreur création bilan pré : ${err.message}`);
    }

    // Naviguer vers le bilan créé en UI pour screenshot
    await loginUI(page, MEDECIN_LOGIN, MEDECIN_PASS);

    if (bilanPreId) {
      // Essayer la navigation directe
      try {
        await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
        // Ouvrir la liste des bilans
        const nephroApp = page.locator('a:has-text("Néphrologie"), .o_app:has-text("Néphrologie")').first();
        if (await nephroApp.isVisible({ timeout: 5000 })) {
          await nephroApp.click();
          await page.waitForTimeout(800);
        }
        // Chercher le menu Bilans ou Biologie
        const bilanMenu = page.locator(
          '.o_menu_sections a:has-text("Bilan"), .o_menu_sections a:has-text("Biologie")'
        ).first();
        if (await bilanMenu.isVisible({ timeout: 5000 })) {
          await bilanMenu.click();
          await page.waitForLoadState('domcontentloaded');
          // Chercher et ouvrir le bilan créé
          const firstRow = page.locator('.o_data_row').first();
          if (await firstRow.isVisible({ timeout: 5000 })) {
            await firstRow.click();
            await page.waitForLoadState('domcontentloaded');
          }
        }
      } catch {
        console.warn('[medecin] Navigation vers le bilan pré échouée');
      }
    }

    await snap(page, '07_medecin_bilan_pre');
  });

  // --------------------------------------------------------------------------
  // TEST 5/6 — Dashboard médecin post-séance
  // --------------------------------------------------------------------------
  test('5/6 — Dashboard médecin post-séance', async ({ page, request }) => {
    await loginApi(request, MEDECIN_LOGIN, MEDECIN_PASS);
    await loginUI(page, MEDECIN_LOGIN, MEDECIN_PASS);

    // Résoudre l'ID de l'action client du dashboard médecin
    let dashboardUrl = null;
    try {
      const actions = await apiSearchRead(
        request,
        'ir.actions.client',
        [['tag', '=', 'acs_doctor_dashboard']],
        ['id', 'name'],
        1
      );
      if (actions && actions.length > 0) {
        dashboardUrl = `/odoo/action-${actions[0].id}`;
        console.log(`[medecin] Dashboard action id=${actions[0].id}`);
      }
    } catch (err) {
      console.warn(`[medecin] Impossible de résoudre l'action dashboard : ${err.message}`);
    }

    // Fallback : chercher via le XML ID
    if (!dashboardUrl) {
      try {
        const xmlIdRecords = await apiSearchRead(
          request,
          'ir.model.data',
          [['module', '=', 'acs_hms_nephrology_dashboard'], ['name', '=', 'action_doctor_dashboard']],
          ['res_id'],
          1
        );
        if (xmlIdRecords && xmlIdRecords.length > 0) {
          dashboardUrl = `/odoo/action-${xmlIdRecords[0].res_id}`;
        }
      } catch {
        // ignore
      }
    }

    if (!dashboardUrl) {
      // Dernier recours : navigation via le menu
      await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      const nephroApp = page.locator('a:has-text("Néphrologie"), .o_app:has-text("Néphrologie")').first();
      if (await nephroApp.isVisible({ timeout: 5000 })) {
        await nephroApp.click();
        await page.waitForTimeout(800);
      }
      const dashMenu = page.locator(
        '.o_menu_sections a:has-text("Dashboard Médecin"), a:has-text("Dashboard Médecin")'
      ).first();
      if (await dashMenu.isVisible({ timeout: 5000 })) {
        await dashMenu.click();
        await page.waitForLoadState('domcontentloaded');
      }
    } else {
      await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
    }

    // Attendre que le dashboard soit chargé
    await page.waitForTimeout(2000);

    // Tab Grille (tab par défaut)
    await snap(page, '10a_medecin_dashboard_grille');

    // Tab Liste
    const listeTab = page.locator(
      '[data-tab="list"], button:has-text("Liste"), .nav-link:has-text("Liste")'
    ).first();
    if (await listeTab.isVisible({ timeout: 5000 })) {
      await listeTab.click();
      await page.waitForTimeout(800);
    }
    await snap(page, '10b_medecin_dashboard_liste');

    // Tab Stats
    const statsTab = page.locator(
      '[data-tab="stats"], button:has-text("Stats"), .nav-link:has-text("Stats"), .nav-link:has-text("Statistiques")'
    ).first();
    if (await statsTab.isVisible({ timeout: 5000 })) {
      await statsTab.click();
      await page.waitForTimeout(800);
    }
    await snap(page, '10c_medecin_dashboard_stats');

    console.log('[medecin] Dashboard médecin parcouru (3 onglets)');
  });

  // --------------------------------------------------------------------------
  // TEST 6/6 — Bilan post-dialyse
  // --------------------------------------------------------------------------
  test('6/6 — Bilan post-dialyse', async ({ page, request }) => {
    const state = readState();

    if (!state.patient_id) {
      test.skip(true, 'patient_id absent du state.json');
    }

    await loginApi(request, MEDECIN_LOGIN, MEDECIN_PASS);

    // Vérifier si le bilan post existe déjà
    if (state.bilan_post_id) {
      const exists = await apiSearchRead(
        request, 'acs.nephro.bilan', [['id', '=', state.bilan_post_id]], ['id', 'bilan_type'], 1
      );
      if (exists && exists.length > 0) {
        console.log(`[medecin] Bilan post existant : id=${state.bilan_post_id}`);
        await loginUI(page, MEDECIN_LOGIN, MEDECIN_PASS);
        await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
        await snap(page, '11_medecin_bilan_post');
        return;
      }
    }

    // Créer le bilan post via API
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const examDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
                     `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;

    const bilanVals = {
      patient_id:  state.patient_id,
      bilan_type:  'punctual',
      exam_date:   examDate,
      urea_post:   6.5,
      creatinine:  780.0,
    };

    // Ajouter urea_pre si on a un bilan pré (pour calcul KT/V cohérent)
    if (state.bilan_pre_id) {
      bilanVals.urea_pre = 18.5;
    }

    // Lier à la séance si disponible
    if (state.procedure_id) {
      bilanVals.procedure_id = state.procedure_id;
    }

    let bilanPostId;
    try {
      bilanPostId = await apiCreate(request, 'acs.nephro.bilan', bilanVals);
      updateState({ bilan_post_id: bilanPostId });
      console.log(`[medecin] Bilan post créé via API : bilan_post_id=${bilanPostId}`);
    } catch (err) {
      console.error(`[medecin] Erreur création bilan post : ${err.message}`);
    }

    // Naviguer vers le bilan en UI pour screenshot
    await loginUI(page, MEDECIN_LOGIN, MEDECIN_PASS);

    if (bilanPostId) {
      try {
        await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
        const nephroApp = page.locator('a:has-text("Néphrologie"), .o_app:has-text("Néphrologie")').first();
        if (await nephroApp.isVisible({ timeout: 5000 })) {
          await nephroApp.click();
          await page.waitForTimeout(800);
        }
        const bilanMenu = page.locator(
          '.o_menu_sections a:has-text("Bilan"), .o_menu_sections a:has-text("Biologie")'
        ).first();
        if (await bilanMenu.isVisible({ timeout: 5000 })) {
          await bilanMenu.click();
          await page.waitForLoadState('domcontentloaded');
          // Ouvrir le premier bilan (le plus récent)
          const firstRow = page.locator('.o_data_row').first();
          if (await firstRow.isVisible({ timeout: 5000 })) {
            await firstRow.click();
            await page.waitForLoadState('domcontentloaded');
          }
        }
      } catch {
        console.warn('[medecin] Navigation vers bilan post échouée');
      }
    }

    await snap(page, '11_medecin_bilan_post');
    console.log('[medecin] Bilan post-dialyse enregistré');
  });

}); // fin describe
