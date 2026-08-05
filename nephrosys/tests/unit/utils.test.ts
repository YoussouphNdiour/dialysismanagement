import { describe, it, expect } from 'vitest';
import { cn, formatDateFR, generateReference } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('resolves Tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'end')).toBe('base end');
  });
});

describe('formatDateFR', () => {
  it('formats Date object to DD/MM/YYYY', () => {
    const date = new Date('2026-08-05T00:00:00Z');
    expect(formatDateFR(date)).toBe('05/08/2026');
  });

  it('formats ISO string to DD/MM/YYYY', () => {
    expect(formatDateFR('2026-01-15T00:00:00Z')).toBe('15/01/2026');
  });
});

describe('generateReference', () => {
  it('starts with given prefix', () => {
    const ref = generateReference('PAT');
    expect(ref).toMatch(/^PAT-\d{8}-[A-Z0-9]{4}$/);
  });
});
