import { test, expect } from '@playwright/test';

test.describe('Authentification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/web/session/logout').catch(() => {});
  });

  test('page de login affichee pour utilisateur non connecte', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1:has-text("NephroSys")')).toBeVisible();
  });

  test('login admin reussi', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[id="email"]', 'admin@nephro.test');
    await page.fill('input[id="password"]', 'Nephro2024!');
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 10000 });
    await expect(page.locator('text=Tableau de bord')).toBeVisible();
  });

  test('login echoue avec mauvais mot de passe', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[id="email"]', 'admin@nephro.test');
    await page.fill('input[id="password"]', 'wrong');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Email ou mot de passe incorrect')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('medecin ne voit pas le menu Admin', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[id="email"]', 'medecin@nephro.test');
    await page.fill('input[id="password"]', 'Nephro2024!');
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 10000 });
    await expect(page.locator('nav >> text=Utilisateurs')).not.toBeVisible();
    await expect(page.locator('nav >> text=Patients')).toBeVisible();
  });
});
