# Sprint 1 — Fondations Cliniques : Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir le module `acs_hms_nephrology` existant avec les postes de dialyse, l'historique de poids sec, les signes vitaux étendus, le calcul automatique KT/V/URR, puis créer deux nouveaux modules : `acs_hms_nephrology_complications` (suivi des incidents per-séance) et `acs_hms_nephrology_bilans` (bilans biologiques complets avec seuils et alertes).

**Architecture:** Trois modules Odoo 19, tous non-destructifs vis-à-vis des modules ACS existants. Chaque nouveau modèle hérite ou étend un modèle existant via `_inherit`. Les tests utilisent `odoo.tests.common.TransactionCase`. Les vues XML étendent les vues existantes via `inherit_id`.

**Tech Stack:** Odoo 19, Python 3.10+, XML (vues QWeb/Odoo), OWL (Odoo Web Library pour le chart), PostgreSQL 18, Docker.

**Référence spec:** `docs/superpowers/specs/2026-05-31-dialyse-nephro-platform-design.md`

**Commande de test (remplacer `<DB>` par le nom de votre base) :**
```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u <MODULE> \
  --log-level=test 2>&1 | grep -E "FAIL|ERROR|ok|test_"
```

---

## Structure des fichiers

```
acs_hms_nephrology/                         (EXISTANT — modifié)
├── models/
│   ├── hms_base.py                         MODIFIÉ — ajout champs procedure + vital sign + dry weight history
│   └── nephrology.py                       MODIFIÉ — ajout acs.dialysis.station + schedule étendu
├── views/
│   ├── nephrology_base_view.xml            MODIFIÉ — vues station dialyse
│   ├── nephrology_view.xml                 MODIFIÉ — form procedure enrichi
│   └── patient_customization_view.xml      MODIFIÉ — onglet historique poids sec
├── security/
│   └── ir.model.access.csv                 MODIFIÉ — accès station + dry weight history
└── tests/
    ├── __init__.py                         CRÉÉ
    └── test_nephrology_base.py             CRÉÉ

acs_hms_nephrology_complications/           (NOUVEAU)
├── __init__.py
├── __manifest__.py
├── models/
│   ├── __init__.py
│   └── complication.py                     — acs.dialysis.complication
├── views/
│   ├── complication_view.xml
│   └── menu_item.xml
├── security/
│   ├── security.xml
│   └── ir.model.access.csv
└── tests/
    ├── __init__.py
    └── test_complication.py

acs_hms_nephrology_bilans/                  (NOUVEAU)
├── __init__.py
├── __manifest__.py
├── models/
│   ├── __init__.py
│   ├── bilan.py                            — acs.nephro.bilan (tous les groupes bio)
│   └── bilan_threshold.py                 — acs.nephro.bilan.threshold (seuils paramétrables)
├── views/
│   ├── bilan_view.xml
│   ├── bilan_threshold_view.xml
│   ├── patient_bilan_tab.xml              — onglet Bilans sur fiche patient
│   └── menu_item.xml
├── security/
│   ├── security.xml
│   └── ir.model.access.csv
├── data/
│   └── default_thresholds.xml            — seuils par défaut KDIGO
├── report/
│   └── bilan_report.xml                  — rapport PDF QWeb
├── static/src/
│   ├── components/
│   │   ├── bilan_chart.js                — composant OWL graphique évolution
│   │   └── bilan_chart.xml               — template OWL
│   └── css/
│       └── bilan_chart.css
└── tests/
    ├── __init__.py
    └── test_bilan.py
```

---

## MODULE A — `acs_hms_nephrology` : Améliorations

---

### Task 1 : Modèle `acs.dialysis.station` (postes de dialyse)

**Files:**
- Modify: `acs_hms_nephrology/models/nephrology.py`
- Modify: `acs_hms_nephrology/views/nephrology_base_view.xml`
- Modify: `acs_hms_nephrology/security/ir.model.access.csv`
- Create: `acs_hms_nephrology/tests/__init__.py`
- Create: `acs_hms_nephrology/tests/test_nephrology_base.py`

- [ ] **Step 1 : Créer le fichier de tests**

Créer `acs_hms_nephrology/tests/__init__.py` :
```python
from . import test_nephrology_base
```

Créer `acs_hms_nephrology/tests/test_nephrology_base.py` :
```python
# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase


class TestDialysisStation(TransactionCase):

    def test_station_creation_standard(self):
        station = self.env['acs.dialysis.station'].create({
            'name': 'Poste 1 - Salle A',
            'room': 'Salle A',
            'station_type': 'standard',
            'equipment_model': 'Fresenius 5008S',
        })
        self.assertEqual(station.name, 'Poste 1 - Salle A')
        self.assertEqual(station.station_type, 'standard')
        self.assertTrue(station.active)

    def test_station_isolation_type(self):
        station = self.env['acs.dialysis.station'].create({
            'name': 'Poste ISO-1',
            'room': 'Salle Isolement',
            'station_type': 'isolation',
        })
        self.assertEqual(station.station_type, 'isolation')

    def test_station_inactive(self):
        station = self.env['acs.dialysis.station'].create({
            'name': 'Poste 2 - Maintenance',
            'room': 'Salle B',
            'station_type': 'standard',
            'active': False,
        })
        # Station inactive ne doit pas apparaître dans les recherches par défaut
        active_stations = self.env['acs.dialysis.station'].search([])
        self.assertNotIn(station, active_stations)
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "FAIL|ERROR|test_station"
```

Attendu : `ERROR — acs.dialysis.station does not exist`

- [ ] **Step 3 : Ajouter le modèle dans `nephrology.py`**

Ajouter à la fin de `acs_hms_nephrology/models/nephrology.py` (avant la dernière ligne `# vim`) :

```python
class ACSDialysisStation(models.Model):
    _name = 'acs.dialysis.station'
    _description = 'Poste de Dialyse'
    _order = 'name'

    name = fields.Char(string='Nom / Numéro', required=True,
                       help="Ex: Poste 3 - Salle B")
    room = fields.Char(string='Salle / Secteur')
    station_type = fields.Selection([
        ('standard', 'Standard'),
        ('isolation', 'Isolement (HBs+, VHC+)'),
    ], string='Type', required=True, default='standard')
    active = fields.Boolean(string='Actif', default=True)
    equipment_model = fields.Char(string='Modèle du générateur',
                                   help="Ex: Fresenius 5008S")
    notes = fields.Text(string='Notes techniques')
```

- [ ] **Step 4 : Ajouter les droits d'accès dans `ir.model.access.csv`**

Ajouter ces lignes dans `acs_hms_nephrology/security/ir.model.access.csv` :
```csv
access_acs_dialysis_station_user,acs.dialysis.station user,model_acs_dialysis_station,acs_hms_nephrology.group_hms_user,1,0,0,0
access_acs_dialysis_station_manager,acs.dialysis.station manager,model_acs_dialysis_station,acs_hms_nephrology.group_hms_manager,1,1,1,1
```

- [ ] **Step 5 : Ajouter les vues dans `nephrology_base_view.xml`**

Ajouter avant le `</odoo>` final dans `acs_hms_nephrology/views/nephrology_base_view.xml` :

```xml
<!-- Postes de Dialyse -->
<record id="view_acs_dialysis_station_list" model="ir.ui.view">
    <field name="name">acs.dialysis.station.list</field>
    <field name="model">acs.dialysis.station</field>
    <field name="arch" type="xml">
        <list string="Postes de Dialyse">
            <field name="name"/>
            <field name="room"/>
            <field name="station_type"/>
            <field name="equipment_model"/>
            <field name="active"/>
        </list>
    </field>
</record>

<record id="view_acs_dialysis_station_form" model="ir.ui.view">
    <field name="name">acs.dialysis.station.form</field>
    <field name="model">acs.dialysis.station</field>
    <field name="arch" type="xml">
        <form string="Poste de Dialyse">
            <sheet>
                <group>
                    <group>
                        <field name="name"/>
                        <field name="room"/>
                        <field name="station_type"/>
                    </group>
                    <group>
                        <field name="equipment_model"/>
                        <field name="active"/>
                    </group>
                </group>
                <separator string="Notes techniques"/>
                <field name="notes" placeholder="Notes de maintenance, équipements annexes..." nolabel="1"/>
            </sheet>
        </form>
    </field>
</record>

<record id="action_acs_dialysis_station" model="ir.actions.act_window">
    <field name="name">Postes de Dialyse</field>
    <field name="res_model">acs.dialysis.station</field>
    <field name="view_mode">list,form</field>
</record>
```

- [ ] **Step 6 : Lancer les tests et vérifier qu'ils passent**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "FAIL|ERROR|ok|test_station"
```

Attendu : `test_station_creation_standard ... ok`, `test_station_isolation_type ... ok`, `test_station_inactive ... ok`

- [ ] **Step 7 : Commit**

```bash
git add acs_hms_nephrology/models/nephrology.py \
        acs_hms_nephrology/views/nephrology_base_view.xml \
        acs_hms_nephrology/security/ir.model.access.csv \
        acs_hms_nephrology/tests/
