// @ts-check
/**
 * 06 — Création ordonnance médicamenteuse néphro
 *
 * Stratégie : création via API (plus fiable que le formulaire avec dropdowns complexes),
 * puis navigation UI vers l'ordonnance pour la capture d'écran.
 *
 * Modèle : prescription.order
 * Champs requis : patient_id, prescription_date
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { readState, updateState } = require('../helpers/state');
const { loginApi, apiSearchRead, apiCreate, apiRead } = require('../helpers/api');
const { loginUI } = require('../helpers/auth');
const { snap } = require('../helpers/screenshot');

const DOCTOR_LOGIN    = 'medecin@nephro.test';
const DOCTOR_PASSWORD = 'Nephro2024!';

test.describe('06 — Création ordonnance médicamenteuse', () => {
  test('06 — Création d\'une ordonnance néphro pour Khadija Diallo E2E', async ({ page, request }) => {
    test.setTimeout(120000);

    try {
      // -----------------------------------------------------------------------
      // 1. Authentification API admin
      // -----------------------------------------------------------------------
      console.log('[06] Authentification API admin...');
      await loginApi(request, 'admin', 'admin');

      // -----------------------------------------------------------------------
      // 2. Lecture du state
      // -----------------------------------------------------------------------
      const state = readState();
      const patient_id = state.patient_id;
      expect(patient_id, 'patient_id doit être défini (exécuter 01 d\'abord)').not.toBeNull();
      console.log('[06] patient_id :', patient_id);

      // -----------------------------------------------------------------------
      // 3. Vérifier si une ordonnance néphro existe déjà pour ce patient
      // -----------------------------------------------------------------------
      let prescription_id = null;

      const existing = await apiSearchRead(
        request, 'prescription.order',
        [['patient_id', '=', patient_id], ['is_nephro_prescription', '=', true]],
        ['id', 'prescription_date'], 1
      ).catch(() => []);

      if (existing.length > 0) {
        prescription_id = existing[0].id;
        console.log('[06] Ordonnance néphro existante : id=' + prescription_id);
      } else {
        // -----------------------------------------------------------------------
        // 4. Créer l'ordonnance via API
        // -----------------------------------------------------------------------
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const todayDatetime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} 08:00:00`;

        // Trouver le médecin
        const physicians = await apiSearchRead(request, 'hms.physician', [], ['id', 'name'], 1).catch(() => []);
        const physicianId = physicians.length > 0 ? physicians[0].id : null;

        const createValues = {
          patient_id:            patient_id,
          prescription_date:     todayDatetime,
          is_nephro_prescription: true,
          nephro_context:        'background',
        };
        if (physicianId) createValues.physician_id = physicianId;

        prescription_id = await apiCreate(request, 'prescription.order', createValues);
        console.log('[06] Ordonnance créée via API : id=' + prescription_id);
      }

      // -----------------------------------------------------------------------
      // 5. Connexion UI et navigation vers l'ordonnance
      // -----------------------------------------------------------------------
      console.log('[06] Connexion UI (admin pour navigation SPA)...');
      await loginUI(page, 'admin', 'admin');

      // Trouver l'action pour prescription.order
      const prescActions = await apiSearchRead(
        request, 'ir.actions.act_window',
        [['res_model', '=', 'prescription.order'], ['name', '=', 'Prescription Order']],
        ['id', 'name'], 1
      ).catch(() => []);
      const actionId = prescActions.length > 0 ? prescActions[0].id : 532;

      const prescUrl = `/odoo/action-${actionId}/${prescription_id}`;
      console.log('[06] Navigation vers :', prescUrl);
      await page.goto(prescUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // -----------------------------------------------------------------------
      // 6. Capture d'écran
      // -----------------------------------------------------------------------
      await snap(page, '06_ordonnance');

      // -----------------------------------------------------------------------
      // 7. Vérification via API
      // -----------------------------------------------------------------------
      const precRecord = await apiRead(
        request, 'prescription.order', [prescription_id],
        ['id', 'patient_id', 'is_nephro_prescription']
      );
      console.log('[06] Ordonnance vérifiée :', JSON.stringify(precRecord[0]));
      expect(precRecord.length).toBe(1);

      // -----------------------------------------------------------------------
      // 8. Mise à jour du state
      // -----------------------------------------------------------------------
      updateState({ prescription_id });
      console.log('[06] State mis à jour — prescription_id:', prescription_id);

      expect(prescription_id, 'prescription_id doit être non nul').not.toBeNull();
      console.log('[06] Test terminé avec succès');

    } catch (err) {
      console.error('[06] ERREUR :', err.message);
      await snap(page, 'error_06_ordonnance').catch(() => {});
      test.info().annotations.push({ type: 'error', description: err.message });
      throw err;
    }
  });
});
