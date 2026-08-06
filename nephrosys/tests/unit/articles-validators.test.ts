import { describe, it, expect } from 'vitest';
import { createArticleSchema, updateArticleSchema, articleListSchema } from '@/lib/validators/articles';

describe('createArticleSchema', () => {
  it('accepts valid medicament article', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Erythropoietine 4000 UI',
      categorie: 'medicament',
      prixUnitaire: 15000,
      unite: 'UI',
      voieAdministration: 'SC',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid consommable without voieAdministration', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Dialyseur F8',
      categorie: 'consommable',
      prixUnitaire: 25000,
      unite: 'unite',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid acte_medical', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Seance de dialyse standard',
      categorie: 'acte_medical',
      prixUnitaire: 25000,
      unite: 'seance',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty nom', () => {
    const result = createArticleSchema.safeParse({
      nom: '',
      categorie: 'medicament',
      prixUnitaire: 15000,
      unite: 'UI',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative prixUnitaire', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Test',
      categorie: 'medicament',
      prixUnitaire: -100,
      unite: 'UI',
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero prixUnitaire', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Test',
      categorie: 'medicament',
      prixUnitaire: 0,
      unite: 'mg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid categorie', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Test',
      categorie: 'invalid_cat',
      prixUnitaire: 100,
      unite: 'mg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects nom longer than 200 characters', () => {
    const result = createArticleSchema.safeParse({
      nom: 'A'.repeat(201),
      categorie: 'medicament',
      prixUnitaire: 100,
      unite: 'mg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty unite', () => {
    const result = createArticleSchema.safeParse({
      nom: 'Test',
      categorie: 'medicament',
      prixUnitaire: 100,
      unite: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateArticleSchema', () => {
  it('accepts partial update with only nom', () => {
    const result = updateArticleSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      nom: 'Nouveau nom',
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with only prixUnitaire', () => {
    const result = updateArticleSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      prixUnitaire: 30000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const result = updateArticleSchema.safeParse({
      nom: 'Nouveau nom',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid uuid', () => {
    const result = updateArticleSchema.safeParse({
      id: 'not-a-uuid',
      nom: 'Test',
    });
    expect(result.success).toBe(false);
  });
});

describe('articleListSchema', () => {
  it('defaults activeOnly to true', () => {
    const result = articleListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeOnly).toBe(true);
    }
  });

  it('accepts categorie filter', () => {
    const result = articleListSchema.safeParse({ categorie: 'medicament' });
    expect(result.success).toBe(true);
  });

  it('accepts activeOnly false', () => {
    const result = articleListSchema.safeParse({ activeOnly: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeOnly).toBe(false);
    }
  });
});
