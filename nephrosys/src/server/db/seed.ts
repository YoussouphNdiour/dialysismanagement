import { db } from './index';
import { users, patients } from './schema';
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

  const SEED_PATIENTS = [
    { nom: 'Diop', prenom: 'Moussa', sexe: 'M' as const, telephone: '+221771000001', statut: 'actif' as const },
    { nom: 'Niang', prenom: 'Aissatou', sexe: 'F' as const, telephone: '+221771000002', statut: 'actif' as const },
    { nom: 'Sarr', prenom: 'Abdoulaye', sexe: 'M' as const, telephone: '+221771000003', statut: 'actif' as const },
    { nom: 'Gueye', prenom: 'Mariama', sexe: 'F' as const, telephone: '+221771000004', statut: 'actif' as const },
    { nom: 'Mbaye', prenom: 'Cheikh', sexe: 'M' as const, telephone: '+221771000005', statut: 'inactif' as const },
    { nom: 'Faye', prenom: 'Sokhna', sexe: 'F' as const, telephone: '+221771000006', statut: 'actif' as const },
    { nom: 'Seck', prenom: 'Oumar', sexe: 'M' as const, telephone: '+221771000007', statut: 'actif' as const },
    { nom: 'Thiam', prenom: 'Ndey', sexe: 'F' as const, telephone: '+221771000008', statut: 'transfere' as const },
    { nom: 'Dia', prenom: 'Mamadou', sexe: 'M' as const, telephone: '+221771000009', statut: 'actif' as const },
    { nom: 'Kane', prenom: 'Fatimata', sexe: 'F' as const, telephone: '+221771000010', statut: 'actif' as const },
  ];

  for (const p of SEED_PATIENTS) {
    await db
      .insert(patients)
      .values(p)
      .onConflictDoNothing();
    console.log(`  Patient: ${p.prenom} ${p.nom}`);
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
