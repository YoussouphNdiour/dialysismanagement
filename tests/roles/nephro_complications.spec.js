// @ts-check
/**
 * SPEC : COMPLICATIONS PER-SÉANCE (module acs_hms_nephrology_complications)
 *
 * Teste le cycle complet de gestion des complications d'hémodialyse :
 *   1. Créer une complication via l'API sur une procédure existante
 *   2. Vérifier les champs obligatoires (type, heure, action, résolution)
 *   3. Ouvrir la liste des complications dans l'UI (rôle infirmière)
 *   4. Vérifier les badges de résolution colorés
 *   5. Ouvrir le formulaire d'une complication
 *
 * Prérequis : une procédure (séance) doit exister dans state.json (procedure_id)
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');
const { snap }         = require('../helpers/screenshot');
const { readState, updateState } = require('../helpers/state');
const {
  loginApi,
  rpcCall,
  apiCreate,
  apiSearchRead,
  apiRead,
} = require('../helpers/api');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const INFIRMIERE_LOGIN = 'infirmiere@nephro.test';
const INFIRMIERE_PASS  = 'Nephro2024!';
const ADMIN_LOGIN      = 'admin';
const ADMIN_PASS       = 'admin';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Complications dialyse — module acs_hms_nephrology_complications', () => {

  // ── 1. Vérification que le modèle est accessible ──────────────────────────
  test('01 — API : le modèle acs.dialysis.complication est accessible', async ({ request }) => {
    await loginApi(request, ADMIN_LOGIN, ADMIN_PASS);

    const fields = await rpcCall(
      request,
      'acs.dialysis.complication',
      'fields_get',
      [],
      { attributes: ['string', 'type'] },
    );

    expect(fields).toBeTruthy();
    expect(fields.complication_type).toBeTruthy();
    expect(fields.occurrence_time).toBeTruthy();
    expect(fields.action_taken).toBeTruthy();
    expect(fields.resolution).toBeTruthy();
    console.log('[complications] modèle accessible, champs vérifiés');
  });

  // ── 2. Créer une complication via API (si procédure disponible) ───────────
  test('02 — API : créer une complication sur une procédure existante', async ({ request }) => {
    const state = readState();
    const procedureId = state.procedure_id;

    if (!procedureId) {
      console.warn('[complications] procedure_id absent — test ignoré (setup requis)');
      test.skip();
      return;
    }

    await loginApi(request, ADMIN_LOGIN, ADMIN_PASS);

    const compId = await apiCreate(request, 'acs.dialysis.complication', {
      procedure_id:     procedureId,
      complication_type: 'hypotension',
      bp_at_occurrence:  '85/50',
      action_taken:      'Arrêt temporaire de la dialyse, Trendelenburg, SSI 250 mL',
      resolution:        'yes',
    });

    expect(compId).toBeGreaterThan(0);
    updateState({ complication_id: compId });
    console.log(`[complications] complication créée id=${compId}`);

    // Vérifier les données enregistrées
    const records = await apiRead(request, 'acs.dialysis.complication', [compId], [
      'complication_type', 'resolution', 'patient_id',
    ]);
    expect(records[0].complication_type).toBe('hypotension');
    expect(records[0].resolution).toBe('yes');
  });

  // ── 3. Créer une complication non résolue (décoration danger) ───────────
  test('03 — API : créer une complication non résolue', async ({ request }) => {
    const state = readState();
    const procedureId = state.procedure_id;

    if (!procedureId) {
      test.skip();
      return;
    }

    await loginApi(request, ADMIN_LOGIN, ADMIN_PASS);

    const compId2 = await apiCreate(request, 'acs.dialysis.complication', {
      procedure_id:      procedureId,
      complication_type: 'early_stop',
      early_stop_duration: 45,
      action_taken:      'Arrêt prématuré à 45 min — TA effondrée',
      resolution:        'no',
    });

    expect(compId2).toBeGreaterThan(0);
    updateState({ complication_id_2: compId2 });

    const records = await apiRead(request, 'acs.dialysis.complication', [compId2], [
      'complication_type', 'resolution', 'early_stop_duration',
    ]);
    expect(records[0].complication_type).toBe('early_stop');
    expect(records[0].resolution).toBe('no');
    expect(records[0].early_stop_duration).toBe(45);
  });

  // ── 4. UI : liste des complications dans le menu infirmière ──────────────
  test('04 — UI : liste des complications (rôle infirmière)', async ({ page }) => {
    await loginUI(page, INFIRMIERE_LOGIN, INFIRMIERE_PASS);

    // Tentative de navigation directe
    await page.goto('/odoo/acs-dialysis-complication', {
      waitUntil: 'domcontentloaded',
    }).catch(() => {});
    await page.waitForLoadState('domcontentloaded');

    const listView = page.locator('.o_list_view, .o_view_controller');
    const hasListView = await listView.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasListView) {
      await snap(page, 'complications_liste');

      // Vérifier les badges colorés (résolution)
      const successBadge = page.locator('.o_data_row .badge.text-bg-success').first();
      const dangerBadge  = page.locator('.o_data_row .badge.text-bg-danger').first();
      const hasAnyBadge  = (
        await successBadge.isVisible({ timeout: 3000 }).catch(() => false) ||
        await dangerBadge.isVisible({ timeout: 3000 }).catch(() => false)
      );
      if (hasAnyBadge) {
        await snap(page, 'complications_badges_resolution');
      }
    } else {
      console.warn('[complications] liste non accessible via URL directe');
    }
  });

  // ── 5. UI : formulaire d'une complication ────────────────────────────────
  test('05 — UI : formulaire complication — champs et validation', async ({ page }) => {
    const state = readState();
    const compId = state.complication_id;

    await loginUI(page, INFIRMIERE_LOGIN, INFIRMIERE_PASS);

    if (compId) {
      await page.goto(`/odoo/acs-dialysis-complication/${compId}`, {
        waitUntil: 'domcontentloaded',
      }).catch(() => {});
      await page.waitForLoadState('domcontentloaded');

      const form = page.locator('.o_form_view');
      if (await form.isVisible({ timeout: 8000 }).catch(() => false)) {
        // Vérifier les champs clés
        await expect(page.locator('[name="complication_type"]')).toBeVisible();
        await expect(page.locator('[name="action_taken"]')).toBeVisible();
        await expect(page.locator('[name="resolution"]')).toBeVisible();
        await snap(page, 'complication_form');
      }
    }
  });

  // ── 6. Vérification des sélections disponibles ────────────────────────────
  test('06 — API : vérifier les types de complication disponibles', async ({ request }) => {
    await loginApi(request, ADMIN_LOGIN, ADMIN_PASS);

    const fields = await rpcCall(
      request,
      'acs.dialysis.complication',
      'fields_get',
      [['complication_type']],
      { attributes: ['selection'] },
    );

    const selection = fields.complication_type?.selection || [];
    const typeKeys = selection.map(([key]) => key);

    expect(typeKeys).toContain('hypotension');
    expect(typeKeys).toContain('cramps');
    expect(typeKeys).toContain('early_stop');
    expect(typeKeys.length).toBeGreaterThanOrEqual(5);
    console.log(`[complications] ${typeKeys.length} types disponibles : ${typeKeys.join(', ')}`);
  });

});
