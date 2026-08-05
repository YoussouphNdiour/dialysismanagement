import { describe, it, expect } from 'vitest';
import { createUserSchema, updateUserSchema } from '@/lib/validators/users';

describe('createUserSchema', () => {
  it('accepts valid user data', () => {
    const result = createUserSchema.safeParse({
      email: 'medecin@nephro.test',
      password: 'Nephro2024!',
      role: 'medecin',
      nom: 'Diallo',
      prenom: 'Mamadou',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = createUserSchema.safeParse({
      email: 'not-an-email',
      password: 'Nephro2024!',
      role: 'medecin',
      nom: 'Diallo',
      prenom: 'Mamadou',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.issues.find((i) => i.path.includes('email'));
      expect(emailError).toBeDefined();
    }
  });

  it('rejects password shorter than 8 characters', () => {
    const result = createUserSchema.safeParse({
      email: 'medecin@nephro.test',
      password: 'short',
      role: 'medecin',
      nom: 'Diallo',
      prenom: 'Mamadou',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwError = result.error.issues.find((i) => i.path.includes('password'));
      expect(pwError).toBeDefined();
    }
  });

  it('rejects invalid role', () => {
    const result = createUserSchema.safeParse({
      email: 'medecin@nephro.test',
      password: 'Nephro2024!',
      role: 'superadmin',
      nom: 'Diallo',
      prenom: 'Mamadou',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty nom', () => {
    const result = createUserSchema.safeParse({
      email: 'medecin@nephro.test',
      password: 'Nephro2024!',
      role: 'medecin',
      nom: '',
      prenom: 'Mamadou',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty prenom', () => {
    const result = createUserSchema.safeParse({
      email: 'medecin@nephro.test',
      password: 'Nephro2024!',
      role: 'medecin',
      nom: 'Diallo',
      prenom: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid roles', () => {
    const roles = ['admin', 'secretaire', 'medecin', 'infirmiere', 'facturation', 'patient'] as const;
    for (const role of roles) {
      const result = createUserSchema.safeParse({
        email: 'user@nephro.test',
        password: 'Nephro2024!',
        role,
        nom: 'Test',
        prenom: 'User',
      });
      expect(result.success).toBe(true);
    }
  });

  it('includes French error message for invalid email', () => {
    const result = createUserSchema.safeParse({
      email: 'bad',
      password: 'Nephro2024!',
      role: 'medecin',
      nom: 'Diallo',
      prenom: 'Mamadou',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path.includes('email'));
      expect(emailIssue?.message).toBe('Email invalide');
    }
  });

  it('includes French error message for short password', () => {
    const result = createUserSchema.safeParse({
      email: 'user@nephro.test',
      password: 'abc',
      role: 'medecin',
      nom: 'Diallo',
      prenom: 'Mamadou',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwIssue = result.error.issues.find((i) => i.path.includes('password'));
      expect(pwIssue?.message).toBe('Minimum 8 caracteres');
    }
  });
});

describe('updateUserSchema', () => {
  it('requires id as UUID', () => {
    const result = updateUserSchema.safeParse({ nom: 'Diallo' });
    expect(result.success).toBe(false);
  });

  it('accepts partial update with only id', () => {
    const result = updateUserSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with email', () => {
    const result = updateUserSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'new@nephro.test',
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with role', () => {
    const result = updateUserSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'infirmiere',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID id', () => {
    const result = updateUserSchema.safeParse({
      id: 'not-a-uuid',
      nom: 'Diallo',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email in update', () => {
    const result = updateUserSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role in update', () => {
    const result = updateUserSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'superadmin',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty nom in update', () => {
    const result = updateUserSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      nom: '',
    });
    expect(result.success).toBe(false);
  });
});
