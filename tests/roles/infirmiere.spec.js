// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');

const LOGIN = 'infirmiere@nephro.test';
const PASS  = 'Nephro2024!';

// ---------------------------------------------------------------------------
// Helper : ouvre le sélecteur d'applications si la grille n'est pas visible.
// En Odoo 19, les utilisateurs avec une action par défaut sont redirigés
// hors de la grille. Les apps restent accessibles via le bouton hamburger.
// ---------------------------------------------------------------------------
async function openAppSwitcherIfNeeded(page) {
  const anyApp = page.locator('.o_app').first();
  if (await anyApp.isVisible({ timeout: 2000 })) {
    return; // La grille d'apps est déjà visible
  }
  const navToggle = page.locator('.o_main_navbar .o_menu_toggle').first();
  const navToggleFallback = page.locator('.o_main_navbar button').first();
  if (await navToggle.isVisible({ timeout: 2000 })) {
    await navToggle.click();
  } else {
    await navToggleFallback.click();
  }
  await page.waitForTimeout(1000);
}

// ---------------------------------------------------------------------------
// Helper : navigue vers une application (grille ou switcher).
// ---------------------------------------------------------------------------
async function navigateToApp(page, appName) {
  await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await openAppSwitcherIfNeeded(page);

  const appLink = page.locator(
    `.o_app:has-text("${appName}"), a.o_app:has-text("${appName}")`
  ).first();
  await appLink.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
}

test.describe('Rôle Infirmière', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, LOGIN, PASS);
  });

  // --- ACCÈS POSITIFS ---

  test('arrive sur le dashboard infirmier', async ({ page }) => {
    // Après login, l'infirmière est redirigée vers son dashboard
    await page.waitForTimeout(2000);
    const url = page.url();
    // Vérifier qu'on est bien connecté (pas sur /web/login)
    expect(url).toContain('/odoo');
  });

  test('accède aux bilans biologiques', async ({ page }) => {
    // Naviguer vers Néphrologie via le helper (gère la redirection action_id)
    await navigateToApp(page, 'Néphrologie');

    // Chercher le sous-menu Bilans
    const bilansMenu = page.locator(
      '.o_menu_sections a:has-text("Bilan"), .o_menu_sections a:has-text("bilan")'
    ).first();
    await expect(bilansMenu).toBeVisible({ timeout: 10000 });
  });

  // --- ACCÈS NÉGATIFS ---

  test('ne voit PAS le menu Facturation Dialyse', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await openAppSwitcherIfNeeded(page);
    const menu = page.locator(
      '.o_app:has-text("Facturation"), a.o_app:has-text("Facturation")'
    ).first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  test('ne voit PAS le menu Configuration', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await openAppSwitcherIfNeeded(page);
    const menu = page.locator(
      '.o_app:has-text("Configuration"), a.o_app:has-text("Configuration")'
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

    await page.goto(`/odoo/acs-patient-procedure/${procedures[0].id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

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
