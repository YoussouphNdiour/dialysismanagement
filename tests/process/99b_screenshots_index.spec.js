// @ts-check
/**
 * 99b — Régénération des screenshots pour docs/index.html
 *
 * Ce test régénère TOUS les screenshots référencés par docs/index.html
 * dans le dossier screenshots/ à la racine du projet.
 *
 * Prérequis : exécuter 98_seed_data.spec.js d'abord pour avoir des données.
 *
 * Exécution :
 *   cd tests && npx playwright test process/99b_screenshots_index.spec.js --workers=1
 */

const { test, expect } = require('@playwright/test');
const { loginUI } = require('../helpers/auth');
const { loginApi, rpcCall, apiSearchRead, apiRead } = require('../helpers/api');
const path = require('path');
const fs = require('fs');

const TEST_PASSWORD = 'Nephro2024!';
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', '..', 'screenshots');

/** Sauvegarde un screenshot avec le nom exact attendu par index.html */
async function snap(page, name) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`[snap] ${name}.png`);
  return filePath;
}

/** Supprime tous les filtres actifs dans la barre de recherche Odoo */
async function clearFilters(page) {
  const filters = page.locator('.o_facet_remove, .o_searchview_facet .o_facet_remove');
  let attempts = 0;
  while (attempts < 10 && await filters.first().isVisible().catch(() => false)) {
    await filters.first().click();
    await page.waitForTimeout(500);
    attempts++;
  }
  await page.waitForTimeout(500);
}

