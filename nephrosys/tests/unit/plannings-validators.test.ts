import { describe, it, expect } from 'vitest';
import {
  createPlanningSchema,
  updatePlanningSchema,
  planningListSchema,
  generateWeekSessionsSchema,
} from '@/lib/validators/plannings';

describe('createPlanningSchema', () => {
  it('accepts valid planning data', () => {
    const result = createPlanningSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      posteId: '550e8400-e29b-41d4-a716-446655440001',
      medecinId: '550e8400-e29b-41d4-a716-446655440002',
      infirmierId: '550e8400-e29b-41d4-a716-446655440003',
      jourSemaine: 0,
      vacation: 'matin',
      recurrence: 'hebdo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid jourSemaine (>6)', () => {
    const result = createPlanningSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      posteId: '550e8400-e29b-41d4-a716-446655440001',
      medecinId: '550e8400-e29b-41d4-a716-446655440002',
      infirmierId: '550e8400-e29b-41d4-a716-446655440003',
      jourSemaine: 7,
      vacation: 'matin',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid vacation', () => {
    const result = createPlanningSchema.safeParse({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      posteId: '550e8400-e29b-41d4-a716-446655440001',
      medecinId: '550e8400-e29b-41d4-a716-446655440002',
      infirmierId: '550e8400-e29b-41d4-a716-446655440003',
      jourSemaine: 0,
      vacation: 'soir',
    });
    expect(result.success).toBe(false);
  });
});

describe('updatePlanningSchema', () => {
  it('requires id', () => {
    const result = updatePlanningSchema.safeParse({ jourSemaine: 1 });
    expect(result.success).toBe(false);
  });

  it('accepts partial update with id', () => {
    const result = updatePlanningSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      vacation: 'apres_midi',
    });
    expect(result.success).toBe(true);
  });
});

describe('planningListSchema', () => {
  it('accepts empty filter (all optional)', () => {
    const result = planningListSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts jourSemaine filter', () => {
    const result = planningListSchema.safeParse({ jourSemaine: 2 });
    expect(result.success).toBe(true);
  });
});

describe('generateWeekSessionsSchema', () => {
  it('accepts valid weekStart date', () => {
    const result = generateWeekSessionsSchema.safeParse({
      weekStart: '2026-08-10',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-date string', () => {
    const result = generateWeekSessionsSchema.safeParse({
      weekStart: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});