git commit -m "feat(nephrology): add acs.dialysis.station model and views"
```

---

### Task 2 : Historique du poids sec (`acs.dry.weight.history`)

**Files:**
- Modify: `acs_hms_nephrology/models/hms_base.py`
- Modify: `acs_hms_nephrology/views/patient_customization_view.xml`
- Modify: `acs_hms_nephrology/security/ir.model.access.csv`
- Modify: `acs_hms_nephrology/tests/test_nephrology_base.py`

- [ ] **Step 1 : Écrire les tests**

Ajouter dans `acs_hms_nephrology/tests/test_nephrology_base.py` :

```python
class TestDryWeightHistory(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({
            'name': 'Test Patient Dialyse',
            'date_of_birth': '1965-03-15',
        })

    def test_dry_weight_history_creation(self):
        entry = self.env['acs.dry.weight.history'].create({
            'patient_id': self.patient.id,
            'weight': 70.5,
            'reason': 'Réévaluation clinique mensuelle',
        })
        self.assertEqual(entry.patient_id.id, self.patient.id)
        self.assertAlmostEqual(entry.weight, 70.5)
        self.assertTrue(entry.changed_by.id)  # doit être rempli automatiquement

    def test_dry_weight_history_ordered_by_date_desc(self):
        self.env['acs.dry.weight.history'].create({'patient_id': self.patient.id, 'weight': 68.0})
        self.env['acs.dry.weight.history'].create({'patient_id': self.patient.id, 'weight': 69.5})
        entries = self.env['acs.dry.weight.history'].search([
            ('patient_id', '=', self.patient.id)
        ])
        self.assertEqual(entries[0].weight, 69.5)  # le plus récent en premier
```

- [ ] **Step 2 : Vérifier l'échec**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_dry_weight"
```

Attendu : `ERROR — acs.dry.weight.history does not exist`

- [ ] **Step 3 : Ajouter le modèle dans `hms_base.py`**

Ajouter à la fin de `acs_hms_nephrology/models/hms_base.py` :

```python
class ACSDryWeightHistory(models.Model):
    _name = 'acs.dry.weight.history'
    _description = 'Historique Poids Sec'
    _order = 'date desc'

    patient_id = fields.Many2one('hms.patient', string='Patient',
                                  required=True, ondelete='cascade')
    date = fields.Datetime(string='Date de modification',
                           default=fields.Datetime.now, required=True)
    weight = fields.Float(string='Poids sec (kg)', required=True, digits=(5, 2))
    changed_by = fields.Many2one('res.users', string='Modifié par',
                                  default=lambda self: self.env.user)
    reason = fields.Text(string='Motif de modification')
```

Et dans la classe `ACSPatient` existante, ajouter le champ relation :
```python
dry_weight_history_ids = fields.One2many(
    'acs.dry.weight.history', 'patient_id',
    string='Historique Poids Sec'
)
```

- [ ] **Step 4 : Ajouter les droits d'accès**

Ajouter dans `acs_hms_nephrology/security/ir.model.access.csv` :
```csv
access_acs_dry_weight_history_user,acs.dry.weight.history user,model_acs_dry_weight_history,acs_hms_nephrology.group_hms_user,1,1,1,0
access_acs_dry_weight_history_manager,acs.dry.weight.history manager,model_acs_dry_weight_history,acs_hms_nephrology.group_hms_manager,1,1,1,1
```

- [ ] **Step 5 : Ajouter la vue inline dans `patient_customization_view.xml`**

Ajouter dans `acs_hms_nephrology/views/patient_customization_view.xml` avant `</odoo>` :

```xml
<!-- Historique poids sec — ajout dans l'onglet Néphrologie du patient -->
<record id="view_hms_patient_dry_weight_inherit" model="ir.ui.view">
    <field name="name">hms.patient.dry.weight.inherit</field>
    <field name="model">hms.patient</field>
    <field name="inherit_id" ref="acs_hms_nephrology.view_hms_patient_nephro_form"/>
    <field name="arch" type="xml">
        <xpath expr="//field[@name='nephro_dialysis_start_date']/.." position="after">
            <separator string="Historique du Poids Sec"/>
            <field name="dry_weight_history_ids" nolabel="1">
                <list editable="bottom">
                    <field name="date"/>
                    <field name="weight"/>
                    <field name="changed_by"/>
                    <field name="reason"/>
                </list>
            </field>
        </xpath>
    </field>
</record>
```

- [ ] **Step 6 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_dry_weight|FAIL|ERROR"
```

Attendu : `test_dry_weight_history_creation ... ok`, `test_dry_weight_history_ordered_by_date_desc ... ok`

- [ ] **Step 7 : Commit**

```bash
git add acs_hms_nephrology/models/hms_base.py \
        acs_hms_nephrology/views/patient_customization_view.xml \
        acs_hms_nephrology/security/ir.model.access.csv \
        acs_hms_nephrology/tests/test_nephrology_base.py
git commit -m "feat(nephrology): add dry weight history tracking"
```

---

### Task 3 : Signes vitaux étendus (SpO2, température, glycémie + alerte hypotension)

**Files:**
- Modify: `acs_hms_nephrology/models/hms_base.py`
- Modify: `acs_hms_nephrology/views/nephrology_view.xml`
- Modify: `acs_hms_nephrology/tests/test_nephrology_base.py`

- [ ] **Step 1 : Écrire les tests**

Ajouter dans `test_nephrology_base.py` :

```python
class TestVitalSignExtended(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Test'})
        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1)
        if not product:
            product = self.env['product.product'].create({
                'name': 'Hémodialyse',
                'type': 'service',
            })
        self.procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
        })

    def test_vital_sign_has_spo2_field(self):
        vital = self.env['hemodialysis.vital.sign'].create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '120/80',
            'heart_rate': 72,
            'spo2': 98.5,
            'temperature': 36.8,
        })
        self.assertAlmostEqual(vital.spo2, 98.5)
        self.assertAlmostEqual(vital.temperature, 36.8)

    def test_vital_sign_has_glycemia_field(self):
        vital = self.env['hemodialysis.vital.sign'].create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '130/85',
            'glycemia': 1.25,
        })
        self.assertAlmostEqual(vital.glycemia, 1.25)

    def test_hypotension_alert_detected(self):
        """TA systolique < 90 = hypotension détectée"""
        vital = self.env['hemodialysis.vital.sign'].create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '85/50',
            'heart_rate': 110,
        })
        self.assertTrue(vital.is_hypotension,
                        "Doit détecter hypotension si TA systolique < 90")

    def test_no_hypotension_when_bp_normal(self):
        vital = self.env['hemodialysis.vital.sign'].create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '120/80',
        })
        self.assertFalse(vital.is_hypotension)
```

- [ ] **Step 2 : Vérifier l'échec**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_vital_sign|test_hypotension|FAIL"
```

Attendu : `ERROR — spo2 does not exist`

- [ ] **Step 3 : Étendre `HemodialysisVitalSign` dans `hms_base.py`**

Dans la classe `HemodialysisVitalSign` existante, ajouter après le champ `notes` :

```python
    spo2 = fields.Float(string='SpO2 (%)', digits=(5, 1))
    temperature = fields.Float(string='Température (°C)', digits=(4, 1))
    glycemia = fields.Float(string='Glycémie (g/L)', digits=(4, 2),
                             help='À saisir si patient diabétique')
    is_hypotension = fields.Boolean(
        string='Hypotension détectée',
        compute='_compute_is_hypotension',
        store=True,
        help='Vrai si TA systolique < 90 mmHg'
    )

    @api.depends('blood_pressure')
    def _compute_is_hypotension(self):
        for rec in self:
            rec.is_hypotension = False
            if rec.blood_pressure:
                try:
                    systolic = int(rec.blood_pressure.split('/')[0].strip())
                    rec.is_hypotension = systolic < 90
                except (ValueError, IndexError):
                    pass
```

- [ ] **Step 4 : Étendre la vue des signes vitaux dans `nephrology_view.xml`**

Localiser dans `acs_hms_nephrology/views/nephrology_view.xml` la vue inline des `vital_sign_ids` et ajouter les nouvelles colonnes.

Ajouter cette vue héritée à la fin de `nephrology_view.xml` :

```xml
<!-- Extension signes vitaux : SpO2, température, glycémie, alerte hypotension -->
<record id="view_hemodialysis_vital_sign_extended" model="ir.ui.view">
    <field name="name">hemodialysis.vital.sign.list.extended</field>
    <field name="model">hemodialysis.vital.sign</field>
    <field name="inherit_id" ref="acs_hms_nephrology.view_hemodialysis_vital_sign_list"/>
    <field name="arch" type="xml">
        <field name="notes" position="before">
            <field name="spo2" optional="show"/>
            <field name="temperature" optional="show"/>
            <field name="glycemia" optional="show"/>
            <field name="is_hypotension" widget="boolean_toggle"
                   decoration-danger="is_hypotension == True"
                   optional="show"/>
        </field>
    </field>
</record>
```

> **Note :** Si la vue `view_hemodialysis_vital_sign_list` n'existe pas en tant que record nommé, créer une vue form standalone pour `hemodialysis.vital.sign` avec tous les champs et l'utiliser comme base.

- [ ] **Step 5 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_vital|test_hypotension|FAIL|ERROR"
```

Attendu : 4 tests `ok`

- [ ] **Step 6 : Commit**

```bash
git add acs_hms_nephrology/models/hms_base.py \
        acs_hms_nephrology/views/nephrology_view.xml \
        acs_hms_nephrology/tests/test_nephrology_base.py
git commit -m "feat(nephrology): extend vital signs with SpO2, temperature, glycemia and hypotension alert"
```

---

### Task 4 : Champs pré/post séance + calcul automatique KT/V et URR

**Files:**
- Modify: `acs_hms_nephrology/models/hms_base.py`
- Modify: `acs_hms_nephrology/views/nephrology_view.xml`
- Modify: `acs_hms_nephrology/tests/test_nephrology_base.py`

- [ ] **Step 1 : Écrire les tests**

Ajouter dans `test_nephrology_base.py` :

```python
import math

class TestProcedureKTV(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient KTV'})
        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1) or self.env['product.product'].create({
            'name': 'Hémodialyse', 'type': 'service',
        })
        self.procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
            'dry_weight': 70.0,
            'arrival_weight': 72.5,
        })

    def test_prise_interdialytique_calculated(self):
        """Prise de poids = poids arrivée - poids sec"""
        self.procedure.write({'arrival_weight': 72.5, 'dry_weight': 70.0})
        self.procedure._compute_weight_fields()
        self.assertAlmostEqual(self.procedure.interdialysis_increase, 2.5, places=1)

    def test_actual_uf_calculated(self):
        """UF réelle = poids arrivée - poids sortie"""
        self.procedure.write({
            'arrival_weight': 72.5,
            'departure_weight': 70.1,
        })
        self.procedure._compute_weight_fields()
        self.assertAlmostEqual(self.procedure.actual_uf, 2400.0, places=0)  # en ml

    def test_ktv_adequate(self):
        """KT/V ≥ 1.2 = statut adéquat"""
        self.procedure.write({
            'urea_pre': 25.0,   # mmol/L
            'urea_post': 8.0,   # mmol/L
            'actual_duration': 4.0,  # heures
            'actual_uf': 2400,   # ml
            'departure_weight': 70.1,  # kg
        })
        self.procedure._compute_ktv()
        self.assertGreaterEqual(self.procedure.ktv_calculated, 1.2)
        self.assertEqual(self.procedure.ktv_status, 'adequate')

    def test_ktv_insufficient(self):
        """KT/V < 1.2 = statut insuffisant"""
        self.procedure.write({
            'urea_pre': 25.0,
            'urea_post': 18.0,   # peu d'épuration
            'actual_duration': 2.5,
            'actual_uf': 1000,
            'departure_weight': 72.0,
        })
        self.procedure._compute_ktv()
        self.assertLess(self.procedure.ktv_calculated, 1.2)
        self.assertEqual(self.procedure.ktv_status, 'insufficient')

    def test_urr_calculated(self):
        """URR = (1 - urée_post/urée_pré) × 100"""
        self.procedure.write({'urea_pre': 25.0, 'urea_post': 8.0})
        self.procedure._compute_ktv()
        expected_urr = (1 - 8.0 / 25.0) * 100
        self.assertAlmostEqual(self.procedure.urr_calculated, expected_urr, places=1)
```

- [ ] **Step 2 : Vérifier l'échec**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_ktv|test_urr|test_prise|test_actual_uf|FAIL"
```

Attendu : `ERROR — departure_weight does not exist`

- [ ] **Step 3 : Ajouter les champs et méthodes dans `AcsPatientProcedure` (`hms_base.py`)**

Dans la classe `AcsPatientProcedure` existante, ajouter après les champs existants :

