# Section 3.1 — Séance d'hémodialyse : gaps restants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combler les 3 gaps restants de la section 3.1 : `actual_duration` auto-calculée depuis date début/fin, `pre_dialysis_bp` obligatoire, et banner HYPOTENSION dans le formulaire de séance.

**Architecture:** Approche 100% native Odoo, sans OWL. `actual_duration` devient un champ computed+inverse avec un champ de stockage `actual_duration_override`. `has_active_hypotension` est un Boolean computed/stored qui déclenche un `<div class="alert">` dans la vue XML.

**Tech Stack:** Odoo 19, Python 3, XML views (QWeb), `odoo.tests.common.TransactionCase`

**Spec:** `docs/superpowers/specs/2026-06-01-seance-hemodialyse-amelioree-gaps.md`

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `acs_hms_nephrology/models/hms_base.py` | Modifier | Champs `actual_duration_override`, `actual_duration` (computed+inverse), `pre_dialysis_bp` required, `has_active_hypotension` |
| `acs_hms_nephrology/views/nephrology_view.xml` | Modifier | Banner HYPOTENSION dans `view_acs_patient_procedure_ktv_inherit` |
| `acs_hms_nephrology/tests/test_nephrology_base.py` | Modifier | 2 tests dans `TestProcedureKTV` + nouvelle classe `TestHypotensionBanner` |

---

## Task 0 : Commit des changements unstaged en attente

> Ces changements existent déjà dans la working tree (vérifiés par `git diff`). Ils corrigent des labels de champs, un champ de test, et la config cron bilans. À commiter avant de démarrer le travail.

**Files:**
- Modify: `acs_hms_nephrology/models/hms_base.py`
- Modify: `acs_hms_nephrology/tests/test_nephrology_base.py`
- Modify: `acs_hms_nephrology_bilans/data/cron_data.xml`

- [ ] **Step 1: Vérifier l'état des changements**

```bash
git -C "/chemin/vers/repo" diff --stat
```

Expected : 3 fichiers modifiés (hms_base.py, test_nephrology_base.py, cron_data.xml)

- [ ] **Step 2: Commiter**

```bash
git add acs_hms_nephrology/models/hms_base.py \
        acs_hms_nephrology/tests/test_nephrology_base.py \
        acs_hms_nephrology_bilans/data/cron_data.xml

git commit -m "fix(nephrology): rename field labels with (Néphro) suffix, fix birthday field in test, fix cron XML ref"
```

---

## Task 1 : `actual_duration` — computed + inverse

**Files:**
- Modify: `acs_hms_nephrology/models/hms_base.py`
- Test: `acs_hms_nephrology/tests/test_nephrology_base.py`

### Étape TDD : écrire les tests d'abord

- [ ] **Step 1: Écrire les 2 tests dans `TestProcedureKTV`**

Ouvrir `acs_hms_nephrology/tests/test_nephrology_base.py`. Après `test_urr_calculated`, ajouter :

```python
def test_actual_duration_auto_from_dates(self):
    """actual_duration calculé depuis date/date_stop si non overridé"""
    from datetime import datetime
    self.procedure.write({
        'date': datetime(2026, 1, 1, 7, 0, 0),
        'date_stop': datetime(2026, 1, 1, 11, 0, 0),
    })
    self.procedure.invalidate_recordset()
    self.assertAlmostEqual(self.procedure.actual_duration, 4.0, places=1)

def test_actual_duration_manual_overrides_dates(self):
    """Saisie manuelle prend le dessus sur le calcul auto"""
    from datetime import datetime
    self.procedure.write({
        'date': datetime(2026, 1, 1, 7, 0, 0),
        'date_stop': datetime(2026, 1, 1, 11, 0, 0),
        'actual_duration': 3.5,
    })
    self.procedure.invalidate_recordset()
    self.assertAlmostEqual(self.procedure.actual_duration, 3.5, places=1)
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
python odoo-bin -i acs_hms_nephrology --test-enable \
  --test-tags acs_hms_nephrology.TestProcedureKTV \
  -d test_db --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK|actual_duration"
```

Expected : les 2 nouveaux tests échouent (le champ actuel est un Float manuel, pas computed).

- [ ] **Step 3: Implémenter `actual_duration_override` + `actual_duration` computed+inverse**

Dans `acs_hms_nephrology/models/hms_base.py`, dans la classe `AcsPatientProcedure`, **remplacer** le champ `actual_duration` existant :

```python
# Remplacer :
actual_duration = fields.Float(
    string='Durée effective (heures)',
    digits=(4, 2),
    help='Calculé depuis heure début et fin, ou saisi manuellement'
)
```

**Par :**

