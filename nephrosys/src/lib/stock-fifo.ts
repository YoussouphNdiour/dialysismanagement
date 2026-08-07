// src/lib/stock-fifo.ts

export type LotPourFifo = {
  lotId: string;
  lotArticleId: string;
  datePeremption: string; // YYYY-MM-DD
  quantiteDisponible: number;
};

export type AllocationFifo = {
  lotId: string;
  lotArticleId: string;
  quantite: number;
};

export type ResultatFifo = {
  allocations: AllocationFifo[];
  totalDisponible: number;
  satisfait: boolean;
};

/**
 * Calcule les allocations FIFO (FEFO) pour une sortie de stock.
 * Trie les lots par date de peremption ascendante (lots qui expirent en premier, utilises en premier).
 * Si le stock total est insuffisant, retourne satisfait=false et allocations=[].
 * Fonction pure — aucun effet de bord, aucune DB.
 */
export function applyFifo(lots: LotPourFifo[], quantiteDemandee: number): ResultatFifo {
  const lotsActifs = lots.filter((l) => l.quantiteDisponible > 0);
  const lotsTries = [...lotsActifs].sort((a, b) =>
    a.datePeremption.localeCompare(b.datePeremption),
  );

  const totalDisponible = lotsTries.reduce((sum, l) => sum + l.quantiteDisponible, 0);

  if (totalDisponible < quantiteDemandee) {
    return { allocations: [], totalDisponible, satisfait: false };
  }

  const allocations: AllocationFifo[] = [];
  let reste = quantiteDemandee;

  for (const lot of lotsTries) {
    if (reste <= 0) break;
    const pris = Math.min(lot.quantiteDisponible, reste);
    allocations.push({ lotId: lot.lotId, lotArticleId: lot.lotArticleId, quantite: pris });
    reste -= pris;
  }

  return { allocations, totalDisponible, satisfait: true };
}
