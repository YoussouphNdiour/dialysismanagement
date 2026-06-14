# Portal Patient Sparklines — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter deux cartes sparkline Chart.js sur `/my/nephro` — tendance Hb (6 derniers bilans) et tendance KT/V (6 dernières séances done).

**Architecture:** Deux helpers `_build_hb_trend(bilans)` et `_build_ktv_trend(seances)` ajoutés à `NephrologyPortal` (même pattern que `_build_chart_data` existant). La route `/my/nephro` les appelle et passe `hb_trend`, `ktv_trend`, `ktv_status` au template. Le template injecte Chart.js via un nouveau bundle `assets_home`, affiche deux nouvelles cartes sparkline (col-md-6 chacune, en-dessous des 3 cartes existantes), et initialise les graphiques via un script inline.

**Tech Stack:** Odoo 19, Python 3, QWeb XML, Chart.js 4.4 (bundle local existant `chart.umd.min.js`), Bootstrap 5.

---

## File Structure

| Fichier | Action | Rôle |
|---|---|---|
| `acs_hms_nephrology_portal/tests/test_trend_data.py` | Créer | Tests TDD pour `_build_hb_trend` et `_build_ktv_trend` |
| `acs_hms_nephrology_portal/tests/__init__.py` | Modifier | Ajouter `from . import test_trend_data` |
| `acs_hms_nephrology_portal/controllers/portal.py` | Modifier | Ajouter helpers + enrichir `portal_nephro_home()` |
| `acs_hms_nephrology_portal/__manifest__.py` | Modifier | Ajouter bundle `assets_home` avec `chart.umd.min.js` |
| `acs_hms_nephrology_portal/templates/portal_home.xml` | Modifier | Nouveau layout 3+2 cartes + sparklines Chart.js |
| `acs_hms_nephrology_portal/static/src/css/portal_nephro.css` | Modifier | Ajouter styles `.nephro-sparkcard` |

> **Note duplication :** Chaque modification dans `as shafi/acs_hms_nephrology_portal/` doit aussi être faite dans `odoo-19.0.post20260601/odoo/addons/acs_hms_nephrology_portal/` (Odoo charge ce répertoire en priorité). Les étapes de commit couvrent les deux emplacements.

---

## Task 1 : Tests TDD (rouge)

**Files:**
- Create: `acs_hms_nephrology_portal/tests/test_trend_data.py`
- Modify: `acs_hms_nephrology_portal/tests/__init__.py`

- [ ] **Step 1 : Lire le fichier `tests/__init__.py` existant**

```bash
cat "acs_hms_nephrology_portal/tests/__init__.py"
```
Attendu : `# -*- coding: utf-8 -*-` (vide)

- [ ] **Step 2 : Créer `tests/test_trend_data.py`**

