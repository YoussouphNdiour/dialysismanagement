# Spec : Graphe évolution bilans — portail patient

**Date :** 2026-06-13  
**Module cible :** `acs_hms_nephrology_portal` (installé, state=installed)  
**Périmètre :** Activation de Chart.js sur la page `/my/bilans`

---

## Contexte

Le module `acs_hms_nephrology_portal` implémente déjà la page `/my/bilans` avec :
- Un contrôleur Python qui construit les données graphe (`_build_chart_data`)
- Un template QWeb avec 3 `<canvas>` (Hb, K, Phosphore) et le JS d'initialisation

**Problème :** Chart.js n'est chargé nulle part → les `new Chart(...)` sont ignorés silencieusement.

**Décision :** Embarquer Chart.js dans les assets Odoo (pas de CDN) pour garantir le fonctionnement hors-ligne en environnement hospitalier.

---

## Fichiers modifiés

| Fichier | Action |
|---|---|
| `static/src/lib/chart.umd.min.js` | Créer — Chart.js v4 minifié |
| `__manifest__.py` | Modifier — ajouter la lib dans `web.assets_frontend` |
| `controllers/portal.py` | Modifier — corriger `_build_chart_data` |
| `templates/portal_bilans.xml` | Aucun changement |

---

## Correction `_build_chart_data`

### Comportement actuel (bugué)
Génère 6 labels de mois calendaires et y associe les bilans par correspondance de mois. Perd des bilans si 2 tombent le même mois ; affiche des zéros si un mois est sans bilan.

### Nouveau comportement
Prend les 6 derniers bilans (order `exam_date asc`, limit 6) et utilise leur date réelle comme label.

```python
def _build_chart_data(self, bilans):
    chart_data = {
        'labels':     [b.exam_date.strftime('%d/%m/%y') for b in bilans],
        'hemoglobin': [round(b.hemoglobin or 0, 2) for b in bilans],
        'potassium':  [round(b.potassium or 0, 2) for b in bilans],
        'phosphorus': [round(b.phosphorus or 0, 2) for b in bilans],
    }
    return json.dumps(chart_data)
```

Le search dans `portal_bilans()` est déjà correct : `limit=6, order='exam_date asc'`.

---

## Chargement Chart.js

**Source :** télécharger `chart.umd.min.js` depuis le CDN npmjs (v4.x) **au moment du développement**, stocker dans le repo.

**Déclaration dans `__manifest__.py` :**
```python
'assets': {
    'web.assets_frontend': [
        'acs_hms_nephrology_portal/static/src/css/portal_nephro.css',
        'acs_hms_nephrology_portal/static/src/lib/chart.umd.min.js',
    ],
},
```

Chart.js UMD expose `window.Chart` — le JS inline du template l'utilise directement via `new Chart(ctx, ...)`, donc aucune modification du template n'est nécessaire.

---

## Critères d'acceptance

1. La page `/my/bilans` (connecté en tant que `patient@nephro.test`) affiche 3 graphes ligne (Hb rouge, K bleu, Phosphore vert).
2. Les labels sont des dates réelles (ex. `12/05/26`) et non des mois calendaires.
3. Aucune erreur JS dans la console.
4. La page fonctionne sans accès internet (Chart.js servi par Odoo).

---

## Hors périmètre

- Ajout de nouvelles courbes (albumine, URR…) — reporté si besoin
- Refresh dynamique sans rechargement — non nécessaire pour l'usage patient
- Recréation du code dans `acs_hms_nephrology_bilans/` — inutile, le module portal est déjà installé
