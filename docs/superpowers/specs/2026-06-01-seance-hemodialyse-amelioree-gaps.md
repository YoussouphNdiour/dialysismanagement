# Section 3.1 — Séance d'hémodialyse améliorée : gaps restants

**Date :** 2026-06-01
**Sprint :** Sprint 2 (continuation)
**Module :** `acs_hms_nephrology`
**Fichiers concernés :**
- `acs_hms_nephrology/models/hms_base.py`
- `acs_hms_nephrology/views/nephrology_view.xml`
- `acs_hms_nephrology/tests/test_nephrology_base.py`

---

## Contexte

Les modèles, vues de base et tests couvrant la section 3.1 du spec principal ont été livrés en Sprint 1. Trois gaps subsistent avant de considérer la section comme complète :

1. `actual_duration` est saisi manuellement — il doit s'auto-calculer depuis `date_stop - date`
2. L'alerte HYPOTENSION est limitée à la colorisation de ligne dans la liste des signes vitaux — un banner persistant est requis dans le formulaire de séance
3. `pre_dialysis_bp` n'est pas marqué `required=True` malgré la mention "obligatoire" dans le spec

Le modèle de base `acs.patient.procedure` (module `acs_hms`) expose déjà `date` (début), `date_stop` (fin) et `duration` (calculée). Ces champs servent d'entrée pour l'auto-calcul.

---

## Design

### 1. Modèle — `hms_base.py`

#### 1.1 `actual_duration` — computed + inverse (overridable)

Remplace le champ Float manuel par un champ computed avec `store=True` et un `inverse` permettant la saisie manuelle de l'infirmier.

**Logique :**
- Si `date` et `date_stop` sont renseignés → calculé automatiquement : `(date_stop - date).total_seconds() / 3600`
- Si l'infirmier saisit manuellement une valeur → stockée dans `_actual_duration_manual`, prioritaire sur le calcul
- Si aucun des deux → `0.0` (le KT/V ne se calcule pas, comportement cliniquement correct)

**Implémentation :**

```python
actual_duration_override = fields.Float(store=True)  # valeur manuelle infirmier

actual_duration = fields.Float(
    string='Durée effective (heures)',
    compute='_compute_actual_duration',
    inverse='_inverse_actual_duration',
    store=True,
    digits=(4, 2),
    help='Calculé automatiquement depuis heure début/fin. Saisie manuelle possible.'
)

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

> `_compute_ktv` dépend de `actual_duration` — aucun changement nécessaire sur la formule KT/V.

#### 1.2 `pre_dialysis_bp` — required=True

```python
pre_dialysis_bp = fields.Char(
    string='TA pré-dialyse',
    required=True,
    help='Ex: 140/90'
)
```

> Les enregistrements existants sans valeur ne sont pas impactés tant qu'ils ne sont pas modifiés (comportement standard Odoo).

#### 1.3 `has_active_hypotension` — computed stored

Champ Boolean calculé depuis les signes vitaux de la séance. Déclenche le banner dans la vue.

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

---

### 2. Vues — `nephrology_view.xml`

#### 2.1 Bannière HYPOTENSION dans le formulaire de séance

Injectée dans `view_acs_patient_procedure_ktv_inherit`, positionnée avant le groupe "Statut à l'arrivée" pour être visible depuis tous les onglets du formulaire.

```xml
<field name="arrival_weight" position="before">
    <div class="alert alert-danger d-flex align-items-center gap-2 mb-2"
         invisible="not has_active_hypotension"
         role="alert">
        <i class="fa fa-exclamation-triangle"/>
        <strong>HYPOTENSION DÉTECTÉE</strong>
        — TA systolique &lt; 90 mmHg sur un ou plusieurs signes vitaux.
    </div>
    <field name="has_active_hypotension" invisible="1"/>
</field>
```

**Comportement :**
- Bannière rouge persistante, visible quel que soit l'onglet actif
- Disparaît si tous les signes vitaux hypotensifs sont supprimés ou corrigés
- N'interfère pas avec la colorisation de ligne existante dans la liste `vital_sign_ids`

#### 2.2 `actual_duration` — pas de changement de vue

Le champ computed+inverse est éditable nativement. Odoo affiche la valeur calculée ; l'infirmier peut la corriger directement dans le champ. Aucun changement XML nécessaire.

---

### 3. Tests — `test_nephrology_base.py`

#### 3.1 Ajouts dans `TestProcedureKTV`

```python
def test_actual_duration_auto_from_dates(self):
    """actual_duration calculé depuis date/date_stop si non overridé"""

def test_actual_duration_manual_overrides_dates(self):
    """Saisie manuelle prend le dessus sur le calcul auto"""
```

#### 3.2 Nouvelle classe `TestHypotensionBanner`

```python
class TestHypotensionBanner(TransactionCase):

    def test_has_active_hypotension_true(self):
        """Banner actif si au moins un signe vital en hypotension"""

    def test_has_active_hypotension_false_when_all_normal(self):
        """Banner inactif si tous les signes vitaux normaux"""

    def test_has_active_hypotension_resets_when_vital_removed(self):
        """Banner se désactive si le signe vital hypotensif est supprimé"""
```

---

## Périmètre hors-scope

- OWL / réactivité temps réel sans save → réservé au dashboard infirmier tablette (Sprint 2)
- Migration de données existantes → non nécessaire (`required=True` n'affecte pas les enregistrements existants)
- Changements sur `hemodialysis.vital.sign` → modèle complet, aucun gap

---

## Ordre d'implémentation recommandé

1. Commit les changements unstaged en attente (`hms_base.py` labels + test fix + cron fix)
2. `_actual_duration_manual` + `actual_duration` computed+inverse + tests
3. `pre_dialysis_bp` required=True
4. `has_active_hypotension` computed + vue banner + tests
5. Vérification finale : `odoo-bin -i acs_hms_nephrology --test-enable`