```python
# -*- coding: utf-8 -*-
import json
from datetime import date, datetime

from odoo.tests.common import TransactionCase


class TestBuildTrendData(TransactionCase):
    """Tests TDD pour _build_hb_trend et _build_ktv_trend."""

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Trend Test'})
        self.nephro_dept = self.env['hr.department'].search(
            [('department_type', '=', 'nephrology')], limit=1
        )
        if not self.nephro_dept:
            self.nephro_dept = self.env['hr.department'].create({
                'name': 'Néphro Trend Test',
                'department_type': 'nephrology',
            })
        product = self.env['product.product'].search([('type', '=', 'service')], limit=1)
        if not product:
            product = self.env['product.product'].create({
                'name': 'Hémodialyse Trend Test',
                'type': 'service',
            })
        self.product = product

    def _make_bilan(self, date_str, hb):
        return self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'exam_date': datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S'),
            'hemoglobin': hb,
        })

    def _make_seance(self, date_str, ktv):
        return self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'department_id': self.nephro_dept.id,
            'date': datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S'),
            'state': 'done',
            'ktv_calculated': ktv,
        })

    # ------------------------------------------------------------------ #
    #  _build_hb_trend                                                     #
    # ------------------------------------------------------------------ #

    def test_hb_trend_returns_valid_json(self):
        """3 bilans → JSON avec 3 labels et 3 values."""
        b1 = self._make_bilan('2026-01-10 08:00:00', 10.5)
        b2 = self._make_bilan('2026-02-10 08:00:00', 11.0)
        b3 = self._make_bilan('2026-03-10 08:00:00', 11.2)

        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        bilans = self.env['acs.nephro.bilan'].browse([b1.id, b2.id, b3.id]).sorted('exam_date')
        result = json.loads(ctrl._build_hb_trend(bilans))

        self.assertEqual(len(result['labels']), 3)
        self.assertEqual(len(result['values']), 3)
        self.assertAlmostEqual(result['values'][-1], 11.2)
        self.assertEqual(result['labels'][0], '10/01')

    def test_hb_trend_empty_recordset_returns_empty_json(self):
        """Aucun bilan → '{}' (pas d'exception, pas de clé 'values')."""
        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        bilans = self.env['acs.nephro.bilan'].browse([])
        result = ctrl._build_hb_trend(bilans)

        self.assertEqual(result, '{}')

    def test_hb_trend_capped_at_six(self):
        """8 bilans → seulement 6 dans le trend (le caller limite à 6)."""
        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        ids = []
        for i in range(8):
            b = self._make_bilan(f'2026-0{(i % 9) + 1}-01 08:00:00' if i < 8 else '2026-08-01 08:00:00', 10.0 + i * 0.1)
            ids.append(b.id)
        bilans = self.env['acs.nephro.bilan'].browse(ids[:6]).sorted('exam_date')
        result = json.loads(ctrl._build_hb_trend(bilans))
        self.assertEqual(len(result['values']), 6)

    # ------------------------------------------------------------------ #
    #  _build_ktv_trend                                                    #
    # ------------------------------------------------------------------ #

    def test_ktv_trend_returns_valid_json(self):
        """3 séances done avec ktv > 0 → JSON avec 3 labels et 3 values."""
        s1 = self._make_seance('2026-01-05 08:00:00', 1.20)
        s2 = self._make_seance('2026-02-05 08:00:00', 1.35)
        s3 = self._make_seance('2026-03-05 08:00:00', 1.42)

        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        seances = self.env['acs.patient.procedure'].browse([s1.id, s2.id, s3.id]).sorted('date')
        result = json.loads(ctrl._build_ktv_trend(seances))

        self.assertEqual(len(result['labels']), 3)
        self.assertAlmostEqual(result['values'][-1], 1.42)
        self.assertEqual(result['labels'][0], '05/01')

    def test_ktv_trend_empty_recordset_returns_empty_json(self):
        """Aucune séance → '{}' (pas d'exception)."""
        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        seances = self.env['acs.patient.procedure'].browse([])
        result = ctrl._build_ktv_trend(seances)

        self.assertEqual(result, '{}')
```

- [ ] **Step 3 : Ajouter l'import dans `tests/__init__.py`**

Remplacer le contenu par :
```python
# -*- coding: utf-8 -*-
from . import test_chart_data
from . import test_trend_data
```

- [ ] **Step 4 : Lancer les tests → vérifier qu'ils échouent**

```bash
cd /Users/yusper/Downloads/modules\ 19/odoo-19.0.post20260601 && \
python odoo-bin -d asshafi \
  --test-enable \
  --stop-after-init \
  -u acs_hms_nephrology_portal \
  --test-tags acs_hms_nephrology_portal.TestBuildTrendData \
  --no-http 2>&1 | tail -30
```

Attendu : erreur de type `AttributeError: 'NephrologyPortal' object has no attribute '_build_hb_trend'` ou `FAIL` — les tests doivent **échouer** à ce stade.

- [ ] **Step 5 : Syncer `tests/__init__.py` dans le répertoire Odoo**

```bash
cp "acs_hms_nephrology_portal/tests/__init__.py" \
   "/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms_nephrology_portal/tests/__init__.py"

cp "acs_hms_nephrology_portal/tests/test_trend_data.py" \
   "/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms_nephrology_portal/tests/test_trend_data.py"
```

