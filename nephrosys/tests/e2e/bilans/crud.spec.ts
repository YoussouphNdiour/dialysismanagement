import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', 'Nephro2024!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Bilans biologiques', () => {
  test('admin voit la liste des bilans', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Bilans');
    await expect(page.locator('h1:has-text("Bilans biologiques")')).toBeVisible();
  });

  test('admin cree un bilan', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Bilans');
    await page.click('text=Nouveau bilan');

    await page.selectOption('select:near(:text("Patient"))', { index: 1 });
    await page.selectOption('select:near(:text("Medecin"))', { index: 1 });

    await page.click('button:has-text("Creer le bilan")');
    await page.waitForURL(/\/bilans\//, { timeout: 10000 });

    await expect(page.locator('text=BIO-')).toBeVisible();
  });

  test('remplir onglet hematologie et verifier badge', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Bilans');

    const firstOuvrir = page.locator('button:has-text("Ouvrir")').first();
    if (await firstOuvrir.isVisible()) {
      await firstOuvrir.click();
      await page.waitForURL(/\/bilans\//, { timeout: 10000 });

      // Fill hemoglobine with low value (< 10)
      await page.fill('input:near(:text("Hemoglobine"))', '8.5');
      await page.click('button:has-text("Enregistrer")');
      await expect(page.locator('text=Enregistre')).toBeVisible({ timeout: 5000 });

      // Reload and check badge
      await page.reload();
      await expect(page.locator('text=Hb: low')).toBeVisible({ timeout: 5000 });
    }
  });
});