```python
actual_duration_override = fields.Float(
    string='Override durée (h)',
    digits=(4, 2),
    help='Rempli automatiquement si infirmier saisit manuellement la durée'
)
actual_duration = fields.Float(
    string='Durée effective (heures)',
    compute='_compute_actual_duration',
    inverse='_inverse_actual_duration',
    store=True,
    digits=(4, 2),
    help='Calculé automatiquement depuis heure début/fin. Saisie manuelle possible.'
)
```

- [ ] **Step 4: Ajouter les méthodes compute/inverse dans `AcsPatientProcedure`**

Après `_compute_weight_fields`, ajouter :

```python
@api.depends('date', 'date_stop', 'actual_duration_override')
def _compute_actual_duration(self):
    for rec in self:
        if rec.actual_duration_override:
            rec.actual_duration = rec.actual_duration_override
        elif rec.date and rec.date_stop:
            diff = rec.date_stop - rec.date
            rec.actual_duration = round(diff.total_seconds() / 3600, 2)
        else:
            rec.actual_duration = 0.0

def _inverse_actual_duration(self):
    for rec in self:
        rec.actual_duration_override = rec.actual_duration
```

> `_compute_ktv` dépend de `actual_duration` — aucun changement nécessaire. La formule KT/V retourne 0 si `actual_duration == 0`, ce qui est cliniquement correct.

- [ ] **Step 5: Vérifier que les tests passent**

```bash
python odoo-bin -i acs_hms_nephrology --test-enable \
  --test-tags acs_hms_nephrology.TestProcedureKTV \
  -d test_db --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK"
```

Expected : tous les tests `TestProcedureKTV` passent, incluant les 2 nouveaux.

- [ ] **Step 6: Commit**

```bash
git add acs_hms_nephrology/models/hms_base.py \
        acs_hms_nephrology/tests/test_nephrology_base.py

git commit -m "feat(nephrology): actual_duration computed+inverse from date/date_stop"
```

---

## Task 2 : `pre_dialysis_bp` — required=True

**Files:**
- Modify: `acs_hms_nephrology/models/hms_base.py`

> Pas de test unitaire dédié : `required=True` est une contrainte ORM/UI standard Odoo, pas de logique Python à tester. Les tests existants créent des procédures sans ce champ — vérifier qu'ils ne cassent pas.

- [ ] **Step 1: Ajouter `required=True`**

Dans `acs_hms_nephrology/models/hms_base.py`, trouver :

```python
pre_dialysis_bp = fields.Char(string='TA pré-dialyse', help='Ex: 140/90')
```

Remplacer par :

```python
pre_dialysis_bp = fields.Char(string='TA pré-dialyse', required=True, help='Ex: 140/90')
```

- [ ] **Step 2: Vérifier que les tests existants ne cassent pas**

Les tests `TestProcedureKTV`, `TestVitalSignExtended`, `TestDryWeightHistory` créent des `acs.patient.procedure` sans `pre_dialysis_bp`. Avec `required=True`, Odoo lève une contrainte uniquement au niveau de la vue, pas de l'ORM Python — les tests `create()` directs passent sans le champ.

Vérifier :

```bash
python odoo-bin -i acs_hms_nephrology --test-enable \
  --test-tags acs_hms_nephrology \
  -d test_db --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK"
```

Expected : tous les tests passent.

- [ ] **Step 3: Commit**

```bash
git add acs_hms_nephrology/models/hms_base.py

git commit -m "feat(nephrology): pre_dialysis_bp required=True (spec: obligatoire)"
```

---

## Task 3 : `has_active_hypotension` + bannière — modèle + vue + tests

**Files:**
- Modify: `acs_hms_nephrology/models/hms_base.py`
- Modify: `acs_hms_nephrology/views/nephrology_view.xml`
- Test: `acs_hms_nephrology/tests/test_nephrology_base.py`

### Étape TDD : écrire les tests d'abord

- [ ] **Step 1: Ajouter la classe `TestHypotensionBanner` dans les tests**

À la fin de `acs_hms_nephrology/tests/test_nephrology_base.py`, ajouter :

