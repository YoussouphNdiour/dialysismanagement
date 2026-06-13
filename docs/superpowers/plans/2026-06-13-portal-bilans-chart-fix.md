# Portal Bilans — Chart.js Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activer les graphiques Chart.js sur `/my/bilans` dans `acs_hms_nephrology_portal` en embarquant la lib localement et en corrigeant `_build_chart_data`.

**Architecture:** Chart.js est ajouté comme asset statique Odoo (`web.assets_frontend`) afin de fonctionner hors-ligne. La méthode `_build_chart_data` est simplifiée pour utiliser les dates réelles des 6 derniers bilans plutôt que des labels de mois calendaires fictifs. Aucune modification du template QWeb n'est nécessaire.

**Tech Stack:** Odoo 19 (Python, QWeb, OWL), Chart.js v4.4 UMD, Playwright (E2E)

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `acs_hms_nephrology_portal/static/src/lib/chart.umd.min.js` | Créer | Bibliothèque Chart.js v4 (embarquée) |
| `acs_hms_nephrology_portal/__manifest__.py` | Modifier | Déclarer la lib dans `web.assets_frontend` |
| `acs_hms_nephrology_portal/controllers/portal.py` | Modifier | Corriger `_build_chart_data` |
| `acs_hms_nephrology_portal/tests/__init__.py` | Créer | Init du package de tests portail |
| `acs_hms_nephrology_portal/tests/test_chart_data.py` | Créer | Test unitaire de `_build_chart_data` |

---

## Task 1 : Télécharger et embarquer Chart.js

**Files:**
- Create: `acs_hms_nephrology_portal/static/src/lib/chart.umd.min.js`
- Modify: `acs_hms_nephrology_portal/__manifest__.py`

- [ ] **Step 1 : Créer le répertoire lib**

```bash
mkdir -p "acs_hms_nephrology_portal/static/src/lib"
```

- [ ] **Step 2 : Télécharger Chart.js v4.4 (UMD build)**

```bash
curl -L "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js" \
  -o "acs_hms_nephrology_portal/static/src/lib/chart.umd.min.js"
```

Vérifier que le fichier fait ~200 Ko et commence par `/*!` :

```bash
wc -c acs_hms_nephrology_portal/static/src/lib/chart.umd.min.js
head -c 80 acs_hms_nephrology_portal/static/src/lib/chart.umd.min.js
```

Expected output : taille entre 150 000 et 250 000 octets, début `/*!` ou `/*`.

- [ ] **Step 3 : Déclarer la lib dans le manifest**

Ouvrir `acs_hms_nephrology_portal/__manifest__.py`. Remplacer le bloc `assets` existant :

```python
    'assets': {
        'web.assets_frontend': [
            'acs_hms_nephrology_portal/static/src/css/portal_nephro.css',
            'acs_hms_nephrology_portal/static/src/lib/chart.umd.min.js',
        ],
    },
```

- [ ] **Step 4 : Commit**

```bash
git add acs_hms_nephrology_portal/static/src/lib/chart.umd.min.js \
        acs_hms_nephrology_portal/__manifest__.py
git commit -m "feat(portal): embed Chart.js v4.4 in frontend assets (no CDN)"
```

---

## Task 2 : Corriger `_build_chart_data` (TDD)

**Files:**
- Create: `acs_hms_nephrology_portal/tests/__init__.py`
- Create: `acs_hms_nephrology_portal/tests/test_chart_data.py`
- Modify: `acs_hms_nephrology_portal/controllers/portal.py`

### Step 1 : Écrire le test qui échoue

- [ ] **Créer `acs_hms_nephrology_portal/tests/__init__.py`** (vide)

```python
# -*- coding: utf-8 -*-
```

- [ ] **Créer `acs_hms_nephrology_portal/tests/test_chart_data.py`**

