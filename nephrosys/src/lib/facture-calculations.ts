/**
 * Calculs de facturation — fonctions pures.
 * Tous les montants en FCFA (decimal string ou number).
 */

/** Calcule le montant d'une ligne : quantite x prix unitaire */
export function calculateLigneMontant(quantite: number, prixUnitaire: number): number {
  return Math.round(quantite * prixUnitaire * 100) / 100;
}

/** Calcule le total des supplements a partir des lignes (exclut la ligne forfait = articleId null) */
export function calculateMontantSupplements(
  lignes: { articleId: string | null; montant: string }[],
): number {
  let total = 0;
  for (const ligne of lignes) {
    if (ligne.articleId !== null) {
      total += parseFloat(ligne.montant);
    }
  }
  return Math.round(total * 100) / 100;
}

/** Calcule le montant total = base + supplements */
export function calculateMontantTotal(montantBase: number, montantSupplements: number): number {
  return Math.round((montantBase + montantSupplements) * 100) / 100;
}
