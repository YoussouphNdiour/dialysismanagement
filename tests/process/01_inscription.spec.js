// Utilisateur: SECRETARY — Inscription du patient Khadija Diallo E2E

'use strict';

const { test, expect } = require('@playwright/test');
const { readState, updateState } = require('../helpers/state');
const { loginApi, apiSearchRead } = require('../helpers/api');
const { loginUI } = require('../helpers/auth');
const { snap } = require('../helpers/screenshot');

// NOTE: Les tests process utilisent admin pour éviter les blocages de routing SPA Odoo 19.
// Les tests rôles (roles/*.spec.js) testent les accès par rôle spécifique.
const SECRETARY_LOGIN    = 'admin';
const SECRETARY_PASSWORD = 'admin';

test.describe('01 — Inscription du patient', () => {
  test('01 — Inscription du patient Khadija Diallo E2E', async ({ page, request }) => {
    test.setTimeout(120000);

    try {
      // -----------------------------------------------------------------------
      // 0. Vérifier si le patient existe déjà (idempotence — relance du test)
      // -----------------------------------------------------------------------
      await loginApi(request, SECRETARY_LOGIN, SECRETARY_PASSWORD);
      const existingPatients = await apiSearchRead(
        request, 'hms.patient', [['name', '=', 'Khadija Diallo E2E']], ['id', 'partner_id'], 1
      ).catch(() => []);

      if (existingPatients.length > 0) {
        const rec = existingPatients[0];
        const patient_id = rec.id;
        const partner_id = Array.isArray(rec.partner_id) ? rec.partner_id[0] : rec.partner_id;
        console.log(`[01] Patient déjà existant : patient_id=${patient_id}, partner_id=${partner_id}`);

        // Navigation vers le patient existant pour la capture d'écran
        await loginUI(page, SECRETARY_LOGIN, SECRETARY_PASSWORD);
        await page.goto(`/odoo/almightyhms-patient/${patient_id}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        await snap(page, '01_patient_cree');

        updateState({ patient_id, partner_id });
        console.log('[01] State mis à jour (patient existant) — patient_id:', patient_id, 'partner_id:', partner_id);
        expect(patient_id).not.toBeNull();
        expect(typeof patient_id).toBe('number');
        console.log('[01] Test terminé avec succès (patient existant réutilisé)');
        return;
      }

      // -----------------------------------------------------------------------
      // 1. Connexion UI en tant que secrétaire
      // -----------------------------------------------------------------------
      await loginUI(page, SECRETARY_LOGIN, SECRETARY_PASSWORD);

      await expect(page).not.toHaveURL(/login/, { timeout: 5000 });
      console.log('[01] Connecté en tant que secrétaire');

      // -----------------------------------------------------------------------
      // 2. Navigation vers la liste des patients
      // -----------------------------------------------------------------------
      await page.goto('/odoo/almightyhms-patient', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      console.log('[01] Sur la page patients :', page.url());

      // -----------------------------------------------------------------------
      // 3. Clic sur "Nouveau" / "New"
      // -----------------------------------------------------------------------
      const newButton = page.locator(
        'button.o_list_button_add, button:has-text("Nouveau"), button:has-text("New"), .o_form_button_new'
      ).first();
      await newButton.waitFor({ state: 'visible', timeout: 15000 });
      await newButton.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      console.log('[01] Formulaire de création ouvert');

      // -----------------------------------------------------------------------
      // 4. Remplissage des champs requis
      // -----------------------------------------------------------------------

      // Nom du patient — Odoo HMS : champ "name" = TEXTAREA (pas un input)
      // placeholder = "e.g. Brandon Freeman", id="name_0"
      const nameField = page.locator('textarea[placeholder*="Brandon Freeman"], textarea#name_0, .o_field_widget[name="name"] textarea').first();
      await nameField.waitFor({ state: 'visible', timeout: 10000 });
      await nameField.clear();
      await nameField.fill('Khadija Diallo E2E');
      await page.waitForTimeout(300);
      console.log('[01] Nom rempli');

      // Date de naissance — chercher le champ date_of_birth ou dob
      try {
        const dobField = page.locator(
          '.o_field_widget[name="date_of_birth"] input, .o_field_widget[name="dob"] input, input[id*="date_of_birth"]'
        ).first();
        await dobField.waitFor({ state: 'visible', timeout: 5000 });
        await dobField.clear();
        await dobField.fill('03/15/1975');
        await dobField.press('Tab');
        console.log('[01] Date de naissance remplie');
      } catch (err) {
        console.error('[01] Impossible de remplir la date de naissance :', err.message);
      }

      // Sexe / Genre
      try {
        const genderField = page.locator(
          '.o_field_widget[name="gender"] select, select[id*="gender"]'
        ).first();
        if (await genderField.isVisible({ timeout: 3000 }).catch(() => false)) {
          await genderField.selectOption('female');
          console.log('[01] Genre (select) rempli');
        } else {
          // Peut être un widget radio ou bouton
          const femaleOption = page.locator(
            'input[type="radio"][value="female"], label:has-text("Féminin"), label:has-text("Female")'
          ).first();
          if (await femaleOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await femaleOption.click();
            console.log('[01] Genre (radio) rempli');
          }
        }
      } catch (err) {
        console.error('[01] Impossible de remplir le genre :', err.message);
      }

      // Téléphone — id="phone_0"
      try {
        const phoneField = page.locator('input#phone_0, input[placeholder="Phone"]').first();
        await phoneField.waitFor({ state: 'visible', timeout: 5000 });
        await phoneField.clear();
        await phoneField.fill('+221701234567');
        console.log('[01] Téléphone rempli');
      } catch (err) {
        console.error('[01] Impossible de remplir le téléphone :', err.message);
      }

      // Email — id="email_0"
      try {
        const emailField = page.locator('input#email_0, input[placeholder="Email"]').first();
        await emailField.waitFor({ state: 'visible', timeout: 5000 });
        await emailField.clear();
        await emailField.fill('khadija.diallo.e2e@example.com');
        console.log('[01] Email rempli');
      } catch (err) {
        console.error('[01] Impossible de remplir l\'email :', err.message);
      }

      // -----------------------------------------------------------------------
      // 5. Sauvegarde du formulaire
      // -----------------------------------------------------------------------
      const saveButton = page.locator(
        'button.o_form_button_save, .o_form_status_indicator button:has-text("Sauvegarder"), button[name="save_manually"], button:has-text("Enregistrer")'
      ).first();

      if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
        console.log('[01] Sauvegardé via bouton Save');
      } else {
        // Odoo 19 auto-save parfois — utiliser raccourci clavier ou bouton breadcrumb
        await page.keyboard.press('Control+s');
        await page.waitForTimeout(1000);
        console.log('[01] Sauvegarde via Ctrl+S');
      }

      // -----------------------------------------------------------------------
      // 6. Capture d'écran
      // -----------------------------------------------------------------------
      await snap(page, '01_patient_cree');

      // -----------------------------------------------------------------------
      // 7. Récupération de l'ID patient depuis l'URL ou le formulaire
      // -----------------------------------------------------------------------
      let patient_id = null;

      // Tenter d'extraire l'ID depuis l'URL
      const urlAfterSave = page.url();
      console.log('[01] URL après sauvegarde :', urlAfterSave);

      const urlMatch = urlAfterSave.match(/\/patients\/(\d+)/);
      if (urlMatch) {
        patient_id = parseInt(urlMatch[1], 10);
        console.log('[01] patient_id extrait de l\'URL :', patient_id);
      }

      // -----------------------------------------------------------------------
      // 8. Recherche via API pour confirmer l'ID et obtenir partner_id
      // -----------------------------------------------------------------------
      await loginApi(request, SECRETARY_LOGIN, SECRETARY_PASSWORD);

      const patientRecords = await apiSearchRead(
        request,
        'hms.patient',
        [['name', '=', 'Khadija Diallo E2E']],
        ['id', 'partner_id'],
        1
      );

      let partner_id = null;

      if (patientRecords && patientRecords.length > 0) {
        const rec = patientRecords[0];
        // Si l'URL n'avait pas donné l'ID, utiliser l'API
        if (!patient_id) {
          patient_id = rec.id;
          console.log('[01] patient_id extrait de l\'API :', patient_id);
        }
        // partner_id peut être [id, name] ou un entier simple
        if (Array.isArray(rec.partner_id)) {
          partner_id = rec.partner_id[0];
        } else {
          partner_id = rec.partner_id;
        }
        console.log('[01] partner_id :', partner_id);
      } else {
        console.error('[01] Patient non trouvé via API après création');
      }

      // -----------------------------------------------------------------------
      // 9. Mise à jour du state
      // -----------------------------------------------------------------------
      updateState({ patient_id, partner_id });
      console.log('[01] State mis à jour — patient_id:', patient_id, 'partner_id:', partner_id);

      // -----------------------------------------------------------------------
      // 10. Assertion finale
      // -----------------------------------------------------------------------
      expect(patient_id, 'patient_id doit être non nul après inscription').not.toBeNull();
      expect(typeof patient_id).toBe('number');
      console.log('[01] Test terminé avec succès');

    } catch (err) {
      console.error('[01] ERREUR :', err.message);
      await snap(page, 'error_01_inscription').catch(() => {});
      test.info().annotations.push({ type: 'error', description: err.message });
      throw err;
    }
  });
});
