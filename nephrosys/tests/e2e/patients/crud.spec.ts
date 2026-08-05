import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', 'Nephro2024!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Patients CRUD', () => {
  test('admin voit la liste des patients', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Patients');
    await expect(page.locator('h1:has-text("Patients")')).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
  });

  test('admin cree un nouveau patient', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Patients');
    await page.click('text=Nouveau patient');

    await page.fill('input[id="nom"]', 'TestE2E');
    await page.fill('input[id="prenom"]', 'Patient');
    await page.selectOption('select[id="sexe"]', 'M');
    await page.fill('input[id="telephone"]', '+221770000000');

    await page.click('button:has-text("Creer le patient")');

    await page.waitForURL('/patients', { timeout: 10000 });
    await expect(page.locator('text=TestE2E')).toBeVisible({ timeout: 5000 });
  });

  test('recherche filtre les patients', async ({ page }) => {
    await loginAs(page, 'admin@nephro.test');
    await page.click('nav >> text=Patients');
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    await page.fill('input[placeholder="Rechercher un patient..."]', 'Diop');

    // Wait for filtered results to appear
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toContainText('Diop', { timeout: 5000 });
  });

  test('secretaire peut creer un patient', async ({ page }) => {
    await loginAs(page, 'secretaire@nephro.test');
    await page.click('nav >> text=Patients');
    await page.click('text=Nouveau patient');

    await page.fill('input[id="nom"]', 'SecrTest');
    await page.fill('input[id="prenom"]', 'Patient');

    await page.click('button:has-text("Creer le patient")');

    await page.waitForURL('/patients', { timeout: 10000 });
    await expect(page.locator('text=SecrTest')).toBeVisible({ timeout: 5000 });
  });
});
