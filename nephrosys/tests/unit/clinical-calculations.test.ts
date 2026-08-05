import { describe, it, expect } from 'vitest';
import {
  calculateInterdialysisIncrease,
  calculateKtV,
  calculateURR,
  calculateBioStatus,
  calculateProductCaP,
} from '@/lib/clinical-calculations';

describe('calculateInterdialysisIncrease', () => {
  it('returns difference between arrival and dry weight', () => {
    expect(calculateInterdialysisIncrease(72.5, 70.0)).toBeCloseTo(2.5, 2);
  });

  it('returns null if either weight is null', () => {
    expect(calculateInterdialysisIncrease(null, 70.0)).toBeNull();
    expect(calculateInterdialysisIncrease(72.5, null)).toBeNull();
  });

  it('handles negative difference (arrival < dry)', () => {
    expect(calculateInterdialysisIncrease(68.0, 70.0)).toBeCloseTo(-2.0, 2);
  });
});

describe('calculateKtV', () => {
  it('calculates Kt/V with Daugirdas formula', () => {
    // Known inputs: ureePre=60, ureePost=20, arrivalWeight=75, departureWeight=72
    const result = calculateKtV(60, 20, 75, 72);
    expect(result).not.toBeNull();
    // -ln(20/60) + (4 - 3.5*(20/60)) * (75-72)/72
    // = -ln(0.333) + (4 - 1.1667) * 0.04167
    // = 1.0986 + 2.8333 * 0.04167
    // = 1.0986 + 0.1181
    // = 1.2167
    expect(result!).toBeCloseTo(1.22, 1);
  });

  it('returns null if any input is null', () => {
    expect(calculateKtV(null, 20, 75, 72)).toBeNull();
    expect(calculateKtV(60, null, 75, 72)).toBeNull();
    expect(calculateKtV(60, 20, null, 72)).toBeNull();
    expect(calculateKtV(60, 20, 75, null)).toBeNull();
  });

  it('returns null if uree_pre is 0 (avoid division by zero)', () => {
    expect(calculateKtV(0, 20, 75, 72)).toBeNull();
  });

  it('returns null if departure_weight is 0', () => {
    expect(calculateKtV(60, 20, 75, 0)).toBeNull();
  });
});

describe('calculateURR', () => {
  it('calculates URR as percentage', () => {
    // (60 - 20) / 60 * 100 = 66.67%
    expect(calculateURR(60, 20)).toBeCloseTo(66.67, 1);
  });

  it('returns null if either value is null', () => {
    expect(calculateURR(null, 20)).toBeNull();
    expect(calculateURR(60, null)).toBeNull();
  });

  it('returns null if uree_pre is 0', () => {
    expect(calculateURR(0, 20)).toBeNull();
  });
});

describe('calculateBioStatus', () => {
  it('returns ok when value is within range', () => {
    expect(calculateBioStatus(12.0, 10.0, 16.0)).toBe('ok');
  });

  it('returns low when value is below seuil_bas', () => {
    expect(calculateBioStatus(8.0, 10.0, 16.0)).toBe('low');
  });

  it('returns high when value is above seuil_haut', () => {
    expect(calculateBioStatus(18.0, 10.0, 16.0)).toBe('high');
  });

  it('returns null when value is null', () => {
    expect(calculateBioStatus(null, 10.0, 16.0)).toBeNull();
  });

  it('handles null seuil_bas (no lower bound)', () => {
    expect(calculateBioStatus(5.0, null, 55.0)).toBe('ok');
    expect(calculateBioStatus(60.0, null, 55.0)).toBe('high');
  });

  it('handles null seuil_haut (no upper bound)', () => {
    expect(calculateBioStatus(5.0, 10.0, null)).toBe('low');
    expect(calculateBioStatus(15.0, 10.0, null)).toBe('ok');
  });

  it('returns ok on exact boundary values', () => {
    expect(calculateBioStatus(10.0, 10.0, 16.0)).toBe('ok');
    expect(calculateBioStatus(16.0, 10.0, 16.0)).toBe('ok');
  });
});

describe('calculateProductCaP', () => {
  it('calculates Ca x P product', () => {
    expect(calculateProductCaP(2.4, 1.2)).toBeCloseTo(2.88, 2);
  });

  it('returns null if either is null', () => {
    expect(calculateProductCaP(null, 1.2)).toBeNull();
    expect(calculateProductCaP(2.4, null)).toBeNull();
  });
});