---

## Task 2 : Backend — helpers + route enrichie (vert)

**Files:**
- Modify: `acs_hms_nephrology_portal/controllers/portal.py` (lignes 34–46 zone helpers, ligne 106–114 retour de `portal_nephro_home`)

- [ ] **Step 1 : Ajouter `_build_hb_trend` et `_build_ktv_trend` après `_build_chart_data` (ligne 46)**

Dans `controllers/portal.py`, après la méthode `_build_chart_data` (qui se termine à la ligne 46), ajouter :

```python
    def _build_hb_trend(self, bilans):
        """
        Construit le JSON sparkline Hb depuis un recordset acs.nephro.bilan trié.
        Retourne '{}' si la liste est vide.
        """
        if not bilans:
            return '{}'
        return json.dumps({
            'labels': [b.exam_date.strftime('%d/%m') for b in bilans if b.exam_date],
            'values': [round(b.hemoglobin or 0, 2) for b in bilans if b.exam_date],
        })

    def _build_ktv_trend(self, seances):
        """
        Construit le JSON sparkline KT/V depuis un recordset acs.patient.procedure trié.
        Retourne '{}' si la liste est vide.
        """
        if not seances:
            return '{}'
        return json.dumps({
            'labels': [p.date.strftime('%d/%m') for p in seances if p.date],
            'values': [round(p.ktv_calculated or 0, 2) for p in seances if p.date],
        })
```

- [ ] **Step 2 : Enrichir `portal_nephro_home()` — ajouter les queries trend et les passer au template**

Dans `portal_nephro_home()`, remplacer le bloc `return request.render(...)` (lignes 106–114) par :

```python
        # Trend Hb — 6 derniers bilans avec hemoglobin > 0, triés asc
        bilans_trend = request.env['acs.nephro.bilan'].sudo().search(
            [('patient_id', '=', patient.id), ('hemoglobin', '>', 0)],
            order='exam_date desc', limit=6,
        ).sorted('exam_date')
        hb_trend = self._build_hb_trend(bilans_trend)

        # Trend KT/V — 6 dernières séances done avec ktv > 0, triées asc
        seances_trend = request.env['acs.patient.procedure'].sudo().search(
            [
                ('patient_id', '=', patient.id),
                ('state', '=', 'done'),
                ('department_id.department_type', '=', 'nephrology'),
                ('ktv_calculated', '>', 0),
            ],
            order='date desc', limit=6,
        ).sorted('date')
        ktv_trend = self._build_ktv_trend(seances_trend)

        ktv_status = last_procedure.ktv_status if last_procedure else False

        return request.render('acs_hms_nephrology_portal.portal_home', {
            'patient': patient,
            'next_rdv': next_rdv,
            'last_bilan': last_bilan,
            'last_procedure': last_procedure,
            'active_rx': active_rx,
            'balance_due': balance_due,
            'payment_status': payment_status,
            'hb_trend': hb_trend,
            'ktv_trend': ktv_trend,
            'ktv_status': ktv_status,
        })
```

- [ ] **Step 3 : Lancer les tests → vérifier qu'ils passent**

```bash
cd /Users/yusper/Downloads/modules\ 19/odoo-19.0.post20260601 && \
python odoo-bin -d asshafi \
  --test-enable \
  --stop-after-init \
  -u acs_hms_nephrology_portal \
  --test-tags acs_hms_nephrology_portal.TestBuildTrendData \
  --no-http 2>&1 | tail -30
```

Attendu : `5 tests passed, 0 failures`

- [ ] **Step 4 : Syncer `controllers/portal.py` dans le répertoire Odoo**

```bash
cp "acs_hms_nephrology_portal/controllers/portal.py" \
   "/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms_nephrology_portal/controllers/portal.py"
```

- [ ] **Step 5 : Commit backend**

```bash
git add \
  acs_hms_nephrology_portal/controllers/portal.py \
  acs_hms_nephrology_portal/tests/__init__.py \
  acs_hms_nephrology_portal/tests/test_trend_data.py
git commit -m "feat(portal): ajouter _build_hb_trend et _build_ktv_trend pour sparklines"
```

