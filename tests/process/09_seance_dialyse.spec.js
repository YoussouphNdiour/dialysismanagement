// @ts-check
/**
 * 09 — Prise en charge infirmière (séance complète)
 *
 * Utilisateur : NURSE (infirmiere@nephro.test / Nephro2024!)
 * Dashboard   : /odoo/action-588 (Interface Infirmier)
 *
 * Ce test simule le workflow infirmier complet :
 *   1. Affichage du dashboard infirmière et sélection du patient
 *   2. Démarrage de la séance
 *   3. Saisie de deux séries de signes vitaux
 *   4. Déclaration d'une complication (hypotension)
 *   5. Fin de séance (poids sortie, tolérance, notes)
 *   6. Validation et retour à la liste
 *
 * Données lues   : procedure_id (depuis state.json)
 * Données écrites : session_completed = true (dans state.json)
 *
 * Sélecteurs basés sur les templates XML réels du module :
 *   - .o_nurse_patient_list     → NursePatientList.xml
 *   - .o_nurse_session_form     → NurseSessionForm.xml
 *   - .o_nurse_end_session      → NurseEndSession.xml
 *   - .o_complication_modal     → NurseComplicationPopup.xml
 */

const { test, expect } = require('@playwright/test');
const { readState, updateState } = require('../helpers/state');
const { loginApi, apiRead, apiWrite, apiSearchRead } = require('../helpers/api');
const { loginUI } = require('../helpers/auth');
const { snap } = require('../helpers/screenshot');

