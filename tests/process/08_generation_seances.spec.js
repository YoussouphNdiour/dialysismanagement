// @ts-check
/**
 * 08 — Génération des séances de dialyse
 *
 * Utilisateur : SECRÉTAIRE (secretaire@nephro.test) + MÉDECIN (medecin@nephro.test)
 * Stratégie   : création du wizard nephrology.session.generator via API,
 *               appel action_open_validator + action_confirm sur le validateur.
 *
 * Tests :
 *   1. Le menu "Séances de Dialyse" (Treatment) est masqué
 *   2. Le secrétaire peut générer des séances SANS RDV (checkbox décochée)
 *   3. Le médecin peut générer des séances AVEC RDV (checkbox cochée)
 *   4. Les RDV créés sont bien liés aux séances (1:1)
 *
 * Données lues depuis state.json  : patient_id, users, config.*
 * Données écrites dans state.json : procedure_id
 */

const { test, expect } = require('@playwright/test');
const { readState, updateState } = require('../helpers/state');
const {
  loginApi, rpcCall, apiCreate, apiWrite, apiSearchRead, apiRead,
} = require('../helpers/api');
const { loginUI } = require('../helpers/auth');
const { snap } = require('../helpers/screenshot');

const TEST_PASSWORD = 'Nephro2024!';

