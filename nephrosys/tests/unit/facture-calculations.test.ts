import { describe, it, expect } from 'vitest';
import {
  calculateLigneMontant,
  calculateMontantSupplements,
  calculateMontantTotal,
} from '@/lib/facture-calculations';

describe('calculateLigneMontant', () => {
  it('calculates simple montant', () => {
    expect(calculateLigneMontant(1, 25000)).toBe(25000);
  });

  it('calculates montant with quantity', () => {
    expect(calculateLigneMontant(3, 5000)).toBe(15000);
  });

  it('calculates montant with decimal quantity', () => {
    expect(calculateLigneMontant(1.5, 10000)).toBe(15000);
  });

  it('handles rounding correctly', () => {
    expect(calculateLigneMontant(3, 3333.33)).toBe(9999.99);
  });
});

describe('calculateMontantSupplements', () => {
  it('returns 0 for empty lignes', () => {
    expect(calculateMontantSupplements([])).toBe(0);
  });

  it('excludes forfait line (articleId null)', () => {
    const lignes = [
      { articleId: null, montant: '25000' },
      { articleId: 'abc-123', montant: '15000' },
    ];
    expect(calculateMontantSupplements(lignes)).toBe(15000);
  });

  it('sums multiple supplement lines', () => {
    const lignes = [
      { articleId: null, montant: '25000' },
      { articleId: 'abc-123', montant: '15000' },
      { articleId: 'def-456', montant: '8000' },
      { articleId: 'ghi-789', montant: '3000' },
    ];
    expect(calculateMontantSupplements(lignes)).toBe(26000);
  });

  it('returns 0 when only forfait line exists', () => {
    const lignes = [{ articleId: null, montant: '25000' }];
    expect(calculateMontantSupplements(lignes)).toBe(0);
  });
});

describe('calculateMontantTotal', () => {
  it('calculates total = base + supplements', () => {
    expect(calculateMontantTotal(25000, 15000)).toBe(40000);
  });

  it('returns base when supplements is 0', () => {
    expect(calculateMontantTotal(25000, 0)).toBe(25000);
  });

  it('handles decimal amounts', () => {
    expect(calculateMontantTotal(25000.50, 15000.75)).toBe(40001.25);
  });
});
