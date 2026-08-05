import { db } from './index';
import { postesDialyse, seuilsCliniques } from './schema';

async function seedPhase2() {
  console.log('Seeding Phase 2 data...');

  // Seed postes de dialyse
  const posteData = [
    ...Array.from({ length: 20 }, (_, i) => ({
      nom: `Poste ${i + 1}`,
      numero: i + 1,
      isVip: false,
      isActive: true,
    })),
    { nom: 'VIP 1', numero: 21, isVip: true, isActive: true },
    { nom: 'VIP 2', numero: 22, isVip: true, isActive: true },
    { nom: 'VIP 3', numero: 23, isVip: true, isActive: true },
  ];

  for (const poste of posteData) {
    await db
      .insert(postesDialyse)
      .values(poste)
      .onConflictDoNothing();
  }
  console.log(`  ${posteData.length} postes created`);

  // Seed seuils cliniques
  const seuilsData = [
    { parametre: 'hemoglobine', label: 'Hemoglobine', seuilBas: '10.0', seuilHaut: '16.0', unite: 'g/dL' },
    { parametre: 'potassium', label: 'Potassium', seuilBas: '3.5', seuilHaut: '5.5', unite: 'mmol/L' },
    { parametre: 'phosphore', label: 'Phosphore', seuilBas: '0.8', seuilHaut: '1.5', unite: 'mmol/L' },
    { parametre: 'albumine', label: 'Albumine', seuilBas: '35.0', seuilHaut: '50.0', unite: 'g/L' },
    { parametre: 'pth', label: 'PTH', seuilBas: '150.0', seuilHaut: '600.0', unite: 'pg/mL' },
    { parametre: 'produit_ca_p', label: 'Produit Ca x P', seuilBas: null, seuilHaut: '55.0', unite: 'mg2/dL2' },
  ];

  for (const seuil of seuilsData) {
    await db
      .insert(seuilsCliniques)
      .values(seuil)
      .onConflictDoNothing();
  }
  console.log(`  ${seuilsData.length} seuils created`);

  console.log('Phase 2 seed complete.');
}

seedPhase2()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
