import { describe, it, expect } from 'vitest';
import { canAccess, getMenuItemsForRole } from '@/lib/permissions';

describe('canAccess', () => {
  it('admin can access everything except portail', () => {
    expect(canAccess('admin', '/patients')).toBe(true);
    expect(canAccess('admin', '/admin')).toBe(true);
    expect(canAccess('admin', '/facturation')).toBe(true);
    expect(canAccess('admin', '/portail')).toBe(false);
  });

  it('secretaire can access patients and planning', () => {
    expect(canAccess('secretaire', '/patients')).toBe(true);
    expect(canAccess('secretaire', '/planning')).toBe(true);
  });

  it('secretaire cannot access admin but can access facturation (read)', () => {
    expect(canAccess('secretaire', '/facturation')).toBe(true);
    expect(canAccess('secretaire', '/admin')).toBe(false);
  });

  it('infirmiere can access seances and facturation (read)', () => {
    expect(canAccess('infirmiere', '/seances')).toBe(true);
    expect(canAccess('infirmiere', '/facturation')).toBe(true);
  });

  it('facturation can access facturation but not seances', () => {
    expect(canAccess('facturation', '/facturation')).toBe(true);
    expect(canAccess('facturation', '/seances')).toBe(false);
  });

  it('patient can only access portail', () => {
    expect(canAccess('patient', '/portail')).toBe(true);
    expect(canAccess('patient', '/patients')).toBe(false);
    expect(canAccess('patient', '/seances')).toBe(false);
  });

  it('medecin can access bilans', () => {
    expect(canAccess('medecin', '/bilans')).toBe(true);
  });
});

describe('getMenuItemsForRole', () => {
  it('admin sees all menu items', () => {
    const items = getMenuItemsForRole('admin');
    expect(items.length).toBe(10);
  });

  it('infirmiere sees 5 items', () => {
    const items = getMenuItemsForRole('infirmiere');
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Patients');
    expect(labels).toContain('Seances');
    expect(labels).toContain('Bilans');
    expect(labels).not.toContain('Facturation');
    expect(labels).not.toContain('Utilisateurs');
  });

  it('facturation sees 3 items', () => {
    const items = getMenuItemsForRole('facturation');
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Facturation');
    expect(labels).toContain('Patients');
    expect(labels).not.toContain('Seances');
  });
});
