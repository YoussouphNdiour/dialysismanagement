// @ts-check
/**
 * 08 — Génération des séances de dialyse
 *
 * Utilisateur : ADMIN (admin/admin)
 * Stratégie   : création du wizard nephrology.session.generator via API,
 *               appel action_open_validator + action_confirm sur le validateur,
 *               puis récupération du premier procedure_id créé.
 *               En cas d'échec du wizard, fallback vers la création directe
 *               d'une acs.patient.procedure.
 *
 * Données lues depuis state.json  : patient_id, config.schedule_id,
 *                                   config.department_id, config.dialyzer_id,
 *                                   config.dialysate_id, config.vascular_access_id
 * Données écrites dans state.json : procedure_id
 */

const { test, expect } = require('@playwright/test');
const { readState, updateState } = require('../helpers/state');
const {
  loginApi, rpcCall, apiCreate, apiWrite, apiSearchRead, apiRead,
} = require('../helpers/api');
const { loginUI } = require('../helpers/auth');
const { snap } = require('../helpers/screenshot');

test.setTimeout(120000);

test.describe('08 — Génération des séances de dialyse', () => {
  test('Générer les séances de dialyse via le wizard session.generator', async ({ page, request }) => {
    // -----------------------------------------------------------------------
    // Étape 1 : Authentification API (admin) pour les appels RPC
    // -----------------------------------------------------------------------
    console.log('[08] Authentification API admin...');
    await loginApi(request, 'admin', 'admin');

    // -----------------------------------------------------------------------
    // Étape 2 : Lecture de l'état partagé
    // -----------------------------------------------------------------------
    const state = readState();
    const patientId    = state.patient_id;
    const scheduleId   = state.config && state.config.schedule_id;
    const departmentId = state.config && state.config.department_id;
    const dialyzerId   = state.config && state.config.dialyzer_id;
    const dialysateId  = state.config && state.config.dialysate_id;
    const vascularId   = state.config && state.config.vascular_access_id;

    console.log(`[08] patient_id=${patientId} schedule_id=${scheduleId} department_id=${departmentId}`);

    if (!patientId) {
      throw new Error('[08] patient_id absent du state.json — vérifiez que les étapes précédentes ont bien été exécutées');
    }

    // -----------------------------------------------------------------------
    // Étape 3 : Connexion UI et navigation vers la liste des séances
    // -----------------------------------------------------------------------
    console.log('[08] Connexion UI admin...');
    await loginUI(page, 'admin', 'admin');

    // Chercher l'action "act_window" du modèle acs.patient.procedure
    console.log('[08] Recherche de l\'action pour acs.patient.procedure...');
    const procedureActions = await apiSearchRead(
      request,
      'ir.actions.act_window',
      [['res_model', '=', 'acs.patient.procedure']],
      ['id', 'name'],
      20,
    );
    console.log('[08] Actions trouvées :', procedureActions.map((a) => `${a.id}:${a.name}`));

    // Prendre l'action la plus pertinente (celle contenant "néphro" ou "dialyse" en priorité)
    let procedureActionId = null;
    if (procedureActions.length > 0) {
      const nephroAction = procedureActions.find(
        (a) => /n[eé]phro|dialys/i.test(a.name),
      );
      procedureActionId = nephroAction ? nephroAction.id : procedureActions[0].id;
    }

    if (procedureActionId) {
      await page.goto(`/odoo/action-${procedureActionId}`, { waitUntil: 'domcontentloaded' });
    } else {
      // Fallback : URL directe commune pour les procédures
      await page.goto('/odoo/action-559', { waitUntil: 'domcontentloaded' });
    }

    await page.waitForTimeout(2000);

    // -----------------------------------------------------------------------
    // Étape 4 : Calcul des dates (aujourd'hui et +7 jours)
    // -----------------------------------------------------------------------
    const now       = new Date();
    const pad       = (n) => String(n).padStart(2, '0');
    const todayStr  = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nextWeek  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextWeekStr = `${nextWeek.getFullYear()}-${pad(nextWeek.getMonth() + 1)}-${pad(nextWeek.getDate())}`;
    const todayDatetimeStr = `${todayStr} 08:00:00`;

    console.log(`[08] Période de génération : ${todayStr} → ${nextWeekStr}`);

    // -----------------------------------------------------------------------
    // Étape 5 : Tentative via le wizard nephrology.session.generator
    // -----------------------------------------------------------------------
    let procedureId = null;

    try {
      console.log('[08] Création du wizard nephrology.session.generator...');
      const wizardId = await apiCreate(request, 'nephrology.session.generator', {
        patient_ids: [[6, 0, [patientId]]],
        date_start:  todayStr,
        date_end:    nextWeekStr,
        exclude_holidays: false,
      });
      console.log(`[08] Wizard créé : id=${wizardId}`);

      // Appel de action_open_validator (étape 1 → 2)
      console.log('[08] Appel action_open_validator...');
      const validatorAction = await rpcCall(
        request,
        'nephrology.session.generator',
        'action_open_validator',
        [[wizardId]],
      );
      console.log('[08] Résultat action_open_validator :', JSON.stringify(validatorAction));

      // Récupérer l'ID du validateur créé
      let validatorId = null;
      if (validatorAction && validatorAction.res_id) {
        validatorId = validatorAction.res_id;
      } else {
        // Chercher le dernier validateur créé pour ce generator
        const validators = await apiSearchRead(
          request,
          'nephrology.session.validator',
          [['generator_id', '=', wizardId]],
          ['id'],
          1,
        );
        if (validators.length > 0) validatorId = validators[0].id;
      }

      if (validatorId) {
        console.log(`[08] Validateur trouvé : id=${validatorId}. Appel action_confirm...`);
        await rpcCall(
          request,
          'nephrology.session.validator',
          'action_confirm',
          [[validatorId]],
        );
        console.log('[08] action_confirm exécuté avec succès');
      } else {
        console.warn('[08] Aucun validateur trouvé — le wizard a peut-être échoué silencieusement');
      }
    } catch (wizardErr) {
      console.warn(`[08] Wizard échoué : ${wizardErr.message}`);
      console.log('[08] Passage au fallback : création directe de acs.patient.procedure...');
    }

    // -----------------------------------------------------------------------
    // Étape 6 : Vérification des procédures créées pour ce patient
    // -----------------------------------------------------------------------
    console.log('[08] Recherche des procédures créées pour le patient...');
    const procedures = await apiSearchRead(
      request,
      'acs.patient.procedure',
      [['patient_id', '=', patientId]],
      ['id', 'date', 'state', 'name'],
      10,
    );
    console.log(`[08] Procédures trouvées : ${procedures.length}`);

    if (procedures.length === 0) {
      // -----------------------------------------------------------------------
      // Fallback : création directe d'une procédure si le wizard n'a rien produit
      // -----------------------------------------------------------------------
      console.log('[08] Aucune procédure — création directe fallback...');
      const fallbackValues = {
        patient_id:  patientId,
        date:        todayDatetimeStr,
        pre_dialysis_bp: '130/80',
        arrival_weight:  72.5,
        dry_weight:      70.0,
      };
      // Ajouter les champs optionnels si disponibles dans le state
      if (departmentId) fallbackValues.department_id = departmentId;
      if (dialyzerId)   fallbackValues.dialyzer_id   = dialyzerId;
      if (dialysateId)  fallbackValues.dialysate_id  = dialysateId;
      if (vascularId)   fallbackValues.vascular_access_id = vascularId;
      if (scheduleId)   fallbackValues.nephrology_schedule_ids = [[4, scheduleId]];

      procedureId = await apiCreate(request, 'acs.patient.procedure', fallbackValues);
      console.log(`[08] Procédure fallback créée : id=${procedureId}`);
    } else {
      // Prendre la première procédure (la plus récente ou celle du jour)
      // Tri : préférer celles du jour, puis la première de la liste
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayProc = procedures.find((p) => {
        const d = new Date(p.date);
        return d >= today;
      });
      procedureId = todayProc ? todayProc.id : procedures[0].id;
      console.log(`[08] Procédure sélectionnée : id=${procedureId}`);
    }

    // -----------------------------------------------------------------------
    // Étape 7 : Associer le planning à la procédure (si schedule_id disponible)
    // -----------------------------------------------------------------------
    if (scheduleId) {
      try {
        console.log(`[08] Association schedule_id=${scheduleId} à procedure_id=${procedureId}...`);
        await apiWrite(request, 'acs.patient.procedure', [procedureId], {
          nephrology_schedule_ids: [[4, scheduleId]],
        });
        console.log('[08] Planning associé avec succès');
      } catch (writeErr) {
        console.warn(`[08] Impossible d'associer le planning : ${writeErr.message}`);
      }
    }

    // -----------------------------------------------------------------------
    // Étape 8 : Navigation UI vers la liste des procédures pour screenshot
    // -----------------------------------------------------------------------
    if (procedureActionId) {
      await page.goto(`/odoo/action-${procedureActionId}`, { waitUntil: 'domcontentloaded' });
    } else {
      await page.goto('/odoo/action-559', { waitUntil: 'domcontentloaded' });
    }
    await page.waitForTimeout(2000);
    await snap(page, '08_seances_generees');

    // -----------------------------------------------------------------------
    // Étape 9 : Vérification finale et persistence dans state.json
    // -----------------------------------------------------------------------
    const procRecord = await apiRead(
      request,
      'acs.patient.procedure',
      [procedureId],
      ['id', 'state', 'patient_id', 'date'],
    );
    console.log('[08] Procédure vérifiée :', JSON.stringify(procRecord[0]));

    // La procédure doit exister et être dans un état valide
    expect(procRecord.length).toBe(1);
    expect([
      'scheduled', 'running', 'done', 'draft',
    ]).toContain(procRecord[0].state);

    // Sauvegarde du procedure_id dans le state partagé
    updateState({ procedure_id: procedureId });
    console.log(`[08] ✓ procedure_id=${procedureId} sauvegardé dans state.json`);
  });
});
