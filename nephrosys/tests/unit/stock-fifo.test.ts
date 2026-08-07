import { describe, it, expect } from 'vitest';
import { applyFifo } from '@/lib/stock-fifo';

describe('applyFifo', () => {
  it('alloue depuis un seul lot suffisant', () => {
    const lots = [
      { lotId: 'lot-1', lotArticleId: 'art-1', datePeremption: '2027-01-01', quantiteDisponible: 10 },
    ];
    const result = applyFifo(lots, 5);
    expect(result.satisfait).toBe(true);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]).toEqual({ lotId: 'lot-1', lotArticleId: 'art-1', quantite: 5 });
  });

  it('alloue sur plusieurs lots (multi-lot)', () => {
    const lots = [
      { lotId: 'lot-1', lotArticleId: 'art-1', datePeremption: '2026-06-01', quantiteDisponible: 3 },
      { lotId: 'lot-2', lotArticleId: 'art-1', datePeremption: '2027-01-01', quantiteDisponible: 7 },
    ];
    const result = applyFifo(lots, 8);
    expect(result.satisfait).toBe(true);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]).toEqual({ lotId: 'lot-1', lotArticleId: 'art-1', quantite: 3 });
    expect(result.allocations[1]).toEqual({ lotId: 'lot-2', lotArticleId: 'art-1', quantite: 5 });
  });

  it('retourne satisfait=false si stock insuffisant', () => {
    const lots = [
      { lotId: 'lot-1', lotArticleId: 'art-1', datePeremption: '2027-01-01', quantiteDisponible: 2 },
    ];
    const result = applyFifo(lots, 5);
    expect(result.satisfait).toBe(false);
    expect(result.totalDisponible).toBe(2);
    expect(result.allocations).toHaveLength(0);
  });

  it('retourne satisfait=false si aucun lot', () => {
    const result = applyFifo([], 5);
    expect(result.satisfait).toBe(false);
    expect(result.totalDisponible).toBe(0);
    expect(result.allocations).toHaveLength(0);
  });

  it('prend le lot a peremption la plus proche en premier (FEFO)', () => {
    const lots = [
      { lotId: 'lot-peremption-tardive', lotArticleId: 'art-1', datePeremption: '2028-01-01', quantiteDisponible: 10 },
      { lotId: 'lot-peremption-proche', lotArticleId: 'art-1', datePeremption: '2026-12-01', quantiteDisponible: 10 },
    ];
    // Lots passes dans un ordre non trie — la fonction doit trier elle-meme
    const result = applyFifo(lots, 3);
    expect(result.satisfait).toBe(true);
    expect(result.allocations[0]!.lotId).toBe('lot-peremption-proche');
  });

  it('ignore les lots avec quantiteDisponible = 0', () => {
    const lots = [
      { lotId: 'lot-vide', lotArticleId: 'art-1', datePeremption: '2026-06-01', quantiteDisponible: 0 },
      { lotId: 'lot-plein', lotArticleId: 'art-1', datePeremption: '2027-01-01', quantiteDisponible: 5 },
    ];
    const result = applyFifo(lots, 3);
    expect(result.satisfait).toBe(true);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]!.lotId).toBe('lot-plein');
  });

  it('alloue exactement le stock disponible total quand quantite = totalDisponible', () => {
    const lots = [
      { lotId: 'lot-1', lotArticleId: 'art-1', datePeremption: '2027-01-01', quantiteDisponible: 4 },
      { lotId: 'lot-2', lotArticleId: 'art-1', datePeremption: '2027-06-01', quantiteDisponible: 6 },
    ];
    const result = applyFifo(lots, 10);
    expect(result.satisfait).toBe(true);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]!.quantite).toBe(4);
    expect(result.allocations[1]!.quantite).toBe(6);
  });
});
