import { describe, it, expect } from 'vitest';
import {
  generateFactureSchema,
  addLigneSchema,
  removeLigneSchema,
  enregistrerPaiementSchema,
  factureListSchema,
  updateTarifSchema,
} from '@/lib/validators/factures';

describe('generateFactureSchema', () => {
  it('accepts valid session UUID', () => {
    const result = generateFactureSchema.safeParse({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const result = generateFactureSchema.safeParse({
      sessionId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing sessionId', () => {
    const result = generateFactureSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('addLigneSchema', () => {
  it('accepts valid input with default quantite', () => {
    const result = addLigneSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      articleId: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantite).toBe(1);
    }
  });

  it('accepts explicit quantite', () => {
    const result = addLigneSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      articleId: '550e8400-e29b-41d4-a716-446655440001',
      quantite: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantite).toBe(3);
    }
  });

  it('rejects negative quantite', () => {
    const result = addLigneSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      articleId: '550e8400-e29b-41d4-a716-446655440001',
      quantite: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero quantite', () => {
    const result = addLigneSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      articleId: '550e8400-e29b-41d4-a716-446655440001',
      quantite: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('removeLigneSchema', () => {
  it('accepts valid ligne UUID', () => {
    const result = removeLigneSchema.safeParse({
      ligneId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const result = removeLigneSchema.safeParse({
      ligneId: 'not-valid',
    });
    expect(result.success).toBe(false);
  });
});

describe('enregistrerPaiementSchema', () => {
  it('accepts especes', () => {
    const result = enregistrerPaiementSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      modePaiement: 'especes',
    });
    expect(result.success).toBe(true);
  });

  it('accepts mobile_money', () => {
    const result = enregistrerPaiementSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      modePaiement: 'mobile_money',
    });
    expect(result.success).toBe(true);
  });

  it('accepts cheque', () => {
    const result = enregistrerPaiementSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      modePaiement: 'cheque',
    });
    expect(result.success).toBe(true);
  });

  it('accepts virement', () => {
    const result = enregistrerPaiementSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      modePaiement: 'virement',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid mode', () => {
    const result = enregistrerPaiementSchema.safeParse({
      factureId: '550e8400-e29b-41d4-a716-446655440000',
      modePaiement: 'bitcoin',
    });
    expect(result.success).toBe(false);
  });
});

describe('factureListSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = factureListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.perPage).toBe(20);
    }
  });

  it('accepts statut filter', () => {
    const result = factureListSchema.safeParse({ statut: 'brouillon' });
    expect(result.success).toBe(true);
  });

  it('accepts date range filter', () => {
    const result = factureListSchema.safeParse({
      dateDebut: '2026-01-01',
      dateFin: '2026-01-31',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format', () => {
    const result = factureListSchema.safeParse({
      dateDebut: '01/01/2026',
    });
    expect(result.success).toBe(false);
  });

  it('rejects perPage over 100', () => {
    const result = factureListSchema.safeParse({ perPage: 200 });
    expect(result.success).toBe(false);
  });

  it('accepts patientId filter', () => {
    const result = factureListSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });
});

describe('updateTarifSchema', () => {
  it('accepts valid update', () => {
    const result = updateTarifSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      montant: 30000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative montant', () => {
    const result = updateTarifSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      montant: -1000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero montant', () => {
    const result = updateTarifSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      montant: 0,
    });
    expect(result.success).toBe(false);
  });
});