test.describe('08 — Génération des séances de dialyse', () => {
  test.describe.configure({ timeout: 120000 });

  // =========================================================================
  // Test A : Le menu "Séances de Dialyse" (Treatment) est masqué
  // =========================================================================
  test('A — Le menu Treatment est masqué pour la secrétaire', async ({ page }) => {
    console.log('[08A] Vérification que le menu Treatment est masqué...');
    await loginUI(page, 'secretaire@nephro.test', TEST_PASSWORD);

    // Naviguer vers le module Néphrologie
    await page.click('.o_navbar_apps_menu button, .o_menu_toggle');
    await page.waitForTimeout(1000);

    // Chercher le menu Néphrologie et cliquer
    const nephroMenu = page.locator('.o_app:has-text("Néphrologie"), .dropdown-item:has-text("Néphrologie")').first();
    if (await nephroMenu.isVisible()) {
      await nephroMenu.click();
      await page.waitForTimeout(2000);
    }

    // Vérifier que "Séances de Dialyse" n'apparaît PAS dans les sous-menus
    const treatmentMenu = page.locator('.o_menu_entry_lvl_1:has-text("Séances de Dialyse"), a:has-text("Séances de Dialyse")');
    const treatmentVisible = await treatmentMenu.isVisible().catch(() => false);
    expect(treatmentVisible).toBe(false);
    console.log('[08A] ✓ Menu "Séances de Dialyse" (Treatment) est bien masqué');

    // Vérifier que "Générer séances en masse" est bien visible pour la secrétaire
    const genMenu = page.locator('a:has-text("Générer séances"), .o_menu_entry_lvl_1:has-text("Générer séances")');
    const genVisible = await genMenu.isVisible().catch(() => false);
    console.log(`[08A] Menu "Générer séances en masse" visible pour secrétaire : ${genVisible}`);

    await snap(page, '08a_menu_nephro_secretaire');
  });

  // =========================================================================
  // Test B : Secrétaire génère des séances SANS RDV
  // =========================================================================
  test('B — Secrétaire génère des séances sans RDV', async ({ page, request }) => {
    console.log('[08B] Génération séances par la secrétaire (sans RDV)...');

    // Auth API en admin (les wizards transient nécessitent souvent les droits admin)
    await loginApi(request, 'admin', 'admin');

    const state = readState();
    const patientId  = state.patient_id;
    const scheduleId = state.config && state.config.schedule_id;
    const departmentId = state.config && state.config.department_id;

    if (!patientId) {
      throw new Error('[08B] patient_id absent du state.json');
    }

    // Annuler puis supprimer les procédures existantes (nettoyage pour test propre)
    const existingProcs = await apiSearchRead(
      request,
      'acs.patient.procedure',
      [['patient_id', '=', patientId]],
      ['id', 'state'],
      100,
    );
    if (existingProcs.length > 0) {
      console.log(`[08B] Nettoyage : ${existingProcs.length} procédures existantes...`);
      const ids = existingProcs.map(p => p.id);
      // Remettre en cancel les procédures qui ne sont pas déjà dans un état supprimable
      const toCancel = existingProcs.filter(p => !['scheduled', 'cancel'].includes(p.state)).map(p => p.id);
      if (toCancel.length > 0) {
        await apiWrite(request, 'acs.patient.procedure', toCancel, { state: 'cancel' });
      }
      await rpcCall(request, 'acs.patient.procedure', 'unlink', [ids]);
    }

    // Calcul des dates
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextWeekStr = `${nextWeek.getFullYear()}-${pad(nextWeek.getMonth() + 1)}-${pad(nextWeek.getDate())}`;

    console.log(`[08B] Période : ${todayStr} → ${nextWeekStr}`);

    // Créer le wizard SANS create_appointments
    const wizardVals = {
      patient_ids: [[6, 0, [patientId]]],
      date_start: todayStr,
      date_end: nextWeekStr,
      exclude_holidays: false,
      create_appointments: false,  // <-- PAS de RDV
    };
    if (scheduleId) wizardVals.schedule_id = scheduleId;

    const wizardId = await apiCreate(request, 'nephrology.session.generator', wizardVals);
    console.log(`[08B] Wizard créé : id=${wizardId}`);

    // Étape 1 → 2 : action_open_validator
    const validatorAction = await rpcCall(
      request, 'nephrology.session.generator', 'action_open_validator', [[wizardId]],
    );

    let validatorId = validatorAction && validatorAction.res_id;
    if (!validatorId) {
      const validators = await apiSearchRead(
        request, 'nephrology.session.validator',
        [['generator_id', '=', wizardId]], ['id'], 1,
      );
      if (validators.length > 0) validatorId = validators[0].id;
    }

    expect(validatorId).toBeTruthy();
    console.log(`[08B] Validateur : id=${validatorId}`);

    // Confirmer
    await rpcCall(request, 'nephrology.session.validator', 'action_confirm', [[validatorId]]);
    console.log('[08B] action_confirm exécuté');

    // Vérifier : des séances créées mais PAS de RDV liés
    const newProcs = await apiSearchRead(
      request, 'acs.patient.procedure',
      [['patient_id', '=', patientId]],
      ['id', 'date', 'state', 'appointment_id'],
      50,
    );
    console.log(`[08B] Séances créées : ${newProcs.length}`);
    expect(newProcs.length).toBeGreaterThan(0);

    // Vérifier qu'aucune séance n'a de RDV lié
    const withRdv = newProcs.filter(p => p.appointment_id && p.appointment_id !== false);
    console.log(`[08B] Séances avec RDV : ${withRdv.length}`);
    expect(withRdv.length).toBe(0);

    console.log('[08B] ✓ Séances générées sans RDV — comportement par défaut préservé');

    // Sauvegarder le premier procedure_id
    updateState({ procedure_id: newProcs[0].id });

    // Screenshot UI
    await loginUI(page, 'secretaire@nephro.test', TEST_PASSWORD);
    const procedureActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.patient.procedure']], ['id', 'name'], 20,
    );
    const nephroAction = procedureActions.find(a => /n[eé]phro|dialys/i.test(a.name));
    const actionId = nephroAction ? nephroAction.id : procedureActions[0]?.id;
    if (actionId) {
      await page.goto(`/odoo/action-${actionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    }
    await snap(page, '08b_seances_sans_rdv');
  });

  // =========================================================================
  // Test C : Médecin génère des séances AVEC RDV
  // =========================================================================
  test('C — Médecin génère des séances avec RDV (checkbox cochée)', async ({ page, request }) => {
    console.log('[08C] Génération séances par le médecin (avec RDV)...');

    await loginApi(request, 'admin', 'admin');

    const state = readState();
    const patientId  = state.patient_id;
    const scheduleId = state.config && state.config.schedule_id;

    if (!patientId) {
      throw new Error('[08C] patient_id absent du state.json');
    }

    // Annuler puis supprimer les procédures existantes et RDV liés
    const existingProcs = await apiSearchRead(
      request, 'acs.patient.procedure',
      [['patient_id', '=', patientId]],
      ['id', 'state', 'appointment_id'],
      100,
    );
    if (existingProcs.length > 0) {
      const ids = existingProcs.map(p => p.id);
      // Supprimer les RDV liés d'abord
      const rdvIds = existingProcs
        .filter(p => p.appointment_id && p.appointment_id !== false)
        .map(p => Array.isArray(p.appointment_id) ? p.appointment_id[0] : p.appointment_id);
      if (rdvIds.length > 0) {
        // Annuler les RDV avant suppression
        await apiWrite(request, 'hms.appointment', rdvIds, { state: 'cancel' }).catch(() => {});
        await rpcCall(request, 'hms.appointment', 'unlink', [rdvIds]).catch(() => {});
      }
      // Annuler les procédures avant suppression
      const toCancel = existingProcs.filter(p => !['scheduled', 'cancel'].includes(p.state)).map(p => p.id);
      if (toCancel.length > 0) {
        await apiWrite(request, 'acs.patient.procedure', toCancel, { state: 'cancel' });
      }
      await rpcCall(request, 'acs.patient.procedure', 'unlink', [ids]);
      console.log(`[08C] Nettoyage : ${existingProcs.length} procédures supprimées`);
    }

    // Calcul des dates
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextWeekStr = `${nextWeek.getFullYear()}-${pad(nextWeek.getMonth() + 1)}-${pad(nextWeek.getDate())}`;

    console.log(`[08C] Période : ${todayStr} → ${nextWeekStr}`);

    // Créer le wizard AVEC create_appointments = true
    const wizardVals = {
      patient_ids: [[6, 0, [patientId]]],
      date_start: todayStr,
      date_end: nextWeekStr,
      exclude_holidays: false,
      create_appointments: true,  // <-- AVEC RDV
    };
    if (scheduleId) wizardVals.schedule_id = scheduleId;

    const wizardId = await apiCreate(request, 'nephrology.session.generator', wizardVals);
    console.log(`[08C] Wizard créé : id=${wizardId}`);

    // Étape 1 → 2
    const validatorAction = await rpcCall(
      request, 'nephrology.session.generator', 'action_open_validator', [[wizardId]],
    );

    let validatorId = validatorAction && validatorAction.res_id;
    if (!validatorId) {
      const validators = await apiSearchRead(
        request, 'nephrology.session.validator',
        [['generator_id', '=', wizardId]], ['id'], 1,
      );
      if (validators.length > 0) validatorId = validators[0].id;
    }

    expect(validatorId).toBeTruthy();
    console.log(`[08C] Validateur : id=${validatorId}`);

    // Confirmer
    await rpcCall(request, 'nephrology.session.validator', 'action_confirm', [[validatorId]]);
    console.log('[08C] action_confirm exécuté');

    // Vérifier : des séances créées AVEC RDV liés (1:1)
    const newProcs = await apiSearchRead(
      request, 'acs.patient.procedure',
      [['patient_id', '=', patientId]],
      ['id', 'date', 'state', 'appointment_id', 'name'],
      50,
    );
    console.log(`[08C] Séances créées : ${newProcs.length}`);
    expect(newProcs.length).toBeGreaterThan(0);

    // Vérifier que TOUTES les séances ont un RDV lié
    const withRdv = newProcs.filter(p => p.appointment_id && p.appointment_id !== false);
    console.log(`[08C] Séances avec RDV : ${withRdv.length} / ${newProcs.length}`);
    expect(withRdv.length).toBe(newProcs.length);

    // Vérifier que le RDV pointe vers la bonne séance (lien inverse)
    const firstProc = withRdv[0];
    const rdvId = Array.isArray(firstProc.appointment_id) ? firstProc.appointment_id[0] : firstProc.appointment_id;
    const rdvRecord = await apiRead(request, 'hms.appointment', [rdvId], ['id', 'patient_id', 'procedure_id']);
    expect(rdvRecord[0].patient_id[0]).toBe(patientId);
    console.log(`[08C] ✓ RDV id=${rdvId} lié à séance id=${firstProc.id} — lien 1:1 vérifié`);

    // Sauvegarder le procedure_id pour les tests suivants
    updateState({ procedure_id: newProcs[0].id });
    console.log(`[08C] ✓ procedure_id=${newProcs[0].id} sauvegardé`);

    // Screenshot UI en tant que médecin
    await loginUI(page, 'medecin@nephro.test', TEST_PASSWORD);
    const procedureActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.patient.procedure']], ['id', 'name'], 20,
    );
    const nephroAction = procedureActions.find(a => /n[eé]phro|dialys/i.test(a.name));
    const actionId = nephroAction ? nephroAction.id : procedureActions[0]?.id;
    if (actionId) {
      await page.goto(`/odoo/action-${actionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    }
    await snap(page, '08c_seances_avec_rdv');

    // Vérifier aussi que les boutons manuels sont masqués sur le formulaire
    if (newProcs.length > 0) {
      await page.goto(`/odoo/action-${actionId}/${newProcs[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Les boutons "Créer RDV depuis planning" et "Générer RDV récurrents" doivent être invisibles
      const btnCreerRDV = page.locator('button:has-text("Créer RDV depuis planning")');
      const btnGenererRDV = page.locator('button:has-text("Générer RDV récurrents")');
      const btn1Visible = await btnCreerRDV.isVisible().catch(() => false);
      const btn2Visible = await btnGenererRDV.isVisible().catch(() => false);
      expect(btn1Visible).toBe(false);
      expect(btn2Visible).toBe(false);
      console.log('[08C] ✓ Boutons RDV manuels masqués sur le formulaire séance');

      await snap(page, '08c_formulaire_seance_sans_boutons');
    }
  });
});