```python
    # --- Avant séance ---
    arrival_status = fields.Selection([
        ('normal', 'Normal'),
        ('tired', 'Fatigué'),
        ('pain', 'Douleur'),
        ('fever', 'Fièvre'),
        ('other', 'Autre'),
    ], string="Statut à l'arrivée")
    pre_dialysis_bp = fields.Char(string='TA pré-dialyse', help='Ex: 140/90')
    pre_dialysis_temp = fields.Float(string='Température pré-dialyse (°C)', digits=(4, 1))
    parameter_change_reason = fields.Text(
        string='Motif de changement de paramètres',
        help='Si les paramètres diffèrent du protocole habituel'
    )

    # --- Fin séance ---
    departure_weight = fields.Float(string='Poids sortie (kg)', digits=(5, 2))
    actual_uf = fields.Float(
        string='UF réelle (ml)',
        compute='_compute_weight_fields',
        store=True,
        digits=(7, 0),
        help='Calculé : (poids arrivée - poids sortie) × 1000'
    )
    actual_duration = fields.Float(
        string='Durée effective (heures)',
        digits=(4, 2),
        help='Calculé depuis heure début et fin, ou saisi manuellement'
    )
    global_tolerance = fields.Selection([
        ('good', 'Bonne'),
        ('average', 'Moyenne'),
        ('poor', 'Mauvaise'),
    ], string='Tolérance globale')
    end_notes = fields.Text(string='Notes de fin de séance')

    # --- Urée pour calcul KT/V ---
    urea_pre = fields.Float(string='Urée pré-dialyse (mmol/L)', digits=(6, 2))
    urea_post = fields.Float(string='Urée post-dialyse (mmol/L)', digits=(6, 2))

    # --- KT/V et URR calculés ---
    ktv_calculated = fields.Float(
        string='KT/V calculé',
        compute='_compute_ktv',
        store=True,
        digits=(4, 2),
        help='Formule Daugirdas II'
    )
    ktv_status = fields.Selection([
        ('adequate', 'Adéquat (≥ 1.2)'),
        ('insufficient', 'Insuffisant (< 1.2)'),
    ], string='Statut KT/V', compute='_compute_ktv', store=True)
    urr_calculated = fields.Float(
        string='URR (%)',
        compute='_compute_ktv',
        store=True,
        digits=(5, 1),
        help='Taux de réduction de l\'urée = (1 - Cpost/Cpré) × 100'
    )

    @api.depends('arrival_weight', 'departure_weight', 'dry_weight')
    def _compute_weight_fields(self):
        import math
        for rec in self:
            # Prise interdialytique
            if rec.arrival_weight and rec.dry_weight:
                rec.interdialysis_increase = round(
                    rec.arrival_weight - rec.dry_weight, 2
                )
            # UF réelle en ml
            if rec.arrival_weight and rec.departure_weight:
                rec.actual_uf = round(
                    (rec.arrival_weight - rec.departure_weight) * 1000, 0
                )

    @api.depends('urea_pre', 'urea_post', 'actual_duration', 'actual_uf', 'departure_weight')
    def _compute_ktv(self):
        import math
        for rec in self:
            rec.ktv_calculated = 0.0
            rec.ktv_status = False
            rec.urr_calculated = 0.0

            if not rec.urea_pre or not rec.urea_post or rec.urea_pre <= 0:
                continue

            # URR
            rec.urr_calculated = round((1 - rec.urea_post / rec.urea_pre) * 100, 1)

            # KT/V Daugirdas II
            # Kt/V = -ln(R - 0.008×t) + (4 - 3.5×R) × UF/W
            R = rec.urea_post / rec.urea_pre
            t = rec.actual_duration or 0.0
            uf_liters = (rec.actual_uf or 0.0) / 1000.0
            W = rec.departure_weight or 0.0

            try:
                inner = R - 0.008 * t
                if inner <= 0 or W <= 0:
                    continue
                ktv = -math.log(inner) + (4 - 3.5 * R) * uf_liters / W
                rec.ktv_calculated = round(ktv, 2)
                rec.ktv_status = 'adequate' if ktv >= 1.2 else 'insufficient'
            except (ValueError, ZeroDivisionError):
                pass
```

- [ ] **Step 4 : Mettre à jour la vue séance dans `nephrology_view.xml`**

Localiser la vue form de `acs.patient.procedure` dans `nephrology_view.xml` et ajouter une extension héritée pour les nouveaux champs.

Ajouter à la fin de `nephrology_view.xml` :

```xml
<!-- Champs pré/post séance + KT/V -->
<record id="view_acs_patient_procedure_ktv_inherit" model="ir.ui.view">
    <field name="name">acs.patient.procedure.ktv.form.inherit</field>
    <field name="model">acs.patient.procedure</field>
    <field name="inherit_id" ref="acs_hms_nephrology.view_acs_patient_procedure_nephro_form"/>
    <field name="arch" type="xml">
        <!-- Statut arrivée — avant le bloc poids -->
        <field name="arrival_weight" position="before">
            <group string="Statut à l'arrivée">
                <field name="arrival_status"/>
                <field name="pre_dialysis_bp"/>
                <field name="pre_dialysis_temp"/>
                <field name="parameter_change_reason"/>
            </group>
        </field>
        <!-- Poids sortie et UF réelle — après le bloc UF -->
        <field name="uf_max" position="after">
            <separator string="Fin de séance"/>
            <group>
                <group>
                    <field name="departure_weight"/>
                    <field name="actual_uf"/>
                    <field name="actual_duration"/>
                    <field name="global_tolerance"/>
                </group>
                <group>
                    <field name="urea_pre"/>
                    <field name="urea_post"/>
                    <field name="urr_calculated"/>
                    <field name="ktv_calculated"
                           decoration-success="ktv_status == 'adequate'"
                           decoration-danger="ktv_status == 'insufficient'"/>
                    <field name="ktv_status" widget="badge"
                           decoration-success="ktv_status == 'adequate'"
                           decoration-danger="ktv_status == 'insufficient'"/>
                </group>
            </group>
            <field name="end_notes" placeholder="Notes de fin de séance..."/>
        </field>
    </field>
</record>
```

- [ ] **Step 5 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_ktv|test_urr|test_prise|test_actual|FAIL|ERROR"
```

Attendu : 5 tests `ok`

- [ ] **Step 6 : Commit**

```bash
git add acs_hms_nephrology/models/hms_base.py \
        acs_hms_nephrology/views/nephrology_view.xml \
        acs_hms_nephrology/tests/test_nephrology_base.py
git commit -m "feat(nephrology): add pre/post session fields and auto KT/V Daugirdas II calculation"
```

---

### Task 5 : Planning étendu (poste, médecin, infirmiers, capacité)

**Files:**
- Modify: `acs_hms_nephrology/models/nephrology.py`
- Modify: `acs_hms_nephrology/views/nephrology_base_view.xml`
- Modify: `acs_hms_nephrology/tests/test_nephrology_base.py`

- [ ] **Step 1 : Écrire les tests**

Ajouter dans `test_nephrology_base.py` :

```python
class TestNephrologyScheduleExtended(TransactionCase):

    def setUp(self):
        super().setUp()
        self.station = self.env['acs.dialysis.station'].create({
            'name': 'Poste 1', 'room': 'Salle A', 'station_type': 'standard',
        })

    def test_schedule_has_station(self):
        schedule = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV Matin',
            'monday': True, 'wednesday': True, 'friday': True,
            'start_time': 7.0, 'end_time': 11.0,
            'station_id': self.station.id,
            'max_patients': 10,
        })
        self.assertEqual(schedule.station_id.id, self.station.id)
        self.assertEqual(schedule.max_patients, 10)

    def test_schedule_nurse_assignment(self):
        nurse = self.env['res.users'].search([], limit=1)
        schedule = self.env['acs.nephrology.schedule'].create({
            'name': 'LMV Matin',
            'monday': True,
            'start_time': 7.0, 'end_time': 11.0,
            'nurse_ids': [(4, nurse.id)],
        })
        self.assertIn(nurse, schedule.nurse_ids)
```

- [ ] **Step 2 : Vérifier l'échec**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_schedule|FAIL"
```

- [ ] **Step 3 : Étendre `ACSNephrologySchedule` dans `nephrology.py`**

Dans la classe `ACSNephrologySchedule` existante, ajouter après `end_time` :

```python
    station_id = fields.Many2one(
        'acs.dialysis.station',
        string='Poste de dialyse',
        help='Poste assigné à ce créneau'
    )
    physician_id = fields.Many2one(
        'hms.physician',
        string='Médecin référent du créneau'
    )
    nurse_ids = fields.Many2many(
        'res.users',
        'nephro_schedule_nurse_rel',
        'schedule_id', 'nurse_id',
        string='Infirmiers assignés'
    )
    max_patients = fields.Integer(
        string='Capacité max (patients)',
        default=0,
        help='0 = illimité. Alerte si dépassé.'
    )
```

- [ ] **Step 4 : Mettre à jour la vue du planning**

Dans `nephrology_base_view.xml`, localiser la vue form de `acs.nephrology.schedule` et ajouter les nouveaux champs après `end_time` :

```xml
<field name="end_time" position="after">
    <field name="station_id"/>
    <field name="physician_id"/>
    <field name="nurse_ids" widget="many2many_tags"/>
    <field name="max_patients"/>
</field>
```

- [ ] **Step 5 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology \
  --log-level=test 2>&1 | grep -E "test_schedule|FAIL|ERROR"
```

Attendu : 2 tests `ok`

- [ ] **Step 6 : Commit**

```bash
git add acs_hms_nephrology/models/nephrology.py \
        acs_hms_nephrology/views/nephrology_base_view.xml \
        acs_hms_nephrology/tests/test_nephrology_base.py
git commit -m "feat(nephrology): extend schedule with station, physician, nurses and capacity"
```

---

## MODULE B — `acs_hms_nephrology_complications`

---

### Task 6 : Scaffold du module + modèle `acs.dialysis.complication`

**Files:**
- Create: `acs_hms_nephrology_complications/__init__.py`
- Create: `acs_hms_nephrology_complications/__manifest__.py`
- Create: `acs_hms_nephrology_complications/models/__init__.py`
- Create: `acs_hms_nephrology_complications/models/complication.py`
- Create: `acs_hms_nephrology_complications/security/security.xml`
- Create: `acs_hms_nephrology_complications/security/ir.model.access.csv`
- Create: `acs_hms_nephrology_complications/tests/__init__.py`
- Create: `acs_hms_nephrology_complications/tests/test_complication.py`

- [ ] **Step 1 : Créer `__init__.py`**

```python
# -*- coding: utf-8 -*-
from . import models
```

- [ ] **Step 2 : Créer `__manifest__.py`**

```python
# -*- coding: utf-8 -*-
{
    'name': 'Complications Hémodialyse',
    'version': '1.0.0',
    'category': 'Medical',
    'summary': 'Suivi des complications et incidents per-séance de dialyse',
    'description': 'Enregistrement des complications survenant pendant les séances '
                   'd\'hémodialyse : hypotension, crampes, arrêts prématurés, etc.',
    'author': 'As-Shafi Custom',
    'website': 'https://as-shafi.com',
    'license': 'LGPL-3',
    'depends': ['acs_hms_nephrology'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'views/complication_view.xml',
        'views/menu_item.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
```

- [ ] **Step 3 : Créer `models/__init__.py`**

```python
# -*- coding: utf-8 -*-
from . import complication
```

- [ ] **Step 4 : Écrire les tests**

Créer `tests/__init__.py` :
```python
from . import test_complication
```

Créer `tests/test_complication.py` :
```python
# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase
from odoo import fields


class TestDialysisComplication(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Complication'})
        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1) or self.env['product.product'].create({
            'name': 'Hémodialyse', 'type': 'service',
        })
        self.procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
        })

    def test_complication_creation(self):
        complication = self.env['acs.dialysis.complication'].create({
            'procedure_id': self.procedure.id,
            'complication_type': 'hypotension',
            'bp_at_occurrence': '85/50',
            'action_taken': 'Position Trendelenburg, perfusion NaCl 100ml',
            'resolution': 'yes',
        })
        self.assertEqual(complication.complication_type, 'hypotension')
        self.assertEqual(complication.resolution, 'yes')

    def test_early_stop_duration_required_when_early_stop(self):
        complication = self.env['acs.dialysis.complication'].create({
            'procedure_id': self.procedure.id,
            'complication_type': 'early_stop',
            'early_stop_duration': 45,
            'action_taken': 'Arrêt sur douleur thoracique',
            'resolution': 'partial',
        })
        self.assertEqual(complication.early_stop_duration, 45)

    def test_complication_count_on_procedure(self):
        self.env['acs.dialysis.complication'].create({
            'procedure_id': self.procedure.id,
            'complication_type': 'cramps',
            'action_taken': 'Hydratation',
            'resolution': 'yes',
        })
        self.env['acs.dialysis.complication'].create({
            'procedure_id': self.procedure.id,
            'complication_type': 'nausea',
            'action_taken': 'Antiémétique',
            'resolution': 'yes',
        })
        self.assertEqual(self.procedure.complication_count, 2)

    def test_has_complication_flag(self):
        self.assertFalse(self.procedure.has_complication)
        self.env['acs.dialysis.complication'].create({
            'procedure_id': self.procedure.id,
            'complication_type': 'hypotension',
            'action_taken': 'Traitement',
            'resolution': 'yes',
        })
        self.procedure.invalidate_recordset()
        self.assertTrue(self.procedure.has_complication)