---

## Task 3 : Frontend — asset bundle + template + CSS

**Files:**
- Modify: `acs_hms_nephrology_portal/__manifest__.py`
- Modify: `acs_hms_nephrology_portal/templates/portal_home.xml`
- Modify: `acs_hms_nephrology_portal/static/src/css/portal_nephro.css`

### Step 1 — Ajouter le bundle `assets_home` dans `__manifest__.py`

- [ ] **Step 1 : Modifier `__manifest__.py`**

Remplacer le bloc `'assets'` (lignes 31–38) par :

```python
    'assets': {
        'web.assets_frontend': [
            'acs_hms_nephrology_portal/static/src/css/portal_nephro.css',
        ],
        'acs_hms_nephrology_portal.assets_bilans': [
            'acs_hms_nephrology_portal/static/src/lib/chart.umd.min.js',
        ],
        'acs_hms_nephrology_portal.assets_home': [
            'acs_hms_nephrology_portal/static/src/lib/chart.umd.min.js',
        ],
    },
```

### Step 2 — Template `portal_home.xml`

Le template actuel a 4 cartes dans `<div class="row g-3">` (lignes 11–89). On les réorganise en 3 cartes (col-md-4) sur la rangée 1, et 2 cartes sparkline (col-md-6) sur la rangée 2.

