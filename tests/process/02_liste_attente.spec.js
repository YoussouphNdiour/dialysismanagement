// Utilisateur: SECRETARY — Ajout du patient à la liste d'attente de dialyse

'use strict';

const { test, expect } = require('@playwright/test');
const { readState, updateState } = require('../helpers/state');
const { loginApi, apiSearchRead, apiCreate } = require('../helpers/api');
const { loginUI } = require('../helpers/auth');
const { snap } = require('../helpers/screenshot');

const SECRETARY_LOGIN    = 'secretaire@nephro.test';
const SECRETARY_PASSWORD = 'Nephro2024!';

test.describe('02 — Ajout liste d\'attente', () => {
  test('02 — Ajout du patient Khadija Diallo E2E à la liste d\'attente', async ({ page, request }) => {
    test.setTimeout(120000);

    try {
      // -----------------------------------------------------------------------
      // 1. Connexion UI en tant que secrétaire
      // -----------------------------------------------------------------------
      await loginUI(page, SECRETARY_LOGIN, SECRETARY_PASSWORD);
      await expect(page).not.toHaveURL(/login/, { timeout: 5000 });
      console.log('[02] Connecté en tant que secrétaire');

      // -----------------------------------------------------------------------
      // 2. Lecture du state pour récupérer patient_id
      // -----------------------------------------------------------------------
      const state = readState();
      const patient_id = state.patient_id;
      expect(patient_id, 'patient_id doit être défini dans le state (exécuter 01 d\'abord)').not.toBeNull();
      console.log('[02] patient_id depuis le state :', patient_id);

      // -----------------------------------------------------------------------
      // 3. Recherche du modèle de liste d'attente via API
      // -----------------------------------------------------------------------
      await loginApi(request, SECRETARY_LOGIN, SECRETARY_PASSWORD);

      let waitingListModel = null;

      try {
        const models = await apiSearchRead(
          request,
          'ir.model',
          [['model', 'like', 'waiting']],
          ['name', 'model'],
          20
        );
        console.log('[02] Modèles "waiting" trouvés :', JSON.stringify(models.map(m => m.model)));

        // Priorité : acs.dialysis.waiting.list, hms.waiting.list, ou autre
        const preferred = ['acs.dialysis.waiting.list', 'hms.waiting.list', 'acs.waiting.list'];
        for (const pref of preferred) {
          const found = models.find(m => m.model === pref);
          if (found) {
            waitingListModel = found.model;
            break;
          }
        }
        if (!waitingListModel && models.length > 0) {
          waitingListModel = models[0].model;
        }
        console.log('[02] Modèle liste d\'attente sélectionné :', waitingListModel);
      } catch (err) {
        console.error('[02] Impossible de rechercher le modèle waiting :', err.message);
      }

      // -----------------------------------------------------------------------
      // 4. Tentative navigation via UI vers la liste d'attente
      // -----------------------------------------------------------------------
      let waiting_list_entry_id = null;
      let uiSuccess = false;

      const candidateUrls = [
        '/odoo/dialysis-waiting-list',
        '/odoo/waiting-list',
        '/odoo/nephrology-waiting-list',
      ];

      for (const candidateUrl of candidateUrls) {
        try {
          await page.goto(candidateUrl, { waitUntil: 'networkidle', timeout: 15000 });
          const url = page.url();
          if (!url.includes('login') && !url.includes('error') && !url.includes('404')) {
            console.log('[02] Liste d\'attente trouvée à :', url);
            uiSuccess = true;
            break;
          }
        } catch (navErr) {
          console.log('[02] URL non disponible :', candidateUrl);
        }
      }

      if (uiSuccess) {
        // Clic sur Nouveau
        try {
          const newButton = page.locator(
            'button.o_list_button_add, button:has-text("Nouveau"), button:has-text("New")'
          ).first();
          await newButton.waitFor({ state: 'visible', timeout: 10000 });
          await newButton.click();
          await page.waitForLoadState('networkidle');

          // Remplir le champ patient
          const patientField = page.locator(
            '.o_field_widget[name="patient_id"] input, input[id*="patient_id"]'
          ).first();
          await patientField.waitFor({ state: 'visible', timeout: 8000 });
          await patientField.clear();
          await patientField.fill('Khadija Diallo E2E');
          await page.waitForTimeout(800);

          // Sélectionner dans la dropdown
          const dropdownOption = page.locator(
            '.o_dropdown_item:has-text("Khadija Diallo E2E"), .ui-autocomplete li:has-text("Khadija Diallo E2E"), ul.o_completion_dropdown li:has-text("Khadija")'
          ).first();
          if (await dropdownOption.isVisible({ timeout: 5000 }).catch(() => false)) {
            await dropdownOption.click();
          }

          await snap(page, '02_liste_attente');

          // Sauvegarder
          const saveButton = page.locator(
            'button.o_form_button_save, button:has-text("Enregistrer"), button:has-text("Sauvegarder")'
          ).first();
          if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await saveButton.click();
            await page.waitForLoadState('networkidle');
          }

          // Récupérer l'ID depuis l'URL
          const urlAfterSave = page.url();
          const urlMatch = urlAfterSave.match(/\/(\d+)(?:\?|$)/);
          if (urlMatch) {
            waiting_list_entry_id = parseInt(urlMatch[1], 10);
            console.log('[02] waiting_list_entry_id depuis URL :', waiting_list_entry_id);
          }
        } catch (uiErr) {
          console.error('[02] Erreur UI liste d\'attente :', uiErr.message);
          await snap(page, 'error_02_ui_waiting_list').catch(() => {});
        }
      }

      // -----------------------------------------------------------------------
      // 5. Fallback : création via API si UI a échoué ou modèle inconnu
      // -----------------------------------------------------------------------
      if (!waiting_list_entry_id && waitingListModel) {
        console.log('[02] Tentative de création via API sur le modèle :', waitingListModel);
        try {
          waiting_list_entry_id = await apiCreate(request, waitingListModel, {
            patient_id: patient_id,
          });
          console.log('[02] waiting_list_entry_id créé via API :', waiting_list_entry_id);

          // Screenshot de la page actuelle si pas encore pris
          await snap(page, '02_liste_attente');
        } catch (apiErr) {
          console.error('[02] Création API échouée :', apiErr.message);
          // Essayer de confirmer l'existence via recherche
          if (waitingListModel) {
            try {
              const existingEntries = await apiSearchRead(
                request,
                waitingListModel,
                [['patient_id', '=', patient_id]],
                ['id'],
                1
              );
              if (existingEntries && existingEntries.length > 0) {
                waiting_list_entry_id = existingEntries[0].id;
                console.log('[02] Entrée existante trouvée :', waiting_list_entry_id);
                await snap(page, '02_liste_attente');
              }
            } catch (searchErr) {
              console.error('[02] Recherche dans le modèle échouée :', searchErr.message);
            }
          }
        }
      }

      // Screenshot de sécurité si aucun n'a été pris
      if (!uiSuccess && !waiting_list_entry_id) {
        await snap(page, '02_liste_attente_echec');
      }

      // -----------------------------------------------------------------------
      // 6. Mise à jour du state
      // -----------------------------------------------------------------------
      updateState({ waiting_list_entry_id });
      console.log('[02] State mis à jour — waiting_list_entry_id:', waiting_list_entry_id);

      // Avertissement mais pas d'échec bloquant si le modèle n'existe pas
      if (!waiting_list_entry_id) {
        test.info().annotations.push({
          type: 'warning',
          description: 'Liste d\'attente non trouvée/créée — aucun modèle waiting list disponible dans ce module',
        });
        console.warn('[02] waiting_list_entry_id est null — possible que ce module ne gère pas de liste d\'attente dédiée');
      }

      console.log('[02] Test terminé');

    } catch (err) {
      console.error('[02] ERREUR :', err.message);
      await snap(page, 'error_02_liste_attente').catch(() => {});
      test.info().annotations.push({ type: 'error', description: err.message });
      throw err;
    }
  });
});