```python
# -*- coding: utf-8 -*-
import json
from datetime import datetime

from odoo.tests.common import TransactionCase


class TestBuildChartData(TransactionCase):
    """Vérifie que _build_chart_data génère des labels de dates réelles."""

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Chart Test'})

    def _make_bilan(self, date_str, hb, k, p):
        """Crée un bilan minimal avec les valeurs clés."""
        return self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'exam_date': datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S'),
            'hemoglobin': hb,
            'potassium': k,
            'phosphorus': p,
        })

    def test_chart_data_uses_real_dates_as_labels(self):
        """Les labels doivent être les dates réelles, pas des mois calendaires."""
        b1 = self._make_bilan('2026-01-15 08:00:00', 11.0, 4.5, 1.4)
        b2 = self._make_bilan('2026-02-20 08:00:00', 10.5, 5.0, 1.6)
        b3 = self._make_bilan('2026-03-10 08:00:00',  9.8, 5.2, 1.9)

        # Instancier le contrôleur pour appeler la méthode pure
        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        bilans = self.env['acs.nephro.bilan'].browse([b1.id, b2.id, b3.id])
        # Tri asc (comme dans portal_bilans())
        bilans = bilans.sorted('exam_date')

        result = json.loads(ctrl._build_chart_data(bilans))

        # Les labels doivent être les dates formatées, pas des noms de mois
        self.assertEqual(result['labels'], ['15/01/26', '20/02/26', '10/03/26'])
        self.assertAlmostEqual(result['hemoglobin'][0], 11.0)
        self.assertAlmostEqual(result['potassium'][1], 5.0)
        self.assertAlmostEqual(result['phosphorus'][2], 1.9)

    def test_chart_data_empty_bilans(self):
        """Avec 0 bilans, retourne des listes vides (pas d'exception)."""
        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        bilans = self.env['acs.nephro.bilan'].browse([])
        result = json.loads(ctrl._build_chart_data(bilans))

        self.assertEqual(result['labels'], [])
        self.assertEqual(result['hemoglobin'], [])

    def test_chart_data_missing_values_default_to_zero(self):
        """Les champs non renseignés (0 ou False) doivent valoir 0 dans la série."""
        b = self._make_bilan('2026-04-01 08:00:00', 0.0, 0.0, 0.0)
        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        bilans = self.env['acs.nephro.bilan'].browse([b.id])
        result = json.loads(ctrl._build_chart_data(bilans))

        self.assertEqual(result['hemoglobin'], [0.0])
        self.assertEqual(result['potassium'], [0.0])
```

- [ ] **Step 2 : Ajouter le module tests dans `__manifest__.py`**

Dans `acs_hms_nephrology_portal/__manifest__.py`, ajouter `'test'` dans la liste top-level si absent, sinon ajouter la clé :

```python
    'installable': True,
    'application': False,
    'auto_install': False,
```

Remplacer par :

```python
    'installable': True,
    'application': False,
    'auto_install': False,
    'test': ['tests/test_chart_data.py'],
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

```bash
cd "/Users/yusper/Downloads/modules 19"
./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --test-enable --stop-after-init \
  -i acs_hms_nephrology_portal \
  --test-tags=TestBuildChartData 2>&1 | grep -E "(FAIL|ERROR|OK|test_chart)"
```

Expected : `FAIL` ou `AssertionError` sur `test_chart_data_uses_real_dates_as_labels`.

### Step 4 : Implémenter la correction

- [ ] **Modifier `acs_hms_nephrology_portal/controllers/portal.py`**

Remplacer la méthode `_build_chart_data` et supprimer les imports inutilisés `date`, `timedelta`, `defaultdict` (vérifier qu'ils ne sont pas utilisés ailleurs dans le fichier).

Nouvelle méthode :

```python
    def _build_chart_data(self, bilans):
        """
        Construit le dict Chart.js depuis une liste ordonnée de acs.nephro.bilan.
        Les labels sont les dates réelles des bilans (format dd/mm/yy).
        Retourne un JSON string.
        """
        chart_data = {
            'labels':     [b.exam_date.strftime('%d/%m/%y') for b in bilans if b.exam_date],
            'hemoglobin': [round(b.hemoglobin or 0, 2) for b in bilans if b.exam_date],
            'potassium':  [round(b.potassium or 0, 2) for b in bilans if b.exam_date],
            'phosphorus': [round(b.phosphorus or 0, 2) for b in bilans if b.exam_date],
        }
        return json.dumps(chart_data)
