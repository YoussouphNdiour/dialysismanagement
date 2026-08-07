import { describe, it, expect } from 'vitest';
import {
  addPrescriptionSchema,
  cancelPrescriptionSchema,
  ordonnanceCreateSchema,
  ordonnanceToggleSchema,
} from '@/lib/validators/prescriptions';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('addPrescriptionSchema', () => {
  it('accepte une prescription valide avec posologie', () => {
    const result = addPrescriptionSchema.safeParse({
      sessionId: UUID,
      articleId: UUID,
      quantite: 2,
      posologie: 'Administrer en fin de seance',
    });
    expect(result.success).toBe(true);
  });

  it('accepte une prescription valide sans posologie', () => {
    const result = addPrescriptionSchema.safeParse({
      sessionId: UUID,
      articleId: UUID,
      quantite: 1,
    });
    expect(result.success).toBe(true);
  });

  it('rejette quantite negative', () => {
    const result = addPrescriptionSchema.safeParse({
      sessionId: UUID,
      articleId: UUID,
      quantite: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejette quantite zero', () => {
    const result = addPrescriptionSchema.safeParse({
      sessionId: UUID,
      articleId: UUID,
      quantite: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejette sessionId non UUID', () => {
    const result = addPrescriptionSchema.safeParse({
      sessionId: 'pas-un-uuid',
      articleId: UUID,
      quantite: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejette posologie > 200 caracteres', () => {
    const result = addPrescriptionSchema.safeParse({
      sessionId: UUID,
      articleId: UUID,
      quantite: 1,
      posologie: 'X'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe('cancelPrescriptionSchema', () => {
  it('accepte un UUID valide', () => {
    const result = cancelPrescriptionSchema.safeParse({ prescriptionId: UUID });
    expect(result.success).toBe(true);
  });

  it('rejette un non-UUID', () => {
    const result = cancelPrescriptionSchema.safeParse({ prescriptionId: 'pas-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('ordonnanceCreateSchema', () => {
  it('accepte patientId et contenu valides', () => {
    const result = ordonnanceCreateSchema.safeParse({
      patientId: UUID,
      contenu: 'Erythropoietine 4000 UI SC 3x/semaine',
    });
    expect(result.success).toBe(true);
  });

  it('rejette contenu vide', () => {
    const result = ordonnanceCreateSchema.safeParse({
      patientId: UUID,
      contenu: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejette patientId non UUID', () => {
    const result = ordonnanceCreateSchema.safeParse({
      patientId: 'pas-uuid',
      contenu: 'Test',
    });
    expect(result.success).toBe(false);
  });
});

describe('ordonnanceToggleSchema', () => {
  it('accepte un UUID valide', () => {
    const result = ordonnanceToggleSchema.safeParse({ ordonnanceId: UUID });
    expect(result.success).toBe(true);
  });

  it('rejette un non-UUID', () => {
    const result = ordonnanceToggleSchema.safeParse({ ordonnanceId: 'pas-uuid' });
    expect(result.success).toBe(false);
  });
});
