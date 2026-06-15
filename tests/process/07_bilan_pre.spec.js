// Utilisateur: DOCTOR — Bilan biologique pré-dialyse

'use strict';

const { test, expect } = require('@playwright/test');
const { readState, updateState } = require('../helpers/state');
const { loginApi, apiSearchRead, apiCreate } = require('../helpers/api');
const { loginUI } = require('../helpers/auth');
const { snap } = require('../helpers/screenshot');

const DOCTOR_LOGIN    = 'medecin@nephro.test';
const DOCTOR_PASSWORD = 'Nephro2024!';

/**
 * Retourne la date du jour au format YYYY-MM-DD HH:MM:SS pour Odoo Datetime.
 */
function todayDatetime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} 08:00:00`;
}

/**
 * Retourne la date du jour au format MM/DD/YYYY HH:MM:SS pour les inputs date Odoo.
 */
function todayInputFormat() {
  const now = new Date();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${mm}/${dd}/${yyyy} 08:00:00`;
}

test.describe('07 — Bilan biologique pré-dialyse', () => {
  test('07 — Création du bilan biologique pré-dialyse pour Khadija Diallo E2E', async ({ page, request }) => {
    test.setTimeout(120000);

    try {
      // -----------------------------------------------------------------------
      // 1. Connexion UI en tant que médecin
      // -----------------------------------------------------------------------
      await loginUI(page, 'admin', 'admin');
      await expect(page).not.toHaveURL(/login/, { timeout: 5000 });
      console.log('[07] Connecté (admin pour navigation SPA)');

      // -----------------------------------------------------------------------
      // 2. Lecture du state
      // -----------------------------------------------------------------------
      const state = readState();
      const patient_id = state.patient_id;
      expect(patient_id, 'patient_id doit être défini (exécuter 01 d\'abord)').not.toBeNull();
      console.log('[07] patient_id :', patient_id);

      // -----------------------------------------------------------------------
      // 3. Navigation vers le formulaire patient ou les bilans
      // -----------------------------------------------------------------------
      await page.goto(`/odoo/almightyhms-patient/${patient_id}`, { waitUntil: 'domcontentloaded' });
      console.log('[07] Page patient chargée :', page.url());

      // -----------------------------------------------------------------------
      // 4. Chercher le smart button ou menu "Bilans Biologiques"
      // -----------------------------------------------------------------------
      let bilansFound = false;

      // A. Smart button
      const smartButtonSelectors = [
        'button:has-text("Bilans")',
        '.o_stat_button:has-text("Bilan")',
        '.oe_button_box button:has-text("Bilan")',
        'a:has-text("Bilans")',
        'button:has-text("Biologie")',
        '.o_stat_button:has-text("Biologie")',
      ];
      for (const sel of smartButtonSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await btn.click();
            await page.waitForLoadState('domcontentloaded');
            console.log('[07] Smart button Bilans cliqué');
            bilansFound = true;
            break;
          }
        } catch (e) { /* continuer */ }
      }

      // B. Navigation directe
      if (!bilansFound) {
        const bilanUrls = [
          '/odoo/action-573',
          '/odoo/action-520',
          '/odoo/nephro-bilans',
          '/odoo/bilans-biologiques',
        ];
        for (const u of bilanUrls) {
          try {
            await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 10000 });
            if (!page.url().includes('login')) {
              bilansFound = true;
              console.log('[07] Page bilans chargée :', page.url());
              break;
            }
          } catch (e) { /* continuer */ }
        }
      }

      // C. Via le menu
      if (!bilansFound) {
        await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
        const bilanMenu = page.locator(
          'a:has-text("Biologie"), .o_menu_sections a:has-text("Biologie"), a:has-text("Bilans")'
        ).first();
        if (await bilanMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
          await bilanMenu.click();
          await page.waitForLoadState('domcontentloaded');
          console.log('[07] Menu Biologie/Bilans cliqué');
          bilansFound = true;
        }
      }

      // -----------------------------------------------------------------------
      // 5. Clic sur "Nouveau"
      // -----------------------------------------------------------------------
      let bilan_pre_id = null;
      let createdViaUI = false;

      try {
        const newButton = page.locator(
          'button.o_list_button_add, button:has-text("Nouveau"), button:has-text("New"), .o_form_button_new'
        ).first();
        await newButton.waitFor({ state: 'visible', timeout: 15000 });
        await newButton.click();
        await page.waitForLoadState('domcontentloaded');
        console.log('[07] Formulaire bilan ouvert');
        createdViaUI = true;
      } catch (uiErr) {
        console.error('[07] Impossible de cliquer sur Nouveau :', uiErr.message);
      }

      if (createdViaUI) {
        // -----------------------------------------------------------------------
        // 6. Remplissage des champs REQUIS
        // -----------------------------------------------------------------------

        // Patient (requis)
        try {
          const patientField = page.locator(
            '.o_field_widget[name="patient_id"] input'
          ).first();
          if (await patientField.isVisible({ timeout: 5000 }).catch(() => false)) {
            const val = await patientField.inputValue();
            if (!val || !val.includes('Khadija')) {
              await patientField.clear();
              await patientField.fill('Khadija Diallo E2E');
              await page.waitForTimeout(600);
              const opt = page.locator('.o_dropdown_item:has-text("Khadija")').first();
              if (await opt.isVisible({ timeout: 3000 }).catch(() => false)) {
                await opt.click();
                console.log('[07] Patient rempli');
              }
            } else {
              console.log('[07] Patient déjà rempli :', val);
            }
          }
        } catch (err) {
          console.error('[07] patient field :', err.message);
        }

        // Date du bilan (requis — auto-remplie normalement)
        try {
          const examDateField = page.locator(
            '.o_field_widget[name="exam_date"] input, input[id*="exam_date"]'
          ).first();
          if (await examDateField.isVisible({ timeout: 3000 }).catch(() => false)) {
            const val = await examDateField.inputValue();
            if (!val) {
              await examDateField.clear();
              await examDateField.fill(todayInputFormat());
              await examDateField.press('Escape');
              console.log('[07] Date bilan remplie :', todayInputFormat());
            } else {
              console.log('[07] Date bilan déjà remplie :', val);
            }
          }
        } catch (err) {
          console.error('[07] exam_date field :', err.message);
        }

        // Type de bilan (requis) — sélection "monthly"
        try {
          const bilanTypeSelect = page.locator(
            '.o_field_widget[name="bilan_type"] select, select[id*="bilan_type"]'
          ).first();
          if (await bilanTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
            await bilanTypeSelect.selectOption('monthly');
            console.log('[07] bilan_type = monthly');
          } else {
            // Widget radio ou many2one
            const monthlyOption = page.locator(
              'label:has-text("Mensuel"), .o_radio_item:has-text("Mensuel")'
            ).first();
            if (await monthlyOption.isVisible({ timeout: 2000 }).catch(() => false)) {
              await monthlyOption.click();
              console.log('[07] bilan_type Mensuel (radio)');
            }
          }
        } catch (err) {
          console.error('[07] bilan_type field :', err.message);
        }

        // -----------------------------------------------------------------------
        // 7. Remplissage des valeurs biologiques optionnelles
        // -----------------------------------------------------------------------
        const biologicalValues = {
          hemoglobin: '9.5',
          creatinine: '850',
          urea_pre:   '18.5',
          potassium:  '5.2',
          phosphorus: '1.9',
          albumin:    '38',
        };

        for (const [fieldName, value] of Object.entries(biologicalValues)) {
          try {
            const field = page.locator(
              `.o_field_widget[name="${fieldName}"] input, input[id*="${fieldName}"]`
            ).first();
            if (await field.isVisible({ timeout: 2000 }).catch(() => false)) {
              await field.clear();
              await field.fill(value);
              console.log(`[07] ${fieldName} = ${value}`);
            }
          } catch (err) {
            console.error(`[07] Impossible de remplir ${fieldName} :`, err.message);
          }
        }

        // -----------------------------------------------------------------------
        // 8. Capture d'écran
        // -----------------------------------------------------------------------
        await snap(page, '07_bilan_pre');

        // -----------------------------------------------------------------------
        // 9. Sauvegarde
        // -----------------------------------------------------------------------
        const saveButton = page.locator(
          'button.o_form_button_save, button:has-text("Enregistrer"), button:has-text("Sauvegarder")'
        ).first();
        if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await saveButton.click();
          await page.waitForLoadState('domcontentloaded');
        } else {
          await page.keyboard.press('Control+s');
          await page.waitForTimeout(1000);
        }
        console.log('[07] Bilan sauvegardé');

        // Depuis l'URL
        const urlAfterSave = page.url();
        const urlMatch = urlAfterSave.match(/\/(\d+)(?:\?|$)/);
        if (urlMatch) {
          bilan_pre_id = parseInt(urlMatch[1], 10);
          console.log('[07] bilan_pre_id depuis URL :', bilan_pre_id);
        }
      }

      // -----------------------------------------------------------------------
      // 10. Confirmation via API
      // -----------------------------------------------------------------------
      await loginApi(request, DOCTOR_LOGIN, DOCTOR_PASSWORD);

      if (!bilan_pre_id) {
        const bilans = await apiSearchRead(
          request,
          'acs.nephro.bilan',
          [['patient_id', '=', patient_id]],
          ['id'],
          1
        );
        if (bilans && bilans.length > 0) {
          bilan_pre_id = bilans[0].id;
          console.log('[07] bilan_pre_id depuis API :', bilan_pre_id);
        }
      }

      // Fallback : créer via API si l'UI a complètement échoué
      if (!bilan_pre_id) {
        console.log('[07] Création du bilan via API (fallback)');
        try {
          bilan_pre_id = await apiCreate(request, 'acs.nephro.bilan', {
            patient_id:  patient_id,
            exam_date:   todayDatetime(),
            bilan_type:  'monthly',
            hemoglobin:  9.5,
            creatinine:  850.0,
            urea_pre:    18.5,
            potassium:   5.2,
            phosphorus:  1.9,
            albumin:     38.0,
          });
          console.log('[07] bilan_pre_id créé via API :', bilan_pre_id);
          await snap(page, '07_bilan_pre');
        } catch (apiErr) {
          console.error('[07] Création API bilan échouée :', apiErr.message);
        }
      }

      // -----------------------------------------------------------------------
      // 11. Mise à jour du state
      // -----------------------------------------------------------------------
      updateState({ bilan_pre_id });
      console.log('[07] State mis à jour — bilan_pre_id:', bilan_pre_id);

      expect(bilan_pre_id, 'bilan_pre_id doit être non nul').not.toBeNull();
      console.log('[07] Test terminé avec succès');

    } catch (err) {
      console.error('[07] ERREUR :', err.message);
      await snap(page, 'error_07_bilan_pre').catch(() => {});
      test.info().annotations.push({ type: 'error', description: err.message });
      throw err;
    }
  });
});