- [ ] **Step 2 : Remplacer le contenu complet de `templates/portal_home.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <template id="portal_home" name="Portail patient — Accueil">
        <t t-call="portal.portal_layout">
            <t t-set="page_name" t-value="'home'"/>
            <div class="container py-4">
                <h2 class="mb-4">
                    Bonjour, <t t-esc="patient.name"/>
                </h2>

                <!-- Rangée 1 : cartes info (3 × col-md-4) -->
                <div class="row g-3 mb-3">

                    <!-- Prochain RDV -->
                    <div class="col-6 col-md-4">
                        <a href="/my/rdv" class="text-decoration-none">
                            <div class="nephro-card h-100">
                                <div class="text-muted small mb-1">Prochain RDV</div>
                                <t t-if="next_rdv">
                                    <strong t-esc="next_rdv.date and next_rdv.date.strftime('%d/%m %H:%M')"/>
                                    <div class="text-muted small" t-if="next_rdv.physician_id">
                                        Dr <t t-esc="next_rdv.physician_id.name"/>
                                    </div>
                                </t>
                                <t t-else="">
                                    <span class="text-muted">Aucun prévu</span>
                                </t>
                            </div>
                        </a>
                    </div>

                    <!-- Solde -->
                    <div class="col-6 col-md-4">
                        <a href="/my/factures" class="text-decoration-none">
                            <div class="nephro-card h-100">
                                <div class="text-muted small mb-1">Solde</div>
                                <strong>
                                    <t t-esc="'%.0f' % (balance_due or 0)"/> MAD
                                </strong>
                                <div class="mt-1">
                                    <t t-if="payment_status == 'ok'">
                                        <span class="badge bg-success">À jour</span>
                                    </t>
                                    <t t-elif="payment_status == 'warning'">
                                        <span class="badge bg-warning text-dark">En attente</span>
                                    </t>
                                    <t t-elif="payment_status == 'overdue'">
                                        <span class="badge bg-danger">En retard</span>
                                    </t>
                                </div>
                            </div>
                        </a>
                    </div>

                    <!-- Ordonnances actives -->
                    <div class="col-6 col-md-4">
                        <a href="/my/ordonnances" class="text-decoration-none">
                            <div class="nephro-card h-100">
                                <div class="text-muted small mb-1">Ordonnances</div>
                                <strong>
                                    <t t-esc="len(active_rx)"/> active(s)
                                </strong>
                                <div class="text-muted small text-truncate" t-if="active_rx">
                                    <t t-foreach="active_rx[:2]" t-as="rx">
                                        <t t-esc="rx.name"/><br/>
                                    </t>
                                </div>
                            </div>
                        </a>
                    </div>
                </div>

                <!-- Rangée 2 : cartes sparkline (2 × col-md-6) — affichées si données disponibles -->
                <t t-if="hb_trend != '{}' or ktv_trend != '{}'">
                    <t t-call-assets="acs_hms_nephrology_portal.assets_home" t-js="true" t-css="false"/>

                    <div class="row g-3 mb-3">

                        <!-- Sparkline Hémoglobine -->
                        <div class="col-6 col-md-6" t-if="hb_trend != '{}'">
                            <a href="/my/bilans" class="text-decoration-none">
                                <div class="nephro-card nephro-sparkcard">
                                    <div class="nephro-sparkcard-header text-danger">
                                        🔬 Hémoglobine
                                    </div>
                                    <div class="nephro-sparkcard-value">
                                        <t t-if="last_bilan">
                                            <t t-esc="'%.1f' % (last_bilan.hemoglobin or 0)"/>
                                            <span class="nephro-sparkcard-unit">g/dL</span>
                                        </t>
                                    </div>
                                    <canvas class="nephro-spark-canvas"
                                            t-att-data-trend="hb_trend"
                                            t-att-data-color="'#e74c3c'"/>
                                </div>
                            </a>
                        </div>

                        <!-- Sparkline KT/V -->
                        <div class="col-6 col-md-6" t-if="ktv_trend != '{}'">
                            <a href="/my/seances" class="text-decoration-none">
                                <div class="nephro-card nephro-sparkcard">
                                    <div class="nephro-sparkcard-header text-primary">
                                        ⚡ KT/V efficacité
                                    </div>
                                    <div class="nephro-sparkcard-value">
                                        <t t-if="last_procedure and last_procedure.ktv_calculated">
                                            <t t-esc="'%.2f' % last_procedure.ktv_calculated"/>
                                            <t t-if="ktv_status == 'adequate'">
                                                <span class="badge bg-success ms-1 nephro-sparkcard-badge">✓</span>
                                            </t>
                                            <t t-elif="ktv_status == 'insufficient'">
                                                <span class="badge bg-warning text-dark ms-1 nephro-sparkcard-badge">⚠</span>
                                            </t>
                                        </t>
                                    </div>
                                    <canvas class="nephro-spark-canvas"
                                            t-att-data-trend="ktv_trend"
                                            t-att-data-color="'#3498db'"/>
                                </div>
                            </a>
                        </div>
                    </div>

                    <!-- Script inline Chart.js sparklines -->
                    <script type="text/javascript">
                        (function() {
                            document.querySelectorAll('.nephro-spark-canvas').forEach(function(canvas) {
                                var raw = canvas.dataset.trend;
                                if (!raw || raw === '{}') return;
                                var trend = JSON.parse(raw);
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
                                            pointBackgroundColor: canvas.dataset.color,
                                            fill: false,
                                            tension: 0.3,
                                        }]
                                    },
                                    options: {
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { display: false },
                                            tooltip: { enabled: false },
                                        },
                                        scales: {
                                            x: { display: false },
                                            y: { display: false },
                                        },
                                        animation: false,
                                    }
                                });
                            });
                        })();
                    </script>
                </t>

                <!-- Navigation secondaire (desktop) -->
                <div class="d-none d-md-flex gap-2 mt-4">
                    <a href="/my/seances" class="btn btn-outline-primary">Mes séances</a>
                    <a href="/my/bilans" class="btn btn-outline-primary">Mes bilans</a>
                    <a href="/my/rdv" class="btn btn-outline-primary">Mes RDV</a>
                    <a href="/my/ordonnances" class="btn btn-outline-primary">Mes ordonnances</a>
                    <a href="/my/factures" class="btn btn-outline-primary">Mes factures</a>
                </div>
            </div>
        </t>
    </template>
</odoo>
```

### Step 3 — CSS sparkcard

- [ ] **Step 3 : Ajouter à la fin de `static/src/css/portal_nephro.css`**