```

- [ ] **Step 5 : Créer `models/complication.py`**

```python
# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ACSDialysisComplication(models.Model):
    _name = 'acs.dialysis.complication'
    _description = 'Complication per-séance d\'hémodialyse'
    _order = 'occurrence_time'

    procedure_id = fields.Many2one(
        'acs.patient.procedure',
        string='Séance d\'hémodialyse',
        required=True,
        ondelete='cascade'
    )
    patient_id = fields.Many2one(
        related='procedure_id.patient_id',
        string='Patient',
        store=True,
        readonly=True
    )
    complication_type = fields.Selection([
        ('hypotension', 'Hypotension'),
        ('cramps', 'Crampes'),
        ('nausea', 'Nausées / Vomissements'),
        ('chest_pain', 'Douleur thoracique'),
        ('fever', 'Fièvre'),
        ('pruritus', 'Prurit'),
        ('early_stop', 'Arrêt prématuré'),
        ('other', 'Autre'),
    ], string='Type de complication', required=True)
    occurrence_time = fields.Datetime(
        string='Heure de survenue',
        default=fields.Datetime.now,
        required=True
    )
    bp_at_occurrence = fields.Char(
        string='TA au moment de la complication',
        help='Ex: 85/50'
    )
    action_taken = fields.Text(string='Action prise', required=True)
    resolution = fields.Selection([
        ('yes', 'Résolue'),
        ('partial', 'Partiellement résolue'),
        ('no', 'Non résolue'),
    ], string='Résolution', required=True)
    early_stop_duration = fields.Integer(
        string='Durée d\'arrêt (minutes)',
        help='Durée d\'arrêt prématuré de la séance en minutes'
    )
    notes = fields.Text(string='Notes complémentaires')


class AcsPatientProcedureComplication(models.Model):
    _inherit = 'acs.patient.procedure'

    complication_ids = fields.One2many(
        'acs.dialysis.complication',
        'procedure_id',
        string='Complications'
    )
    complication_count = fields.Integer(
        string='Nb complications',
        compute='_compute_complication_count',
        store=True
    )
    has_complication = fields.Boolean(
        string='A des complications',
        compute='_compute_complication_count',
        store=True
    )

    @api.depends('complication_ids')
    def _compute_complication_count(self):
        for rec in self:
            count = len(rec.complication_ids)
            rec.complication_count = count
            rec.has_complication = count > 0
```

- [ ] **Step 6 : Créer les fichiers de sécurité**

`security/security.xml` :
```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data noupdate="1">
    </data>
</odoo>
```

`security/ir.model.access.csv` :
```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_acs_dialysis_complication_user,acs.dialysis.complication user,model_acs_dialysis_complication,acs_hms_nephrology.group_hms_user,1,1,1,0
access_acs_dialysis_complication_manager,acs.dialysis.complication manager,model_acs_dialysis_complication,acs_hms_nephrology.group_hms_manager,1,1,1,1
```

- [ ] **Step 7 : Créer `views/complication_view.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>

    <record id="view_acs_dialysis_complication_list" model="ir.ui.view">
        <field name="name">acs.dialysis.complication.list</field>
        <field name="model">acs.dialysis.complication</field>
        <field name="arch" type="xml">
            <list string="Complications" decoration-danger="resolution == 'no'"
                  decoration-warning="resolution == 'partial'">
                <field name="occurrence_time"/>
                <field name="complication_type"/>
                <field name="bp_at_occurrence"/>
                <field name="action_taken"/>
                <field name="resolution" widget="badge"
                       decoration-success="resolution == 'yes'"
                       decoration-warning="resolution == 'partial'"
                       decoration-danger="resolution == 'no'"/>
                <field name="early_stop_duration"
                       optional="show"
                       attrs="{'invisible': [('complication_type', '!=', 'early_stop')]}"/>
            </list>
        </field>
    </record>

    <record id="view_acs_dialysis_complication_form" model="ir.ui.view">
        <field name="name">acs.dialysis.complication.form</field>
        <field name="model">acs.dialysis.complication</field>
        <field name="arch" type="xml">
            <form string="Complication">
                <sheet>
                    <group>
                        <group>
                            <field name="procedure_id"/>
                            <field name="complication_type"/>
                            <field name="occurrence_time"/>
                            <field name="bp_at_occurrence"/>
                        </group>
                        <group>
                            <field name="resolution" widget="radio"/>
                            <field name="early_stop_duration"
                                   attrs="{'invisible': [('complication_type', '!=', 'early_stop')],
                                           'required': [('complication_type', '=', 'early_stop')]}"/>
                        </group>
                    </group>
                    <separator string="Action prise"/>
                    <field name="action_taken" nolabel="1"
                           placeholder="Décrire l'action prise..."/>
                    <separator string="Notes complémentaires"/>
                    <field name="notes" nolabel="1"/>
                </sheet>
            </form>
        </field>
    </record>

    <!-- Extension vue séance : onglet complications -->
    <record id="view_procedure_complication_tab" model="ir.ui.view">
        <field name="name">acs.patient.procedure.complication.tab</field>
        <field name="model">acs.patient.procedure</field>
        <field name="inherit_id" ref="acs_hms_nephrology.view_acs_patient_procedure_nephro_form"/>
        <field name="arch" type="xml">
            <xpath expr="//notebook" position="inside">
                <page string="Complications" name="complications"
                      attrs="{'invisible': [('complication_count', '=', 0)]}"
                      decoration-danger="has_complication">
                    <field name="complication_ids"
                           context="{'default_procedure_id': active_id}">
                        <list>
                            <field name="occurrence_time"/>
                            <field name="complication_type"/>
                            <field name="bp_at_occurrence"/>
                            <field name="resolution" widget="badge"
                                   decoration-success="resolution == 'yes'"
                                   decoration-warning="resolution == 'partial'"
                                   decoration-danger="resolution == 'no'"/>
                        </list>
                    </field>
                    <group>
                        <field name="complication_count" readonly="1"/>
                        <field name="has_complication" invisible="1"/>
                    </group>
                </page>
            </xpath>
        </field>
    </record>

    <record id="action_acs_dialysis_complication" model="ir.actions.act_window">
        <field name="name">Complications</field>
        <field name="res_model">acs.dialysis.complication</field>
        <field name="view_mode">list,form</field>
    </record>

</odoo>
```

- [ ] **Step 8 : Créer `views/menu_item.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <menuitem id="menu_acs_complications"
              name="Complications"
              parent="acs_hms_nephrology.menu_nephrology_config"
              action="action_acs_dialysis_complication"
              sequence="30"/>
</odoo>
```

- [ ] **Step 9 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -i acs_hms_nephrology_complications \
  --log-level=test 2>&1 | grep -E "test_complication|FAIL|ERROR"
```

Attendu : 4 tests `ok`

- [ ] **Step 10 : Commit**

```bash
git add acs_hms_nephrology_complications/
git commit -m "feat: create acs_hms_nephrology_complications module with dialysis complication tracking"
```

---

## MODULE C — `acs_hms_nephrology_bilans`

---

### Task 7 : Scaffold du module + modèle `acs.nephro.bilan` (structure de base)

**Files:**
- Create: `acs_hms_nephrology_bilans/__init__.py`
- Create: `acs_hms_nephrology_bilans/__manifest__.py`
- Create: `acs_hms_nephrology_bilans/models/__init__.py`
- Create: `acs_hms_nephrology_bilans/models/bilan.py`
- Create: `acs_hms_nephrology_bilans/tests/__init__.py`
- Create: `acs_hms_nephrology_bilans/tests/test_bilan.py`

- [ ] **Step 1 : Créer `__init__.py`**

```python
# -*- coding: utf-8 -*-
from . import models
```

- [ ] **Step 2 : Créer `__manifest__.py`**

```python
# -*- coding: utf-8 -*-
{
    'name': 'Bilans Biologiques Dialyse',
    'version': '1.0.0',
    'category': 'Medical',
    'summary': 'Bilans biologiques complets pour les patients en hémodialyse',
    'description': 'Suivi des bilans biologiques (NFS, biochimie, électrolytes, '
                   'minéraux-os, nutrition, sérologies) avec seuils KDIGO paramétrables '
                   'et alertes automatiques.',
    'author': 'As-Shafi Custom',
    'website': 'https://as-shafi.com',
    'license': 'LGPL-3',
    'depends': ['acs_hms_nephrology'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/default_thresholds.xml',
        'views/bilan_threshold_view.xml',
        'views/bilan_view.xml',
        'views/patient_bilan_tab.xml',
        'views/menu_item.xml',
        'report/bilan_report.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'acs_hms_nephrology_bilans/static/src/components/bilan_chart.js',
            'acs_hms_nephrology_bilans/static/src/components/bilan_chart.xml',
            'acs_hms_nephrology_bilans/static/src/css/bilan_chart.css',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
```

- [ ] **Step 3 : Créer `models/__init__.py`**

```python
# -*- coding: utf-8 -*-
from . import bilan
from . import bilan_threshold
```

- [ ] **Step 4 : Écrire les tests**

Créer `tests/__init__.py` :
```python
from . import test_bilan
```

