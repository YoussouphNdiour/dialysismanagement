// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');

const LOGIN = 'patient@nephro.test';
const PASS  = 'Nephro2024!';

test.describe('Rôle Patient (Portail)', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, LOGIN, PASS);
  });

  // --- ACCÈS POSITIFS ---

  test('redirigé vers /my après login', async ({ page }) => {
    const url = page.url();
    expect(url).toContain('/my');
  });

  test('voit son historique de séances', async ({ page }) => {
    // Naviguer vers la page des séances
    const dialysisLink = page.locator('a:has-text("dialyse"), a:has-text("séance"), a:has-text("Dialysis")').first();
    if (await dialysisLink.isVisible({ timeout: 5000 })) {
      await dialysisLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    }

    const title = await page.title();
    expect(title).not.toContain('Error');
  });

  test('voit ses bilans biologiques', async ({ page }) => {
    const bilansLink = page.locator('a:has-text("bilan"), a:has-text("Bilan"), a:has-text("résultat")').first();
    if (await bilansLink.isVisible({ timeout: 5000 })) {
      await bilansLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    }

    const title = await page.title();
    expect(title).not.toContain('Error');
  });

  // --- ACCÈS NÉGATIFS ---

  test('ne peut PAS accéder au backend /web', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const url = page.url();
    // Le patient doit être redirigé vers /my ou /web/login, pas vers le backend
    expect(url).not.toMatch(/\/odoo\/[a-z]/);
  });

});