```python
class TestHypotensionBanner(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Banner'})
        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1) or self.env['product.product'].create({
            'name': 'Hémodialyse', 'type': 'service',
            'hospital_product_type': 'nephrology_procedure',
        })
        self.procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
        })

    def test_has_active_hypotension_true_when_vital_bp_low(self):
        """Banner actif si au moins un signe vital a TA systolique < 90"""
        self.env['hemodialysis.vital.sign'].create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '85/50',
        })
        self.procedure.invalidate_recordset()
        self.assertTrue(self.procedure.has_active_hypotension)

    def test_has_active_hypotension_false_when_all_normal(self):
        """Banner inactif si tous les signes vitaux sont normaux"""
        self.env['hemodialysis.vital.sign'].create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '120/80',
        })
        self.env['hemodialysis.vital.sign'].create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '115/75',
        })
        self.procedure.invalidate_recordset()
        self.assertFalse(self.procedure.has_active_hypotension)

    def test_has_active_hypotension_false_when_no_vitals(self):
        """Banner inactif si aucun signe vital enregistré"""
        self.assertFalse(self.procedure.has_active_hypotension)

    def test_has_active_hypotension_resets_when_vital_deleted(self):
        """Banner se désactive si le signe vital hypotensif est supprimé"""
        vital = self.env['hemodialysis.vital.sign'].create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '80/50',
        })
        self.procedure.invalidate_recordset()
        self.assertTrue(self.procedure.has_active_hypotension)

        vital.unlink()
        self.procedure.invalidate_recordset()
        self.assertFalse(self.procedure.has_active_hypotension)
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
python odoo-bin -i acs_hms_nephrology --test-enable \
  --test-tags acs_hms_nephrology.TestHypotensionBanner \
  -d test_db --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK|has_active"
```

Expected : `AttributeError: 'acs.patient.procedure' object has no attribute 'has_active_hypotension'`

- [ ] **Step 3: Ajouter `has_active_hypotension` dans le modèle**

Dans `acs_hms_nephrology/models/hms_base.py`, dans `AcsPatientProcedure`, après `vital_sign_ids` :

```python
has_active_hypotension = fields.Boolean(
    string='Hypotension active',
    compute='_compute_has_active_hypotension',
    store=True,
)

@api.depends('vital_sign_ids.is_hypotension')
def _compute_has_active_hypotension(self):
    for rec in self:
        rec.has_active_hypotension = any(rec.vital_sign_ids.mapped('is_hypotension'))
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
python odoo-bin -i acs_hms_nephrology --test-enable \
  --test-tags acs_hms_nephrology.TestHypotensionBanner \
  -d test_db --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK"
```

Expected : 4 tests `TestHypotensionBanner` passent.

- [ ] **Step 5: Ajouter la bannière dans la vue XML**

Dans `acs_hms_nephrology/views/nephrology_view.xml`, dans le record `view_acs_patient_procedure_ktv_inherit`, modifier le bloc `<field name="arrival_weight" position="before">` :

```xml
<!-- Statut arrivée — avant le bloc poids -->
<field name="arrival_weight" position="before">
    <field name="has_active_hypotension" invisible="1"/>
    <div class="alert alert-danger d-flex align-items-center gap-2 mb-2"
         invisible="not has_active_hypotension"
         role="alert">
        <i class="fa fa-exclamation-triangle fa-lg me-2"/>
        <span>
            <strong>HYPOTENSION DÉTECTÉE</strong>
            — TA systolique &lt; 90 mmHg sur un ou plusieurs signes vitaux.
        </span>
    </div>
    <group string="Statut à l'arrivée">
        <field name="arrival_status"/>
        <field name="pre_dialysis_bp"/>
        <field name="pre_dialysis_temp"/>
        <field name="parameter_change_reason"/>
    </group>
</field>
```

> Le groupe "Statut à l'arrivée" est conservé tel quel — seule la bannière est ajoutée au-dessus.

- [ ] **Step 6: Vérifier tous les tests du module**

```bash
python odoo-bin -i acs_hms_nephrology --test-enable \
  --test-tags acs_hms_nephrology \
  -d test_db --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK|Ran"
```

Expected : tous les tests passent (`Ran N tests ... OK`).

- [ ] **Step 7: Commit**

```bash
git add acs_hms_nephrology/models/hms_base.py \
        acs_hms_nephrology/views/nephrology_view.xml \
        acs_hms_nephrology/tests/test_nephrology_base.py

git commit -m "feat(nephrology): add hypotension banner and has_active_hypotension computed field"
```

---

## Self-Review

**Couverture spec :**
- ✅ `actual_duration` auto-calculée depuis `date`/`date_stop` — Task 1
- ✅ Override manuel infirmier → `actual_duration_override` — Task 1
- ✅ `pre_dialysis_bp` required=True — Task 2
- ✅ `has_active_hypotension` computed/stored — Task 3
- ✅ Bannière rouge dans le formulaire — Task 3
- ✅ Colorisation liste signes vitaux — déjà en place, non modifiée
- ✅ Commit changements unstaged préalables — Task 0

**Cohérence des noms :**
- `actual_duration_override` : défini Task 1, utilisé dans `_compute_actual_duration` et `_inverse_actual_duration` — cohérent
- `has_active_hypotension` : défini Task 3 modèle, référencé Task 3 vue — cohérent
- `_compute_actual_duration` / `_inverse_actual_duration` : définis et référencés dans le même task — cohérent

**Absence de placeholders :** Tous les steps contiennent du code complet.
