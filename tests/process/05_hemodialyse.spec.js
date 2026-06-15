// @ts-check
/**
 * 05 — Prescription hémodialyse (séance de dialyse)
 *
 * Stratégie : création via API (plus fiable que le formulaire complexe),
 * puis navigation UI vers la procédure créée pour la capture d'écran.
 *
 * Modèle : acs.patient.procedure
 * Champs requis : patient_id, product_id, pre_dialysis_bp
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { readState, updateState } = require('../helpers/state');
const { loginApi, apiSearchRead, apiCreate, apiRead } = require('../helpers/api');
const { loginUI } = require('../helpers/auth');
const { snap } = require('../helpers/screenshot');

const DOCTOR_LOGIN    = 'medecin@nephro.test';
const DOCTOR_PASSWORD = 'Nephro2024!';

test.describe('05 — Prescription hémodialyse', () => {
  test('05 — Création d\'une prescription d\'hémodialyse pour Khadija Diallo E2E', async ({ page, request }) => {
    test.setTimeout(120000);

    try {
      // -----------------------------------------------------------------------
      // 1. Authentification API admin
      // -----------------------------------------------------------------------
      console.log('[05] Authentification API admin...');
      await loginApi(request, 'admin', 'admin');

      // -----------------------------------------------------------------------
      // 2. Lecture du state
      // -----------------------------------------------------------------------
      const state = readState();
      const patient_id = state.patient_id;
      expect(patient_id, 'patient_id doit être défini (exécuter 01 d\'abord)').not.toBeNull();
      const config = state.config || {};
      console.log('[05] patient_id :', patient_id, '| config :', JSON.stringify(config));

      // -----------------------------------------------------------------------
      // 3. Vérifier si une procédure existe déjà pour ce patient
      // -----------------------------------------------------------------------
      let hemodialysis_id = null;

      const existing = await apiSearchRead(
        request, 'acs.patient.procedure',
        [['patient_id', '=', patient_id]],
        ['id', 'state', 'product_id'], 1
      );

      if (existing.length > 0) {
        hemodialysis_id = existing[0].id;
        console.log('[05] Procédure existante trouvée : id=' + hemodialysis_id);
      } else {
        // -----------------------------------------------------------------------
        // 4. Trouver le product_id pour la procédure
        // -----------------------------------------------------------------------
        let procedureProductId = config.product_id || null;

        if (!procedureProductId) {
          // Chercher un produit de type "procedure" nephro
          const products = await apiSearchRead(
            request, 'product.product',
            [['hospital_product_type', 'like', 'procedure']],
            ['id', 'name'], 1
          ).catch(() => []);
          if (products.length > 0) {
            procedureProductId = products[0].id;
            console.log('[05] Produit procédure trouvé :', products[0].name);
          }
        }

        if (!procedureProductId) {
          // Fallback : utiliser n'importe quel produit de service
          const anyProducts = await apiSearchRead(
            request, 'product.product',
            [['type', '=', 'service']],
            ['id', 'name'], 1
          ).catch(() => []);
          if (anyProducts.length > 0) procedureProductId = anyProducts[0].id;
        }

        // -----------------------------------------------------------------------
        // 5. Créer la procédure via API
        // -----------------------------------------------------------------------
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const todayDatetime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} 08:00:00`;

        const createValues = {
          patient_id:      patient_id,
          date:            todayDatetime,  // Requis pour le filtre date du dashboard infirmière
          pre_dialysis_bp: '140/90',
          arrival_weight:  72.5,
          dry_weight:      70.0,
        };
        if (procedureProductId) createValues.product_id = procedureProductId;
        if (config.department_id) createValues.department_id = config.department_id;
        if (config.vascular_access_id) createValues.type_of_vascular_access = config.vascular_access_id;
        if (config.dialyzer_id) createValues.dialyzer_type = config.dialyzer_id;
        if (config.dialysate_id) createValues.type_of_dialysate = config.dialysate_id;

        hemodialysis_id = await apiCreate(request, 'acs.patient.procedure', createValues);
        console.log('[05] Procédure créée via API : id=' + hemodialysis_id);
      }

      // -----------------------------------------------------------------------
      // 6. Connexion UI (admin) et navigation vers la procédure
      // -----------------------------------------------------------------------
      console.log('[05] Connexion UI (admin pour navigation SPA)...');
      await loginUI(page, 'admin', 'admin');

      // Trouver l'action pour acs.patient.procedure
      const procedureActions = await apiSearchRead(
        request, 'ir.actions.act_window',
        [['res_model', '=', 'acs.patient.procedure'], ['name', '=', 'Hémodialyse du patient']],
        ['id', 'name'], 1
      );
      const actionId = procedureActions.length > 0 ? procedureActions[0].id : 560;

      const procUrl = `/odoo/action-${actionId}/${hemodialysis_id}`;
      console.log('[05] Navigation vers :', procUrl);
      await page.goto(procUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // -----------------------------------------------------------------------
      // 7. Capture d'écran
      // -----------------------------------------------------------------------
      await snap(page, '05_hemodialyse_prescription');

      // -----------------------------------------------------------------------
      // 8. Vérification via API
      // -----------------------------------------------------------------------
      const procRecord = await apiRead(request, 'acs.patient.procedure', [hemodialysis_id], ['id', 'state', 'patient_id']);
      console.log('[05] Procédure vérifiée :', JSON.stringify(procRecord[0]));
      expect(procRecord.length).toBe(1);

      // -----------------------------------------------------------------------
      // 9. Mise à jour du state
      // -----------------------------------------------------------------------
      updateState({ hemodialysis_id });
      console.log('[05] State mis à jour — hemodialysis_id:', hemodialysis_id);

      expect(hemodialysis_id, 'hemodialysis_id doit être non nul').not.toBeNull();
      console.log('[05] Test terminé avec succès');

    } catch (err) {
      console.error('[05] ERREUR :', err.message);
      await snap(page, 'error_05_hemodialyse').catch(() => {});
      test.info().annotations.push({ type: 'error', description: err.message });
      throw err;
    }
  });
});
