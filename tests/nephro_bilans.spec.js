// @ts-check
/**
 * nephro_bilans.spec.js — Tests E2E des Bilans Biologiques
 *
 * Standalone. Patient cible : Seynabou Diouf (id=9).
 *
 * Couverture :
 *   1. Cr\u00e9er un bilan Pr\u00e9-dialyse via API, v\u00e9rifier les statuts calcul\u00e9s
 *   2. V\u00e9rifier que le bilan appara\u00eet dans action-573 avec badges statut
 *   3. V\u00e9rifier que le bouton "Imprimer" est visible sur le formulaire de bilan
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { loginApi, apiCreate, apiSearchRead, apiRead } = require('./helpers/api');
const { loginUI } = require('./helpers/auth');
const { snap } = require('./helpers/screenshot');

const PATIENT_ID = 9; // Seynabou Diouf
const ADMIN_LOGIN = 'admin';
const ADMIN_PASSWORD = 'admin';

function todayDatetime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} 08:00:00`;
}

test.describe('Bilans Biologiques \u2014 N\u00e9phropathie', () => {

  test('Cr\u00e9er un bilan Pr\u00e9-dialyse et v\u00e9rifier les statuts Hb calcul\u00e9s', async ({ page, request }) => {
    test.setTimeout(120000);

    // \u2500\u2500\u2500 \u00c9tape 1 : Cr\u00e9er le bilan via API \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    await loginApi(request, ADMIN_LOGIN, ADMIN_PASSWORD);

    const bilanId = await apiCreate(request, 'acs.nephro.bilan', {
      patient_id: PATIENT_ID,
      exam_date:  todayDatetime(),
      bilan_type: 'predialysis',
      hemoglobin:  8.5,   // < 10 \u2192 'low'
      potassium:   4.8,   // 3.5\u20135.5 \u2192 'ok'
      phosphorus:  2.1,   // > 1.8 \u2192 'high'
      albumin:    34.0,   // < 35 \u2192 'low'
    });
    console.log('[bilans] bilan cr\u00e9\u00e9 id=', bilanId);
    expect(bilanId).toBeGreaterThan(0);

    // \u2500\u2500\u2500 \u00c9tape 2 : V\u00e9rifier les statuts calcul\u00e9s via API \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const bilans = await apiRead(request, 'acs.nephro.bilan', [bilanId], [
      'id', 'name', 'hemoglobin_status', 'potassium_status', 'phosphorus_status', 'albumin_status',
    ]);
    expect(bilans).toHaveLength(1);
    const b = bilans[0];
    expect(b.hemoglobin_status).toBe('low');
    expect(b.potassium_status).toBe('ok');
    expect(b.phosphorus_status).toBe('high');
    expect(b.albumin_status).toBe('low');
    console.log('[bilans] statuts v\u00e9rifi\u00e9s :', b);

    // \u2500\u2500\u2500 \u00c9tape 3 : V\u00e9rifier dans l\u2019UI (onglet Bilans Biologiques) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    await loginUI(page, ADMIN_LOGIN, ADMIN_PASSWORD);
    await page.goto(`/odoo/almightyhms-patient/${PATIENT_ID}`, { waitUntil: 'domcontentloaded' });

    // Ouvrir l'onglet Bilans Biologiques ou le smart button
    const bilanTab = page.locator(
      '.o_notebook .nav-link:has-text("Bilans"), .nav-link:has-text("Bilans Biologiques")'
    ).first();
    if (await bilanTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bilanTab.click();
      await page.waitForTimeout(800);
      console.log('[bilans] onglet Bilans Biologiques ouvert');
    }

    await snap(page, 'nephro_bilans_patient_tab');

    // \u2500\u2500\u2500 \u00c9tape 4 : V\u00e9rifier bouton Imprimer sur le formulaire du bilan \u2500\u2500\u2500\u2500\u2500\u2500
    await page.goto(`/odoo/action-573/${bilanId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    const printBtn = page.locator(
      'button:has-text("Imprimer"), button:has-text("Print"), .o_form_button_print'
    ).first();
    const hasPrintBtn = await printBtn.isVisible({ timeout: 8000 }).catch(() => false);
    await snap(page, 'nephro_bilan_form_print');
    expect(hasPrintBtn, 'Bouton Imprimer doit \u00eatre visible').toBeTruthy();

    console.log('[bilans] Test termin\u00e9 avec succ\u00e8s');
  });

  test('V\u00e9rifier que la liste action-573 affiche des badges de statut', async ({ page, request }) => {
    test.setTimeout(60000);

    await loginApi(request, ADMIN_LOGIN, ADMIN_PASSWORD);

    const bilans = await apiSearchRead(request, 'acs.nephro.bilan',
      [['patient_id', '=', PATIENT_ID]],
      ['id', 'name', 'hemoglobin_status'],
      5
    );
    expect(bilans.length).toBeGreaterThan(0);
    console.log('[bilans] bilans trouv\u00e9s :', bilans.length);

    await loginUI(page, ADMIN_LOGIN, ADMIN_PASSWORD);
    await page.goto('/odoo/action-573', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.o_data_row', { timeout: 15000 });

    const badges = page.locator('.o_field_badge, .badge, [class*="badge"]');
    const badgeCount = await badges.count();
    console.log('[bilans] badges trouv\u00e9s :', badgeCount);
    await snap(page, 'nephro_bilans_liste_badges');
    expect(badgeCount).toBeGreaterThan(0);

    console.log('[bilans] Badges visibles dans la liste');
  });

});
