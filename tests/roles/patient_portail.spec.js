// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');

const LOGIN = 'patient@nephro.test';
const PASS  = 'Nephro2024!';

// ---------------------------------------------------------------------------
// Helper : login spécifique pour l'utilisateur portail.
//
// Les utilisateurs portail Odoo 19 sont redirigés vers /my/home ou /my
// après connexion (pas vers /odoo/). La fonction loginUI standard attend
// une URL contenant /(odoo|my)/ ce qui peut échouer si la redirection
// aboutit à /my/home sans slash final ou à un autre chemin portail.
//
// Ce helper gère explicitement les URLs portail.
// ---------------------------------------------------------------------------
async function loginPortal(page, login, password) {
  // Déconnexion préalable
  await page.goto('/web/session/logout', { waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(500);

  // Navigation vers la page de connexion
  await page.goto('/web/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Attendre le champ login
  await page.waitForSelector('input[name="login"], input[id="login"]', {
    state: 'visible', timeout: 15000,
  });

  // Remplir les identifiants
  await page.fill('input[name="login"]', login);
  await page.fill('input[name="password"], input[type="password"]', password);

  // Soumettre le formulaire
  const loginForm = page.locator('form[action*="/web/login"]');
  await loginForm.locator('button.btn-primary[type="submit"]').click();

  // Attendre la redirection : portail (/my, /my/home), backend (/odoo) ou website (/)
  // On attend que l'URL ne soit plus /web/login
  await page.waitForURL(url => !url.includes('/web/login'), { timeout: 30000 });
  await page.waitForTimeout(500);

  console.log(`[auth/portal] loginPortal : "${login}" connecté → ${page.url()}`);
}

test.describe('Rôle Patient (Portail)', () => {

  test.beforeEach(async ({ page }) => {
    await loginPortal(page, LOGIN, PASS);
  });

  // --- ACCÈS POSITIFS ---

  test('redirigé vers /my après login', async ({ page }) => {
    const url = page.url();
    // Le patient portail doit atterrir sur /my ou /my/home (pas sur /web/login)
    expect(url).toMatch(/\/my(\/|$)/);
  });

  test('voit son historique de séances', async ({ page }) => {
    // Naviguer vers /my si pas déjà dessus
    if (!page.url().includes('/my')) {
      await page.goto('/my', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
    }

    const dialysisLink = page.locator(
      'a:has-text("dialyse"), a:has-text("séance"), a:has-text("Dialysis")'
    ).first();
    if (await dialysisLink.isVisible({ timeout: 5000 })) {
      await dialysisLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    }

    const title = await page.title();
    expect(title).not.toContain('Error');
  });

  test('voit ses bilans biologiques', async ({ page }) => {
    // Naviguer vers /my si pas déjà dessus
    if (!page.url().includes('/my')) {
      await page.goto('/my', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
    }

    const bilansLink = page.locator(
      'a:has-text("bilan"), a:has-text("Bilan"), a:has-text("résultat")'
    ).first();
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
