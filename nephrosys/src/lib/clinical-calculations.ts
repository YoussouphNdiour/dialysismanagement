/**
 * Calculs cliniques — fonctions pures pour la nephrologie.
 * Toutes les valeurs numeriques sont passees en number | null.
 */

/** Prise de poids interdialytique = poids arrivee - poids sec */
export function calculateInterdialysisIncrease(
  arrivalWeight: number | null,
  dryWeight: number | null,
): number | null {
  if (arrivalWeight == null || dryWeight == null) return null;
  return Math.round((arrivalWeight - dryWeight) * 100) / 100;
}

/**
 * Kt/V (formule de Daugirdas II simplifiee)
 * = -ln(R) + (4 - 3.5 * R) * deltaW / departureWeight
 * ou R = ureePost / ureePre, deltaW = arrivalWeight - departureWeight
 */
export function calculateKtV(
  ureePre: number | null,
  ureePost: number | null,
  arrivalWeight: number | null,
  departureWeight: number | null,
): number | null {
  if (ureePre == null || ureePost == null || arrivalWeight == null || departureWeight == null) {
    return null;
  }
  if (ureePre === 0 || departureWeight === 0) return null;

  const r = ureePost / ureePre;
  const deltaW = arrivalWeight - departureWeight;
  const ktv = -Math.log(r) + (4 - 3.5 * r) * (deltaW / departureWeight);
  return Math.round(ktv * 100) / 100;
}

/** URR (%) = (ureePre - ureePost) / ureePre * 100 */
export function calculateURR(
  ureePre: number | null,
  ureePost: number | null,
): number | null {
  if (ureePre == null || ureePost == null) return null;
  if (ureePre === 0) return null;
  return Math.round(((ureePre - ureePost) / ureePre) * 10000) / 100;
}

/**
 * Statut biologique par rapport aux seuils configurables.
 * Retourne 'low' | 'ok' | 'high' | null.
 */
export function calculateBioStatus(
  value: number | null,
  seuilBas: number | null,
  seuilHaut: number | null,
): 'ok' | 'low' | 'high' | null {
  if (value == null) return null;
  if (seuilBas != null && value < seuilBas) return 'low';
  if (seuilHaut != null && value > seuilHaut) return 'high';
  return 'ok';
}

/** Produit phospho-calcique = calcium x phosphore */
export function calculateProductCaP(
  calcium: number | null,
  phosphore: number | null,
): number | null {
  if (calcium == null || phosphore == null) return null;
  return Math.round(calcium * phosphore * 100) / 100;
}
