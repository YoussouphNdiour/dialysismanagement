import { describe, it, expect } from 'vitest';
import {
  entreeStockSchema,
  sortieManuelleSchema,
  ajustementSchema,
  setSeuilSchema,
} from '@/lib/validators/stock';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('entreeStockSchema', () => {
  it('accepte une entree valide', () => {
    const result = entreeStockSchema.safeParse({
      articleId: UUID,
      numeroLot: 'LOT-2024-001',
      datePeremption: '2027-01-15',
      quantite: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejette articleId non UUID', () => {
    const result = entreeStockSchema.safeParse({
      articleId: 'pas-un-uuid',
      numeroLot: 'LOT-001',
      datePeremption: '2027-01-15',
      quantite: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejette numeroLot vide', () => {
    const result = entreeStockSchema.safeParse({
      articleId: UUID,
      numeroLot: '',
      datePeremption: '2027-01-15',
      quantite: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejette numeroLot > 100 caracteres', () => {
    const result = entreeStockSchema.safeParse({
      articleId: UUID,
      numeroLot: 'X'.repeat(101),
      datePeremption: '2027-01-15',
      quantite: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejette datePeremption format invalide', () => {
    const result = entreeStockSchema.safeParse({
      articleId: UUID,
      numeroLot: 'LOT-001',
      datePeremption: '15/01/2027',
      quantite: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejette quantite negative', () => {
    const result = entreeStockSchema.safeParse({
      articleId: UUID,
      numeroLot: 'LOT-001',
      datePeremption: '2027-01-15',
      quantite: -10,
    });
    expect(result.success).toBe(false);
  });

  it('rejette quantite zero', () => {
    const result = entreeStockSchema.safeParse({
      articleId: UUID,
      numeroLot: 'LOT-001',
      datePeremption: '2027-01-15',
      quantite: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('sortieManuelleSchema', () => {
  it('accepte une sortie valide', () => {
    const result = sortieManuelleSchema.safeParse({
      articleId: UUID,
      quantite: 5,
      motif: 'Utilise pour patient externe',
    });
    expect(result.success).toBe(true);
  });

  it('rejette quantite negative', () => {
    const result = sortieManuelleSchema.safeParse({
      articleId: UUID,
      quantite: -1,
      motif: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('rejette motif vide', () => {
    const result = sortieManuelleSchema.safeParse({
      articleId: UUID,
      quantite: 5,
      motif: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejette motif > 200 caracteres', () => {
    const result = sortieManuelleSchema.safeParse({
      articleId: UUID,
      quantite: 5,
      motif: 'M'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe('ajustementSchema', () => {
  it('accepte un ajustement positif avec lotId', () => {
    const result = ajustementSchema.safeParse({
      articleId: UUID,
      lotId: UUID,
      quantite: 10,
      motif: 'Correction inventaire',
    });
    expect(result.success).toBe(true);
  });

  it('accepte un ajustement negatif sans lotId', () => {
    const result = ajustementSchema.safeParse({
      articleId: UUID,
      quantite: -5,
      motif: 'Perte constatee',
    });
    expect(result.success).toBe(true);
  });

  it('rejette quantite zero', () => {
    const result = ajustementSchema.safeParse({
      articleId: UUID,
      quantite: 0,
      motif: 'Test',
    });
    expect(result.success).toBe(false);
  });
});

describe('setSeuilSchema', () => {
  it('accepte un seuil valide', () => {
    const result = setSeuilSchema.safeParse({
      articleId: UUID,
      seuilMin: 10,
    });
    expect(result.success).toBe(true);
  });

  it('rejette seuilMin negatif', () => {
    const result = setSeuilSchema.safeParse({
      articleId: UUID,
      seuilMin: -5,
    });
    expect(result.success).toBe(false);
  });

  it('rejette seuilMin zero', () => {
    const result = setSeuilSchema.safeParse({
      articleId: UUID,
      seuilMin: 0,
    });
    expect(result.success).toBe(false);
  });
});
