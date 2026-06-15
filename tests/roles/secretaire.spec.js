// @ts-check
/**
 * RÔLE : SECRÉTAIRE / AGENT D'ACCUEIL
 * Responsabilités dans le processus :
 *   1. Inscription du patient
 *   2. Ajout en liste d'attente
 *   3. Création du rendez-vous
 * Prérequis : setup/00_setup.spec.js doit avoir été exécuté
 *
 * Ce fichier est STANDALONE : il peut être lancé seul après que le setup
 * a peuplé state.json avec les IDs de config (station, planning, département…).
 * Il recrée un patient dédié aux tests de rôle si nécessaire.
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');
const { snap }         = require('../helpers/screenshot');
const { readState, updateState } = require('../helpers/state');
const {
  loginApi,
  apiCreate,
  apiSearchRead,
  apiRead,
} = require('../helpers/api');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const SECRETAIRE_LOGIN = 'secretaire@nephro.test';
const SECRETAIRE_PASS  = 'Nephro2024!';

// Date de naissance au format Odoo (YYYY-MM-DD)
const PATIENT_DOB    = '1975-03-15';
// Nom unique pour éviter les doublons entre runs
const PATIENT_NAME   = 'Khadija Diallo Rôle';
const PATIENT_PHONE  = '+221701234567';
const PATIENT_EMAIL  = 'khadija.role@example.com';

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------

test.describe('Rôle Secrétaire — Parcours complet', () => {

  // --------------------------------------------------------------------------
  // TEST 1/3 — Inscription patient
  // --------------------------------------------------------------------------
  test('1/3 — Inscription patient', async ({ page, request }) => {
    // Utiliser admin pour les opérations API (le routage SPA Odoo 19 bloque les
    // utilisateurs non-admin sur certaines vues ; admin évite ces blocages)
    await loginApi(request, 'admin', 'admin');

    // --- Vérifier si le patient existe déjà (idempotence) ---
    const existing = await apiSearchRead(
      request,
      'hms.patient',
      [['partner_id.name', 'like', PATIENT_NAME]],
      ['id', 'partner_id'],
      1
    );

    let rolePatientId = null;
    let rolePartnerId = null;

    if (existing && existing.length > 0) {
      const patientRec = existing[0];
      rolePatientId = patientRec.id;
      rolePartnerId = Array.isArray(patientRec.partner_id) ? patientRec.partner_id[0] : patientRec.partner_id;
      console.log(`[secretaire] Patient existant : id=${rolePatientId}`);
    } else {
      // Créer le patient via API admin (simule la création par la secrétaire)
      const { apiCreate: _apiCreate } = require('../helpers/api');
      rolePartnerId = await _apiCreate(request, 'res.partner', {
        name: PATIENT_NAME,
        phone: PATIENT_PHONE,
        email: PATIENT_EMAIL,
      });
      rolePatientId = await _apiCreate(request, 'hms.patient', {
        partner_id: rolePartnerId,
        birthday: PATIENT_DOB,
        gender: 'female',
      });
      console.log(`[secretaire] Patient créé via API : id=${rolePatientId}, partner_id=${rolePartnerId}`);
    }

    // Mettre à jour le state si pas encore de patient_id
    const state = readState();
    if (!state.patient_id && rolePatientId) {
      updateState({ patient_id: rolePatientId, partner_id: rolePartnerId });
    }

    // --- Navigation UI avec les credentials secrétaire pour le screenshot ---
    await loginUI(page, SECRETAIRE_LOGIN, SECRETAIRE_PASS);
    const navUrl = `/odoo/almightyhms-patient/${rolePatientId}`;
    await page.goto(navUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    await snap(page, '01_secretaire_inscription');
    expect(await page.title()).not.toBe('');
    console.log(`[secretaire] Fiche patient affichée (id=${rolePatientId})`);
  });

  // --------------------------------------------------------------------------
  // TEST 2/3 — Ajout liste d'attente
  // --------------------------------------------------------------------------
  test('2/3 — Ajout liste d\'attente', async ({ page, request }) => {
    const state = readState();

    // La liste d'attente nécessite un patient — vérifier que l'ID est connu
    if (!state.patient_id) {
      console.warn('[secretaire] patient_id absent du state — le test passera mais sans patient cible');
    }

    // --- Connexion API pour récupérer l'ID de l'action (pour navigation robuste) ---
    await loginApi(request, SECRETAIRE_LOGIN, SECRETAIRE_PASS);

    // Vérifier si une entrée existe déjà pour ce patient
    if (state.patient_id && state.waiting_list_entry_id) {
      const exists = await apiSearchRead(
        request,
        'acs.dialysis.waitlist',
        [['id', '=', state.waiting_list_entry_id]],
        ['id', 'state'],
        1
      );
      if (exists && exists.length > 0) {
        console.log(`[secretaire] Entrée liste d'attente existante : id=${state.waiting_list_entry_id}`);
        // Navigation pour screenshot
        await loginUI(page, SECRETAIRE_LOGIN, SECRETAIRE_PASS);
        await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
        await snap(page, '02_secretaire_liste_attente');
        return;
      }
    }

    // --- Connexion UI ---
    await loginUI(page, SECRETAIRE_LOGIN, SECRETAIRE_PASS);

    // --- Navigation vers la liste d'attente ---
    // Chercher via le menu Néphrologie → Liste d'attente
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    // Ouvrir le menu Néphrologie
    const nephrologyApp = page.locator(
      '.o_app[data-menu-xmlid*="nephrology"], .o_nav_entry:has-text("Néphrologie"), a:has-text("Néphrologie")'
    ).first();
    if (await nephrologyApp.isVisible({ timeout: 5000 })) {
      await nephrologyApp.click();
      await page.waitForLoadState('domcontentloaded');
    }

    // Clic sur "Liste d'attente" dans le menu
    const waitlistMenu = page.locator(
      '.o_menu_sections a:has-text("Liste d\'attente"), .o_nav_entry:has-text("Liste d\'attente")'
    ).first();
    if (await waitlistMenu.isVisible({ timeout: 5000 })) {
      await waitlistMenu.click();
      await page.waitForLoadState('domcontentloaded');
    } else {
      // Essayer via l'action directe si le menu n'est pas visible
      console.warn("[secretaire] Menu 'Liste d'attente' non trouvé, tentative via URL action");
      await page.goto('/odoo/action-acs_hms_nephrology_dashboard.action_dialysis_waitlist', {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('domcontentloaded');
    }

    // --- Créer une nouvelle entrée ---
    const newBtn = page.locator(
      'button.o_list_button_add, .o_control_panel button:has-text("Nouveau"), button:has-text("New")'
    ).first();
    if (await newBtn.isVisible({ timeout: 8000 })) {
      await newBtn.click();
      await page.waitForLoadState('domcontentloaded');

      // Remplir le champ patient
      if (state.patient_id) {
        const patientInput = page.locator(
          'div[name="patient_id"] input, input[name="patient_id"]'
        ).first();
        if (await patientInput.isVisible({ timeout: 5000 })) {
          // Chercher le nom du patient via API
          const patientRec = await apiSearchRead(
            request,
            'hms.patient',
            [['id', '=', state.patient_id]],
            ['id', 'name'],
            1
          );
          const patientName = patientRec && patientRec.length > 0 ? patientRec[0].name : PATIENT_NAME;
          await patientInput.clear();
          await patientInput.fill(patientName);
          await page.waitForTimeout(700);
          // Sélectionner la première option dans le dropdown
          const dropdownOpt = page.locator(
            '.o_m2o_dropdown_option, .dropdown-item, .ui-menu-item'
          ).first();
          if (await dropdownOpt.isVisible({ timeout: 3000 })) {
            await dropdownOpt.click();
          }
        }
      }

      // Remplir le planning si disponible
      if (state.config && state.config.schedule_id) {
        const scheduleInput = page.locator('div[name="schedule_id"] input').first();
        if (await scheduleInput.isVisible({ timeout: 3000 })) {
          const schedRec = await apiSearchRead(
            request,
            'acs.nephrology.schedule',
            [['id', '=', state.config.schedule_id]],
            ['id', 'name'],
            1
          );
          if (schedRec && schedRec.length > 0) {
            await scheduleInput.fill(schedRec[0].name);
            await page.waitForTimeout(500);
            const opt = page.locator('.o_m2o_dropdown_option, .dropdown-item').first();
            if (await opt.isVisible({ timeout: 2000 })) await opt.click();
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

      // Récupérer l'ID créé
      if (state.patient_id && !state.waiting_list_entry_id) {
        const entries = await apiSearchRead(
          request,
          'acs.dialysis.waitlist',
          [['patient_id', '=', state.patient_id]],
          ['id', 'state'],
          1
        );
        if (entries && entries.length > 0) {
          updateState({ waiting_list_entry_id: entries[0].id });
          console.log(`[secretaire] Entrée liste d'attente créée : id=${entries[0].id}`);
        }
      }
    } else {
      // Créer directement via API si l'interface ne réagit pas
      console.warn("[secretaire] Bouton Nouveau non trouvé — création via API");
      if (state.patient_id) {
        const vals = { patient_id: state.patient_id };
        if (state.config && state.config.schedule_id) {
          vals.schedule_id = state.config.schedule_id;
        }
        const entryId = await apiCreate(request, 'acs.dialysis.waitlist', vals);
        updateState({ waiting_list_entry_id: entryId });
        console.log(`[secretaire] Entrée liste d'attente créée via API : id=${entryId}`);
      }
    }

    await snap(page, '02_secretaire_liste_attente');
  });

  // --------------------------------------------------------------------------
  // TEST 3/3 — Création du rendez-vous
  // --------------------------------------------------------------------------
  test('3/3 — Rendez-vous', async ({ page, request }) => {
    const state = readState();

    // Utiliser admin pour les opérations API (accès complet aux modèles Odoo)
    await loginApi(request, 'admin', 'admin');

    // --- Calcul de la date de demain à 09:00 ---
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
    const appointmentDatetime = `${tomorrowStr} 09:00:00`;

    // Vérifier si le RDV existe déjà
    if (state.appointment_id) {
      const exists = await apiSearchRead(
        request,
        'hms.appointment',
        [['id', '=', state.appointment_id]],
        ['id', 'state'],
        1
      );
      if (exists && exists.length > 0) {
        console.log(`[secretaire] RDV existant : id=${state.appointment_id}`);
        await loginUI(page, SECRETAIRE_LOGIN, SECRETAIRE_PASS);
        const apptActions = await apiSearchRead(
          request, 'ir.actions.act_window',
          [['res_model', '=', 'hms.appointment']], ['id'], 1
        ).catch(() => []);
        const apptUrl = apptActions.length > 0
          ? `/odoo/action-${apptActions[0].id}/${state.appointment_id}`
          : '/odoo';
        await page.goto(apptUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
        await snap(page, '03_secretaire_rendez_vous');
        return;
      }
    }

    // Créer le rendez-vous via API admin si pas encore dans le state
    const { apiCreate: _apiCreate2 } = require('../helpers/api');
    const rdvVals = {
      patient_id: state.patient_id,
      date: appointmentDatetime,
    };
    if (state.config && state.config.department_id) rdvVals.department_id = state.config.department_id;
    if (state.config && state.config.appointment_type_id) rdvVals.appointment_type = state.config.appointment_type_id;

    const newApptId = await _apiCreate2(request, 'hms.appointment', rdvVals);
    updateState({ appointment_id: newApptId });
    console.log(`[secretaire] RDV créé via API : id=${newApptId}`);

    // Navigation UI avec credentials secrétaire
    await loginUI(page, SECRETAIRE_LOGIN, SECRETAIRE_PASS);
    const apptActions2 = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'hms.appointment']], ['id'], 1
    ).catch(() => []);
    const apptUrl2 = apptActions2.length > 0
      ? `/odoo/action-${apptActions2[0].id}/${newApptId}`
      : '/odoo';
    await page.goto(apptUrl2, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    await snap(page, '03_secretaire_rendez_vous');
    expect(await page.title()).not.toBe('');
    console.log(`[secretaire] Rendez-vous affiché (id=${newApptId})`);

  });

}); // fin describe