Créer `tests/test_bilan.py` :
```python
# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase


class TestBilanBiologique(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Bilan'})

    def test_bilan_creation(self):
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'hemoglobin': 10.8,
            'potassium': 4.9,
            'phosphorus': 2.1,
            'albumin': 38.0,
        })
        self.assertEqual(bilan.patient_id.id, self.patient.id)
        self.assertEqual(bilan.bilan_type, 'monthly')
        self.assertAlmostEqual(bilan.hemoglobin, 10.8)

    def test_urr_computed_from_urea(self):
        """URR = (1 - urée_post/urée_pré) × 100"""
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'urea_pre': 25.0,
            'urea_post': 8.0,
        })
        expected_urr = (1 - 8.0 / 25.0) * 100
        self.assertAlmostEqual(bilan.urr_calculated, expected_urr, places=1)

    def test_caxp_product_computed(self):
        """Produit CaxP = calcium × phosphore"""
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'calcium': 2.3,
            'phosphorus': 1.8,
        })
        self.assertAlmostEqual(bilan.caxp_product, 2.3 * 1.8, places=2)

    def test_hemoglobin_status_ok(self):
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'hemoglobin': 11.0,
        })
        self.assertEqual(bilan.hemoglobin_status, 'ok')

    def test_hemoglobin_status_low(self):
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'hemoglobin': 8.5,
        })
        self.assertEqual(bilan.hemoglobin_status, 'low')

    def test_potassium_status_high(self):
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'potassium': 6.2,
        })
        self.assertEqual(bilan.potassium_status, 'high')

    def test_bilan_sequence_auto(self):
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
        })
        self.assertTrue(bilan.name.startswith('BIO/'))
```

- [ ] **Step 5 : Vérifier l'échec**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -i acs_hms_nephrology_bilans \
  --log-level=test 2>&1 | grep -E "test_bilan|FAIL|ERROR" | head -20
```

Attendu : `ERROR — acs.nephro.bilan does not exist`

- [ ] **Step 6 : Créer `models/bilan.py`**

```python
# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ACSNephroBilan(models.Model):
    _name = 'acs.nephro.bilan'
    _description = 'Bilan Biologique Dialyse'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'exam_date desc'

    name = fields.Char(string='Référence', required=True,
                       default='Nouveau', copy=False, readonly=True)
    patient_id = fields.Many2one('hms.patient', string='Patient',
                                  required=True, ondelete='cascade', tracking=True)
    exam_date = fields.Datetime(string='Date du bilan',
                                 default=fields.Datetime.now, required=True, tracking=True)
    physician_id = fields.Many2one('hms.physician', string='Médecin prescripteur')
    bilan_type = fields.Selection([
        ('monthly', 'Mensuel'),
        ('quarterly', 'Trimestriel'),
        ('biannual', 'Semestriel'),
        ('annual', 'Annuel'),
        ('punctual', 'Ponctuel'),
    ], string='Type de bilan', required=True, default='monthly')
    attachment_ids = fields.Many2many(
        'ir.attachment', 'nephro_bilan_attachment_rel',
        'bilan_id', 'attachment_id',
        string='PDF Laboratoire'
    )
    notes = fields.Text(string='Notes')

    # ===== HÉMATOLOGIE =====
    hemoglobin = fields.Float(string='Hémoglobine (g/dL)', digits=(5, 2))
    hematocrit = fields.Float(string='Hématocrite (%)', digits=(5, 1))
    white_blood_cells = fields.Float(string='Globules blancs (G/L)', digits=(5, 2))
    platelets = fields.Float(string='Plaquettes (G/L)', digits=(6, 0))
    ferritin = fields.Float(string='Ferritine (µg/L)', digits=(7, 1))
    transferrin_saturation = fields.Float(string='Saturation transferrine (%)', digits=(5, 1))

    # ===== BIOCHIMIE RÉNALE =====
    creatinine = fields.Float(string='Créatinine (µmol/L)', digits=(7, 1))
    urea_pre = fields.Float(string='Urée pré-dialyse (mmol/L)', digits=(6, 2))
    urea_post = fields.Float(string='Urée post-dialyse (mmol/L)', digits=(6, 2))
    uric_acid = fields.Float(string='Acide urique (µmol/L)', digits=(7, 1))
    urr_calculated = fields.Float(
        string='URR (%)', compute='_compute_urr', store=True, digits=(5, 1))

    # ===== ÉLECTROLYTES =====
    sodium = fields.Float(string='Sodium Na (mmol/L)', digits=(5, 1))
    potassium = fields.Float(string='Potassium K (mmol/L)', digits=(5, 2))
    calcium = fields.Float(string='Calcium Ca (mmol/L)', digits=(5, 2))
    phosphorus = fields.Float(string='Phosphore P (mmol/L)', digits=(5, 2))
    bicarbonate = fields.Float(string='Bicarbonate HCO3 (mmol/L)', digits=(5, 1))
    caxp_product = fields.Float(
        string='Produit CaxP', compute='_compute_caxp', store=True, digits=(5, 2),
        help='Calcium × Phosphore. Alerte si > 4.4 mmol²/L²')

    # ===== MINÉRAUX - OS =====
    pth = fields.Float(string='PTH (pg/mL)', digits=(7, 1))
    vitamin_d = fields.Float(string='Vitamine D (ng/mL)', digits=(6, 1))
    alkaline_phosphatase = fields.Float(string='PAL (UI/L)', digits=(6, 1))

    # ===== NUTRITION & INFLAMMATION =====
    albumin = fields.Float(string='Albumine (g/L)', digits=(5, 1))
    total_proteins = fields.Float(string='Protéines totales (g/L)', digits=(5, 1))
    crp = fields.Float(string='CRP (mg/L)', digits=(6, 1))
    prealbumin = fields.Float(string='Pré-albumine (mg/L)', digits=(6, 1))

    # ===== SÉROLOGIES =====
    hbs_ag = fields.Selection([
        ('positive', 'Positif'),
        ('negative', 'Négatif'),
        ('not_done', 'Non fait'),
    ], string='HBs Ag', default='not_done')
    anti_hbs = fields.Selection([
        ('positive', 'Positif (immunisé)'),
        ('negative', 'Négatif (non immunisé)'),
        ('not_done', 'Non fait'),
    ], string='Anti-HBs', default='not_done')
    anti_hbc = fields.Selection([
        ('positive', 'Positif'),
        ('negative', 'Négatif'),
        ('not_done', 'Non fait'),
    ], string='Anti-HBc', default='not_done')
    anti_hcv = fields.Selection([
        ('positive', 'Positif'),
        ('negative', 'Négatif'),
        ('not_done', 'Non fait'),
    ], string='Anti-VHC', default='not_done')
    anti_hiv = fields.Selection([
        ('positive', 'Positif'),
        ('negative', 'Négatif'),
        ('not_done', 'Non fait'),
    ], string='Anti-VIH', default='not_done')

    # ===== STATUTS CALCULÉS (badges) =====
    hemoglobin_status = fields.Selection([
        ('ok', 'OK'), ('low', 'Bas'), ('high', 'Élevé'),
    ], compute='_compute_statuses', store=True, string='Statut Hb')

    potassium_status = fields.Selection([
        ('ok', 'OK'), ('low', 'Bas'), ('high', 'Élevé'),
    ], compute='_compute_statuses', store=True, string='Statut K')

    phosphorus_status = fields.Selection([
        ('ok', 'OK'), ('low', 'Bas'), ('high', 'Élevé'),
    ], compute='_compute_statuses', store=True, string='Statut P')

    albumin_status = fields.Selection([
        ('ok', 'OK'), ('low', 'Bas'),
    ], compute='_compute_statuses', store=True, string='Statut Albumine')

    pth_status = fields.Selection([
        ('ok', 'OK'), ('low', 'Bas'), ('high', 'Élevé'),
    ], compute='_compute_statuses', store=True, string='Statut PTH')

    caxp_status = fields.Selection([
        ('ok', 'OK'), ('high', 'Élevé'),
    ], compute='_compute_statuses', store=True, string='Statut CaxP')

    # ===== COMPUTED FIELDS =====

    @api.depends('urea_pre', 'urea_post')
    def _compute_urr(self):
        for rec in self:
            if rec.urea_pre and rec.urea_post and rec.urea_pre > 0:
                rec.urr_calculated = round(
                    (1 - rec.urea_post / rec.urea_pre) * 100, 1
                )
            else:
                rec.urr_calculated = 0.0

    @api.depends('calcium', 'phosphorus')
    def _compute_caxp(self):
        for rec in self:
            if rec.calcium and rec.phosphorus:
                rec.caxp_product = round(rec.calcium * rec.phosphorus, 2)
            else:
                rec.caxp_product = 0.0

    @api.depends('hemoglobin', 'potassium', 'phosphorus', 'albumin', 'pth', 'caxp_product')
    def _compute_statuses(self):
        for rec in self:
            # Hémoglobine : cible 10–12 g/dL
            if rec.hemoglobin:
                if rec.hemoglobin < 10.0:
                    rec.hemoglobin_status = 'low'
                elif rec.hemoglobin > 12.0:
                    rec.hemoglobin_status = 'high'
                else:
                    rec.hemoglobin_status = 'ok'
            else:
                rec.hemoglobin_status = False

            # Potassium : cible 3.5–5.5 mmol/L
            if rec.potassium:
                if rec.potassium < 3.5:
                    rec.potassium_status = 'low'
                elif rec.potassium > 5.5:
                    rec.potassium_status = 'high'
                else:
                    rec.potassium_status = 'ok'
            else:
                rec.potassium_status = False

            # Phosphore : cible 1.1–1.8 mmol/L
            if rec.phosphorus:
                if rec.phosphorus < 1.1:
                    rec.phosphorus_status = 'low'
                elif rec.phosphorus > 1.8:
                    rec.phosphorus_status = 'high'
                else:
                    rec.phosphorus_status = 'ok'
            else:
                rec.phosphorus_status = False

            # Albumine : cible > 35 g/L
            if rec.albumin:
                rec.albumin_status = 'ok' if rec.albumin >= 35.0 else 'low'
            else:
                rec.albumin_status = False

            # PTH : cible 150–300 pg/mL
            if rec.pth:
                if rec.pth < 150:
                    rec.pth_status = 'low'
                elif rec.pth > 300:
                    rec.pth_status = 'high'
                else:
                    rec.pth_status = 'ok'
            else:
                rec.pth_status = False

            # CaxP : alerte si > 4.4 mmol²/L²
            if rec.caxp_product:
                rec.caxp_status = 'high' if rec.caxp_product > 4.4 else 'ok'
            else:
                rec.caxp_status = False

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'Nouveau') == 'Nouveau':
                vals['name'] = (
                    self.env['ir.sequence'].next_by_code('acs.nephro.bilan')
                    or 'Nouveau'
                )
        return super().create(vals_list)
```

- [ ] **Step 7 : Créer `models/bilan_threshold.py`**

```python
# -*- coding: utf-8 -*-
from odoo import fields, models


class ACSNephroBilanThreshold(models.Model):
    """Seuils paramétrables par le médecin (valeurs par défaut = KDIGO)"""
    _name = 'acs.nephro.bilan.threshold'
    _description = 'Seuils biologiques paramétrables'

    name = fields.Char(string='Paramètre', required=True)
    code = fields.Char(string='Code', required=True)
    unit = fields.Char(string='Unité')
    min_normal = fields.Float(string='Min normal', digits=(7, 2))
    max_normal = fields.Float(string='Max normal', digits=(7, 2))
    min_target = fields.Float(string='Min cible dialyse', digits=(7, 2))
    max_target = fields.Float(string='Max cible dialyse', digits=(7, 2))
    notes = fields.Text(string='Notes / Guidelines')
    active = fields.Boolean(default=True)