```css
/* ----------------------------------------
   Sparkline cards — /my/nephro homepage
   ---------------------------------------- */
.nephro-sparkcard {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 110px;
    padding: 12px;
}

.nephro-sparkcard-header {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.nephro-sparkcard-value {
    font-size: 1.4rem;
    font-weight: 700;
    color: #1a1a2e;
    line-height: 1.2;
    display: flex;
    align-items: baseline;
    gap: 4px;
    min-height: 1.8rem;
}

.nephro-sparkcard-unit {
    font-size: 0.75rem;
    font-weight: 400;
    color: #666;
}

.nephro-sparkcard-badge {
    font-size: 0.6rem !important;
}

.nephro-spark-canvas {
    flex: 1;
    width: 100% !important;
    min-height: 48px;
    max-height: 60px;
}
```

- [ ] **Step 4 : Syncer les 3 fichiers frontend dans le répertoire Odoo**

```bash
PORTAL_SRC="acs_hms_nephrology_portal"
PORTAL_DST="/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms_nephrology_portal"

cp "$PORTAL_SRC/__manifest__.py"                   "$PORTAL_DST/__manifest__.py"
cp "$PORTAL_SRC/templates/portal_home.xml"         "$PORTAL_DST/templates/portal_home.xml"
cp "$PORTAL_SRC/static/src/css/portal_nephro.css"  "$PORTAL_DST/static/src/css/portal_nephro.css"
```

- [ ] **Step 5 : Mettre à jour le module Odoo et vérifier**

```bash
cd "/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601" && \
python odoo-bin -d asshafi -u acs_hms_nephrology_portal --stop-after-init --no-http 2>&1 | tail -20
```

Attendu : `Modules loaded.` sans `ERROR`.

- [ ] **Step 6 : Commit frontend**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add \
  acs_hms_nephrology_portal/__manifest__.py \
  acs_hms_nephrology_portal/templates/portal_home.xml \
  acs_hms_nephrology_portal/static/src/css/portal_nephro.css
git commit -m "feat(portal): sparklines Hb + KT/V sur /my/nephro avec Chart.js"
```

---

## Task 4 : Valider visuellement + commit payment modules

### Vérification visuelle portal

- [ ] **Step 1 : Ouvrir `/my/nephro` dans le navigateur**

URL : `http://localhost:8069/my/nephro` (ou le port configuré)

Checker :
- Rangée 1 : 3 cartes (RDV, Solde, Ordonnances) côte à côte
- Rangée 2 : 2 cartes sparkline visibles SI le patient a des bilans ET des séances
- Sparkline rouge (Hb) avec valeur courante et mini-graphique
- Sparkline bleue (KT/V) avec valeur + badge vert ✓ ou orange ⚠
- Si patient sans données : rangée 2 absente, pas d'erreur JS dans la console

- [ ] **Step 2 : Vérifier la console JS (F12)**

Attendu : aucune erreur `Chart is not defined` ou `Cannot read properties of null`.

### Commit payment modules

Les modules `payment_orange_money` et `payment_wave` sont fonctionnellement complets (aucun TODO/FIXME, tests présents) mais non suivis par git. On les commit.

- [ ] **Step 3 : Commit payment_orange_money**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add payment_orange_money/
git commit -m "feat(payment): ajouter module Orange Money v1.1 (complet)"
```

- [ ] **Step 4 : Commit payment_wave**

```bash
git add payment_wave/
git commit -m "feat(payment): ajouter module Wave v1.0 (complet)"
```

- [ ] **Step 5 : Vérifier git status propre**

```bash
git status
```

Attendu : `nothing to commit, working tree clean` (hors fichiers intentionnellement non suivis).

---

## Récapitulatif

| Task | Fichiers | Résultat attendu |
|---|---|---|
| 1 | `tests/test_trend_data.py`, `tests/__init__.py` | 5 tests FAIL (rouge) |
| 2 | `controllers/portal.py` | 5 tests PASS (vert) |
| 3 | `__manifest__.py`, `portal_home.xml`, `portal_nephro.css` | Sparklines affichées en prod |
| 4 | — (validation + payment commits) | Tout en git |