```

Vérifier en tête du fichier que `json` est bien importé (il l'est déjà à la ligne 2).

Supprimer si non utilisés ailleurs dans le fichier :
```python
from collections import defaultdict
from datetime import date, timedelta
```

- [ ] **Step 5 : Lancer les tests et vérifier qu'ils passent**

```bash
cd "/Users/yusper/Downloads/modules 19"
./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --test-enable --stop-after-init \
  -i acs_hms_nephrology_portal \
  --test-tags=TestBuildChartData 2>&1 | grep -E "(FAIL|ERROR|OK|Ran|test_chart)"
```

Expected : `Ran 3 tests... OK`

- [ ] **Step 6 : Commit**

```bash
git add acs_hms_nephrology_portal/tests/__init__.py \
        acs_hms_nephrology_portal/tests/test_chart_data.py \
        acs_hms_nephrology_portal/controllers/portal.py \
        acs_hms_nephrology_portal/__manifest__.py
git commit -m "fix(portal): _build_chart_data uses real dates, drop calendar-month logic"
```

---

## Task 3 : Upgrade du module et vérification E2E

**Files:** (aucune modification — vérification uniquement)

- [ ] **Step 1 : Arrêter Odoo si en cours**

```bash
pkill -f "odoo.*asshafi" 2>/dev/null; sleep 2
```

- [ ] **Step 2 : Upgrader le module en DB**

```bash
cd "/Users/yusper/Downloads/modules 19"
nohup ./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 --log-level=warn \
  -u acs_hms_nephrology_portal > /tmp/odoo.log 2>&1 &
```

Attendre 20 secondes, vérifier qu'Odoo répond :

```bash
sleep 20 && curl -s -o /dev/null -w "%{http_code}" http://localhost:8069/web/health
```

Expected : `200`

- [ ] **Step 3 : Vérifier que Chart.js est bien servi par Odoo**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8069/web/assets/web.assets_frontend/acs_hms_nephrology_portal/static/src/lib/chart.umd.min.js"
```

Expected : `200` (ou `304`). Si `404`, vérifier que le manifest est bien sauvegardé et qu'Odoo a bien upgradé le module.

- [ ] **Step 4 : Lancer le test Playwright portail bilans**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/tests"
npx playwright test process/13_portail_patient.spec.js --reporter=line
```

Expected : `1 passed`

- [ ] **Step 5 : Vérifier visuellement les graphes (optionnel mais recommandé)**

Vérifier que le screenshot `13c_portail_bilans.png` montre bien 3 graphes ligne.

Si pas de bilans pour le patient de test, en créer un via l'interface admin :
- Aller sur `http://localhost:8069/odoo/patients` → ouvrir le patient lié à `patient@nephro.test`
- Onglet "Bilans Biologiques" → Nouveau bilan avec Hb=11.0, K=4.5, P=1.5

- [ ] **Step 6 : Commit final**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add -p  # vérifier qu'aucun fichier temp n'est inclus
git commit -m "chore: upgrade acs_hms_nephrology_portal — Chart.js charts verified E2E"
```

---

## Critères d'acceptance (rappel de la spec)

1. `/my/bilans` affiche 3 graphes ligne (Hb rouge, K bleu, Phosphore vert) si bilans existent
2. Les labels sont des dates réelles (`dd/mm/yy`), pas des mois calendaires
3. Aucune erreur JS dans la console navigateur
4. Page fonctionnelle sans accès internet