```

- [ ] **Step 8 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -i acs_hms_nephrology_bilans \
  --log-level=test 2>&1 | grep -E "test_bilan|FAIL|ERROR"
```

Attendu : 7 tests `ok`

- [ ] **Step 9 : Commit**

```bash
git add acs_hms_nephrology_bilans/
git commit -m "feat: create acs_hms_nephrology_bilans module with full biological monitoring"
```

---

### Task 8 : Vues bilans + intégration fiche patient + séquence

**Files:**
- Create: `acs_hms_nephrology_bilans/security/security.xml`
- Create: `acs_hms_nephrology_bilans/security/ir.model.access.csv`
- Create: `acs_hms_nephrology_bilans/data/default_thresholds.xml`
- Create: `acs_hms_nephrology_bilans/views/bilan_view.xml`
- Create: `acs_hms_nephrology_bilans/views/bilan_threshold_view.xml`
- Create: `acs_hms_nephrology_bilans/views/patient_bilan_tab.xml`
- Create: `acs_hms_nephrology_bilans/views/menu_item.xml`

- [ ] **Step 1 : Créer `security/security.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data noupdate="1">
    </data>
</odoo>
```

- [ ] **Step 2 : Créer `security/ir.model.access.csv`**

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_acs_nephro_bilan_user,acs.nephro.bilan user,model_acs_nephro_bilan,acs_hms_nephrology.group_hms_user,1,1,1,0
access_acs_nephro_bilan_manager,acs.nephro.bilan manager,model_acs_nephro_bilan,acs_hms_nephrology.group_hms_manager,1,1,1,1
access_acs_nephro_bilan_threshold_user,acs.nephro.bilan.threshold user,model_acs_nephro_bilan_threshold,acs_hms_nephrology.group_hms_user,1,0,0,0
access_acs_nephro_bilan_threshold_manager,acs.nephro.bilan.threshold manager,model_acs_nephro_bilan_threshold,acs_hms_nephrology.group_hms_manager,1,1,1,1
```

- [ ] **Step 3 : Créer `data/default_thresholds.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data noupdate="1">
        <!-- Séquence bilans -->
        <record id="seq_acs_nephro_bilan" model="ir.sequence">
            <field name="name">Bilan Biologique Dialyse</field>
            <field name="code">acs.nephro.bilan</field>
            <field name="prefix">BIO/</field>
            <field name="padding">5</field>
            <field name="company_id" eval="False"/>
        </record>

        <!-- Seuils par défaut KDIGO -->
        <record id="threshold_hemoglobin" model="acs.nephro.bilan.threshold">
            <field name="name">Hémoglobine</field>
            <field name="code">hemoglobin</field>
            <field name="unit">g/dL</field>
            <field name="min_target">10.0</field>
            <field name="max_target">12.0</field>
            <field name="notes">Cible KDIGO : 10–12 g/dL en dialyse</field>
        </record>
        <record id="threshold_potassium" model="acs.nephro.bilan.threshold">
            <field name="name">Potassium</field>
            <field name="code">potassium</field>
            <field name="unit">mmol/L</field>
            <field name="min_target">3.5</field>
            <field name="max_target">5.5</field>
            <field name="notes">Hyperkaliémie si > 5.5 mmol/L</field>
        </record>
        <record id="threshold_phosphorus" model="acs.nephro.bilan.threshold">
            <field name="name">Phosphore</field>
            <field name="code">phosphorus</field>
            <field name="unit">mmol/L</field>
            <field name="min_target">1.1</field>
            <field name="max_target">1.8</field>
            <field name="notes">Cible KDIGO : 1.1–1.8 mmol/L</field>
        </record>
        <record id="threshold_albumin" model="acs.nephro.bilan.threshold">
            <field name="name">Albumine</field>
            <field name="code">albumin</field>
            <field name="unit">g/L</field>
            <field name="min_target">35.0</field>
            <field name="notes">Dénutrition si &lt; 35 g/L</field>
        </record>
        <record id="threshold_pth" model="acs.nephro.bilan.threshold">
            <field name="name">PTH</field>
            <field name="code">pth</field>
            <field name="unit">pg/mL</field>
            <field name="min_target">150.0</field>
            <field name="max_target">300.0</field>
            <field name="notes">Cible KDIGO : 2–9× limite supérieure normale (≈150–300)</field>
        </record>
        <record id="threshold_ferritin" model="acs.nephro.bilan.threshold">
            <field name="name">Ferritine</field>
            <field name="code">ferritin</field>
            <field name="unit">µg/L</field>
            <field name="min_target">200.0</field>
            <field name="max_target">500.0</field>
            <field name="notes">Carence martiale si &lt; 200, surcharge si > 500</field>
        </record>
        <record id="threshold_caxp" model="acs.nephro.bilan.threshold">
            <field name="name">Produit CaxP</field>
            <field name="code">caxp_product</field>
            <field name="unit">mmol²/L²</field>
            <field name="max_target">4.4</field>
            <field name="notes">Risque calcification vasculaire si > 4.4</field>
        </record>
    </data>
</odoo>
```

- [ ] **Step 4 : Créer `views/bilan_view.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>

    <record id="view_acs_nephro_bilan_list" model="ir.ui.view">
        <field name="name">acs.nephro.bilan.list</field>
        <field name="model">acs.nephro.bilan</field>
        <field name="arch" type="xml">
            <list string="Bilans Biologiques" default_order="exam_date desc">
                <field name="name"/>
                <field name="exam_date"/>
                <field name="bilan_type"/>
                <field name="hemoglobin"/>
                <field name="hemoglobin_status" widget="badge"
                       decoration-success="hemoglobin_status == 'ok'"
                       decoration-danger="hemoglobin_status == 'low' or hemoglobin_status == 'high'"
                       optional="show"/>
                <field name="potassium"/>
                <field name="potassium_status" widget="badge"
                       decoration-success="potassium_status == 'ok'"
                       decoration-danger="potassium_status == 'high'"
                       decoration-warning="potassium_status == 'low'"
                       optional="show"/>
                <field name="phosphorus"/>
                <field name="phosphorus_status" widget="badge"
                       decoration-success="phosphorus_status == 'ok'"
                       decoration-danger="phosphorus_status == 'high'"
                       optional="show"/>
                <field name="albumin"/>
                <field name="albumin_status" widget="badge"
                       decoration-success="albumin_status == 'ok'"
                       decoration-danger="albumin_status == 'low'"
                       optional="show"/>
                <field name="physician_id" optional="hide"/>
            </list>
        </field>
    </record>

    <record id="view_acs_nephro_bilan_form" model="ir.ui.view">
        <field name="name">acs.nephro.bilan.form</field>
        <field name="model">acs.nephro.bilan</field>
        <field name="arch" type="xml">
            <form string="Bilan Biologique">
                <header>
                    <field name="name" readonly="1" class="o_field_widget o_statusbar_status"/>
                </header>
                <sheet>
                    <group>
                        <group>
                            <field name="patient_id"/>
                            <field name="exam_date"/>
                            <field name="bilan_type"/>
                        </group>
                        <group>
                            <field name="physician_id"/>
                            <field name="attachment_ids" widget="many2many_binary"/>
                        </group>
                    </group>
                    <notebook>
                        <page string="Hématologie" name="hematology">
                            <group>
                                <group>
                                    <field name="hemoglobin"/>
                                    <field name="hemoglobin_status" widget="badge"
                                           decoration-success="hemoglobin_status == 'ok'"
                                           decoration-danger="hemoglobin_status in ('low','high')"/>
                                    <field name="hematocrit"/>
                                    <field name="white_blood_cells"/>
                                    <field name="platelets"/>
                                </group>
                                <group>
                                    <field name="ferritin"/>
                                    <field name="transferrin_saturation"/>
                                </group>
                            </group>
                        </page>
                        <page string="Biochimie Rénale" name="biochemistry">
                            <group>
                                <group>
                                    <field name="creatinine"/>
                                    <field name="urea_pre"/>
                                    <field name="urea_post"/>
                                    <field name="urr_calculated"/>
                                </group>
                                <group>
                                    <field name="uric_acid"/>
                                </group>
                            </group>
                        </page>
                        <page string="Électrolytes" name="electrolytes">
                            <group>
                                <group>
                                    <field name="sodium"/>
                                    <field name="potassium"/>
                                    <field name="potassium_status" widget="badge"
                                           decoration-success="potassium_status == 'ok'"
                                           decoration-danger="potassium_status == 'high'"
                                           decoration-warning="potassium_status == 'low'"/>
                                </group>
                                <group>
                                    <field name="calcium"/>
                                    <field name="phosphorus"/>
                                    <field name="phosphorus_status" widget="badge"
                                           decoration-success="phosphorus_status == 'ok'"
                                           decoration-danger="phosphorus_status in ('low','high')"/>
                                    <field name="bicarbonate"/>
                                    <field name="caxp_product"/>
                                    <field name="caxp_status" widget="badge"
                                           decoration-success="caxp_status == 'ok'"
                                           decoration-danger="caxp_status == 'high'"/>
                                </group>
                            </group>
                        </page>
                        <page string="Minéraux-Os" name="minerals">
                            <group>
                                <group>
                                    <field name="pth"/>
                                    <field name="pth_status" widget="badge"
                                           decoration-success="pth_status == 'ok'"
                                           decoration-danger="pth_status in ('low','high')"/>
                                </group>
                                <group>
                                    <field name="vitamin_d"/>
                                    <field name="alkaline_phosphatase"/>
                                </group>
                            </group>
                        </page>
                        <page string="Nutrition / Inflammation" name="nutrition">
                            <group>
                                <group>
                                    <field name="albumin"/>
                                    <field name="albumin_status" widget="badge"
                                           decoration-success="albumin_status == 'ok'"
                                           decoration-danger="albumin_status == 'low'"/>
                                    <field name="total_proteins"/>
                                </group>
                                <group>
                                    <field name="crp"/>
                                    <field name="prealbumin"/>
                                </group>
                            </group>
                        </page>
                        <page string="Sérologies" name="serology">
                            <group>
                                <group>
                                    <field name="hbs_ag" widget="badge"
                                           decoration-danger="hbs_ag == 'positive'"
                                           decoration-success="hbs_ag == 'negative'"/>
                                    <field name="anti_hbs" widget="badge"
                                           decoration-success="anti_hbs == 'positive'"
                                           decoration-warning="anti_hbs == 'negative'"/>
                                    <field name="anti_hbc" widget="badge"
                                           decoration-warning="anti_hbc == 'positive'"
                                           decoration-success="anti_hbc == 'negative'"/>
                                </group>
                                <group>
                                    <field name="anti_hcv" widget="badge"
                                           decoration-danger="anti_hcv == 'positive'"
                                           decoration-success="anti_hcv == 'negative'"/>
                                    <field name="anti_hiv" widget="badge"
                                           decoration-danger="anti_hiv == 'positive'"
                                           decoration-success="anti_hiv == 'negative'"/>
                                </group>
                            </group>
                        </page>
                        <page string="Notes" name="notes_page">
                            <field name="notes" nolabel="1"
                                   placeholder="Notes cliniques complémentaires..."/>
                        </page>
                    </notebook>
                </sheet>
                <chatter/>
            </form>
        </field>
    </record>

    <record id="action_acs_nephro_bilan" model="ir.actions.act_window">
        <field name="name">Bilans Biologiques</field>
        <field name="res_model">acs.nephro.bilan</field>
        <field name="view_mode">list,form</field>
        <field name="context">{'search_default_group_patient': 1}</field>
    </record>

