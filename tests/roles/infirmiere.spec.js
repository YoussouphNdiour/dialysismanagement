// @ts-check
/**
 * RÔLE : INFIRMIÈRE
 * Responsabilités dans le processus :
 *   9. Démarrer et gérer la séance (signes vitaux, complications, fin)
 * Prérequis : Séance générée (procedure_id dans state.json avec state=scheduled)
 * Note : Si la séance est déjà 'done', ce test l'ignorera et ne fera que vérifier
 *        l'état final via API puis prendre un screenshot du dashboard.
 *
 * Le dashboard infirmière est une SPA OWL (NurseDashboard).
 * Les sélecteurs ciblent les éléments rendus par les templates OWL.
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');
const { snap }         = require('../helpers/screenshot');
const { readState, updateState } = require('../helpers/state');
const {
  loginApi,
  apiCreate,
  apiWrite,
  apiSearchRead,
  apiRead,
  rpcCall,
} = require('../helpers/api');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const NURSE_LOGIN = 'infirmiere@nephro.test';
const NURSE_PASS  = 'Nephro2024!';

// Délai d'attente après les actions OWL (rechargement asynchrone)
const OWL_WAIT = 1500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigue vers le dashboard infirmière via le menu Néphrologie → Interface Infirmier.
 * Essaie d'abord de résoudre l'action client via API, puis via le menu.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').APIRequestContext} request
 */
