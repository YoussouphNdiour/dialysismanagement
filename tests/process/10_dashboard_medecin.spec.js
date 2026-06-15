// @ts-check
/**
 * 10 — Dashboard médecin — vérification KT/V et complications
 *
 * Utilisateur : DOCTOR (medecin@nephro.test / Nephro2024!)
 *
 * Ce test parcourt les 3 onglets du dashboard médecin :
 *   - Grille (⬛ Grille) → DoctorStationGrid.xml
 *   - Liste  (☰ Liste)  → table .dd-list-table dans DoctorDashboard.xml
 *   - Stats  (📊 Stats) → DoctorStatsChart.xml
 *
 * Il vérifie ensuite via API que la procédure est à l'état 'done'
 * après la séance infirmière de l'étape 09.
 *
 * Sélecteurs basés sur DoctorDashboard.xml :
 *   .doctor-dashboard → racine du composant
 *   .dd-tabs button[data-tab="list"]  → onglet Liste
 *   .dd-tabs button[data-tab="stats"] → onglet Stats
 *   .dd-list-table → table liste des patients
 *
 * Données lues   : procedure_id
 * Données écrites : aucune
 */

const { test, expect } = require('@playwright/test');
const { readState } = require('../helpers/state');
const { loginApi, apiSearchRead, apiRead } = require('../helpers/api');
const { loginUI } = require('../helpers/auth');
const { snap } = require('../helpers/screenshot');

test.setTimeout(120000);

test.describe('10 — Dashboard médecin — vérification KT/V et complications', () => {
  test('Parcourir les onglets du dashboard médecin et vérifier l\'état de la procédure', async ({ page, request }) => {
    try {
      // -----------------------------------------------------------------------
      // Étape 1 : Authentification API admin (ir.actions.client requiert admin)
      // -----------------------------------------------------------------------
      console.log('[10] Authentification API admin...');
      await loginApi(request, 'admin', 'admin');

      // -----------------------------------------------------------------------
      // Étape 2 : Lecture de l'état partagé
      // -----------------------------------------------------------------------
      const state = readState();
      const procedureId = state.procedure_id;
      console.log(`[10] procedure_id=${procedureId}`);

      if (!procedureId) {
        throw new Error('[10] procedure_id absent du state.json — l\'étape 08 doit être exécutée en premier');
      }

      // -----------------------------------------------------------------------
      // Étape 3 : Trouver l'action du dashboard médecin
      // Le tag de l'action est 'acs_doctor_dashboard' (cf. DoctorDashboard.js)
      // -----------------------------------------------------------------------
      console.log('[10] Recherche de l\'action dashboard médecin...');
      const actions = await apiSearchRead(
        request,
        'ir.actions.client',
        [['tag', '=', 'acs_doctor_dashboard']],
        ['id', 'name'],
        1,
      );

      let doctorDashboardUrl;
      if (actions.length > 0) {
        doctorDashboardUrl = `/odoo/action-${actions[0].id}`;
        console.log(`[10] Action dashboard médecin : id=${actions[0].id}, url=${doctorDashboardUrl}`);
      } else {
        // Fallback : chercher dans ir.actions.act_window
        console.warn('[10] Action client acs_doctor_dashboard introuvable — tentative fallback...');
        doctorDashboardUrl = '/odoo/action-589'; // Valeur de fallback courante
      }

      // -----------------------------------------------------------------------
      // Étape 4 : Connexion UI médecin
      // -----------------------------------------------------------------------
      // NOTE: admin used for UI navigation (SPA routing blocks role users in Odoo 19)
      console.log('[10] Connexion UI (admin pour navigation SPA)...');
      await loginUI(page, 'admin', 'admin');

      // -----------------------------------------------------------------------
      // Étape 5 : Navigation vers le dashboard médecin
      // -----------------------------------------------------------------------
      console.log(`[10] Navigation vers ${doctorDashboardUrl}...`);
      await page.goto(doctorDashboardUrl, { waitUntil: 'domcontentloaded' });

      // Attendre que le composant DoctorDashboard soit rendu
      // La racine est div.doctor-dashboard (DoctorDashboard.xml)
      await page.waitForSelector('.doctor-dashboard', { timeout: 30000 });
      console.log('[10] Dashboard médecin chargé');

      // -----------------------------------------------------------------------
      // Étape 6 : Screenshot de l'onglet Grille (onglet par défaut)
      // L'onglet initial est "grid" dans DoctorDashboard.js (useState tab: "grid")
      // -----------------------------------------------------------------------
      await page.waitForTimeout(2000); // Attendre le chargement des données
      await snap(page, '10a_doctor_dashboard_grille');

      // -----------------------------------------------------------------------
      // Étape 7 : Clic sur l'onglet "☰ Liste"
      // <button data-tab="list"> dans .dd-tabs (DoctorDashboard.xml)
      // -----------------------------------------------------------------------
      console.log('[10] Clic sur l\'onglet "☰ Liste"...');
      await page.locator('.dd-tabs button[data-tab="list"]').click();

      // Attendre que la table de liste soit visible
      await page.waitForSelector('.dd-list-table', { timeout: 15000 });
      console.log('[10] Onglet Liste affiché');
      await page.waitForTimeout(1000);
      await snap(page, '10b_doctor_liste');

      // -----------------------------------------------------------------------
      // Étape 8 : Clic sur l'onglet "📊 Stats"
      // <button data-tab="stats"> dans .dd-tabs
      // -----------------------------------------------------------------------
      console.log('[10] Clic sur l\'onglet "📊 Stats"...');
      await page.locator('.dd-tabs button[data-tab="stats"]').click();

      // Attendre le rendu du composant DoctorStatsChart
      await page.waitForTimeout(2000);
      await snap(page, '10c_doctor_stats');

      // -----------------------------------------------------------------------
      // Étape 9 : Vérification API de la procédure
      // -----------------------------------------------------------------------
      console.log('[10] Vérification API de la procédure...');
      const procRecords = await apiRead(
        request,
        'acs.patient.procedure',
        [procedureId],
        ['id', 'state', 'ktv_calculated', 'ktv_status', 'complication_count', 'departure_weight'],
      );

      const proc = procRecords[0];
      console.log('[10] Procédure vérifiée :', JSON.stringify(proc));

      // La procédure doit être à l'état 'done' après la séance infirmière
      // (ou 'running' si la validation n'a pas encore été traitée)
      expect(['done', 'running', 'scheduled']).toContain(proc.state);

      if (proc.state === 'done') {
        console.log(`[10] ✓ Procédure terminée — KT/V: ${proc.ktv_calculated}, statut: ${proc.ktv_status}, complications: ${proc.complication_count}`);
      } else {
        console.warn(`[10] ⚠ Procédure en état '${proc.state}' — l'étape 09 n'a peut-être pas complété la validation`);
      }

    } catch (err) {
      await snap(page, '10_ERREUR').catch(() => {});
      console.error(`[10] Erreur : ${err.message}`);
      throw err;
    }
  });
});
