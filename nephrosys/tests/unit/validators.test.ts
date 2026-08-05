import { describe, it, expect } from 'vitest';
import { loginSchema, changePasswordSchema } from '@/lib/validators/auth';
import { createPatientSchema, updatePatientSchema, patientListSchema } from '@/lib/validators/patients';

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'admin@nephro.test',
      password: 'Nephro2024!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'Nephro2024!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'admin@nephro.test',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts matching passwords >= 8 chars', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'Different456',
    });
    expect(result.success).toBe(false);
  });

  it('rejects new password < 8 chars', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('createPatientSchema', () => {
  it('accepts valid patient data', () => {
    const result = createPatientSchema.safeParse({
      nom: 'Fall',
      prenom: 'Ibrahima',
      sexe: 'M',
      telephone: '+221771234567',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty nom', () => {
    const result = createPatientSchema.safeParse({
      nom: '',
      prenom: 'Ibrahima',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sexe', () => {
    const result = createPatientSchema.safeParse({
      nom: 'Fall',
      prenom: 'Ibrahima',
      sexe: 'X',
    });
    expect(result.success).toBe(false);
  });
});

describe('updatePatientSchema', () => {
  it('requires id', () => {
    const result = updatePatientSchema.safeParse({ nom: 'Fall' });
    expect(result.success).toBe(false);
  });

  it('accepts partial update with id', () => {
    const result = updatePatientSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      telephone: '+221771234567',
    });
    expect(result.success).toBe(true);
  });
});

describe('patientListSchema', () => {
  it('provides defaults for page and perPage', () => {
    const result = patientListSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
  });

  it('rejects perPage > 100', () => {
    const result = patientListSchema.safeParse({ perPage: 200 });
    expect(result.success).toBe(false);
  });
});