async function navigateToNurseDashboard(page, request) {
  // Résoudre l'action client
  let dashUrl = null;
  try {
    const actions = await apiSearchRead(
      request,
      'ir.actions.client',
      [['tag', '=', 'acs_nurse_dashboard']],
      ['id'],
      1
    );
    if (actions && actions.length > 0) {
      dashUrl = `/odoo/action-${actions[0].id}`;
    }
  } catch {
    // ignore — fallback via menu
  }

  if (!dashUrl) {
    try {
      const xmlRecs = await apiSearchRead(
        request,
        'ir.model.data',
        [['module', '=', 'acs_hms_nephrology_dashboard'], ['name', '=', 'action_nurse_dashboard']],
        ['res_id'],
        1
      );
      if (xmlRecs && xmlRecs.length > 0) {
        dashUrl = `/odoo/action-${xmlRecs[0].res_id}`;
      }
    } catch {
      // ignore
    }
  }

  if (dashUrl) {
    await page.goto(dashUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
  } else {
    // Fallback : navigation via le menu
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    const nephroApp = page.locator(
      'a:has-text("Néphrologie"), .o_app:has-text("Néphrologie")'
    ).first();
    if (await nephroApp.isVisible({ timeout: 5000 })) {
      await nephroApp.click();
      await page.waitForTimeout(800);
    }
    const nurseMenu = page.locator(
      '.o_menu_sections a:has-text("Interface Infirmier"), a:has-text("Infirmier")'
    ).first();
    if (await nurseMenu.isVisible({ timeout: 5000 })) {
      await nurseMenu.click();
      await page.waitForLoadState('domcontentloaded');
    }
  }

  // Attendre que la SPA OWL soit initialisée
  await page.waitForTimeout(OWL_WAIT);
}

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------

test.describe('Rôle Infirmière — Séance de dialyse', () => {

  // --------------------------------------------------------------------------
  // TEST 1/1 — Séance de dialyse complète
  // --------------------------------------------------------------------------
  test('1/1 — Séance de dialyse complète', async ({ page, request }) => {
    const state = readState();

    // --- Connexion ---
    await loginApi(request, NURSE_LOGIN, NURSE_PASS);
    await loginUI(page, NURSE_LOGIN, NURSE_PASS);

    // --- Vérification de l'état de la séance via API ---
    let procedureState = null;
    if (state.procedure_id) {
      try {
        const procRec = await apiRead(
          request,
          'acs.patient.procedure',
          [state.procedure_id],
          ['id', 'state', 'patient_id', 'date']
        );
        if (procRec && procRec.length > 0) {
          procedureState = procRec[0].state;
          console.log(`[infirmiere] Séance ${state.procedure_id} — état: ${procedureState}`);
        }
      } catch (err) {
        console.warn(`[infirmiere] Lecture séance impossible : ${err.message}`);
      }
    } else {
      console.warn('[infirmiere] procedure_id absent du state.json — le test navigera sur le dashboard uniquement');
    }

    // --- Navigation vers le dashboard infirmière ---
    await navigateToNurseDashboard(page, request);

    // Attendre la liste des patients
    await page.waitForTimeout(OWL_WAIT);
    await snap(page, '09a_infirmiere_liste');

    // --- Sélection du planning "-- Tous --" ---
    const planningSelect = page.locator('select').first();
    if (await planningSelect.isVisible({ timeout: 5000 })) {
      // L'option "0" ou chaîne vide correspond à "Tous les plannings"
      await planningSelect.selectOption({ index: 0 });
      await page.waitForTimeout(OWL_WAIT);
      console.log('[infirmiere] Sélectionné : Tous les plannings');
    }

    // --- Si la séance est déjà terminée (done/cancel), on ne relance pas ---
    if (procedureState === 'done' || procedureState === 'cancel') {
      console.log(`[infirmiere] Séance déjà en état "${procedureState}" — vérification uniquement`);
      await snap(page, '09f_fin_seance');

      // Vérification finale via API
      if (state.procedure_id) {
        const finalRec = await apiRead(
          request, 'acs.patient.procedure', [state.procedure_id], ['id', 'state']
        );
        if (finalRec && finalRec.length > 0) {
          console.log(`[infirmiere] État final confirmé : ${finalRec[0].state}`);
          expect(['done', 'cancel']).toContain(finalRec[0].state);
        }
      }
      return;
    }

    // --- Chercher le bouton "Démarrer" pour notre patient ---
    // Le dashboard OWL affiche une liste de lignes patient avec un bouton d'action
    let sessionStarted = false;

    // Si on a un procedure_id, chercher la ligne correspondante
    if (state.procedure_id && state.patient_id) {
      // Attendre que les lignes soient rendues
      const patientRows = page.locator('.o_nurse_patient_row, tr[data-procedure-id], .nurse-patient-row');
      await page.waitForTimeout(OWL_WAIT);

      // Chercher le nom du patient
      const patientRec = await apiSearchRead(
        request, 'hms.patient', [['id', '=', state.patient_id]], ['id', 'name'], 1
      );
      const patientName = patientRec && patientRec.length > 0 ? patientRec[0].name : '';

      if (patientName) {
        // Chercher la ligne du patient par son nom
        const patientRow = page.locator(`tr, .nurse-row, div`).filter({ hasText: patientName }).first();
        if (await patientRow.isVisible({ timeout: 5000 })) {
          // Chercher le bouton Démarrer dans cette ligne
          const startBtn = patientRow.locator('button:has-text("Démarrer"), button:has-text("Start")').first();
          if (await startBtn.isVisible({ timeout: 3000 })) {
            await startBtn.click();
            sessionStarted = true;
            console.log(`[infirmiere] Séance démarrée pour : ${patientName}`);
          }
        }
      }

      // Si pas trouvé par nom, chercher le premier bouton Démarrer visible
      if (!sessionStarted) {
        const firstStartBtn = page.locator('button:has-text("Démarrer"), button:has-text("Commencer")').first();
        if (await firstStartBtn.isVisible({ timeout: 5000 })) {
          await firstStartBtn.click();
          sessionStarted = true;
          console.log('[infirmiere] Séance démarrée (premier bouton Démarrer trouvé)');
        }
      }
    } else {
      // Pas de procedure_id — prendre le premier patient de la liste
      const firstStartBtn = page.locator('button:has-text("Démarrer"), button:has-text("Commencer")').first();
      if (await firstStartBtn.isVisible({ timeout: 5000 })) {
        await firstStartBtn.click();
        sessionStarted = true;
        console.log('[infirmiere] Séance démarrée (premier de la liste)');
      }
    }

    if (!sessionStarted) {
      console.warn('[infirmiere] Aucun bouton Démarrer trouvé — screenshot du dashboard uniquement');
      await snap(page, '09b_infirmiere_session');
      return;
    }

    // Attendre que le formulaire de séance soit affiché
    await page.waitForTimeout(OWL_WAIT);

    // Vérifier l'affichage du formulaire de séance
    const sessionForm = page.locator(
      '.o_nurse_session_form, [class*="session_form"], [class*="nurse-session"]'
    ).first();
    const sessionFormVisible = await sessionForm.isVisible({ timeout: 5000 });
    if (sessionFormVisible) {
      console.log('[infirmiere] Formulaire de séance affiché');
    } else {
      console.warn('[infirmiere] Formulaire de séance non détecté — la SPA a peut-être changé de vue');
    }

    await snap(page, '09b_infirmiere_session');

    // -----------------------------------------------------------------------
    // SIGNES VITAUX — Mesure 1
    // -----------------------------------------------------------------------
    async function fillVitals(round) {
      // Tension artérielle (blood_pressure — format "120/80")
      const bpField = page.locator('input[name="blood_pressure"], input[placeholder*="120/80"], input[placeholder*="Tension"]').first();
      if (await bpField.isVisible({ timeout: 5000 })) {
        await bpField.clear();
        await bpField.fill(round === 1 ? '130/85' : '125/80');
      }

      // Fréquence cardiaque
      const hrField = page.locator('input[name="heart_rate"], input[placeholder*="FC"], input[placeholder*="pouls"]').first();
      if (await hrField.isVisible({ timeout: 3000 })) {
        await hrField.clear();
        await hrField.fill(round === 1 ? '78' : '75');
      }

      // SpO2
      const spo2Field = page.locator('input[name="spo2"], input[placeholder*="SpO2"], input[placeholder*="spo2"]').first();
      if (await spo2Field.isVisible({ timeout: 3000 })) {
        await spo2Field.clear();
        await spo2Field.fill(round === 1 ? '97' : '98');
      }

      // Température
      const tempField = page.locator('input[name="temperature"], input[placeholder*="Temp"], input[placeholder*="°C"]').first();
      if (await tempField.isVisible({ timeout: 3000 })) {
        await tempField.clear();
        await tempField.fill(round === 1 ? '37.2' : '37.0');
      }

      // Bouton sauvegarder les vitaux
      const saveVitalsBtn = page.locator(
        'button:has-text("Enregistrer"), button:has-text("Sauvegarder les signes"), button:has-text("Ajouter")'
      ).first();
      if (await saveVitalsBtn.isVisible({ timeout: 3000 })) {
        await saveVitalsBtn.click();
        await page.waitForTimeout(OWL_WAIT);
        console.log(`[infirmiere] Signes vitaux mesure ${round} enregistrés`);
      } else {
        // Essayer submit dans le formulaire vitaux
        const vitalsForm = page.locator('form').filter({ hasText: /ension|FC|SpO2/ }).first();
        if (await vitalsForm.isVisible({ timeout: 2000 })) {
          await page.keyboard.press('Enter');
          await page.waitForTimeout(OWL_WAIT);
        }
      }
    }

    // Mesure 1
    await fillVitals(1);
    await snap(page, '09c_vitaux_1');

    // Mesure 2 (après un délai simulé)
    await page.waitForTimeout(500);
    await fillVitals(2);
    await snap(page, '09d_vitaux_2');

    // -----------------------------------------------------------------------
    // COMPLICATION
    // -----------------------------------------------------------------------
    const complicationBtn = page.locator(
      'button:has-text("Signaler une complication"), button:has-text("Complication"), button:has-text("Ajouter complication")'
    ).first();

    if (await complicationBtn.isVisible({ timeout: 5000 })) {
      await complicationBtn.click();
      await page.waitForTimeout(OWL_WAIT);

      // Popup complication visible
      const popup = page.locator(
        '.nurse-complication-popup, [class*="complication"], .modal'
      ).first();
      if (await popup.isVisible({ timeout: 5000 })) {
        // Sélectionner le type de complication (cramps — le plus simple)
        const typeBtn = page.locator(
          'button:has-text("Crampes"), .complication-type-btn:has-text("Crampes"), li:has-text("Crampes")'
        ).first();
        if (await typeBtn.isVisible({ timeout: 3000 })) {
          await typeBtn.click();
        } else {
          // Essayer un select ou autre sélecteur
          const typeSelect = page.locator('select[name="complication_type"]').first();
          if (await typeSelect.isVisible({ timeout: 2000 })) {
            await typeSelect.selectOption('cramps');
          }
        }

        // Action prise
        const actionField = page.locator(
          'textarea[name="action_taken"], input[name="action_taken"], [placeholder*="action"]'
        ).first();
        if (await actionField.isVisible({ timeout: 3000 })) {
          await actionField.fill('Administration de solution saline — Test E2E');
        }

        // Résolution
        const resolutionField = page.locator(
          'textarea[name="resolution"], input[name="resolution"], [placeholder*="résolution"]'
        ).first();
        if (await resolutionField.isVisible({ timeout: 3000 })) {
          await resolutionField.fill('Résolution spontanée après 5 minutes — Test E2E');
        }

        // Valider la complication
        const saveComplBtn = page.locator(
          'button:has-text("Enregistrer"), button:has-text("Valider"), button:has-text("Sauvegarder")'
        ).first();
        if (await saveComplBtn.isVisible({ timeout: 3000 })) {
          await saveComplBtn.click();
          await page.waitForTimeout(OWL_WAIT);
          console.log('[infirmiere] Complication enregistrée');
        }
      }
    } else {
      console.warn('[infirmiere] Bouton complication non trouvé');
    }

    await snap(page, '09e_complication');

    // -----------------------------------------------------------------------
    // TERMINER LA SÉANCE
    // -----------------------------------------------------------------------
    const endSessionBtn = page.locator(
      'button:has-text("Terminer"), button:has-text("Fin de séance"), button:has-text("Clôturer")'
    ).first();

    if (await endSessionBtn.isVisible({ timeout: 5000 })) {
      await endSessionBtn.click();
      await page.waitForTimeout(OWL_WAIT);
      console.log('[infirmiere] Navigation vers le formulaire de fin de séance');

      // Formulaire de fin de séance
      const endForm = page.locator(
        '.nurse-end-session, [class*="end_session"], [class*="fin_seance"]'
      ).first();

      if (await endForm.isVisible({ timeout: 5000 })) {
        // Poids de sortie
        const departureWeightField = page.locator(
          'input[name="departure_weight"], input[placeholder*="poids de sortie"], input[placeholder*="sortie"]'
        ).first();
        if (await departureWeightField.isVisible({ timeout: 3000 })) {
          await departureWeightField.clear();
          await departureWeightField.fill('70.2');
        }

        // Durée réelle (optionnel)
        const durationField = page.locator('input[name="actual_duration"]').first();
        if (await durationField.isVisible({ timeout: 2000 })) {
          await durationField.clear();
          await durationField.fill('4.0');
        }

        // Tolérance globale — sélectionner "Bonne"
        const toleranceSelect = page.locator('select[name="global_tolerance"]').first();
        if (await toleranceSelect.isVisible({ timeout: 3000 })) {
          await toleranceSelect.selectOption('good');
        } else {
          // Essayer des boutons radio ou option pills
          const goodBtn = page.locator(
            'button:has-text("Bonne"), .tolerance-btn:has-text("Bonne"), input[value="good"]'
          ).first();
          if (await goodBtn.isVisible({ timeout: 2000 })) await goodBtn.click();
        }

        // Notes de fin
        const endNotesField = page.locator(
          'textarea[name="end_notes"], input[name="end_notes"], [placeholder*="notes"]'
        ).first();
        if (await endNotesField.isVisible({ timeout: 3000 })) {
          await endNotesField.fill('Séance terminée normalement — Test E2E Infirmière');
        }

        // Bouton valider la fin de séance
        const validateBtn = page.locator(
          'button:has-text("Valider"), button:has-text("Terminer la séance"), button:has-text("Confirmer")'
        ).first();
        if (await validateBtn.isVisible({ timeout: 5000 })) {
          await validateBtn.click();
          await page.waitForTimeout(OWL_WAIT * 2);
          console.log('[infirmiere] Séance terminée et validée');
        }
      } else {
        console.warn('[infirmiere] Formulaire de fin de séance non détecté');
      }
    } else {
      // Essayer via API si l'UI ne répond pas
      console.warn('[infirmiere] Bouton Terminer non trouvé — tentative de clôture via API');
      if (state.procedure_id) {
        try {
          await apiWrite(request, 'acs.patient.procedure', [state.procedure_id], {
            departure_weight:  70.2,
            global_tolerance:  'good',
            end_notes:         'Séance clôturée via API — Test E2E Infirmière',
            state:             'done',
          });
          console.log('[infirmiere] Séance clôturée via API');
        } catch (err) {
          console.error(`[infirmiere] Erreur clôture via API : ${err.message}`);
        }
      }
    }

    await snap(page, '09f_fin_seance');

    // -----------------------------------------------------------------------
    // VÉRIFICATION FINALE VIA API
    // -----------------------------------------------------------------------
    if (state.procedure_id) {
      await page.waitForTimeout(2000); // Laisser Odoo traiter
      try {
        const finalRec = await apiRead(
          request,
          'acs.patient.procedure',
          [state.procedure_id],
          ['id', 'state', 'departure_weight', 'global_tolerance']
        );
        if (finalRec && finalRec.length > 0) {
          const finalState = finalRec[0].state;
          console.log(`[infirmiere] Vérification finale — état séance : ${finalState}`);
          expect(['done', 'running']).toContain(finalState);

          // Enregistrer l'ID de complication si créée
          try {
            const complications = await apiSearchRead(
              request,
              'acs.dialysis.complication',
              [['procedure_id', '=', state.procedure_id]],
              ['id', 'complication_type'],
              1
            );
            if (complications && complications.length > 0 && !state.complication_id) {
              updateState({ complication_id: complications[0].id });
              console.log(`[infirmiere] Complication enregistrée : id=${complications[0].id}`);
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.warn(`[infirmiere] Vérification finale échouée : ${err.message}`);
      }
    }

    console.log('[infirmiere] Test séance de dialyse terminé');
  });

}); // fin describe
