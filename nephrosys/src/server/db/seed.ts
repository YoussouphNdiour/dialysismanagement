import { db } from './index';
import { users } from './schema';
import bcrypt from 'bcryptjs';

const SEED_USERS = [
  { email: 'admin@nephro.test', role: 'admin' as const, nom: 'Admin', prenom: 'Super' },
  { email: 'medecin@nephro.test', role: 'medecin' as const, nom: 'Diallo', prenom: 'Mamadou' },
  {
    email: 'infirmiere@nephro.test',
    role: 'infirmiere' as const,
    nom: 'Ndiaye',
    prenom: 'Fatou',
  },
  {
    email: 'secretaire@nephro.test',
    role: 'secretaire' as const,
    nom: 'Sow',
    prenom: 'Aminata',
  },
  {
    email: 'facturation@nephro.test',
    role: 'facturation' as const,
    nom: 'Ba',
    prenom: 'Ousmane',
  },
  { email: 'patient@nephro.test', role: 'patient' as const, nom: 'Fall', prenom: 'Ibrahima' },
];

async function seed() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('Nephro2024!', 12);

  for (const u of SEED_USERS) {
    await db
      .insert(users)
      .values({
        email: u.email,
        passwordHash,
        role: u.role,
        nom: u.nom,
        prenom: u.prenom,
      })
      .onConflictDoNothing({ target: users.email });

    console.log(`  User: ${u.email} (${u.role})`);
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
