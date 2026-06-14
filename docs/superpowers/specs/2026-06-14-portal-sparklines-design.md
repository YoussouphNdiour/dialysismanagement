# Portal Patient Sparklines — Design Spec

## Goal

Ajouter deux cartes sparkline Chart.js sur la page d'accueil patient `/my/nephro` :
- **Hémoglobine** : valeur courante + tendance sur les 6 derniers bilans
- **KT/V** : valeur courante + badge efficacité + tendance sur les 6 dernières séances done

## Architecture

### Composants modifiés

| Fichier | Rôle | Changement |
|---|---|---|
| `controllers/portal.py` | Route `/my/nephro` | +2 datasets JSON (`hb_trend`, `ktv_trend`) |
| `views/portal_home.xml` | Template homepage | Remplacer carte "Dernier bilan" par 2 cartes sparkline |
| `__manifest__.py` | Assets | Nouveau bundle `assets_home` chargeant `chart.umd.min.js` |
| `static/src/css/portal_nephro.css` | Styles | Ajouter `.nephro-sparkcard` |

### Aucun fichier créé — uniquement des modifications.

---

## Backend — `controllers/portal.py`

### Route `/my/nephro` — données ajoutées

La méthode existante `portal_nephro_home()` récupère déjà `last_bilan` et `last_procedure`. On enrichit en ajoutant :

```python
# Hb trend — 6 derniers bilans avec hemoglobin > 0
bilans_trend = request.env['acs.nephro.bilan'].sudo().search(
    [('patient_id', '=', patient.id), ('hemoglobin', '>', 0)],
    order='exam_date desc', limit=6
).sorted('exam_date')

hb_trend = json.dumps({
    'labels': [b.exam_date.strftime('%d/%m') for b in bilans_trend],
    'values': [round(b.hemoglobin, 2) for b in bilans_trend],
})

# KT/V trend — 6 dernières séances done avec ktv_calculated > 0
seances_trend = request.env['acs.patient.procedure'].sudo().search(
    [
        ('patient_id', '=', patient.id),
        ('state', '=', 'done'),
        ('department_id.department_type', '=', 'nephrology'),
        ('ktv_calculated', '>', 0),
    ],
    order='date desc', limit=6
).sorted('date')

ktv_trend = json.dumps({
    'labels': [p.date.strftime('%d/%m') for p in seances_trend],
    'values': [round(p.ktv_calculated, 2) for p in seances_trend],
})
```

