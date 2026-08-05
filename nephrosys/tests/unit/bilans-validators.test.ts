import { describe, it, expect } from 'vitest';
import {
  createBilanSchema,
  updateBilanSchema,
  bilanListSchema,
} from '@/lib/validators/bilans';

describe('createBilanSchema', () => {
  it('accepts valid bilan creation data', () => {
    const result = createBilanSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      physicianId: '550e8400-e29b-41d4-a716-446655440001',
      dateBilan: '2026-08-10T10:00:00.000Z',
      typeBilan: 'mensuel',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type_bilan', () => {
    const result = createBilanSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      physicianId: '550e8400-e29b-41d4-a716-446655440001',
      dateBilan: '2026-08-10T10:00:00.000Z',
      typeBilan: 'quotidien',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing patientId', () => {
    const result = createBilanSchema.safeParse({
      physicianId: '550e8400-e29b-41d4-a716-446655440001',
      dateBilan: '2026-08-10T10:00:00.000Z',
      typeBilan: 'mensuel',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateBilanSchema', () => {
  it('requires id', () => {
    const result = updateBilanSchema.safeParse({
      hemoglobine: 12.5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts hematologie fields', () => {
    const result = updateBilanSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      hemoglobine: 12.5,
      hematocrite: 38.0,
      globulesBlancs: 7.2,
      plaquettes: 250000,
      ferritine: 450,
    });
    expect(result.success).toBe(true);
  });

  it('accepts serologie enum values', () => {
    const result = updateBilanSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      hbsAg: 'negatif',
      antiHbs: 'positif',
      antiHcv: 'non_fait',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid serologie value', () => {
    const result = updateBilanSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      hbsAg: 'inconnu',
    });
    expect(result.success).toBe(false);
  });

  it('accepts electrolytes fields', () => {
    const result = updateBilanSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      sodium: 140,
      potassium: 4.5,
      calcium: 2.3,
      phosphore: 1.2,
    });
    expect(result.success).toBe(true);
  });
});

describe('bilanListSchema', () => {
  it('provides defaults', () => {
    const result = bilanListSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
  });

  it('accepts all filters', () => {
    const result = bilanListSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      typeBilan: 'trimestriel',
      dateDebut: '2026-01-01',
      dateFin: '2026-12-31',
    });
    expect(result.success).toBe(true);
  });
});
