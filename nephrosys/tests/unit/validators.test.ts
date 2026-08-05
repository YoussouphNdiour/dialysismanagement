import { describe, it, expect } from 'vitest';
import { loginSchema, changePasswordSchema } from '@/lib/validators/auth';

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
