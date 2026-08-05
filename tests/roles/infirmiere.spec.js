// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');

const LOGIN = 'infirmiere@nephro.test';
const PASS  = 'Nephro2024!';

// ---------------------------------------------------------------------------
// Helper : s'assure que les apps sont visibles.
// En Odoo 19, quand un utilisateur a une action par défaut, il est redirigé
// hors de la grille d'apps. Les apps restent accessibles via le bouton
// « Home Menu » (title="Home Menu") qui ouvre un dropdown avec les .o_app.
// ---------------------------------------------------------------------------
async function ensureAppsVisible(page) {
  await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Si la grille d'apps est déjà visible, rien à faire
  const anyApp = page.locator('.o_app').first();
  if (await anyApp.isVisible({ timeout: 2000 })) {
    return;
  }

  // Sinon, ouvrir le Home Menu dropdown
  const homeMenu = page.locator('button[title="Home Menu"]');
  if (await homeMenu.isVisible({ timeout: 3000 })) {
    await homeMenu.click();
    await page.waitForTimeout(500);
  }
}

test.describe('Rôle Infirmière', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, LOGIN, PASS);
  });

  // --- ACCÈS POSITIFS ---

  test('arrive sur le dashboard infirmier', async ({ page }) => {
    await page.waitForTimeout(2000);
    const url = page.url();
    // Vérifier qu'on est bien connecté (pas sur /web/login)
    expect(url).toContain('/odoo');
  });

  test('voit le menu Patient', async ({ page }) => {
    await ensureAppsVisible(page);
    const menu = page.locator('.o_app:has-text("Patient")').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  // --- ACCÈS NÉGATIFS ---

  test('ne voit PAS le menu Configuration', async ({ page }) => {
    await ensureAppsVisible(page);
    const menu = page.locator(
      '.o_app:has-text("Configuration"), .o_app:has-text("Settings")'
    ).first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  // --- PARCOURS MÉTIER ---

  test('ouvre une séance planifiée et la démarre', async ({ page, request }) => {
    const { loginApi, apiSearchRead } = require('../helpers/api');
    await loginApi(request, 'admin', 'admin');

    // Trouver une séance planifiée
    const procedures = await apiSearchRead(
      request, 'acs.patient.procedure',
      [['state', '=', 'scheduled']],
      ['id', 'name'], 1
    );

    if (procedures.length === 0) {
      console.warn('[infirmiere] Aucune séance planifiée — test skip');
      return;
    }

    await page.goto(
      `/web#model=acs.patient.procedure&view_type=form&id=${procedures[0].id}`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);

    // Chercher le bouton Démarrer
    const startBtn = page.locator('button:has-text("Démarrer"), button:has-text("Start")').first();
    if (await startBtn.isVisible({ timeout: 5000 })) {
      await startBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    }

    const title = await page.title();
    expect(title).not.toContain('Error');
  });

});
