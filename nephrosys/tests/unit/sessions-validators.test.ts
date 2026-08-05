import { describe, it, expect } from 'vitest';
import {
  createSessionSchema,
  updatePreDialyseSchema,
  updateMachineSchema,
  updateFinSeanceSchema,
  sessionListSchema,
} from '@/lib/validators/sessions';

describe('createSessionSchema', () => {
  it('accepts valid session data', () => {
    const result = createSessionSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      posteId: '550e8400-e29b-41d4-a716-446655440001',
      physicianId: '550e8400-e29b-41d4-a716-446655440002',
      nurseId: '550e8400-e29b-41d4-a716-446655440003',
      dateSeance: '2026-08-10',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing patientId', () => {
    const result = createSessionSchema.safeParse({
      posteId: '550e8400-e29b-41d4-a716-446655440001',
      physicianId: '550e8400-e29b-41d4-a716-446655440002',
      nurseId: '550e8400-e29b-41d4-a716-446655440003',
      dateSeance: '2026-08-10',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional planningId', () => {
    const result = createSessionSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      posteId: '550e8400-e29b-41d4-a716-446655440001',
      physicianId: '550e8400-e29b-41d4-a716-446655440002',
      nurseId: '550e8400-e29b-41d4-a716-446655440003',
      dateSeance: '2026-08-10',
      planningId: '550e8400-e29b-41d4-a716-446655440004',
    });
    expect(result.success).toBe(true);
  });
});

describe('updatePreDialyseSchema', () => {
  it('requires id', () => {
    const result = updatePreDialyseSchema.safeParse({
      arrivalWeight: 72.5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid pre-dialyse data', () => {
    const result = updatePreDialyseSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      arrivalStatus: 'stable',
      arrivalWeight: 72.5,
      dryWeight: 70.0,
      taPreDialyse: '140/90',
      taDebout: '135/85',
      taCoucher: '130/80',
      temperaturePre: 36.5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid arrival status', () => {
    const result = updatePreDialyseSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      arrivalStatus: 'critique',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateMachineSchema', () => {
  it('accepts valid machine parameters', () => {
    const result = updateMachineSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      typeDialyse: 'hemodialyse',
      dialyzerType: 'FX80',
      debitSang: 300,
      debitDialysat: 500,
      ufPrescrite: 2.5,
      dureePrescrite: 240,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type_dialyse', () => {
    const result = updateMachineSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      typeDialyse: 'inconnu',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateFinSeanceSchema', () => {
  it('accepts valid fin de seance data', () => {
    const result = updateFinSeanceSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      departureWeight: 70.5,
      ufReelle: 2.0,
      dureeReelle: 235,
      toleranceGlobale: 'bonne',
      ureePre: 60,
      ureePost: 20,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid tolerance', () => {
    const result = updateFinSeanceSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      toleranceGlobale: 'excellente',
    });
    expect(result.success).toBe(false);
  });
});

describe('sessionListSchema', () => {
  it('provides defaults for page and perPage', () => {
    const result = sessionListSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
  });

  it('accepts date filter', () => {
    const result = sessionListSchema.safeParse({
      date: '2026-08-10',
    });
    expect(result.success).toBe(true);
  });

  it('accepts statut filter', () => {
    const result = sessionListSchema.safeParse({
      statut: 'en_cours',
    });
    expect(result.success).toBe(true);
  });
});