Valeurs retournées au template (en plus de l'existant) :
- `hb_trend` : JSON string `{ labels: [...], values: [...] }` — vide `"{}"` si aucun bilan
- `ktv_trend` : JSON string `{ labels: [...], values: [...] }` — vide `"{}"` si aucune séance
- `hb_current` : float dernière valeur Hb (déjà dans `last_bilan.hemoglobin`, réexposé pour clarté)
- `ktv_current` : float dernière valeur KT/V (déjà dans `last_procedure.ktv_calculated`)
- `ktv_status` : string `'adequate'` / `'insufficient'` / `False` (depuis `last_procedure.ktv_status`)

`json` est déjà importé si besoin (sinon : `import json` en haut du fichier).

---

## Frontend — `views/portal_home.xml`

### Layout avant → après

**Avant :** 4 cartes égales (col-6 col-md-3)
```
[RDV]  [Dernier bilan — Hb valeur seule]  [Solde]  [Ordonnances]
```

**Après :** Rangée 1 : 3 cartes × `col-6 col-md-4` (RDV, Solde, Ordonnances). Rangée 2 : 2 cartes sparkline × `col-6 col-md-6` (plus larges pour le graphique).
```
[RDV  col-md-4]  [Solde  col-md-4]  [Ordonnances  col-md-4]
[Hb sparkline  col-md-6]  [KT/V sparkline  col-md-6]
```

### Template Hb card

```xml
<div class="col-6 col-md-6" t-if="hb_trend and hb_trend != '{}'">
  <div class="nephro-card nephro-sparkcard">
    <div class="nephro-sparkcard-header text-danger">🔬 Hémoglobine</div>
    <div class="nephro-sparkcard-value">
      <span t-esc="'%.1f' % (last_bilan.hemoglobin if last_bilan else 0)"/>
      <span class="nephro-sparkcard-unit">g/dL</span>
    </div>
    <canvas class="nephro-spark-canvas"
            t-att-data-trend="hb_trend"
            t-att-data-color="'#e74c3c'"/>
  </div>
</div>
```

### Template KT/V card

```xml
<div class="col-6 col-md-6" t-if="ktv_trend and ktv_trend != '{}'">
  <div class="nephro-card nephro-sparkcard">
    <div class="nephro-sparkcard-header text-primary">⚡ KT/V efficacité</div>
    <div class="nephro-sparkcard-value">
      <span t-esc="'%.2f' % (last_procedure.ktv_calculated if last_procedure else 0.0)"/>
      <span t-if="ktv_status == 'adequate'"
            class="badge bg-success ms-1" style="font-size:0.6rem;">✓</span>
      <span t-elif="ktv_status == 'insufficient'"
            class="badge bg-warning ms-1" style="font-size:0.6rem;">⚠</span>
    </div>
    <canvas class="nephro-spark-canvas"
            t-att-data-trend="ktv_trend"
            t-att-data-color="'#3498db'"/>
  </div>
</div>
```

### Script inline (en bas du template, une seule fois)

```xml
<t t-if="hb_trend or ktv_trend">
  <script>
    document.querySelectorAll('.nephro-spark-canvas').forEach(function(canvas) {
      var trend = JSON.parse(canvas.dataset.trend || '{}');
      if (!trend.labels || !trend.labels.length) return;
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: trend.labels,
          datasets: [{
            data: trend.values,
            borderColor: canvas.dataset.color,
            borderWidth: 2,
            pointRadius: 2,
            fill: false,
            tension: 0.3,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
          animation: false,
        }
      });
    });
  </script>
</t>
```

---

## Assets — `__manifest__.py`

Ajouter un bundle dédié à la homepage (pour ne pas charger Chart.js partout) :

```python
'acs_hms_nephrology_portal.assets_home': [
    'acs_hms_nephrology_portal/static/src/lib/chart.umd.min.js',
],
```

Dans `portal_home.xml` (dans le bloc `<head>` ou via `t-call-assets`) :

```xml
<t t-call-assets="acs_hms_nephrology_portal.assets_home" t-js="true" t-css="false"/>
```

---

## CSS — `static/src/css/portal_nephro.css`

```css
.nephro-sparkcard {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 110px;
}

.nephro-sparkcard-header {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.nephro-sparkcard-value {
    font-size: 1.4rem;
    font-weight: 700;
    color: #1a1a2e;
    line-height: 1.2;
    display: flex;
    align-items: baseline;
    gap: 4px;
}

.nephro-sparkcard-unit {
    font-size: 0.75rem;
    font-weight: 400;
    color: #666;
}

.nephro-spark-canvas {
    flex: 1;
    width: 100% !important;
    min-height: 45px;
    max-height: 55px;
}
```

---

## Tests Python

Fichier : `tests/test_portal_trend_data.py`  
Classe : `TestPortalTrendData(TransactionCase)`

Le contrôleur est pur Python — on peut tester `_build_trend_data()` directement sans HTTP.
On extrait la logique de calcul dans une méthode helper testable du contrôleur.

### Méthode helper à extraire dans le contrôleur

```python
def _build_trend_data(self, patient):
    """Retourne (hb_trend_json, ktv_trend_json) pour un patient."""
    bilans = request.env['acs.nephro.bilan'].sudo().search(
        [('patient_id', '=', patient.id), ('hemoglobin', '>', 0)],
        order='exam_date desc', limit=6
    ).sorted('exam_date')
    hb = {'labels': [b.exam_date.strftime('%d/%m') for b in bilans],
          'values': [round(b.hemoglobin, 2) for b in bilans]}

    seances = request.env['acs.patient.procedure'].sudo().search(
        [('patient_id', '=', patient.id), ('state', '=', 'done'),
         ('department_id.department_type', '=', 'nephrology'),
         ('ktv_calculated', '>', 0)],
        order='date desc', limit=6
    ).sorted('date')
    ktv = {'labels': [p.date.strftime('%d/%m') for p in seances],
           'values': [round(p.ktv_calculated, 2) for p in seances]}

    return json.dumps(hb) if hb['labels'] else '{}', \
           json.dumps(ktv) if ktv['labels'] else '{}'
```

### Test 1 — 3 bilans → hb_trend contient 3 entrées

```python
def test_hb_trend_with_three_bilans(self):
    product = self._get_or_create_product()
    for hb_val in [10.5, 11.0, 11.2]:
        self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'exam_date': fields.Date.today(),
            'hemoglobin': hb_val,
        })
    hb_json, _ = self.controller._build_trend_data(self.patient)
    data = json.loads(hb_json)
    self.assertEqual(len(data['labels']), 3)
    self.assertEqual(len(data['values']), 3)
    self.assertAlmostEqual(data['values'][-1], 11.2)
```

### Test 2 — Aucun bilan → hb_trend = '{}'

```python
def test_hb_trend_empty_when_no_bilans(self):
    hb_json, _ = self.controller._build_trend_data(self.patient)
    self.assertEqual(hb_json, '{}')
```

### Test 3 — 10 séances → ktv_trend limité à 6

```python
def test_ktv_trend_capped_at_six(self):
    product = self._get_or_create_product()
    for i in range(10):
        self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
            'department_id': self.nephro_dept.id,
            'date': fields.Datetime.now(),
            'state': 'done',
            'ktv_calculated': 1.2 + i * 0.05,
        })
    _, ktv_json = self.controller._build_trend_data(self.patient)
    data = json.loads(ktv_json)
    self.assertEqual(len(data['values']), 6)
```

### Test 4 — Séances avec ktv=0 exclues

```python
def test_ktv_trend_excludes_zero_ktv(self):
    product = self._get_or_create_product()
    # 2 séances ktv=0 (exclues)
    for _ in range(2):
        self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
            'department_id': self.nephro_dept.id,
            'date': fields.Datetime.now(),
            'state': 'done',
            'ktv_calculated': 0.0,
        })
    # 3 séances ktv>0
    for i in range(3):
        self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
            'department_id': self.nephro_dept.id,
            'date': fields.Datetime.now(),
            'state': 'done',
            'ktv_calculated': 1.3 + i * 0.1,
        })
    _, ktv_json = self.controller._build_trend_data(self.patient)
    data = json.loads(ktv_json)
    self.assertEqual(len(data['values']), 3)
```

---

## Contraintes

- Chart.js déjà présent dans `static/src/lib/chart.umd.min.js` — ne pas re-télécharger
- `t-call-assets` pour le bundle home : disponible en Odoo 17+ / 19
- Les cartes sparkline ne s'affichent que si des données existent (`t-if`)
- Fallback gracieux si pas de bilan/séance : la carte disparaît, pas d'erreur JS
- Mobile : les cartes en col-6 → 2 par ligne, sparkline visible
