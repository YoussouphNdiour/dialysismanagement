// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');

const LOGIN = 'facturation@nephro.test';
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
  // Ouvrir le switcher via le bouton toggle de la nav principale
  const navToggle = page.locator('.o_main_navbar .o_menu_toggle').first();
  const navToggleFallback = page.locator('.o_main_navbar button').first();
  if (await navToggle.isVisible({ timeout: 2000 })) {
    await navToggle.click();
  } else {
    await navToggleFallback.click();
  }
  await page.waitForTimeout(1000);
}

test.describe('Rôle Facturation', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, LOGIN, PASS);
  });

  // --- ACCÈS POSITIFS ---

  test('voit le menu Facturation Dialyse', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await openAppSwitcherIfNeeded(page);
    const menu = page.locator(
      '.o_app:has-text("Facturation"), a.o_app:has-text("Facturation")'
    ).first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  // --- ACCÈS NÉGATIFS ---

  test('ne voit PAS le menu Clinique', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await openAppSwitcherIfNeeded(page);
    const menu = page.locator(
      '.o_app:has-text("Clinique"), a.o_app:has-text("Clinique")'
    ).first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  // --- PARCOURS MÉTIER ---

  test('accède à la liste des factures', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await openAppSwitcherIfNeeded(page);

    const factMenu = page.locator(
      '.o_app:has-text("Facturation"), a.o_app:has-text("Facturation")'
    ).first();
    await factMenu.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Vérifier que la page charge sans erreur
    const title = await page.title();
    expect(title).not.toContain('Error');
  });

});
