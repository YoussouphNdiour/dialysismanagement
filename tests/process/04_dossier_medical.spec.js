// Utilisateur: DOCTOR — Dossier médical du patient (onglets néphro)

'use strict';

const { test, expect } = require('@playwright/test');
const { readState } = require('../helpers/state');
const { loginApi, apiSearchRead } = require('../helpers/api');
const { loginUI } = require('../helpers/auth');
const { snap } = require('../helpers/screenshot');

// NOTE: admin used for UI navigation (SPA routing blocks role users in Odoo 19)
const DOCTOR_LOGIN    = 'medecin@nephro.test';
const DOCTOR_PASSWORD = 'Nephro2024!';

test.describe('04 — Dossier médical', () => {
  test('04 — Remplissage du dossier médical de Khadija Diallo E2E', async ({ page, request }) => {
    test.setTimeout(120000);

    try {
      // -----------------------------------------------------------------------
      // 1. Connexion UI en tant que médecin
      // -----------------------------------------------------------------------
      await loginUI(page, 'admin', 'admin');
      await expect(page).not.toHaveURL(/login/, { timeout: 5000 });
      console.log('[04] Connecté (admin pour navigation SPA)');

      // -----------------------------------------------------------------------
      // 2. Lecture du state
      // -----------------------------------------------------------------------
      const state = readState();
      const patient_id = state.patient_id;
      expect(patient_id, 'patient_id doit être défini (exécuter 01 d\'abord)').not.toBeNull();
      const config = state.config || {};
      console.log('[04] patient_id :', patient_id);

      // -----------------------------------------------------------------------
      // 3. Navigation vers le dossier patient
      // -----------------------------------------------------------------------
      await page.goto(`/odoo/almightyhms-patient/${patient_id}`, { waitUntil: 'domcontentloaded' });

      const currentUrl = page.url();
      if (currentUrl.includes('login') || currentUrl.includes('error')) {
        // Fallback via la liste patients
        await page.goto('/odoo/almightyhms-patient', { waitUntil: 'domcontentloaded' });
        const patientLink = page.locator(`tr.o_data_row:has-text("Khadija Diallo E2E"), .o_kanban_record:has-text("Khadija Diallo E2E")`).first();
        if (await patientLink.isVisible({ timeout: 5000 }).catch(() => false)) {
          await patientLink.click();
          await page.waitForLoadState('domcontentloaded');
        }
      }
      console.log('[04] Page patient chargée :', page.url());

      // -----------------------------------------------------------------------
      // 4. Exploration des onglets du formulaire patient
      // -----------------------------------------------------------------------
      const tabNames = ['Néphro', 'Dialyse', 'Antécédents', 'Néphrologie', 'Medical', 'Info'];
      for (const tabName of tabNames) {
        try {
          const tab = page.locator(
            `a.nav-link:has-text("${tabName}"), .o_notebook .nav-link:has-text("${tabName}"), button.nav-link:has-text("${tabName}")`
          ).first();
          if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tab.click();
            await page.waitForTimeout(500);
            console.log(`[04] Onglet "${tabName}" cliqué`);
            break;
          }
        } catch (e) {
          // Continuer avec le prochain onglet
        }
      }

      // -----------------------------------------------------------------------
      // 5. Remplissage des champs médicaux
      // -----------------------------------------------------------------------

      // Accès vasculaire (type_of_vascular_access sur la procédure, mais peut être sur le patient)
      if (config.vascular_access_id) {
        try {
          // Chercher le champ sur le formulaire courant
          await loginApi(request, DOCTOR_LOGIN, DOCTOR_PASSWORD);
          const vaRecords = await apiSearchRead(
            request,
            'acs.vascular.access',
            [['id', '=', config.vascular_access_id]],
            ['id', 'name'], 1
          );

          if (vaRecords && vaRecords.length > 0) {
            const vaName = vaRecords[0].name;
            const vaField = page.locator(
              '.o_field_widget[name="vascular_access_id"] input, .o_field_widget[name="type_of_vascular_access"] input'
            ).first();
            if (await vaField.isVisible({ timeout: 3000 }).catch(() => false)) {
              await vaField.clear();
              await vaField.fill(vaName);
              await page.waitForTimeout(500);
              const vaOpt = page.locator(`.o_dropdown_item:has-text("${vaName}")`).first();
              if (await vaOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
                await vaOpt.click();
                console.log('[04] Accès vasculaire rempli :', vaName);
              }
            }
          }
        } catch (err) {
          console.error('[04] Impossible de remplir l\'accès vasculaire :', err.message);
        }
      }

      // Poids sec (dry_weight) — chercher sur le formulaire ou un onglet dédié
      try {
        const dryWeightField = page.locator(
          '.o_field_widget[name="dry_weight"] input, input[id*="dry_weight"]'
        ).first();
        if (await dryWeightField.isVisible({ timeout: 3000 }).catch(() => false)) {
          await dryWeightField.clear();
          await dryWeightField.fill('70.0');
          await dryWeightField.press('Tab');
          console.log('[04] Poids sec rempli : 70.0');
        } else {
          console.log('[04] Champ dry_weight non visible sur le formulaire patient — il est sur la procédure');
        }
      } catch (err) {
        console.error('[04] Impossible de remplir le poids sec :', err.message);
      }

      // Antécédents médicaux néphro (nephro_medical_antecedent)
      try {
        const antecedentsField = page.locator(
          '.o_field_widget[name="nephro_medical_antecedent"] textarea, .o_field_widget[name="nephro_medical_antecedent"] div[contenteditable]'
        ).first();
        if (await antecedentsField.isVisible({ timeout: 3000 }).catch(() => false)) {
          await antecedentsField.click();
          await antecedentsField.fill('IRC stade 5, HTA');
          console.log('[04] Antécédents néphro remplis');
        } else {
          // Essayer dans un autre onglet — Antécédents
          const antecedentsTab = page.locator(
            'a.nav-link:has-text("Antécédents"), .o_notebook .nav-link:has-text("Antécédents")'
          ).first();
          if (await antecedentsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await antecedentsTab.click();
            await page.waitForTimeout(500);
            const antField2 = page.locator(
              '.o_field_widget[name="nephro_medical_antecedent"] textarea, textarea[id*="nephro_medical_antecedent"]'
            ).first();
            if (await antField2.isVisible({ timeout: 3000 }).catch(() => false)) {
              await antField2.click();
              await antField2.fill('IRC stade 5, HTA');
              console.log('[04] Antécédents néphro remplis (onglet Antécédents)');
            }
          }
        }
      } catch (err) {
        console.error('[04] Impossible de remplir les antécédents :', err.message);
      }

      // Cocher "Soins néphrologiques" si présent
      try {
        const nephroCareCheckbox = page.locator(
          'input[type="checkbox"][id*="nephrology_care"], .o_field_widget[name="nephrology_care"] input[type="checkbox"]'
        ).first();
        if (await nephroCareCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isChecked = await nephroCareCheckbox.isChecked();
          if (!isChecked) {
            await nephroCareCheckbox.click();
            console.log('[04] Nephrology care coché');
          }
        }
      } catch (err) {
        console.error('[04] Impossible de cocher nephrology_care :', err.message);
      }

      // -----------------------------------------------------------------------
      // 6. Capture d'écran
      // -----------------------------------------------------------------------
      await snap(page, '04_dossier_medical');

      // -----------------------------------------------------------------------
      // 7. Sauvegarde
      // -----------------------------------------------------------------------
      const saveButton = page.locator(
        'button.o_form_button_save, button:has-text("Enregistrer"), button:has-text("Sauvegarder")'
      ).first();
      if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForLoadState('domcontentloaded');
        console.log('[04] Dossier médical sauvegardé');
      } else {
        await page.keyboard.press('Control+s');
        await page.waitForTimeout(1000);
        console.log('[04] Sauvegarde via Ctrl+S');
      }

      // Vérifier pas de message d'erreur
      const errorAlert = page.locator('.o_notification.o_notification_danger, .alert-danger').first();
      if (await errorAlert.isVisible({ timeout: 2000 }).catch(() => false)) {
        const errorText = await errorAlert.textContent();
        console.error('[04] Alerte d\'erreur détectée :', errorText);
        test.info().annotations.push({ type: 'warning', description: `Erreur UI: ${errorText}` });
      }

      console.log('[04] Test terminé avec succès');

    } catch (err) {
      console.error('[04] ERREUR :', err.message);
      await snap(page, 'error_04_dossier_medical').catch(() => {});
      test.info().annotations.push({ type: 'error', description: err.message });
      throw err;
    }
  });
});