test.describe('99b — Screenshots pour docs/index.html', () => {
  test.describe.configure({ timeout: 300000 });

  // ═══════════════════════════════════════════════════════════════════
  // P0 — Prérequis (Login + Admin dashboard)
  // ═══════════════════════════════════════════════════════════════════
  test('P0 — Login et dashboard admin', async ({ page }) => {
    // p0_login_page — page de connexion
    await page.goto('/web/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await snap(page, 'p0_login_page');

    // p0_dashboard_admin — accueil admin (grille apps)
    await loginUI(page, 'admin', 'admin');
    await page.click('.o_navbar_apps_menu button, .o_menu_toggle');
    await page.waitForTimeout(1500);
    await snap(page, 'p0_dashboard_admin');
  });

  // ═══════════════════════════════════════════════════════════════════
  // C1 — Secrétaire (vues quotidiennes)
  // ═══════════════════════════════════════════════════════════════════
  test('C1 — Secrétaire vues quotidiennes', async ({ page, request }) => {
    await loginUI(page, 'secretaire@nephro.test', TEST_PASSWORD);
    await loginApi(request, 'admin', 'admin');

    // c1_sec_01_patient_list — liste patients
    const patActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'hms.patient']], ['id', 'name'], 10,
    );
    const patAction = patActions.find(a => /patient/i.test(a.name));
    if (patAction) {
      await page.goto(`/odoo/action-${patAction.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await snap(page, 'c1_sec_01_patient_list');
    }

    // c1_sec_02_patient_dossier — fiche patient
    // Basculer en vue liste si kanban par défaut
    const listBtnSec = page.locator('.o_cp_switch_buttons button.o_list, button[data-tooltip="List"], .o_switch_view.o_list');
    if (await listBtnSec.first().isVisible().catch(() => false)) {
      await listBtnSec.first().click();
      await page.waitForTimeout(2000);
    }
    await page.waitForSelector('.o_data_row', { timeout: 5000 }).catch(() => {});
    const firstPatient = page.locator('.o_data_row').first();
    if (await firstPatient.isVisible()) {
      await firstPatient.click();
      await page.waitForTimeout(2000);
      await snap(page, 'c1_sec_02_patient_dossier');
    } else {
      // Essayer via kanban
      const kanbanCard = page.locator('.o_kanban_record').first();
      if (await kanbanCard.isVisible().catch(() => false)) {
        await kanbanCard.click();
        await page.waitForTimeout(2000);
        await snap(page, 'c1_sec_02_patient_dossier');
      }
    }

    // c1_sec_03_absences_list — liste absences (model: acs.dialysis.absence, action 591)
    await page.goto('/odoo/action-591', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await clearFilters(page);
    await snap(page, 'c1_sec_03_absences_list');

    // c1_sec_04_absence_detail — détail absence (ouvrir la première)
    await page.waitForSelector('.o_data_row', { timeout: 5000 }).catch(() => {});
    const firstAbsRow = page.locator('.o_data_row').first();
    if (await firstAbsRow.isVisible()) {
      await firstAbsRow.click();
      await page.waitForTimeout(2000);
      await snap(page, 'c1_sec_04_absence_detail');
    } else {
      await snap(page, 'c1_sec_04_absence_detail');
    }

    // c1_sec_05_waiting_list (pas référencé dans index.html mais existe)
  });

  // ═══════════════════════════════════════════════════════════════════
  // C2 — Médecin (vues quotidiennes)
  // ═══════════════════════════════════════════════════════════════════
  test('C2 — Médecin vues quotidiennes', async ({ page, request }) => {
    await loginUI(page, 'medecin@nephro.test', TEST_PASSWORD);
    await loginApi(request, 'admin', 'admin');

    // c2_med_01_accueil — accueil médecin (liste patients, pas Discuss)
    await page.waitForTimeout(2000);
    await snap(page, 'c2_med_01_accueil');

    // c2_med_02_patient_list — liste patients
    const patActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'hms.patient']], ['id', 'name'], 10,
    );
    const patAction = patActions.find(a => /patient/i.test(a.name));
    if (patAction) {
      await page.goto(`/odoo/action-${patAction.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await snap(page, 'c2_med_02_patient_list');
    }

    // c2_med_03_patient_dossier — dossier patient
    // Basculer en vue liste si kanban par défaut
    const listBtnMed = page.locator('.o_cp_switch_buttons button.o_list, button[data-tooltip="List"], .o_switch_view.o_list');
    if (await listBtnMed.first().isVisible().catch(() => false)) {
      await listBtnMed.first().click();
      await page.waitForTimeout(2000);
    }
    await page.waitForSelector('.o_data_row', { timeout: 5000 }).catch(() => {});
    const firstPatientMed = page.locator('.o_data_row').first();
    if (await firstPatientMed.isVisible()) {
      await firstPatientMed.click();
      await page.waitForTimeout(2000);
      await snap(page, 'c2_med_03_patient_dossier');
    } else {
      // Essayer via kanban
      const kanbanCardMed = page.locator('.o_kanban_record').first();
      if (await kanbanCardMed.isVisible().catch(() => false)) {
        await kanbanCardMed.click();
        await page.waitForTimeout(2000);
        await snap(page, 'c2_med_03_patient_dossier');
      }
    }

    // c2_med_04_prescription — liste prescriptions (PAS la page avec erreur!)
    const ordActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'prescription.order']], ['id', 'name'], 10,
    );
    if (ordActions.length > 0) {
      await page.goto(`/odoo/action-${ordActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      await page.waitForTimeout(1000);
      await snap(page, 'c2_med_04_prescription');
    }

    // c2_med_05_sessions_list — liste séances
    const procActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.patient.procedure']], ['id', 'name'], 20,
    );
    const nephroProc = procActions.find(a => /n[eé]phro|dialys|h[eé]mo/i.test(a.name));
    const procActionId = nephroProc ? nephroProc.id : procActions[0]?.id;
    if (procActionId) {
      await page.goto(`/odoo/action-${procActionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      await page.waitForTimeout(1000);
      await snap(page, 'c2_med_05_sessions_list');
    }

    // c2_med_06_bilan_pre — bilan biologique (liste ou formulaire)
    const bilanActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.nephro.bilan']], ['id', 'name'], 10,
    );
    if (bilanActions.length > 0) {
      await page.goto(`/odoo/action-${bilanActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      // Ouvrir le premier bilan s'il existe
      const firstBilan = page.locator('.o_data_row').first();
      if (await firstBilan.isVisible()) {
        await firstBilan.click();
        await page.waitForTimeout(2000);
      }
      await snap(page, 'c2_med_06_bilan_pre');
    }

    // c2_med_07_ordonnance — ordonnance (formulaire)
    if (ordActions.length > 0) {
      await page.goto(`/odoo/action-${ordActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      const firstOrd = page.locator('.o_data_row').first();
      if (await firstOrd.isVisible()) {
        await firstOrd.click();
        await page.waitForTimeout(2000);
      }
      await snap(page, 'c2_med_07_ordonnance');
    }

    // c2_med_08_dashboard_grille — dashboard médecin (ir.actions.client, action 589)
    await page.goto('/odoo/action-589', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    // S'assurer qu'on est sur l'onglet Grille (data-tab="grid")
    const gridTab = page.locator('button.dd-tab[data-tab="grid"]');
    if (await gridTab.isVisible().catch(() => false)) {
      await gridTab.click();
      await page.waitForTimeout(2000);
    }
    await snap(page, 'c2_med_08_dashboard_grille');

    // c2_med_09_dashboard_liste — onglet Liste (data-tab="list")
    const listTab = page.locator('button.dd-tab[data-tab="list"]');
    if (await listTab.isVisible().catch(() => false)) {
      await listTab.click();
      await page.waitForTimeout(2000);
    }
    await snap(page, 'c2_med_09_dashboard_liste');

    // c2_med_10_dashboard_stats — onglet Stats (data-tab="stats")
    const statsTab = page.locator('button.dd-tab[data-tab="stats"]');
    if (await statsTab.isVisible().catch(() => false)) {
      await statsTab.click();
      await page.waitForTimeout(2000);
    }
    await snap(page, 'c2_med_10_dashboard_stats');

    // c2_med_12_bilan_post — bilan post-dialyse
    if (bilanActions.length > 0) {
      await page.goto(`/odoo/action-${bilanActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      // Essayer d'ouvrir un bilan post (le dernier)
      const lastBilan = page.locator('.o_data_row').last();
      if (await lastBilan.isVisible()) {
        await lastBilan.click();
        await page.waitForTimeout(2000);
      }
      await snap(page, 'c2_med_12_bilan_post');
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // C3 — Infirmière (séance de dialyse) — Interface OWL custom
  // ═══════════════════════════════════════════════════════════════════
  test('C3 — Infirmière séance de dialyse', async ({ page, request }) => {
    await loginUI(page, 'infirmiere@nephro.test', TEST_PASSWORD);
    await loginApi(request, 'admin', 'admin');

    // ── c3_inf_01_dashboard — NursePatientList (action-588) ──
    await page.goto('/odoo/action-588', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    // Attendre que le composant OWL NursePatientList se charge
    await page.waitForSelector('.o_nurse_patient_list, .o_nurse_dashboard', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await snap(page, 'c3_inf_01_dashboard');

    // ── c3_inf_02_session_start — Cliquer "Démarrer" sur un patient programmé ──
    // Le bouton "Demarrer" (btn-success) dans la liste patient lance NurseSessionForm
    const startBtn = page.locator('.o_nurse_patient_list .btn-success, .o_nurse_dashboard .btn-success').first();
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      await page.waitForTimeout(3000);
      // NurseSessionForm est maintenant affiché (screen: 'session')
      await page.waitForSelector('.o_nurse_session_form', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await snap(page, 'c3_inf_02_session_start');
    } else {
      // Fallback: si pas de patient programmé, chercher "Reprendre" (running)
      const resumeBtn = page.locator('.o_nurse_patient_list .btn-primary, .o_nurse_dashboard .btn-primary').first();
      if (await resumeBtn.isVisible().catch(() => false)) {
        await resumeBtn.click();
        await page.waitForTimeout(3000);
        await page.waitForSelector('.o_nurse_session_form', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);
      }
      await snap(page, 'c3_inf_02_session_start');
    }

    // ── c3_inf_03_vitals_initial — Carte "Données à l'arrivée" + formulaire vitaux ──
    // Le NurseSessionForm affiche les données d'arrivée et le formulaire de saisie des vitaux
    await snap(page, 'c3_inf_03_vitals_initial');

    // ── c3_inf_04_session_running — Remplir les signes vitaux et enregistrer ──
    // Saisir la TA (champ obligatoire pour activer le bouton)
    const taInput = page.locator('.o_nurse_session_form input[type="text"]').first();
    if (await taInput.isVisible().catch(() => false)) {
      await taInput.fill('135/80');
      await page.waitForTimeout(500);
    }
    // Saisir FC
    const fcInput = page.locator('.o_nurse_session_form input[type="number"]').first();
    if (await fcInput.isVisible().catch(() => false)) {
      await fcInput.fill('78');
      await page.waitForTimeout(500);
    }
    await snap(page, 'c3_inf_04_session_running');

    // ── c3_inf_05_complication_popup — Popup complication OWL ──
    // Cliquer "Signaler une complication" (btn-warning) pour ouvrir NurseComplicationPopup
    const compBtn = page.locator('.o_nurse_session_form .btn-warning, button:has-text("Signaler")').first();
    if (await compBtn.isVisible().catch(() => false)) {
      await compBtn.click();
      await page.waitForTimeout(2000);
      // Le popup complication est un overlay custom (.o_complication_backdrop + .o_complication_modal)
      await page.waitForSelector('.o_complication_modal, .o_complication_backdrop', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await snap(page, 'c3_inf_05_complication_popup');

      // ── c3_inf_06_complication_filled — Remplir la complication ──
      // Sélectionner un type (cliquer le premier bouton toggle, ex: Hypotension)
      const typeBtn = page.locator('.o_complication_modal .btn-outline-secondary').first();
      if (await typeBtn.isVisible().catch(() => false)) {
        await typeBtn.click();
        await page.waitForTimeout(500);
      }
      // Saisir "Action prise" (textarea obligatoire)
      const actionTextarea = page.locator('.o_complication_modal textarea').first();
      if (await actionTextarea.isVisible().catch(() => false)) {
        await actionTextarea.fill('Sérum salé 100ml, position Trendelenburg');
        await page.waitForTimeout(500);
      }
      // Sélectionner résolution (premier bouton, ex: Résolue)
      const resolBtn = page.locator('.o_complication_modal .btn-success, .o_complication_modal button:has-text("solue")').first();
      if (await resolBtn.isVisible().catch(() => false)) {
        await resolBtn.click();
        await page.waitForTimeout(500);
      }
      await snap(page, 'c3_inf_06_complication_filled');

      // Fermer le popup (Annuler pour ne pas modifier les données)
      const cancelBtn = page.locator('.o_complication_modal .btn-secondary, .o_complication_modal button:has-text("Annuler")').first();
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(1000);
      }
    } else {
      await snap(page, 'c3_inf_05_complication_popup');
      await snap(page, 'c3_inf_06_complication_filled');
    }

    // ── c3_inf_08_session_end — Écran fin de séance (NurseEndSession) ──
    // Depuis le formulaire de séance, cliquer directement "Terminer la séance"
    const endBtn = page.locator('button:has-text("Terminer la"), .btn-success:has-text("Terminer")').first();
    if (await endBtn.isVisible().catch(() => false)) {
      await endBtn.click();
      await page.waitForTimeout(2000);
      // NurseEndSession est affiché (screen: 'end')
      await page.waitForSelector('.o_nurse_end_session', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await snap(page, 'c3_inf_08_session_end');

      // ── c3_inf_09_end_vitals — Remplir les données de sortie ──
      // Poids sortie (champ obligatoire, form-control-lg)
      const weightInput = page.locator('.o_nurse_end_session input[type="number"]').first();
      if (await weightInput.isVisible().catch(() => false)) {
        await weightInput.fill('70.2');
        await page.waitForTimeout(500);
      }
      // Sélectionner tolérance globale (ex: Bonne)
      const tolBtn = page.locator('.o_nurse_end_session button:has-text("Bonne")').first();
      if (await tolBtn.isVisible().catch(() => false)) {
        await tolBtn.click();
        await page.waitForTimeout(500);
      }
      await snap(page, 'c3_inf_09_end_vitals');

      // ── c3_inf_10_session_done — Formulaire rempli prêt à valider ──
      // Scroll pour voir le bouton VALIDER LA SÉANCE
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await snap(page, 'c3_inf_10_session_done');

      // Retour à la liste sans valider (pour ne pas changer l'état)
      const backEndBtn = page.locator('button:has-text("Retour")').first();
      if (await backEndBtn.isVisible().catch(() => false)) {
        await backEndBtn.click();
        await page.waitForTimeout(2000);
      }
    } else {
      // Fallback: pas de bouton "Terminer" visible (session non démarrée correctement)
      await snap(page, 'c3_inf_08_session_end');
      await snap(page, 'c3_inf_09_end_vitals');
      await snap(page, 'c3_inf_10_session_done');
    }

    // ── c3_inf_07_dashboard_alert — Retour au dashboard avec statuts mis à jour ──
    await page.goto('/odoo/action-588', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.waitForSelector('.o_nurse_patient_list, .o_nurse_dashboard', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await snap(page, 'c3_inf_07_dashboard_alert');
  });

  // ═══════════════════════════════════════════════════════════════════
  // C3 — Planning Dialyse (action-590, acs_dialysis_calendar)
  // ═══════════════════════════════════════════════════════════════════
  test('C3 — Planning Dialyse', async ({ page, request }) => {
    await loginApi(request, 'admin', 'admin');

    // Donner à l'infirmière le groupe néphrologie pour voir l'onglet clinique
    try {
      const xmlRef = await apiSearchRead(request, 'ir.model.data',
        [['module', '=', 'acs_hms_nephrology'], ['name', '=', 'group_hms_nephrology_user']],
        ['res_id'], 1);
      const infUser = await apiSearchRead(request, 'res.users',
        [['login', '=', 'infirmiere@nephro.test']], ['id'], 1);
      if (xmlRef.length && infUser.length) {
        const grpId = xmlRef[0].res_id;
        const userId = infUser[0].id;
        await rpcCall(request, 'res.groups', 'write', [[grpId], { user_ids: [[4, userId]] }]);
        console.log(`  Groupe nephro (id=${grpId}) ajouté à infirmière (id=${userId})`);
      }
    } catch (e) {
      console.log('  Note: groupe nephro infirmière:', e.message);
    }

    await loginUI(page, 'infirmiere@nephro.test', TEST_PASSWORD);

    // ── c3_plan_01_calendar_day — Planning Dialyse vue jour (postes + séances) ──
    await page.goto('/odoo/action-590', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.waitForSelector('.dc-wrap, .dc-content', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    // S'assurer qu'on est en vue jour
    const dayBtn = page.locator('button:has-text("Jour"), .dc-toolbar button:has-text("J")').first();
    if (await dayBtn.isVisible().catch(() => false)) {
      await dayBtn.click();
      await page.waitForTimeout(2000);
    }
    // Si 0% occupation (pas de séances aujourd'hui), naviguer aux jours précédents
    let hasSessionCards = await page.locator('.dc-session-card').first().isVisible().catch(() => false);
    if (!hasSessionCards) {
      // Cliquer le bouton "précédent" (‹ = &#8249;, .dc-nav-btn premier du groupe)
      for (let i = 0; i < 7 && !hasSessionCards; i++) {
        const prevArrow = page.locator('.dc-nav-btn').first();
        if (await prevArrow.isVisible().catch(() => false)) {
          await prevArrow.click();
          await page.waitForTimeout(2000);
        }
        hasSessionCards = await page.locator('.dc-session-card').first().isVisible().catch(() => false);
      }
    }
    await snap(page, 'c3_plan_01_calendar_day');

    // ── c3_plan_02_calendar_week — Vue semaine ──
    const weekBtn = page.locator('button:has-text("Semaine"), .dc-toolbar button:has-text("S")').first();
    if (await weekBtn.isVisible().catch(() => false)) {
      await weekBtn.click();
      await page.waitForTimeout(2000);
      await snap(page, 'c3_plan_02_calendar_week');
    } else {
      await snap(page, 'c3_plan_02_calendar_week');
    }

    // ── c3_plan_03_session_panel — Clic sur une séance → panneau patient ──
    // Revenir en vue jour au jour qui contient des séances
    const dayBtn2 = page.locator('.dc-mode-btn:has-text("Jour"), button:has-text("Jour")').first();
    if (await dayBtn2.isVisible().catch(() => false)) {
      await dayBtn2.click();
      await page.waitForTimeout(2000);
    }
    // Naviguer au jour avec des séances si aujourd'hui est vide
    let hasCards2 = await page.locator('.dc-session-card').first().isVisible().catch(() => false);
    if (!hasCards2) {
      for (let i = 0; i < 7 && !hasCards2; i++) {
        const prevArrow2 = page.locator('.dc-nav-btn').first();
        if (await prevArrow2.isVisible().catch(() => false)) {
          await prevArrow2.click();
          await page.waitForTimeout(2000);
        }
        hasCards2 = await page.locator('.dc-session-card').first().isVisible().catch(() => false);
      }
    }
    // Cliquer sur la première carte de séance dans la grille
    const sessionCard = page.locator('.dc-session-card').first();
    if (await sessionCard.isVisible().catch(() => false)) {
      await sessionCard.click();
      await page.waitForTimeout(2000);
      // Attendre le panneau latéral DoctorPatientPanel
      await page.waitForSelector('.doctor-patient-panel', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await snap(page, 'c3_plan_03_session_panel');

      // ── c3_plan_04_dossier_complet — Clic "Dossier complet" → formulaire séance ──
      const dossierBtn = page.locator('.dpp-btn-primary, .doctor-patient-panel button:has-text("Dossier complet")').first();
      if (await dossierBtn.isVisible().catch(() => false)) {
        await dossierBtn.click();
        await page.waitForTimeout(3000);
        await page.waitForSelector('.o_form_view, .o_action', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);

        // S'assurer que l'onglet Néphrologie est sélectionné
        const nephroTab = page.locator('.o_notebook .nav-link').filter({ hasText: /n[eé]phrologie/i }).first();
        if (await nephroTab.isVisible().catch(() => false)) {
          await nephroTab.click();
          await page.waitForTimeout(500);
        }
        await snap(page, 'c3_plan_04_dossier_complet');

        // ── c3_plan_05_dossier_scroll — Scroll vers Poids / Fin de séance ──
        await page.evaluate(() => {
          const el = document.querySelector('.o_form_sheet_bg');
          if (el) el.scrollTop = 700;
        });
        await page.waitForTimeout(500);
        await snap(page, 'c3_plan_05_dossier_scroll');

        // ── c3_plan_06_dossier_debits — Scroll vers Débits / Paramètres du bain ──
        await page.evaluate(() => {
          const el = document.querySelector('.o_form_sheet_bg');
          if (el) el.scrollTop = 1400;
        });
        await page.waitForTimeout(500);
        await snap(page, 'c3_plan_06_dossier_debits');
      } else {
        await snap(page, 'c3_plan_04_dossier_complet');
        await snap(page, 'c3_plan_05_dossier_scroll');
        await snap(page, 'c3_plan_06_dossier_debits');
      }
    } else {
      // Pas de séance visible, prendre quand même un screenshot
      await snap(page, 'c3_plan_03_session_panel');
      await snap(page, 'c3_plan_04_dossier_complet');
      await snap(page, 'c3_plan_05_dossier_scroll');
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // C3 — Médecin (dashboard avec alertes)
  // ═══════════════════════════════════════════════════════════════════
  test('C3 — Médecin dashboard alertes', async ({ page, request }) => {
    await loginUI(page, 'medecin@nephro.test', TEST_PASSWORD);
    await loginApi(request, 'admin', 'admin');

    // c3_med_01_dashboard_with_alert — dashboard médecin (ir.actions.client, action 589)
    await page.goto('/odoo/action-589', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await snap(page, 'c3_med_01_dashboard_with_alert');

    // c3_med_02_complication_detail — détail complication (action 586)
    await page.goto('/odoo/action-586', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await clearFilters(page);
    await page.waitForSelector('.o_data_row', { timeout: 5000 }).catch(() => {});
    const firstCompMed = page.locator('.o_data_row').first();
    if (await firstCompMed.isVisible()) {
      await firstCompMed.click();
      await page.waitForTimeout(2000);
    }
    await snap(page, 'c3_med_02_complication_detail');
  });

  // ═══════════════════════════════════════════════════════════════════
  // C4 — Facturation
  // ═══════════════════════════════════════════════════════════════════
  test('C4 — Facturation', async ({ page, request }) => {
    await loginUI(page, 'facturation@nephro.test', TEST_PASSWORD);
    await loginApi(request, 'admin', 'admin');

    // c4_fac_01_dashboard — accueil facturation
    await page.waitForTimeout(2000);
    await snap(page, 'c4_fac_01_dashboard');

    // c4_fac_02_unbilled_sessions — séances non facturées
    const procActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.patient.procedure']], ['id', 'name'], 20,
    );
    const nephroProc = procActions.find(a => /n[eé]phro|dialys|non.factur|unbilled/i.test(a.name));
    const procActionId = nephroProc ? nephroProc.id : procActions[0]?.id;
    if (procActionId) {
      await page.goto(`/odoo/action-${procActionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      await page.waitForTimeout(1000);
      await snap(page, 'c4_fac_02_unbilled_sessions');
    }

    // c4_fac_03_invoice_draft — facture brouillon
    const invActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'account.move']], ['id', 'name'], 20,
    );
    const facAction = invActions.find(a => /facture|invoice/i.test(a.name));
    const invActionId = facAction ? facAction.id : invActions[0]?.id;
    if (invActionId) {
      await page.goto(`/odoo/action-${invActionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      await page.waitForTimeout(1000);
      await snap(page, 'c4_fac_03_invoice_draft');

      // Ouvrir la première facture
      const firstInv = page.locator('.o_data_row').first();
      if (await firstInv.isVisible()) {
        await firstInv.click();
        await page.waitForTimeout(2000);

        // c4_fac_04_invoice_split — détail facture
        await snap(page, 'c4_fac_04_invoice_split');

        // c4_fac_05_invoice_posted — scroll pour voir lignes
        await page.evaluate(() => window.scrollTo(0, 300));
        await page.waitForTimeout(500);
        await snap(page, 'c4_fac_05_invoice_posted');
      }
    }

    // c4_fac_06_payment_dialog — retour liste + chercher facture payée
    if (invActionId) {
      await page.goto(`/odoo/action-${invActionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      await page.waitForTimeout(1000);

      // Chercher une facture posted/paid
      const rows = page.locator('.o_data_row');
      const count = await rows.count();
      if (count >= 2) {
        await rows.nth(1).click();
        await page.waitForTimeout(2000);
        await snap(page, 'c4_fac_06_payment_dialog');
      } else if (count >= 1) {
        await rows.first().click();
        await page.waitForTimeout(2000);
        await snap(page, 'c4_fac_06_payment_dialog');
      }
    }

    // c4_fac_07_invoice_paid — facture payée
    if (invActionId) {
      await page.goto(`/odoo/action-${invActionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      const rows2 = page.locator('.o_data_row');
      const count2 = await rows2.count();
      if (count2 >= 3) {
        await rows2.nth(2).click();
      } else if (count2 >= 1) {
        await rows2.last().click();
      }
      await page.waitForTimeout(2000);
      await snap(page, 'c4_fac_07_invoice_paid');
    }

    // c4_fac_08_report_wizard — rapports / wizard
    // Chercher un menu rapport dans la facturation
    await page.click('.o_navbar_apps_menu button, .o_menu_toggle');
    await page.waitForTimeout(500);
    const facApp = page.locator('.o_app:has-text("Facturation"), .o_app:has-text("Invoicing")').first();
    if (await facApp.isVisible()) {
      await facApp.click();
      await page.waitForTimeout(2000);
    }
    await snap(page, 'c4_fac_08_report_wizard');

    // c4_fac_09_patient_balances — soldes patients
    const balActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'hms.patient']], ['id', 'name'], 10,
    );
    const balAction = balActions.find(a => /patient/i.test(a.name));
    if (balAction) {
      await page.goto(`/odoo/action-${balAction.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await snap(page, 'c4_fac_09_patient_balances');
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // C5 — Patient Portail
  // ═══════════════════════════════════════════════════════════════════
  test('C5 — Patient portail', async ({ page }) => {
    await loginUI(page, 'patient@nephro.test', TEST_PASSWORD);

    // c5_pat_01_dashboard — tableau de bord portail
    await page.goto('/my/nephro', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await snap(page, 'c5_pat_01_dashboard');

    // c5_pat_02_sessions_list — mes séances
    await page.goto('/my/seances', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await snap(page, 'c5_pat_02_sessions_list');

    // c5_pat_03_session_detail — détail séance (ouvrir la première)
    const firstLink = page.locator('a[href*="/my/seances/"]').first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await page.waitForTimeout(2000);
      await snap(page, 'c5_pat_03_session_detail');
    } else {
      await snap(page, 'c5_pat_03_session_detail');
    }

    // c5_pat_04_bilans — mes bilans
    await page.goto('/my/bilans', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await snap(page, 'c5_pat_04_bilans');

    // c5_pat_05_rdv — mes rendez-vous
    await page.goto('/my/rdv', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await snap(page, 'c5_pat_05_rdv');

    // c5_pat_06_ordonnances — mes ordonnances
    await page.goto('/my/ordonnances', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await snap(page, 'c5_pat_06_ordonnances');

    // c5_pat_07_factures — mes factures
    await page.goto('/my/invoices', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await snap(page, 'c5_pat_07_factures');
  });

  // ═══════════════════════════════════════════════════════════════════
  // P1 — Secrétaire parcours inscription
  // ═══════════════════════════════════════════════════════════════════
  test('P1 — Secrétaire parcours inscription', async ({ page, request }) => {
    await loginUI(page, 'secretaire@nephro.test', TEST_PASSWORD);
    await loginApi(request, 'admin', 'admin');

    // p1_sec_01_patient_list — liste patients vue secrétaire
    const patActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'hms.patient']], ['id', 'name'], 10,
    );
    const patAction = patActions.find(a => /patient/i.test(a.name));
    if (patAction) {
      await page.goto(`/odoo/action-${patAction.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await snap(page, 'p1_sec_01_patient_list');

      // p1_sec_02_patient_form_empty — formulaire vide
      // Basculer en vue liste si kanban par défaut
      const listBtnP1 = page.locator('.o_cp_switch_buttons button.o_list, button[data-tooltip="List"], .o_switch_view.o_list');
      if (await listBtnP1.first().isVisible().catch(() => false)) {
        await listBtnP1.first().click();
        await page.waitForTimeout(2000);
      }
      await page.waitForSelector('.o_data_row', { timeout: 5000 }).catch(() => {});
      const newBtn = page.locator('.o_list_button_add, button:has-text("Nouveau"), .btn-primary:has-text("New")').first();
      if (await newBtn.isVisible()) {
        await newBtn.click();
        await page.waitForTimeout(3000);
        await snap(page, 'p1_sec_02_patient_form_empty');

        // Remplir le formulaire — chercher le champ nom dans le formulaire
        const nameField = page.locator('.o_field_widget[name="name"] input, input[name="name"]').first();
        if (await nameField.isVisible().catch(() => false)) {
          await nameField.click();
          await nameField.fill('Amadou Bâ');
          await page.waitForTimeout(1000);
        }
        await snap(page, 'p1_sec_03_patient_form_filled');

        // Annuler pour ne pas créer de doublon
        const discardBtn = page.locator('.o_form_button_cancel, button:has-text("Annuler"), button:has-text("Discard")').first();
        if (await discardBtn.isVisible().catch(() => false)) {
          await discardBtn.click();
          await page.waitForTimeout(1000);
          // Confirmer l'annulation si popup
          const confirmBtn = page.locator('.modal-footer .btn-primary, button:has-text("OK")').first();
          if (await confirmBtn.isVisible().catch(() => false)) {
            await confirmBtn.click();
            await page.waitForTimeout(1000);
          }
        }
      }

      // p1_sec_04_patient_saved — fiche patient existant
      await page.goto(`/odoo/action-${patAction.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      // Basculer en vue liste si kanban par défaut
      const listBtnP1b = page.locator('.o_cp_switch_buttons button.o_list, button[data-tooltip="List"], .o_switch_view.o_list');
      if (await listBtnP1b.first().isVisible().catch(() => false)) {
        await listBtnP1b.first().click();
        await page.waitForTimeout(2000);
      }
      await page.waitForSelector('.o_data_row', { timeout: 5000 }).catch(() => {});
      const firstP = page.locator('.o_data_row').first();
      if (await firstP.isVisible()) {
        await firstP.click();
        await page.waitForTimeout(2000);
        await snap(page, 'p1_sec_04_patient_saved');
      } else {
        // Essayer via kanban
        const kanbanP1 = page.locator('.o_kanban_record').first();
        if (await kanbanP1.isVisible().catch(() => false)) {
          await kanbanP1.click();
          await page.waitForTimeout(2000);
          await snap(page, 'p1_sec_04_patient_saved');
        }
      }
    }

    // p1_sec_05_absence_draft + p1_sec_06_absence_validated (action 591)
    await page.goto('/odoo/action-591', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await clearFilters(page);

    // Ouvrir la première absence
    await page.waitForSelector('.o_data_row', { timeout: 5000 }).catch(() => {});
    const firstAbsP1 = page.locator('.o_data_row').first();
    if (await firstAbsP1.isVisible()) {
      await firstAbsP1.click();
      await page.waitForTimeout(2000);
      await snap(page, 'p1_sec_05_absence_draft');
      await snap(page, 'p1_sec_06_absence_validated');
    } else {
      // Si pas d'absence, prendre la vue liste
      await snap(page, 'p1_sec_05_absence_draft');
      await snap(page, 'p1_sec_06_absence_validated');
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // P1 — Médecin parcours prescription
  // ═══════════════════════════════════════════════════════════════════
  test('P1 — Médecin parcours prescription', async ({ page, request }) => {
    await loginUI(page, 'medecin@nephro.test', TEST_PASSWORD);
    await loginApi(request, 'admin', 'admin');

    // p1_med_01_prescription_empty — vue prescriptions
    const ordActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'prescription.order']], ['id', 'name'], 10,
    );
    if (ordActions.length > 0) {
      await page.goto(`/odoo/action-${ordActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      await snap(page, 'p1_med_01_prescription_empty');

      // Ouvrir la première prescription si elle existe
      const firstOrd = page.locator('.o_data_row').first();
      if (await firstOrd.isVisible()) {
        await firstOrd.click();
        await page.waitForTimeout(2000);
        await snap(page, 'p1_med_02_prescription_filled');

        // Scroll pour voir les lignes
        await page.evaluate(() => window.scrollTo(0, 300));
        await page.waitForTimeout(500);
        await snap(page, 'p1_med_03_prescription_saved');
      }
    }

    // p1_med_04_generator_empty — wizard générateur
    const genActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'nephrology.session.generator']], ['id', 'name'], 5,
    );
    if (genActions.length > 0) {
      await page.goto(`/odoo/action-${genActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await snap(page, 'p1_med_04_generator_empty');

      // Ouvrir le wizard (formulaire nouveau)
      const newBtnGen = page.locator('.o_list_button_add, button:has-text("Nouveau"), .btn-primary:has-text("New")').first();
      if (await newBtnGen.isVisible().catch(() => false)) {
        await newBtnGen.click();
        await page.waitForTimeout(3000);
        await snap(page, 'p1_med_05_generator_filled');
      } else {
        // Si déjà en vue formulaire ou liste vide, prendre quand même
        await snap(page, 'p1_med_05_generator_filled');
      }
    } else {
      // Pas de générateur, prendre un screenshot placeholder
      await snap(page, 'p1_med_04_generator_empty');
      await snap(page, 'p1_med_05_generator_filled');
    }

    // p1_med_06_generator_preview — vue validation
    const valActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'nephrology.session.validator']], ['id', 'name'], 5,
    );
    if (valActions.length > 0) {
      await page.goto(`/odoo/action-${valActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await snap(page, 'p1_med_06_generator_preview');
    } else {
      // Fallback : prendre la vue du wizard
      await snap(page, 'p1_med_06_generator_preview');
    }

    // p1_med_07_sessions_created — liste séances créées
    const procActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.patient.procedure']], ['id', 'name'], 20,
    );
    const nephroProc = procActions.find(a => /n[eé]phro|dialys|h[eé]mo/i.test(a.name));
    const procActionId = nephroProc ? nephroProc.id : procActions[0]?.id;
    if (procActionId) {
      await page.goto(`/odoo/action-${procActionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      await page.waitForTimeout(1000);
      await snap(page, 'p1_med_07_sessions_created');
    }

    // p1_med_08_bilan_pre — bilan pré-dialyse
    const bilanActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.nephro.bilan']], ['id', 'name'], 10,
    );
    if (bilanActions.length > 0) {
      await page.goto(`/odoo/action-${bilanActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      const firstBilan = page.locator('.o_data_row').first();
      if (await firstBilan.isVisible()) {
        await firstBilan.click();
        await page.waitForTimeout(2000);
      }
      await snap(page, 'p1_med_08_bilan_pre');
    }

    // p1_med_09_ordonnance — ordonnance
    if (ordActions.length > 0) {
      await page.goto(`/odoo/action-${ordActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await clearFilters(page);
      const firstOrd = page.locator('.o_data_row').first();
      if (await firstOrd.isVisible()) {
        await firstOrd.click();
        await page.waitForTimeout(2000);
      }
      await snap(page, 'p1_med_09_ordonnance');
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // P1 — Facturation parcours
  // ═══════════════════════════════════════════════════════════════════
  test('P1 — Facturation parcours assureur', async ({ page, request }) => {
    await loginUI(page, 'facturation@nephro.test', TEST_PASSWORD);
    await loginApi(request, 'admin', 'admin');

    // p1_fac_01_assureur — liste assureurs (res.partner avec is_insurance)
    const partnerActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'res.partner']], ['id', 'name'], 20,
    );
    const insurerAction = partnerActions.find(a => /assur|insur/i.test(a.name));
    if (insurerAction) {
      await page.goto(`/odoo/action-${insurerAction.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await snap(page, 'p1_fac_01_assureur');
    } else {
      // Fallback: prendre la vue facturation
      await page.waitForTimeout(1000);
      await snap(page, 'p1_fac_01_assureur');
    }

    // p1_fac_02_dossier_assureur — dossier assureur
    const firstRow = page.locator('.o_data_row, .o_kanban_record').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(2000);
      await snap(page, 'p1_fac_02_dossier_assureur');
    } else {
      await snap(page, 'p1_fac_02_dossier_assureur');
    }
  });
});
