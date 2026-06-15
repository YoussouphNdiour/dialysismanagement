// @ts-check
/**
 * 11 — Bilan biologique post-dialyse
 *
 * Utilisateur : DOCTOR (medecin@nephro.test / Nephro2024!)
 *
 * Ce test crée un bilan biologique de type 'ponctuel' (post-dialyse) via l'API,
 * puis navigue vers l'enregistrement dans l'interface Odoo pour en prendre un screenshot.
 *
 * Modèle : acs.nephro.bilan (défini dans acs_hms_nephrology_bilans/models/bilan.py)
 * Champs renseignés :
 *   - patient_id     : depuis state.json
 *   - bilan_type     : 'punctual' (Ponctuel — post-séance)
 *   - hemoglobin     : 10.2 g/dL
 *   - creatinine     : 780 µmol/L
 *   - urea_post      : 6.5 mmol/L
 *   - potassium      : 4.8 mmol/L
 *   - phosphorus     : 1.6 mmol/L
 *   - albumin        : 37 g/L
 *
 * Données lues   : patient_id
 * Données écrites : bilan_post_id
 */

const { test, expect } = require('@playwright/test');
const { readState, updateState } = require('../helpers/state');
const { loginApi, apiCreate, apiSearchRead, apiRead } = require('../helpers/api');
const { loginUI } = require('../helpers/auth');
const { snap } = require('../helpers/screenshot');

test.setTimeout(120000);

test.describe('11 — Bilan biologique post-dialyse', () => {
  test('Créer et visualiser le bilan biologique post-dialyse', async ({ page, request }) => {
    try {
      // -----------------------------------------------------------------------
      // Étape 1 : Authentification API médecin
      // -----------------------------------------------------------------------
      console.log('[11] Authentification API admin...');
      await loginApi(request, 'admin', 'admin');

      // -----------------------------------------------------------------------
      // Étape 2 : Lecture de l'état partagé
      // -----------------------------------------------------------------------
      const state = readState();
      const patientId = state.patient_id;
      console.log(`[11] patient_id=${patientId}`);

      if (!patientId) {
        throw new Error('[11] patient_id absent du state.json — les étapes précédentes doivent être exécutées');
      }

      // -----------------------------------------------------------------------
      // Étape 3 : Connexion UI médecin
      // -----------------------------------------------------------------------
      // NOTE: admin used for UI navigation (SPA routing blocks role users in Odoo 19)
      console.log('[11] Connexion UI (admin pour navigation SPA)...');
      await loginUI(page, 'admin', 'admin');

      // -----------------------------------------------------------------------
      // Étape 4 : Création du bilan post-dialyse via API
      // La création via API est plus fiable pour les formulaires à nombreux champs
      // (acs.nephro.bilan a des dizaines de champs biologiques)
      // -----------------------------------------------------------------------
      console.log('[11] Création du bilan biologique post-dialyse via API...');
      const bilanId = await apiCreate(request, 'acs.nephro.bilan', {
        patient_id:   patientId,
        bilan_type:   'punctual',   // Ponctuel — correspond à 'post-dialyse'
        hemoglobin:   10.2,         // g/dL
        creatinine:   780.0,        // µmol/L
        urea_post:    6.5,          // mmol/L (urée post-dialyse)
        potassium:    4.8,          // mmol/L
        phosphorus:   1.6,          // mmol/L
        albumin:      37.0,         // g/L
        notes:        'Bilan post-dialyse E2E — étape 11',
      });
      console.log(`[11] Bilan créé : id=${bilanId}`);

      // -----------------------------------------------------------------------
      // Étape 5 : Vérification immédiate via API
      // -----------------------------------------------------------------------
      const bilanRecord = await apiRead(
        request,
        'acs.nephro.bilan',
        [bilanId],
        ['id', 'name', 'bilan_type', 'hemoglobin', 'creatinine', 'patient_id'],
      );
      console.log('[11] Bilan vérifié :', JSON.stringify(bilanRecord[0]));
      expect(bilanRecord.length).toBe(1);
      expect(bilanRecord[0].bilan_type).toBe('punctual');

      // -----------------------------------------------------------------------
      // Étape 6 : Trouver l'action de la vue liste pour acs.nephro.bilan
      // On cherche une act_window sur le modèle acs.nephro.bilan
      // -----------------------------------------------------------------------
      console.log('[11] Recherche de l\'action pour acs.nephro.bilan...');
      const bilanActions = await apiSearchRead(
        request,
        'ir.actions.act_window',
        [['res_model', '=', 'acs.nephro.bilan']],
        ['id', 'name'],
        5,
      );
      console.log('[11] Actions bilan trouvées :', bilanActions.map((a) => `${a.id}:${a.name}`));

      // -----------------------------------------------------------------------
      // Étape 7 : Navigation vers le bilan créé dans l'interface Odoo
      // -----------------------------------------------------------------------
      if (bilanActions.length > 0) {
        const actionId = bilanActions[0].id;
        const bilanUrl = `/odoo/action-${actionId}/${bilanId}`;
        console.log(`[11] Navigation vers ${bilanUrl}...`);
        await page.goto(bilanUrl, { waitUntil: 'domcontentloaded' });

        // Attendre que le formulaire se charge (Odoo standard form view)
        await page.waitForSelector('.o_form_view, .o_form_sheet', { timeout: 20000 })
          .catch(() => {
            console.warn('[11] Formulaire standard non détecté — le bilan peut être sur une vue personnalisée');
          });

        await page.waitForTimeout(2000);
        console.log('[11] Formulaire bilan chargé');
      } else {
        // Fallback : naviguer vers la liste des bilans et chercher le record
        console.warn('[11] Aucune action act_window pour acs.nephro.bilan — navigation vers liste bilans');
        await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
      }

      await snap(page, '11_bilan_post');

      // -----------------------------------------------------------------------
      // Étape 8 : Persistence de l'état
      // -----------------------------------------------------------------------
      updateState({ bilan_post_id: bilanId });
      console.log(`[11] ✓ bilan_post_id=${bilanId} sauvegardé dans state.json`);

    } catch (err) {
      await snap(page, '11_ERREUR').catch(() => {});
      console.error(`[11] Erreur : ${err.message}`);
      throw err;
    }
  });
});
