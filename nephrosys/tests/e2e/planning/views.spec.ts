import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', 'Nephro2024!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Planning', () => {
  test('admin voit la vue grille par defaut', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Planning');
    await expect(page.locator('h1:has-text("Planning")')).toBeVisible();
    // Grid view is default
    await expect(page.locator('text=Matin')).toBeVisible({ timeout: 5000 });
  });

  test('switch entre les 3 vues', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Planning');

    // Calendar
    await page.click('button:has-text("Calendrier")');
    await expect(page.locator('text=Lun')).toBeVisible({ timeout: 5000 });

    // List
    await page.click('button:has-text("Liste")');
    // Should show list or empty message
    await expect(
      page.locator('text=Aucune affectation').or(page.locator('table'))
    ).toBeVisible({ timeout: 5000 });

    // Back to grid
    await page.click('button:has-text("Grille")');
    await expect(page.locator('text=Matin')).toBeVisible({ timeout: 5000 });
  });

  test('admin voit la page postes', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.goto('/planning/postes');
    await expect(page.locator('h1:has-text("Postes de dialyse")')).toBeVisible();
  });
});
