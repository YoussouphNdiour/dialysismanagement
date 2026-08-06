import { db } from './index';
import { tarifsBase, articles } from './schema';

async function seedPhase3() {
  console.log('Seeding Phase 3 data...');

  // Seed tarifs de base
  const tarifsData = [
    {
      label: 'Tarif seance standard',
      code: 'tarif_standard',
      montant: '25000',
    },
    {
      label: 'Tarif seance VIP',
      code: 'tarif_vip',
      montant: '40000',
    },
  ];

  for (const tarif of tarifsData) {
    await db.insert(tarifsBase).values(tarif).onConflictDoNothing();
  }
  console.log(`  ${tarifsData.length} tarifs created`);

  // Seed sample articles
  const articlesData = [
    {
      nom: 'Erythropoietine 4000 UI',
      categorie: 'medicament' as const,
      prixUnitaire: '15000',
      unite: 'UI',
      voieAdministration: 'SC',
    },
    {
      nom: 'Fer injectable (Venofer) 100mg',
      categorie: 'medicament' as const,
      prixUnitaire: '8000',
      unite: 'mg',
      voieAdministration: 'IV',
    },
    {
      nom: 'Heparine 5000 UI',
      categorie: 'medicament' as const,
      prixUnitaire: '3000',
      unite: 'UI',
      voieAdministration: 'IV',
    },
    {
      nom: 'Dialyseur F8 HPS',
      categorie: 'consommable' as const,
      prixUnitaire: '25000',
      unite: 'unite',
    },
    {
      nom: 'Ligne arterielle',
      categorie: 'consommable' as const,
      prixUnitaire: '5000',
      unite: 'unite',
    },
    {
      nom: 'Ligne veineuse',
      categorie: 'consommable' as const,
      prixUnitaire: '5000',
      unite: 'unite',
    },
    {
      nom: 'Catheter temporaire',
      categorie: 'acte_medical' as const,
      prixUnitaire: '50000',
      unite: 'unite',
    },
    {
      nom: 'Bilan sanguin complet',
      categorie: 'acte_medical' as const,
      prixUnitaire: '15000',
      unite: 'unite',
    },
  ];

  for (const article of articlesData) {
    await db.insert(articles).values(article).onConflictDoNothing();
  }
  console.log(`  ${articlesData.length} articles created`);

  console.log('Phase 3 seed complete.');
}

seedPhase3()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