</odoo>
```

- [ ] **Step 5 : Créer `views/bilan_threshold_view.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="view_acs_nephro_bilan_threshold_list" model="ir.ui.view">
        <field name="name">acs.nephro.bilan.threshold.list</field>
        <field name="model">acs.nephro.bilan.threshold</field>
        <field name="arch" type="xml">
            <list string="Seuils Biologiques" editable="top">
                <field name="name"/>
                <field name="code"/>
                <field name="unit"/>
                <field name="min_target"/>
                <field name="max_target"/>
                <field name="notes"/>
                <field name="active"/>
            </list>
        </field>
    </record>

    <record id="action_acs_nephro_bilan_threshold" model="ir.actions.act_window">
        <field name="name">Seuils Biologiques</field>
        <field name="res_model">acs.nephro.bilan.threshold</field>
        <field name="view_mode">list,form</field>
    </record>
</odoo>
```

- [ ] **Step 6 : Créer `views/patient_bilan_tab.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Ajout d'un onglet Bilans sur la fiche patient -->
    <record id="view_hms_patient_bilan_tab" model="ir.ui.view">
        <field name="name">hms.patient.bilan.tab</field>
        <field name="model">hms.patient</field>
        <field name="inherit_id" ref="acs_hms_nephrology.view_hms_patient_nephro_form"/>
        <field name="arch" type="xml">
            <xpath expr="//notebook" position="inside">
                <page string="Bilans Biologiques" name="bilans">
                    <field name="bilan_ids"
                           context="{'default_patient_id': active_id}"
                           domain="[('patient_id', '=', active_id)]">
                        <list default_order="exam_date desc">
                            <field name="name"/>
                            <field name="exam_date"/>
                            <field name="bilan_type"/>
                            <field name="hemoglobin"/>
                            <field name="hemoglobin_status" widget="badge"
                                   decoration-success="hemoglobin_status == 'ok'"
                                   decoration-danger="hemoglobin_status in ('low','high')"/>
                            <field name="potassium"/>
                            <field name="potassium_status" widget="badge"
                                   decoration-success="potassium_status == 'ok'"
                                   decoration-danger="potassium_status == 'high'"
                                   decoration-warning="potassium_status == 'low'"/>
                            <field name="phosphorus_status" widget="badge"
                                   decoration-success="phosphorus_status == 'ok'"
                                   decoration-danger="phosphorus_status == 'high'"/>
                            <field name="albumin_status" widget="badge"
                                   decoration-success="albumin_status == 'ok'"
                                   decoration-danger="albumin_status == 'low'"/>
                        </list>
                    </field>
                </page>
            </xpath>
        </field>
    </record>
</odoo>
```

Puis ajouter la relation inverse dans `hms_base.py` (classe `ACSPatient` héritée) :
```python
bilan_ids = fields.One2many(
    'acs.nephro.bilan', 'patient_id', string='Bilans Biologiques'
)
```

- [ ] **Step 7 : Créer `views/menu_item.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <menuitem id="menu_acs_nephro_bilans"
              name="Bilans Biologiques"
              parent="acs_hms_nephrology.menu_nephrology"
              action="action_acs_nephro_bilan"
              sequence="15"/>
    <menuitem id="menu_acs_bilan_thresholds"
              name="Seuils Biologiques"
              parent="acs_hms_nephrology.menu_nephrology_config"
              action="action_acs_nephro_bilan_threshold"
              sequence="25"/>
</odoo>
```

- [ ] **Step 8 : Lancer les tests complets**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology_bilans \
  --log-level=test 2>&1 | grep -E "test_bilan|FAIL|ERROR"
```

Attendu : tous les tests `ok`, aucun `FAIL` ni `ERROR`

- [ ] **Step 9 : Commit**

```bash
git add acs_hms_nephrology_bilans/
git commit -m "feat(bilans): add views, thresholds, patient tab and default KDIGO thresholds"
```

---

### Task 9 : Cron — Alerte bilans en retard (> 30 jours)

**Files:**
- Create: `acs_hms_nephrology_bilans/data/cron_data.xml`
- Modify: `acs_hms_nephrology_bilans/__manifest__.py`
- Modify: `acs_hms_nephrology_bilans/models/bilan.py`
- Modify: `acs_hms_nephrology_bilans/tests/test_bilan.py`

- [ ] **Step 1 : Écrire le test**

Ajouter dans `test_bilan.py` :

```python
class TestBilanOverdueAlert(TransactionCase):

    def setUp(self):
        super().setUp()
        from datetime import timedelta
        self.patient_ok = self.env['hms.patient'].create({'name': 'Patient avec bilan récent'})
        self.patient_overdue = self.env['hms.patient'].create({'name': 'Patient sans bilan récent'})

        # Activer le flag néphro
        self.patient_ok.write({'nephrology_care': True})
        self.patient_overdue.write({'nephrology_care': True})

        # Bilan récent pour patient_ok
        self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient_ok.id,
            'bilan_type': 'monthly',
            'exam_date': fields.Datetime.now(),
        })
        # Vieux bilan pour patient_overdue (35 jours)
        old_date = fields.Datetime.now() - timedelta(days=35)
        self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient_overdue.id,
            'bilan_type': 'monthly',
            'exam_date': old_date,
        })

    def test_overdue_patients_detected(self):
        overdue = self.env['acs.nephro.bilan']._get_overdue_patients(days=30)
        self.assertIn(self.patient_overdue.id, overdue.ids)
        self.assertNotIn(self.patient_ok.id, overdue.ids)
```

- [ ] **Step 2 : Ajouter la méthode dans `bilan.py`**

Ajouter dans la classe `ACSNephroBilan` :

```python
    @api.model
    def _get_overdue_patients(self, days=30):
        """Retourne les patients néphro sans bilan depuis X jours"""
        from datetime import timedelta
        cutoff = fields.Datetime.now() - timedelta(days=days)

        # Patients néphro actifs
        nephro_patients = self.env['hms.patient'].search([
            ('nephrology_care', '=', True),
            ('active', '=', True),
        ])

        overdue_patients = self.env['hms.patient']
        for patient in nephro_patients:
            last_bilan = self.search([
                ('patient_id', '=', patient.id),
            ], order='exam_date desc', limit=1)

            if not last_bilan or last_bilan.exam_date < cutoff:
                overdue_patients |= patient

        return overdue_patients

    @api.model
    def action_check_overdue_bilans(self):
        """Cron : crée des activités mail pour les bilans en retard"""
        overdue = self._get_overdue_patients(days=30)
        for patient in overdue:
            # Créer une activité sur le patient
            patient.activity_schedule(
                'mail.mail_activity_data_todo',
                summary='Bilan biologique en retard (> 30 jours)',
                note=f'Le patient {patient.name} n\'a pas eu de bilan depuis plus de 30 jours.',
                user_id=patient.physician_id.user_id.id if patient.physician_id else self.env.uid,
            )
```

- [ ] **Step 3 : Créer `data/cron_data.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data noupdate="1">
        <record id="cron_check_overdue_bilans" model="ir.cron">
            <field name="name">Dialyse : Vérifier bilans biologiques en retard</field>
            <field name="model_id" ref="model_acs_nephro_bilan"/>
            <field name="state">code</field>
            <field name="code">model.action_check_overdue_bilans()</field>
            <field name="interval_number">1</field>
            <field name="interval_type">days</field>
            <field name="numbercall">-1</field>
            <field name="active">True</field>
        </record>
    </data>
</odoo>
```

- [ ] **Step 4 : Ajouter le cron dans `__manifest__.py`**

Dans la liste `'data'` du manifest, ajouter :
```python
'data/cron_data.xml',
```

- [ ] **Step 5 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 odoo \
  -c /etc/odoo/odoo.conf \
  --test-enable --stop-after-init \
  -d <DB> -u acs_hms_nephrology_bilans \
  --log-level=test 2>&1 | grep -E "test_overdue|FAIL|ERROR"
```

Attendu : `test_overdue_patients_detected ... ok`

- [ ] **Step 6 : Commit**

```bash
git add acs_hms_nephrology_bilans/data/cron_data.xml \
        acs_hms_nephrology_bilans/__manifest__.py \
        acs_hms_nephrology_bilans/models/bilan.py \
        acs_hms_nephrology_bilans/tests/test_bilan.py
