import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', 'Nephro2024!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Configuration seuils', () => {
  test('admin voit la page configuration', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.goto('/admin/configuration');
    await expect(page.locator('h1:has-text("Configuration")')).toBeVisible();
    await expect(page.locator('text=Hemoglobine')).toBeVisible({ timeout: 10000 });
  });

  test('admin modifie un seuil', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.goto('/admin/configuration');

    // Click modify on first row
    const firstModifier = page.locator('button:has-text("Modifier")').first();
    await firstModifier.click();

    // Should show input fields
    await expect(page.locator('input[type="number"]').first()).toBeVisible();
  });
});
