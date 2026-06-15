// @ts-check
/**
 * Configuration Playwright pour la suite E2E du module néphro Odoo 19.
 * Exécution séquentielle (1 worker) pour respecter l'ordre des fixtures
 * et éviter les conflits de session sur la même base de données.
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Répertoire racine pour la découverte des tests
  testDir: '.',

  // Exécution séquentielle obligatoire : les tests dépendent les uns des autres
  // via state.json (IDs créés dans le setup sont lus dans les tests suivants)
  fullyParallel: false,
  workers: 1,

  // Pas de retry en CI pour garder des rapports lisibles
  retries: 0,

  // Timeout global par test (90 secondes — Odoo peut être lent au premier chargement)
  timeout: 90000,

  reporter: [
    // Rapport HTML interactif généré dans playwright-report/ à la racine du projet
    ['html', { outputFolder: '../playwright-report', open: 'never' }],
    // Sortie console en temps réel pour suivre l'avancement
    ['list'],
  ],

  use: {
    // URL de base de l'instance Odoo locale
    baseURL: 'http://localhost:8069',

    // Mode non-headless pour faciliter le débogage visuel
    headless: false,

    // Capture d'écran uniquement en cas d'échec
    screenshot: 'only-on-failure',

    // Pas de vidéo pour éviter l'overhead disque
    video: 'off',

    // Timeout pour chaque action Playwright (clic, fill, etc.)
    actionTimeout: 20000,

    // Timeout pour les navigations et les attentes de réseau
    navigationTimeout: 45000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Résolution large pour afficher tous les éléments du dashboard
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
