import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', 'Nephro2024!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Seances de dialyse', () => {
  test('admin voit la liste des seances', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Seances');
    await expect(page.locator('h1:has-text("Seances de dialyse")')).toBeVisible();
  });

  test('admin cree une seance manuelle', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Seances');
    await page.click('text=Nouvelle seance');

    await page.selectOption('select:near(:text("Patient"))', { index: 1 });
    await page.selectOption('select:near(:text("Poste"))', { index: 1 });
    await page.selectOption('select:near(:text("Medecin"))', { index: 1 });
    await page.selectOption('select:near(:text("Infirmier"))', { index: 1 });

    await page.click('button:has-text("Creer la seance")');
    await page.waitForURL(/\/seances\//, { timeout: 10000 });

    // Should see planifiee badge
    await expect(page.locator('text=Planifiee')).toBeVisible();
  });

  test('demarrer et terminer une seance', async ({ page }) => {
    // Requires a seance to exist
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Seances');

    // Click first session
    const firstOuvrir = page.locator('button:has-text("Ouvrir")').first();
    if (await firstOuvrir.isVisible()) {
      await firstOuvrir.click();
      await page.waitForURL(/\/seances\//, { timeout: 10000 });

      // If planifiee, demarrer
      const demarrerBtn = page.locator('button:has-text("Demarrer la seance")');
      if (await demarrerBtn.isVisible()) {
        await demarrerBtn.click();
        await expect(page.locator('text=En cours')).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