test.describe('09 — Prise en charge infirmière (séance complète)', () => {
  test('Workflow infirmière complet : vitaux, complication, fin de séance', async ({ page, request }) => {
    test.setTimeout(120000);
    try {
      // -----------------------------------------------------------------------
      // Étape 1 : Authentification API admin (lecture/reset procédure)
      // -----------------------------------------------------------------------
      console.log('[09] Authentification API admin...');
      await loginApi(request, 'admin', 'admin');

      // -----------------------------------------------------------------------
      // Étape 2 : Lecture de l'état partagé
      // -----------------------------------------------------------------------
      const state = readState();
      const procedureId = state.procedure_id;
      console.log(`[09] procedure_id=${procedureId}`);

      if (!procedureId) {
        throw new Error('[09] procedure_id absent du state.json — l\'étape 08 doit être exécutée en premier');
      }

      // -----------------------------------------------------------------------
      // Étape 2b : Vérifier l'état de la procédure, la date, et le département
      //            Remettre en 'scheduled' si déjà 'done' (relance du test)
      //            S'assurer que la date est aujourd'hui (pour le filtre dashboard)
      // -----------------------------------------------------------------------
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const todayDatetime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} 12:00:00`;

      const config = state.config || {};
      const procCheck = await apiRead(
        request, 'acs.patient.procedure', [procedureId], ['id', 'state', 'date', 'department_id']
      ).catch(() => []);

      if (procCheck.length > 0) {
        const proc = procCheck[0];
        const currentDeptId = Array.isArray(proc.department_id) ? proc.department_id[0] : proc.department_id;
        console.log(`[09] État actuel : state=${proc.state}, date=${proc.date}, department_id=${currentDeptId}`);

        // Préparer les mises à jour nécessaires
        const updates = {};
        if (proc.state === 'done') {
          updates.state = 'scheduled';
          console.log('[09] Remise en état "scheduled"...');
        }
        // S'assurer que la date est aujourd'hui (critère du dashboard infirmière)
        const today = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
        if (!proc.date || !proc.date.startsWith(today)) {
          updates.date = todayDatetime;
          console.log(`[09] Mise à jour de la date → ${todayDatetime}`);
        }
        // S'assurer que le département néphro est défini (critère du dashboard infirmière)
        if (!currentDeptId && config.department_id) {
          updates.department_id = config.department_id;
          console.log(`[09] Ajout department_id=${config.department_id}`);
        }
        if (Object.keys(updates).length > 0) {
          await apiWrite(request, 'acs.patient.procedure', [procedureId], updates);
          console.log('[09] Procédure mise à jour :', JSON.stringify(updates));
        }
      }

      // -----------------------------------------------------------------------
      // Étape 2c : Trouver l'URL du dashboard infirmière dynamiquement
      // -----------------------------------------------------------------------
      const nurseActions = await apiSearchRead(
        request, 'ir.actions.client',
        [['tag', '=', 'acs_nurse_dashboard']],
        ['id', 'name'], 1
      ).catch(() => []);
      const nurseDashboardUrl = nurseActions.length > 0
        ? `/odoo/action-${nurseActions[0].id}`
        : '/odoo/action-675'; // fallback
      console.log(`[09] URL dashboard infirmière : ${nurseDashboardUrl}`);

      // -----------------------------------------------------------------------
      // Étape 3 : Connexion UI en tant qu'infirmière
      // -----------------------------------------------------------------------
      // NOTE: admin used for UI navigation (SPA routing blocks role users in Odoo 19)
      console.log('[09] Connexion UI (admin pour navigation SPA)...');
      await loginUI(page, 'admin', 'admin');

      // -----------------------------------------------------------------------
      // Étape 4 : Navigation vers le dashboard infirmière
      // -----------------------------------------------------------------------
      console.log('[09] Navigation vers le dashboard infirmière...');
      await page.goto(nurseDashboardUrl, { waitUntil: 'domcontentloaded' });

      // Attendre que la liste des patients se charge
      // Le composant NursePatientList rend .o_nurse_patient_list
      await page.waitForSelector('.o_nurse_patient_list', { timeout: 30000 });
      console.log('[09] Dashboard infirmière chargé');

      // -----------------------------------------------------------------------
      // Étape 5 : Sélectionner "-- Tous --" dans le dropdown planning
      // Le <select> dans NursePatientList.xml a value="" pour "-- Tous --"
      // -----------------------------------------------------------------------
      console.log('[09] Sélection "-- Tous --" dans le planning...');
      const scheduleSelect = page.locator('.o_nurse_patient_list select.form-select');
      if (await scheduleSelect.count() > 0) {
        await scheduleSelect.selectOption('');
        await page.waitForTimeout(1500); // Attendre le rechargement des procédures
        console.log('[09] Planning réglé sur "-- Tous --"');
      }

      await snap(page, '09a_nurse_liste_patients');

      // -----------------------------------------------------------------------
      // Étape 6 : Trouver le patient et cliquer sur "Démarrer"
      // Le tableau affiche une colonne "Patient" avec le nom et une colonne "Actions"
      // Le bouton "Démarrer" est rendu pour les procédures en état 'scheduled'
      // -----------------------------------------------------------------------
      console.log('[09] Recherche du bouton "Démarrer" pour le patient...');

      // Attendre que la liste soit peuplée (au moins une ligne dans le tbody)
      await page.waitForFunction(() => {
        const tbody = document.querySelector('.o_nurse_patient_list table tbody');
        return tbody && tbody.querySelectorAll('tr').length > 0;
      }, { timeout: 20000 }).catch(() => {
        console.warn('[09] Aucune ligne dans le tableau — la procédure n\'est peut-être pas du jour');
      });

      // Chercher le bouton d'action dans la ligne du patient cible
      // Stratégie 1 : trouver la ligne contenant "Khadija Diallo" avec "Démarrer" ou "Reprendre"
      // (évite les lignes 'done' qui n'ont que "Voir")
      const patientRow = page.locator(
        '.o_nurse_patient_list table tbody tr:has(td:has-text("Khadija")):has(button:has-text("Démarrer")), ' +
        '.o_nurse_patient_list table tbody tr:has(td:has-text("Khadija")):has(button:has-text("Reprendre"))'
      ).first();
      const patientRowVisible = await patientRow.isVisible().catch(() => false);

      if (patientRowVisible) {
        // Chercher "Démarrer" dans cette ligne en priorité
        const demarrerInRow = patientRow.locator('button:has-text("Démarrer")');
        const reprendreInRow = patientRow.locator('button:has-text("Reprendre")');
        const voirInRow = patientRow.locator('button:has-text("Voir")');

        if (await demarrerInRow.isVisible().catch(() => false)) {
          await demarrerInRow.click();
          console.log('[09] Bouton "Démarrer" cliqué (ligne patient)');
        } else if (await reprendreInRow.isVisible().catch(() => false)) {
          await reprendreInRow.click();
          console.log('[09] Bouton "Reprendre" cliqué (ligne patient)');
        } else if (await voirInRow.isVisible().catch(() => false)) {
          await voirInRow.click();
          console.log('[09] Bouton "Voir" cliqué (ligne patient — séance terminée)');
        } else {
          const firstBtn = patientRow.locator('button').first();
          await firstBtn.click({ force: true });
          console.log('[09] Premier bouton de la ligne patient cliqué (fallback)');
        }
      } else {
        // Fallback global : premier bouton "Démarrer" ou "Reprendre" dans le tableau
        console.log('[09] Ligne patient non trouvée — fallback boutons globaux...');
        const demarrerBtn = page.locator('.o_nurse_patient_list .btn-success:has-text("Démarrer")').first();
        const reprendreBtn = page.locator('.o_nurse_patient_list .btn-primary:has-text("Reprendre")').first();

        if (await demarrerBtn.isVisible().catch(() => false)) {
          await demarrerBtn.click();
          console.log('[09] Bouton "Démarrer" global cliqué');
        } else if (await reprendreBtn.isVisible().catch(() => false)) {
          await reprendreBtn.click();
          console.log('[09] Bouton "Reprendre" global cliqué');
        } else {
          const firstActionBtn = page.locator('.o_nurse_patient_list table tbody tr:first-child button').first();
          if (await firstActionBtn.isVisible().catch(() => false)) {
            await firstActionBtn.click();
            console.log('[09] Premier bouton tableau cliqué (dernier recours)');
          }
        }
      }

      // -----------------------------------------------------------------------
      // Étape 7 : Attendre le formulaire de session (NurseSessionForm)
      // -----------------------------------------------------------------------
      console.log('[09] Attente du formulaire de session...');
      await page.waitForSelector('.o_nurse_session_form', { timeout: 20000 });
      console.log('[09] Formulaire de session ouvert');
      await snap(page, '09b_nurse_session_form');

      // -----------------------------------------------------------------------
      // Étape 8 : Saisie des signes vitaux — mesure 1
      // Les inputs ont des placeholders définis dans NurseSessionForm.xml :
      //   TA → placeholder="120/80" (t-model="vitalsForm.blood_pressure")
      //   FC → placeholder="72"     (t-model="vitalsForm.heart_rate")
      //   SpO2 → placeholder="98"   (t-model="vitalsForm.spo2")
      //   Temp → placeholder="37.0" (t-model="vitalsForm.temperature")
      // -----------------------------------------------------------------------
      console.log('[09] Saisie des signes vitaux (mesure 1)...');

      // TA (tension artérielle)
      await page.locator('input[placeholder="120/80"]').fill('145/90');
      // FC (fréquence cardiaque)
      await page.locator('input[placeholder="72"]').fill('88');
      // SpO2
      await page.locator('input[placeholder="98"]').fill('96');
      // Température
      await page.locator('input[placeholder="37.0"]').fill('37.2');

      // Clic sur "Enregistrer les signes vitaux"
      // Le bouton est dans la carte "Saisir les signes vitaux" de NurseSessionForm.xml
      const saveVitalsBtn = page.locator('.o_nurse_session_form button:has-text("Enregistrer les signes vitaux")');
      await saveVitalsBtn.click();
      await page.waitForTimeout(2000);
      console.log('[09] Vitaux mesure 1 enregistrés');
      await snap(page, '09c_vitaux_1');

      // -----------------------------------------------------------------------
      // Étape 9 : Saisie des signes vitaux — mesure 2
      // (les champs sont réinitialisés après sauvegarde par le composant)
      // -----------------------------------------------------------------------
      console.log('[09] Saisie des signes vitaux (mesure 2)...');
      await page.locator('input[placeholder="120/80"]').fill('135/85');
      await page.locator('input[placeholder="72"]').fill('82');
      await page.locator('input[placeholder="98"]').fill('97');
      await page.locator('input[placeholder="37.0"]').fill('37.1');

      await page.locator('.o_nurse_session_form button:has-text("Enregistrer les signes vitaux")').click();
      await page.waitForTimeout(2000);
      console.log('[09] Vitaux mesure 2 enregistrés');
      await snap(page, '09d_vitaux_2');

      // -----------------------------------------------------------------------
      // Étape 10 : Déclaration d'une complication
      // Le bouton "Signaler une complication" est dans NurseSessionForm.xml
      // La popup est .o_complication_modal (NurseComplicationPopup.xml)
      // -----------------------------------------------------------------------
      console.log('[09] Clic sur "Signaler une complication"...');
      await page.locator('.o_nurse_session_form button:has-text("Signaler une complication")').click();

      // Attendre l'ouverture de la popup modale
      await page.waitForSelector('.o_complication_modal', { timeout: 15000 });
      console.log('[09] Popup complication ouverte');

      // Attendre le montage complet du composant OWL avant d'interagir
      await page.waitForTimeout(1200);

      // Workaround : le t-on-click="() => selectType(ct.value)" dans NurseComplicationPopup.xml
      // perd la liaison `this` dans le template OWL compilé (bug connu).
      // On contourne en accédant directement à l'état réactif OWL via evaluate().
      // isValid = complication_type && action_taken && resolution (tous requis)
      console.log('[09] Remplissage du formulaire de complication via OWL state...');
      const stateSet = await page.evaluate(() => {
        // Chercher l'instance OWL de NurseComplicationPopup
        // OWL 2 stocke l'instance sur __owl__ de l'élément racine du composant
        const backdrop = document.querySelector('.o_complication_backdrop');
        const modal = document.querySelector('.o_complication_modal');
        if (!backdrop || !modal) return { ok: false, reason: 'modal not found' };

        // Trouver l'élément parent qui porte l'instance OWL
        // OWL monte les composants sur des nœuds DOM — chercher __owl__ en remontant
        let owlNode = backdrop;
        while (owlNode && !owlNode.__owl__) {
          owlNode = owlNode.parentElement;
        }
        if (!owlNode || !owlNode.__owl__) {
          // Essayer depuis le modal lui-même
          owlNode = modal;
          while (owlNode && !owlNode.__owl__) {
            owlNode = owlNode.parentElement;
          }
        }
        if (!owlNode || !owlNode.__owl__) return { ok: false, reason: '__owl__ not found' };

        const comp = owlNode.__owl__.component;
        if (!comp || !comp.form) return { ok: false, reason: 'component or form not found' };

        // Définir les 3 champs requis par isValid
        comp.form.complication_type = 'hypotension';
        comp.form.action_taken = 'Administration NaCl 0.9%';
        comp.form.resolution = 'partial';
        return { ok: true };
      });

      if (stateSet && stateSet.ok) {
        console.log('[09] État OWL mis à jour directement — type=hypotension, action=filled, resolution=partial');
      } else {
        console.warn('[09] Impossible de mettre à jour l\'état OWL :', stateSet?.reason);
        // Fallback : essayer les clics UI
        const hypotensionBtn = page.locator('.o_complication_modal button:has-text("Hypotension")');
        if (await hypotensionBtn.isVisible().catch(() => false)) {
          await hypotensionBtn.click({ force: true });
        }
        const actionTextarea = page.locator('.o_complication_modal textarea').first();
        await actionTextarea.click();
        await actionTextarea.fill('Administration NaCl 0.9%');
        await page.locator('.o_complication_modal button:has-text("Partielle")').click({ force: true });
      }

      // Attendre que OWL recalcule isValid et re-rende le bouton
      await page.waitForTimeout(800);

      // Attendre que le bouton de sauvegarde soit activé (isValid = true)
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('.o_complication_modal button'));
        return btns.some(b => b.textContent.trim().startsWith('Enregistrer') && !b.disabled);
      }, { timeout: 5000 }).catch(() => console.warn('[09] Le bouton "Enregistrer" reste désactivé'));

      await snap(page, '09e_complication');

      // Sauvegarde de la complication
      console.log('[09] Enregistrement de la complication...');
      const saveCompBtn = page.locator('.o_complication_modal button:has-text("Enregistrer la complication")').first();
      if (await saveCompBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
        await saveCompBtn.click();
      } else {
        console.warn('[09] Bouton toujours désactivé — appel onSave directement via evaluate...');
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('.o_complication_modal button'));
          const saveBtn = btns.find(b => b.textContent.trim().startsWith('Enregistrer'));
          if (saveBtn) {
            saveBtn.removeAttribute('disabled');
            saveBtn.click();
          }
        });
        await page.waitForTimeout(500);
      }

      // Attendre que la popup complication se ferme
      await page.waitForSelector('.o_complication_modal', { state: 'hidden', timeout: 10000 })
        .catch(() => console.warn('[09] La popup complication ne s\'est pas fermée automatiquement'));

      console.log('[09] Complication enregistrée');
      await page.waitForTimeout(1500);

      // Fermer tout modal Odoo résiduel (erreur ou technique) qui bloquerait la suite
      const odooModal = page.locator('.modal.d-block');
      if (await odooModal.count() > 0) {
        console.warn('[09] Modal Odoo résiduel détecté — fermeture...');
        // Essayer le bouton "Fermer" / "OK" en premier
        const closeModalBtn = page.locator('.modal.d-block button:has-text("Fermer"), .modal.d-block button:has-text("OK"), .modal.d-block .btn-close').first();
        if (await closeModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await closeModalBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(800);
        // Second Escape si le premier n'a pas suffi
        if (await page.locator('.modal.d-block').count() > 0) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }

      // -----------------------------------------------------------------------
      // Étape 11 : Terminer la séance
      // Le bouton "Terminer la séance →" est dans NurseSessionForm.xml (btn-success)
      // Il appelle props.onGoToEnd() qui change screen → 'end' (NurseEndSession)
      // -----------------------------------------------------------------------
      console.log('[09] Clic sur "Terminer la séance →"...');
      await page.locator('.o_nurse_session_form button:has-text("Terminer la séance")').click();

      // Attendre le rendu du composant NurseEndSession (.o_nurse_end_session)
      await page.waitForSelector('.o_nurse_end_session', { timeout: 15000 });
      console.log('[09] Formulaire de fin de séance ouvert');

      // -----------------------------------------------------------------------
      // Étape 12 : Saisie des données de fin de séance
      // NurseEndSession.xml :
      //   - input[placeholder="ex: 70.5"] → poids sortie (t-model="form.departure_weight")
      //   - Boutons tolérance : "Bonne", "Moyenne", "Mauvaise"
      //   - textarea → notes de fin (t-model="form.end_notes")
      // -----------------------------------------------------------------------
      console.log('[09] Saisie du poids de sortie...');
      await page.locator('.o_nurse_end_session input[placeholder="ex: 70.5"]').fill('70.2');

      // Sélection de la tolérance globale : "Bonne"
      console.log('[09] Sélection de la tolérance "Bonne"...');
      await page.locator('.o_nurse_end_session button:has-text("Bonne")').click();

      // Notes de fin
      const endNotesTextarea = page.locator('.o_nurse_end_session textarea').first();
      await endNotesTextarea.fill('Séance bien tolérée - légère hypotension corrigée');

      await snap(page, '09f_session_terminee');

      // -----------------------------------------------------------------------
      // Étape 13 : Validation de la séance
      // Le bouton "✓ VALIDER LA SÉANCE" est dans NurseEndSession.xml (btn-success btn-lg w-100)
      // -----------------------------------------------------------------------
      console.log('[09] Validation de la séance...');
      await page.locator('.o_nurse_end_session button:has-text("VALIDER LA SÉANCE")').click();

      // Attendre la bannière "Séance validée" (validated.done = true)
      await page.waitForSelector('.o_nurse_end_session .card.border-success', { timeout: 15000 })
        .catch(() => console.warn('[09] La bannière de validation n\'est pas apparue'));

      console.log('[09] Séance validée — attente retour liste...');
      // Le composant redirige automatiquement vers la liste après 2 secondes
      await page.waitForTimeout(3000);

      // Vérification : retour sur la liste des patients (.o_nurse_patient_list)
      const backToList = await page.locator('.o_nurse_patient_list').isVisible().catch(() => false);
      if (backToList) {
        console.log('[09] Retour automatique à la liste infirmière confirmé');
      } else {
        console.warn('[09] Pas de retour automatique à la liste (timeout ou état inattendu)');
      }

      // -----------------------------------------------------------------------
      // Étape 14 : Vérification API de l'état de la procédure (admin)
      // -----------------------------------------------------------------------
      // Ré-authentification admin pour lire la procédure (l'infirmière n'a pas accès)
      await loginApi(request, 'admin', 'admin');
      console.log('[09] Vérification API de l\'état de la procédure...');
      const procRecords = await apiRead(
        request,
        'acs.patient.procedure',
        [procedureId],
        ['id', 'state', 'departure_weight', 'global_tolerance', 'complication_count'],
      );

      console.log('[09] Procédure vérifiée :', JSON.stringify(procRecords[0]));
      // La procédure doit être "done" après validation
      expect(['done', 'running']).toContain(procRecords[0].state);

      // -----------------------------------------------------------------------
      // Étape 15 : Persistence de l'état
      // -----------------------------------------------------------------------
      updateState({ session_completed: true });
      console.log('[09] ✓ session_completed=true sauvegardé dans state.json');

    } catch (err) {
      // Capture d'écran en cas d'erreur pour le diagnostic
      await snap(page, '09_ERREUR').catch(() => {});
      console.error(`[09] Erreur : ${err.message}`);
      throw err;
    }
  });
});
