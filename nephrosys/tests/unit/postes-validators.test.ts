import { describe, it, expect } from 'vitest';
import { createPosteSchema, updatePosteSchema } from '@/lib/validators/postes';
import { updateSeuilSchema } from '@/lib/validators/seuils';

describe('createPosteSchema', () => {
  it('accepts valid poste data', () => {
    const result = createPosteSchema.safeParse({
      nom: 'Poste 1',
      numero: 1,
      isVip: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty nom', () => {
    const result = createPosteSchema.safeParse({
      nom: '',
      numero: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative numero', () => {
    const result = createPosteSchema.safeParse({
      nom: 'Poste 1',
      numero: -1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional equipement', () => {
    const result = createPosteSchema.safeParse({
      nom: 'VIP 1',
      numero: 1,
      isVip: true,
      equipement: 'Fresenius 5008S',
    });
    expect(result.success).toBe(true);
  });
});

describe('updatePosteSchema', () => {
  it('requires id', () => {
    const result = updatePosteSchema.safeParse({ nom: 'Poste 2' });
    expect(result.success).toBe(false);
  });

  it('accepts partial update with id', () => {
    const result = updatePosteSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      nom: 'Poste 2',
    });
    expect(result.success).toBe(true);
  });
});

describe('updateSeuilSchema', () => {
  it('requires id', () => {
    const result = updateSeuilSchema.safeParse({ seuilBas: 10 });
    expect(result.success).toBe(false);
  });

  it('accepts valid seuil update', () => {
    const result = updateSeuilSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      seuilBas: 10.0,
      seuilHaut: 16.0,
      unite: 'g/dL',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null seuil_bas (no lower bound)', () => {
    const result = updateSeuilSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      seuilBas: null,
      seuilHaut: 55.0,
    });
    expect(result.success).toBe(true);
  });
});