git commit -m "feat(bilans): add daily cron for overdue biological test alerts"
```

---

### Task 10 : Rapport PDF bilan (QWeb)

**Files:**
- Create: `acs_hms_nephrology_bilans/report/bilan_report.xml`

- [ ] **Step 1 : Créer `report/bilan_report.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>

    <record id="action_report_nephro_bilan" model="ir.actions.report">
        <field name="name">Bilan Biologique</field>
        <field name="model">acs.nephro.bilan</field>
        <field name="report_type">qweb-pdf</field>
        <field name="report_name">acs_hms_nephrology_bilans.report_nephro_bilan</field>
        <field name="report_file">acs_hms_nephrology_bilans.report_nephro_bilan</field>
        <field name="print_report_name">'Bilan_%s_%s' % (object.patient_id.name.replace(' ', '_'), object.exam_date.strftime('%Y%m%d'))</field>
        <field name="binding_model_id" ref="model_acs_nephro_bilan"/>
    </record>

    <template id="report_nephro_bilan">
        <t t-call="web.html_container">
            <t t-foreach="docs" t-as="o">
                <t t-call="web.external_layout">
                    <div class="page">
                        <h2>Bilan Biologique — <t t-esc="o.patient_id.name"/></h2>
                        <p>
                            <strong>Date :</strong> <t t-esc="o.exam_date.strftime('%d/%m/%Y')"/> |
                            <strong>Type :</strong> <t t-esc="dict(o._fields['bilan_type'].selection).get(o.bilan_type, '')"/> |
                            <strong>Médecin :</strong> <t t-esc="o.physician_id.name or 'N/A'"/>
                        </p>

                        <h3>Hématologie</h3>
                        <table class="table table-sm table-bordered">
                            <thead><tr><th>Paramètre</th><th>Résultat</th><th>Unité</th><th>Cible</th><th>Statut</th></tr></thead>
                            <tbody>
                                <tr t-if="o.hemoglobin">
                                    <td>Hémoglobine</td><td><t t-esc="o.hemoglobin"/></td>
                                    <td>g/dL</td><td>10–12</td>
                                    <td><t t-esc="dict(o._fields['hemoglobin_status'].selection).get(o.hemoglobin_status, '')"/></td>
                                </tr>
                                <tr t-if="o.ferritin">
                                    <td>Ferritine</td><td><t t-esc="o.ferritin"/></td>
                                    <td>µg/L</td><td>200–500</td><td>—</td>
                                </tr>
                            </tbody>
                        </table>

                        <h3>Électrolytes</h3>
                        <table class="table table-sm table-bordered">
                            <thead><tr><th>Paramètre</th><th>Résultat</th><th>Unité</th><th>Cible</th><th>Statut</th></tr></thead>
                            <tbody>
                                <tr t-if="o.potassium">
                                    <td>Potassium K</td><td><t t-esc="o.potassium"/></td>
                                    <td>mmol/L</td><td>3.5–5.5</td>
                                    <td><t t-esc="dict(o._fields['potassium_status'].selection).get(o.potassium_status, '')"/></td>
                                </tr>
                                <tr t-if="o.phosphorus">
                                    <td>Phosphore P</td><td><t t-esc="o.phosphorus"/></td>
                                    <td>mmol/L</td><td>1.1–1.8</td>
                                    <td><t t-esc="dict(o._fields['phosphorus_status'].selection).get(o.phosphorus_status, '')"/></td>
                                </tr>
                                <tr t-if="o.caxp_product">
                                    <td>Produit CaxP</td><td><t t-esc="o.caxp_product"/></td>
                                    <td>mmol²/L²</td><td>&lt; 4.4</td>
                                    <td><t t-esc="dict(o._fields['caxp_status'].selection).get(o.caxp_status, '')"/></td>
                                </tr>
                            </tbody>
                        </table>

                        <h3>Nutrition / Inflammation</h3>
                        <table class="table table-sm table-bordered">
                            <thead><tr><th>Paramètre</th><th>Résultat</th><th>Unité</th><th>Cible</th><th>Statut</th></tr></thead>
                            <tbody>
                                <tr t-if="o.albumin">
                                    <td>Albumine</td><td><t t-esc="o.albumin"/></td>
                                    <td>g/L</td><td>&gt; 35</td>
                                    <td><t t-esc="dict(o._fields['albumin_status'].selection).get(o.albumin_status, '')"/></td>
                                </tr>
                                <tr t-if="o.crp">
                                    <td>CRP</td><td><t t-esc="o.crp"/></td>
                                    <td>mg/L</td><td>&lt; 5</td><td>—</td>
                                </tr>
                            </tbody>
                        </table>

                        <t t-if="o.notes">
                            <h3>Notes cliniques</h3>
                            <p><t t-esc="o.notes"/></p>
                        </t>
                    </div>
                </t>
            </t>
        </t>
    </template>

</odoo>
```

- [ ] **Step 2 : Tester le rendu PDF depuis l'interface Odoo**

1. Ouvrir un bilan dans Odoo → menu Imprimer → "Bilan Biologique"
2. Vérifier que le PDF se génère sans erreur
3. Vérifier que les sections Hématologie, Électrolytes, Nutrition s'affichent correctement

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_bilans/report/bilan_report.xml
git commit -m "feat(bilans): add QWeb PDF report for biological tests"
```

---

### Task 11 : Composant OWL — Graphique évolution bilans

**Files:**
- Create: `acs_hms_nephrology_bilans/static/src/components/bilan_chart.js`
- Create: `acs_hms_nephrology_bilans/static/src/components/bilan_chart.xml`
- Create: `acs_hms_nephrology_bilans/static/src/css/bilan_chart.css`

- [ ] **Step 1 : Créer `static/src/components/bilan_chart.js`**

```javascript
/** @odoo-module **/

import { Component, useState, onWillStart, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

/**
 * BilanChartWidget — affiche l'évolution d'un paramètre biologique sur 12 mois
 * Utilisé comme widget sur la fiche patient dans l'onglet Bilans
 */
export class BilanChartWidget extends Component {
    static template = "acs_hms_nephrology_bilans.BilanChart";
    static props = {
        patientId: { type: Number },
        parameter: { type: String },    // 'hemoglobin', 'potassium', 'phosphorus', 'albumin', 'pth'
        label: { type: String },
        unit: { type: String },
        targetMin: { type: Number, optional: true },
        targetMax: { type: Number, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        this.canvasRef = useRef("canvas");
        this.state = useState({ loading: true, data: [], labels: [] });

        onWillStart(async () => {
            await this._loadData();
        });
    }

    async _loadData() {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const bilans = await this.orm.searchRead(
            "acs.nephro.bilan",
            [
                ["patient_id", "=", this.props.patientId],
                ["exam_date", ">=", twelveMonthsAgo.toISOString()],
            ],
            ["exam_date", this.props.parameter],
            { order: "exam_date asc", limit: 24 }
        );

        this.state.labels = bilans.map((b) => {
            const d = new Date(b.exam_date);
            return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        });
        this.state.data = bilans.map((b) => b[this.props.parameter] || null);
        this.state.loading = false;

        // Rendu Chart.js après le prochain tick
        setTimeout(() => this._renderChart(), 50);
    }

    _renderChart() {
        const canvas = this.canvasRef.el;
        if (!canvas || !this.state.data.length) return;

        const datasets = [
            {
                label: `${this.props.label} (${this.props.unit})`,
                data: this.state.data,
                borderColor: "#1565C0",
                backgroundColor: "rgba(21, 101, 192, 0.1)",
                tension: 0.3,
                fill: true,
                pointRadius: 5,
            },
        ];

        // Ligne cible min (pointillée verte)
        if (this.props.targetMin) {
            datasets.push({
                label: `Cible min (${this.props.targetMin})`,
                data: new Array(this.state.labels.length).fill(this.props.targetMin),
                borderColor: "#2E7D32",
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
            });
        }

        // Ligne cible max (pointillée orange)
        if (this.props.targetMax) {
            datasets.push({
                label: `Cible max (${this.props.targetMax})`,
                data: new Array(this.state.labels.length).fill(this.props.targetMax),
                borderColor: "#E65100",
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
            });
        }

        // Chart.js est disponible dans Odoo via /web/static/lib/Chart/Chart.js
        new Chart(canvas, {
            type: "line",
            data: { labels: this.state.labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "top" },
                    title: {
                        display: true,
                        text: `Évolution — ${this.props.label} (12 mois)`,
                    },
                },
                scales: {
                    y: { beginAtZero: false },
                },
            },
        });
    }
}

// Enregistrement comme widget de vue de liste/form
registry.category("view_widgets").add("bilan_chart", {
    component: BilanChartWidget,
});
```

- [ ] **Step 2 : Créer `static/src/components/bilan_chart.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">

    <t t-name="acs_hms_nephrology_bilans.BilanChart">
        <div class="acs_bilan_chart_container">
            <t t-if="state.loading">
                <div class="text-center p-3">
                    <i class="fa fa-spinner fa-spin"/> Chargement du graphique...
                </div>
            </t>
            <t t-elif="!state.data.length">
                <div class="text-center text-muted p-3">
                    Aucune donnée disponible sur les 12 derniers mois
                </div>
            </t>
            <t t-else="">
                <canvas t-ref="canvas" style="height: 220px;"/>
            </t>
        </div>
    </t>

</templates>
```

- [ ] **Step 3 : Créer `static/src/css/bilan_chart.css`**

```css
.acs_bilan_chart_container {
    padding: 12px;
    background: #fafafa;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
    margin-bottom: 16px;
}
```

- [ ] **Step 4 : Ajouter les graphiques dans `patient_bilan_tab.xml`**

Dans la page "Bilans Biologiques" de la fiche patient, ajouter après la liste des bilans :

```xml
<separator string="Évolution sur 12 mois"/>
<div class="row">
    <div class="col-md-6">
        <widget name="bilan_chart"
                patient_id="id"
                parameter="'hemoglobin'"
                label="'Hémoglobine'"
                unit="'g/dL'"
                target_min="10.0"
                target_max="12.0"/>
    </div>
    <div class="col-md-6">
        <widget name="bilan_chart"
                patient_id="id"
                parameter="'phosphorus'"
                label="'Phosphore'"
                unit="'mmol/L'"
                target_min="1.1"
                target_max="1.8"/>
    </div>
</div>
<div class="row">
    <div class="col-md-6">
        <widget name="bilan_chart"
                patient_id="id"
                parameter="'potassium'"
                label="'Potassium'"
                unit="'mmol/L'"
                target_min="3.5"
                target_max="5.5"/>
    </div>
    <div class="col-md-6">
        <widget name="bilan_chart"
                patient_id="id"
                parameter="'albumin'"
                label="'Albumine'"
                unit="'g/L'"
                target_min="35.0"/>
    </div>
</div>
```

- [ ] **Step 5 : Tester le composant OWL dans le navigateur**

1. Redémarrer le conteneur Odoo pour recharger les assets :
```bash
docker restart odoo-19-as-shafi-minhn92-odoo19-1
```

2. Ouvrir la fiche d'un patient néphro avec des bilans saisis
3. Aller dans l'onglet "Bilans Biologiques"
4. Vérifier que les 4 graphiques s'affichent avec les lignes cibles
5. Vérifier dans la console browser (F12) qu'il n'y a pas d'erreur JavaScript

- [ ] **Step 6 : Commit**

```bash
git add acs_hms_nephrology_bilans/static/
git commit -m "feat(bilans): add OWL chart component for 12-month biological parameter evolution"
```

---

## Récapitulatif Sprint 1

| # | Tâche | Module | Statut |
|---|---|---|---|
| 1 | `acs.dialysis.station` model + views | `acs_hms_nephrology` | - [ ] |
| 2 | `acs.dry.weight.history` model + views | `acs_hms_nephrology` | - [ ] |
| 3 | Signes vitaux étendus (SpO2, temp, glycémie, alerte hypotension) | `acs_hms_nephrology` | - [ ] |
| 4 | Champs pré/post séance + KT/V Daugirdas II + URR | `acs_hms_nephrology` | - [ ] |
| 5 | Planning étendu (poste, médecin, infirmiers, capacité) | `acs_hms_nephrology` | - [ ] |
| 6 | Module complications + `acs.dialysis.complication` | `acs_hms_nephrology_complications` | - [ ] |
| 7 | Module bilans + `acs.nephro.bilan` (tous groupes bio) | `acs_hms_nephrology_bilans` | - [ ] |
| 8 | Vues bilans + intégration patient + seuils KDIGO | `acs_hms_nephrology_bilans` | - [ ] |
| 9 | Cron alertes bilans en retard | `acs_hms_nephrology_bilans` | - [ ] |
| 10 | Rapport PDF bilan (QWeb) | `acs_hms_nephrology_bilans` | - [ ] |
| 11 | Composant OWL graphique évolution | `acs_hms_nephrology_bilans` | - [ ] |

**Résultat attendu en fin de Sprint 1 :**
- Les séances d'hémodialyse enregistrent SpO2, température, statut arrivée, tolérance, et calculent automatiquement KT/V et URR
- Les postes de dialyse sont configurables et liés aux plannings
- Les complications per-séance sont tracées avec type, heure, action et résolution
- Les bilans biologiques complets sont saisis avec badges colorés automatiques
- Les courbes d'évolution sur 12 mois s'affichent sur la fiche patient
- Un cron quotidien alerte sur les bilans en retard
- Un PDF bilan est imprimable depuis Odoo
