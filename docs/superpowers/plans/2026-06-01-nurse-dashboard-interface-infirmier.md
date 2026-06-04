# Interface Infirmier Tablette (Section 5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le module `acs_hms_nephrology_dashboard` avec une interface infirmier tablette OWL — 4 écrans (liste patients du jour, séance en cours, popup complication, fin de séance).

**Architecture:** OWL Client Action (`ir.actions.client`, tag `acs_nurse_dashboard`) montée dans le shell Odoo. Composant racine `NurseDashboard` gère la machine à états (`screen: list|session|end`), le timer 30 min visuel, et le rechargement procédure après chaque write serveur. Pas de nouveaux modèles Python — les écritures ciblent `acs.patient.procedure`, `hemodialysis.vital.sign`, et `acs.dialysis.complication`.

**Tech Stack:** Odoo 19, OWL 2 (`@odoo/owl`), `useService("orm")`, `useEffect`, Python `TransactionCase`

**Spec :** `docs/superpowers/specs/2026-06-01-nurse-dashboard-interface-infirmier.md`

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `acs_hms_nephrology_dashboard/__manifest__.py` | Créer | Déclaration module, assets, dépendances |
| `acs_hms_nephrology_dashboard/__init__.py` | Créer | Init Python (vide) |
| `acs_hms_nephrology_dashboard/models/__init__.py` | Créer | Init models (vide) |
| `acs_hms_nephrology_dashboard/security/ir.model.access.csv` | Créer | ACL write infirmier sur `acs.patient.procedure` |
| `acs_hms_nephrology_dashboard/views/nurse_dashboard_action.xml` | Créer | `ir.actions.client` + menu item |
| `acs_hms_nephrology_dashboard/static/src/nurse_dashboard.js` | Créer | Bundle entry point |
| `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseDashboard.js` | Créer | Composant racine : machine à états, timer, data loading |
| `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseDashboard.xml` | Créer | Template racine — routing par screen |
| `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NursePatientList.js` | Créer | Écran 1 : liste patients + sélecteur planning |
| `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NursePatientList.xml` | Créer | Template Écran 1 |
| `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseSessionForm.js` | Créer | Écran 2 : signes vitaux, bannières, timer |
| `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseSessionForm.xml` | Créer | Template Écran 2 |
| `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseComplicationPopup.js` | Créer | Écran 3 : popup complication |
| `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseComplicationPopup.xml` | Créer | Template Écran 3 |
| `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseEndSession.js` | Créer | Écran 4 : fin de séance + validation KT/V |
| `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseEndSession.xml` | Créer | Template Écran 4 |
| `acs_hms_nephrology_dashboard/tests/__init__.py` | Créer | Init tests |
| `acs_hms_nephrology_dashboard/tests/test_nurse_dashboard.py` | Créer | Tests Python : ACL + filtre données |

---

## Task 1 : Scaffolding module + ACL

**Files :**
- Create: `acs_hms_nephrology_dashboard/__manifest__.py`
- Create: `acs_hms_nephrology_dashboard/__init__.py`
- Create: `acs_hms_nephrology_dashboard/models/__init__.py`
- Create: `acs_hms_nephrology_dashboard/security/ir.model.access.csv`
- Create: `acs_hms_nephrology_dashboard/views/nurse_dashboard_action.xml`
- Test: `acs_hms_nephrology_dashboard/tests/__init__.py`
- Test: `acs_hms_nephrology_dashboard/tests/test_nurse_dashboard.py`

### Étape TDD : écrire les tests ACL d'abord

- [ ] **Step 1 : Écrire le test ACL**

Créer `acs_hms_nephrology_dashboard/tests/__init__.py` :
```python
# -*- coding: utf-8 -*-
from . import test_nurse_dashboard
```

Créer `acs_hms_nephrology_dashboard/tests/test_nurse_dashboard.py` :
```python
# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase
from odoo.exceptions import AccessError


class TestNurseDashboardACL(TransactionCase):

    def setUp(self):
        super().setUp()
        # Créer un utilisateur infirmier
        nurse_group = self.env.ref('acs_hms.group_hms_nurse')
        self.nurse_user = self.env['res.users'].create({
            'name': 'Infirmier Test',
            'login': 'nurse_test_dashboard@test.com',
            'groups_id': [(6, 0, [nurse_group.id])],
        })
        # Patient + produit + procédure de test
        self.patient = self.env['hms.patient'].create({'name': 'Patient ACL Test'})
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

    def test_nurse_can_write_procedure(self):
        """Infirmier peut modifier acs.patient.procedure (departure_weight, global_tolerance)"""
        proc_as_nurse = self.procedure.with_user(self.nurse_user)
        # Ne doit pas lever AccessError
        proc_as_nurse.write({'global_tolerance': 'good'})
        self.assertEqual(self.procedure.global_tolerance, 'good')

    def test_nurse_can_create_vital_sign(self):
        """Infirmier peut créer hemodialysis.vital.sign"""
        vital = self.env['hemodialysis.vital.sign'].with_user(self.nurse_user).create({
            'procedure_id': self.procedure.id,
            'blood_pressure': '120/80',
            'heart_rate': 72,
        })
        self.assertTrue(vital.id)

    def test_nurse_can_create_complication(self):
        """Infirmier peut créer acs.dialysis.complication"""
        complication = self.env['acs.dialysis.complication'].with_user(self.nurse_user).create({
            'procedure_id': self.procedure.id,
            'complication_type': 'hypotension',
            'action_taken': 'Position Trendelenburg, sérum physiologique',
            'resolution': 'yes',
        })
        self.assertTrue(complication.id)
```

- [ ] **Step 2 : Vérifier que le test `test_nurse_can_write_procedure` échoue**

Le module n'existe pas encore — on vérifie la logique attendue en lisant le CSV ACL de `acs_hms` :
```bash
grep "acs_patient_procedure\|patient_procedure" \
  "/Users/yusper/Downloads/modules 19/as shafi/acs_hms/security/ir.model.access.csv"
```
Expected : `group_hms_nurse` absent → confirme que le test va échouer (AccessError) une fois le module chargé sans notre ACL.

- [ ] **Step 3 : Créer la structure du module**

```bash
mkdir -p "/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology_dashboard/models"
mkdir -p "/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology_dashboard/security"
mkdir -p "/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology_dashboard/views"
mkdir -p "/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard"
mkdir -p "/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology_dashboard/tests"
```

- [ ] **Step 4 : Créer `__init__.py` et `models/__init__.py`**

`acs_hms_nephrology_dashboard/__init__.py` :
```python
# -*- coding: utf-8 -*-
from . import models
```

`acs_hms_nephrology_dashboard/models/__init__.py` :
```python
# -*- coding: utf-8 -*-
```

- [ ] **Step 5 : Créer `security/ir.model.access.csv`**

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_acs_patient_procedure_nurse_dashboard,acs.patient.procedure nurse dashboard,acs_hms.model_acs_patient_procedure,acs_hms.group_hms_nurse,1,1,0,0
```

- [ ] **Step 6 : Créer `views/nurse_dashboard_action.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="action_nurse_dashboard" model="ir.actions.client">
        <field name="name">Interface Infirmier</field>
        <field name="tag">acs_nurse_dashboard</field>
    </record>

    <menuitem
        id="menu_nurse_dashboard"
        name="Interface Infirmier"
        action="action_nurse_dashboard"
        parent="acs_hms_nephrology.menu_nephrology"
        groups="acs_hms.group_hms_nurse,acs_hms_base.group_hms_manager,acs_hms_nephrology.group_hms_nephrology_user"
        sequence="5"/>
</odoo>
```

- [ ] **Step 7 : Créer `__manifest__.py`**

```python
# -*- coding: utf-8 -*-
{
    'name': 'Nephrology Dashboard',
    'version': '1.0.0',
    'category': 'Medical',
    'summary': 'Interface infirmier tablette + dashboard médecin (OWL)',
    'depends': ['acs_hms_nephrology', 'acs_hms_nephrology_complications'],
    'data': [
        'security/ir.model.access.csv',
        'views/nurse_dashboard_action.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'acs_hms_nephrology_dashboard/static/src/**/*.js',
            'acs_hms_nephrology_dashboard/static/src/**/*.xml',
        ],
    },
    'application': False,
    'installable': True,
    'license': 'OPL-1',
}
```

- [ ] **Step 8 : Vérifier que les tests passent**

```bash
cd /path/to/odoo && python odoo-bin \
  -i acs_hms_nephrology_dashboard \
  --test-enable \
  --test-tags acs_hms_nephrology_dashboard.TestNurseDashboardACL \
  -d test_db --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK|Ran"
```

Expected : `Ran 3 tests ... OK`

- [ ] **Step 9 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/
git commit -m "feat(dashboard): scaffold acs_hms_nephrology_dashboard module + nurse ACL"
```

---

## Task 2 : NurseDashboard — composant racine

**Files :**
- Create: `acs_hms_nephrology_dashboard/static/src/nurse_dashboard.js`
- Create: `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseDashboard.js`
- Create: `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseDashboard.xml`

Les sous-composants (NursePatientList, NurseSessionForm, NurseEndSession) sont importés mais créés aux Tasks 3–6. Pour compiler sans erreur, créer d'abord des stubs minimalistes pour chaque sous-composant avant d'implémenter le racine.

- [ ] **Step 1 : Créer les stubs des sous-composants**

`NursePatientList.js` (stub) :
```js
/** @odoo-module **/
import { Component } from "@odoo/owl";
export class NursePatientList extends Component {
    static template = "acs_hms_nephrology_dashboard.NursePatientList";
    static props = ["procedures", "schedules", "scheduleId", "onSelectProcedure", "onScheduleChange", "onMarkAbsent"];
}
```

`NursePatientList.xml` (stub) :
```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates>
    <t t-name="acs_hms_nephrology_dashboard.NursePatientList">
        <div>Liste patients (stub)</div>
    </t>
</templates>
```

`NurseSessionForm.js` (stub) :
```js
/** @odoo-module **/
import { Component } from "@odoo/owl";
export class NurseSessionForm extends Component {
    static template = "acs_hms_nephrology_dashboard.NurseSessionForm";
    static props = ["procedure", "vitals", "timer", "onTimerReset", "onSaveVitals", "onSaveComplication", "onGoToEnd", "onBackToList"];
}
```

`NurseSessionForm.xml` (stub) :
```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates>
    <t t-name="acs_hms_nephrology_dashboard.NurseSessionForm">
        <div>Séance en cours (stub)</div>
    </t>
</templates>
```

`NurseEndSession.js` (stub) :
```js
/** @odoo-module **/
import { Component } from "@odoo/owl";
export class NurseEndSession extends Component {
    static template = "acs_hms_nephrology_dashboard.NurseEndSession";
    static props = ["procedure", "vitals", "onValidateSession", "onBackToSession"];
}
```

`NurseEndSession.xml` (stub) :
```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates>
    <t t-name="acs_hms_nephrology_dashboard.NurseEndSession">
        <div>Fin de séance (stub)</div>
    </t>
</templates>
```

- [ ] **Step 2 : Créer `NurseDashboard.js`**

```js
/** @odoo-module **/
import { Component, useState, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { NursePatientList } from "./NursePatientList";
import { NurseSessionForm } from "./NurseSessionForm";
import { NurseEndSession } from "./NurseEndSession";

const PROCEDURE_FIELDS = [
    'id', 'name', 'patient_id', 'state', 'date', 'date_stop',
    'department_id', 'nephrology_schedule_ids',
    'arrival_status', 'pre_dialysis_bp', 'arrival_weight', 'dry_weight',
    'interdialysis_increase', 'uf_habituelle',
    'has_active_hypotension', 'vital_sign_ids',
    'departure_weight', 'actual_uf', 'actual_duration',
    'global_tolerance', 'end_notes',
    'urea_pre', 'urea_post',
    'ktv_calculated', 'ktv_status', 'urr_calculated',
    'complication_count',
];

const VITAL_FIELDS = [
    'id', 'measurement_time', 'blood_pressure', 'heart_rate',
    'respiratory_rate', 'spo2', 'temperature', 'glycemia', 'is_hypotension', 'notes',
];

function todayRange() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return [`${d} 00:00:00`, `${d} 23:59:59`];
}

export class NurseDashboard extends Component {
    static template = "acs_hms_nephrology_dashboard.NurseDashboard";
    static components = { NursePatientList, NurseSessionForm, NurseEndSession };

    setup() {
        this.orm = useService("orm");
        this.user = useService("user");
        this.state = useState({
            screen: 'list',
            procedureId: null,
            procedure: null,
            vitals: [],
            scheduleId: null,
            procedures: [],
            schedules: [],
        });
        this.timer = useState({
            secondsLeft: 1800,
            isRinging: false,
        });
        this._loadSchedules();
        this._loadProcedures();

        useEffect(() => {
            if (this.state.screen !== 'session') return;
            const id = setInterval(() => {
                if (this.timer.secondsLeft > 0) {
                    this.timer.secondsLeft -= 1;
                } else {
                    this.timer.isRinging = true;
                }
            }, 1000);
            return () => clearInterval(id);
        }, () => [this.state.screen]);
    }

    async _loadSchedules() {
        const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, …, 6=Sat
        const dayFields = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const dayField = dayFields[jsDay === 0 ? 6 : jsDay - 1];

        this.state.schedules = await this.orm.searchRead(
            'acs.nephrology.schedule',
            [[dayField, '=', true]],
            ['id', 'name', 'station_id', 'nurse_ids'],
        );

        const uid = this.user.userId;
        const mine = this.state.schedules.find((s) => s.nurse_ids.includes(uid));
        if (mine) {
            this.state.scheduleId = mine.id;
            await this._loadProcedures();
        }
    }

    async _loadProcedures() {
        const [start, end] = todayRange();
        const domain = [
            ['department_id.department_type', '=', 'nephrology'],
            ['date', '>=', start],
            ['date', '<=', end],
        ];
        if (this.state.scheduleId) {
            domain.push(['nephrology_schedule_ids', 'in', [this.state.scheduleId]]);
        }
        this.state.procedures = await this.orm.searchRead(
            'acs.patient.procedure',
            domain,
            ['id', 'patient_id', 'state', 'date', 'nephrology_schedule_ids'],
            { order: 'date asc' },
        );
    }

    async _reloadProcedure() {
        if (!this.state.procedureId) return;
        const [rec] = await this.orm.read(
            'acs.patient.procedure',
            [this.state.procedureId],
            PROCEDURE_FIELDS,
        );
        this.state.procedure = rec;
        if (rec.vital_sign_ids && rec.vital_sign_ids.length) {
            const vitals = await this.orm.read(
                'hemodialysis.vital.sign',
                rec.vital_sign_ids,
                VITAL_FIELDS,
            );
            vitals.sort((a, b) => (a.measurement_time > b.measurement_time ? 1 : -1));
            this.state.vitals = vitals;
        } else {
            this.state.vitals = [];
        }
    }

    async onSelectProcedure(id) {
        this.state.procedureId = id;
        await this._reloadProcedure();
        this.state.screen = 'session';
    }

    async onScheduleChange(scheduleId) {
        this.state.scheduleId = scheduleId || null;
        await this._loadProcedures();
    }

    onTimerReset() {
        this.timer.secondsLeft = 1800;
        this.timer.isRinging = false;
    }

    async onSaveVitals(vals) {
        vals.procedure_id = this.state.procedureId;
        await this.orm.create('hemodialysis.vital.sign', [vals]);
        await this._reloadProcedure();
    }

    async onSaveComplication(vals) {
        vals.procedure_id = this.state.procedureId;
        await this.orm.create('acs.dialysis.complication', [vals]);
        await this._reloadProcedure();
    }

    async onValidateSession(vals) {
        await this.orm.write('acs.patient.procedure', [this.state.procedureId], vals);
        await this._reloadProcedure();
        setTimeout(() => {
            this.state.screen = 'list';
            this.state.procedureId = null;
            this.state.procedure = null;
            this.state.vitals = [];
            this.timer.secondsLeft = 1800;
            this.timer.isRinging = false;
            this._loadProcedures();
        }, 2000);
    }

    async onMarkAbsent(procedureId) {
        await this.orm.write('acs.patient.procedure', [procedureId], { state: 'cancel' });
        await this._loadProcedures();
    }

    onGoToEnd() { this.state.screen = 'end'; }
    onBackToList() { this.state.screen = 'list'; }
    onBackToSession() { this.state.screen = 'session'; }
}

registry.category("actions").add("acs_nurse_dashboard", NurseDashboard);
```

- [ ] **Step 3 : Créer `NurseDashboard.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates>
    <t t-name="acs_hms_nephrology_dashboard.NurseDashboard">
        <div class="o_action o_nurse_dashboard">
            <NursePatientList
                t-if="state.screen === 'list'"
                procedures="state.procedures"
                schedules="state.schedules"
                scheduleId="state.scheduleId"
                onSelectProcedure.bind="onSelectProcedure"
                onScheduleChange.bind="onScheduleChange"
                onMarkAbsent.bind="onMarkAbsent"
            />
            <NurseSessionForm
                t-if="state.screen === 'session' and state.procedure"
                procedure="state.procedure"
                vitals="state.vitals"
                timer="timer"
                onTimerReset.bind="onTimerReset"
                onSaveVitals.bind="onSaveVitals"
                onSaveComplication.bind="onSaveComplication"
                onGoToEnd.bind="onGoToEnd"
                onBackToList.bind="onBackToList"
            />
            <NurseEndSession
                t-if="state.screen === 'end' and state.procedure"
                procedure="state.procedure"
                vitals="state.vitals"
                onValidateSession.bind="onValidateSession"
                onBackToSession.bind="onBackToSession"
            />
        </div>
    </t>
</templates>
```

- [ ] **Step 4 : Créer le bundle entry point `static/src/nurse_dashboard.js`**

```js
/** @odoo-module **/
export { NurseDashboard } from "./components/nurse_dashboard/NurseDashboard";
```

- [ ] **Step 5 : Vérification manuelle — monter le module et vérifier que l'action charge**

```bash
# Mettre à jour le module dans Odoo
# Naviguer vers Odoo → Néphrologie → Interface Infirmier
# Attendu : page blanche ou "Liste patients (stub)" selon le screen initial
```

- [ ] **Step 6 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/static/
git commit -m "feat(dashboard): add NurseDashboard root component with state machine and timer"
```

---

## Task 3 : NursePatientList — Écran 1

**Files :**
- Modify: `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NursePatientList.js` (remplace stub)
- Modify: `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NursePatientList.xml` (remplace stub)

- [ ] **Step 1 : Remplacer le stub `NursePatientList.js`**

```js
/** @odoo-module **/
import { Component } from "@odoo/owl";

export class NursePatientList extends Component {
    static template = "acs_hms_nephrology_dashboard.NursePatientList";
    static props = {
        procedures: Array,
        schedules: Array,
        scheduleId: { type: Number, optional: true },
        onSelectProcedure: Function,
        onScheduleChange: Function,
        onMarkAbsent: Function,
    };

    get today() {
        return new Date().toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
    }

    posteFor(proc) {
        if (!proc.nephrology_schedule_ids || !proc.nephrology_schedule_ids.length) return '—';
        const sid = proc.nephrology_schedule_ids[0];
        const sched = this.props.schedules.find((s) => s.id === sid);
        if (!sched) return '—';
        return sched.station_id ? sched.station_id[1] : sched.name;
    }

    formatTime(datetime) {
        if (!datetime) return '—';
        // datetime format: "YYYY-MM-DD HH:MM:SS"
        return datetime.slice(11, 16);
    }

    stateLabel(state) {
        return { scheduled: 'En attente', running: 'En cours', done: 'Terminé', cancel: 'Absent' }[state] || state;
    }

    stateBadgeClass(state) {
        return {
            scheduled: 'badge bg-secondary',
            running: 'badge bg-success',
            done: 'badge bg-primary',
            cancel: 'badge bg-danger',
        }[state] || 'badge bg-secondary';
    }

    onScheduleChange(ev) {
        const val = parseInt(ev.target.value) || null;
        this.props.onScheduleChange(val);
    }
}
```

- [ ] **Step 2 : Remplacer le stub `NursePatientList.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates>
    <t t-name="acs_hms_nephrology_dashboard.NursePatientList">
        <div class="o_nurse_patient_list p-3">
            <!-- Header -->
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h4 class="mb-0">Patients du jour — <t t-esc="today"/></h4>
                <div class="d-flex align-items-center gap-2">
                    <label class="mb-0 fw-semibold">Planning :</label>
                    <select class="form-select form-select-sm" t-on-change="onScheduleChange">
                        <option value="">-- Tous --</option>
                        <t t-foreach="props.schedules" t-as="s" t-key="s.id">
                            <option t-att-value="s.id" t-att-selected="s.id === props.scheduleId">
                                <t t-esc="s.name"/>
                            </option>
                        </t>
                    </select>
                    <span class="badge bg-primary">
                        <t t-esc="props.procedures.length"/> patients
                    </span>
                </div>
            </div>

            <!-- État vide : aucun planning assigné -->
            <div t-if="!props.scheduleId and props.procedures.length === 0"
                 class="alert alert-warning">
                <strong>Aucun poste assigné aujourd'hui.</strong>
                Sélectionnez un planning manuellement ci-dessus pour voir les patients.
            </div>

            <!-- État vide : planning sélectionné mais aucun patient -->
            <div t-if="props.scheduleId and props.procedures.length === 0"
                 class="alert alert-info">
                Aucun patient programmé pour ce planning aujourd'hui.
            </div>

            <!-- Tableau patients -->
            <div t-if="props.procedures.length > 0" class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead class="table-light">
                        <tr>
                            <th>Poste</th>
                            <th>Patient</th>
                            <th>Heure prévue</th>
                            <th>Statut</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <t t-foreach="props.procedures" t-as="proc" t-key="proc.id">
                            <tr>
                                <td><t t-esc="posteFor(proc)"/></td>
                                <td class="fw-semibold"><t t-esc="proc.patient_id[1]"/></td>
                                <td><t t-esc="formatTime(proc.date)"/></td>
                                <td>
                                    <span t-att-class="stateBadgeClass(proc.state)">
                                        <t t-esc="stateLabel(proc.state)"/>
                                    </span>
                                </td>
                                <td class="d-flex gap-1 flex-wrap">
                                    <button t-if="proc.state === 'scheduled'"
                                            class="btn btn-sm btn-success"
                                            t-on-click="() => props.onSelectProcedure(proc.id)">
                                        Démarrer
                                    </button>
                                    <button t-if="proc.state === 'running'"
                                            class="btn btn-sm btn-primary"
                                            t-on-click="() => props.onSelectProcedure(proc.id)">
                                        Reprendre
                                    </button>
                                    <button t-if="proc.state === 'done'"
                                            class="btn btn-sm btn-outline-secondary"
                                            t-on-click="() => props.onSelectProcedure(proc.id)">
                                        Voir
                                    </button>
                                    <button t-if="proc.state !== 'cancel' and proc.state !== 'done'"
                                            class="btn btn-sm btn-outline-danger"
                                            t-on-click="() => props.onMarkAbsent(proc.id)">
                                        Absent
                                    </button>
                                </td>
                            </tr>
                        </t>
                    </tbody>
                </table>
            </div>
        </div>
    </t>
</templates>
```

- [ ] **Step 3 : Vérification manuelle**

Mettre à jour le module dans Odoo. Naviguer vers Interface Infirmier.
Expected : tableau affiché avec les patients du jour, sélecteur planning actif, badge compteur.

- [ ] **Step 4 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NursePatientList.js \
        acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NursePatientList.xml
git commit -m "feat(dashboard): implement NursePatientList screen (Écran 1)"
```

---

## Task 4 : NurseSessionForm — Écran 2

**Files :**
- Modify: `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseSessionForm.js`
- Modify: `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseSessionForm.xml`
- Create: `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseComplicationPopup.js` (stub — nécessaire pour l'import)
- Create: `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseComplicationPopup.xml` (stub)

- [ ] **Step 1 : Créer le stub `NurseComplicationPopup.js`**

(Sera remplacé en Task 5. Créé ici pour que l'import dans NurseSessionForm compile.)

```js
/** @odoo-module **/
import { Component } from "@odoo/owl";
export class NurseComplicationPopup extends Component {
    static template = "acs_hms_nephrology_dashboard.NurseComplicationPopup";
    static props = { onSave: Function, onCancel: Function };
}
```

`NurseComplicationPopup.xml` (stub) :
```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates>
    <t t-name="acs_hms_nephrology_dashboard.NurseComplicationPopup">
        <div>Complication popup (stub)</div>
    </t>
</templates>
```

- [ ] **Step 2 : Remplacer le stub `NurseSessionForm.js`**

```js
/** @odoo-module **/
import { Component, useState } from "@odoo/owl";
import { NurseComplicationPopup } from "./NurseComplicationPopup";

export class NurseSessionForm extends Component {
    static template = "acs_hms_nephrology_dashboard.NurseSessionForm";
    static components = { NurseComplicationPopup };
    static props = {
        procedure: Object,
        vitals: Array,
        timer: Object,
        onTimerReset: Function,
        onSaveVitals: Function,
        onSaveComplication: Function,
        onGoToEnd: Function,
        onBackToList: Function,
    };

    setup() {
        this.vitalsForm = useState({
            blood_pressure: '',
            heart_rate: '',
            respiratory_rate: '',
            spo2: '',
            temperature: '',
            glycemia: '',
        });
        this.popup = useState({ open: false });
        this.saving = useState({ vitals: false });
    }

    get timerDisplay() {
        const s = this.props.timer.secondsLeft;
        return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }

    get patientName() {
        const p = this.props.procedure.patient_id;
        return Array.isArray(p) ? p[1] : '—';
    }

    async saveVitals() {
        if (!this.vitalsForm.blood_pressure) return;
        this.saving.vitals = true;
        const vals = {
            blood_pressure: this.vitalsForm.blood_pressure,
            heart_rate: parseInt(this.vitalsForm.heart_rate) || 0,
            respiratory_rate: parseInt(this.vitalsForm.respiratory_rate) || 0,
            spo2: parseFloat(this.vitalsForm.spo2) || 0.0,
            temperature: parseFloat(this.vitalsForm.temperature) || 0.0,
            glycemia: parseFloat(this.vitalsForm.glycemia) || 0.0,
        };
        await this.props.onSaveVitals(vals);
        Object.assign(this.vitalsForm, { blood_pressure: '', heart_rate: '', respiratory_rate: '', spo2: '', temperature: '', glycemia: '' });
        this.saving.vitals = false;
    }

    async onComplicationSave(vals) {
        await this.props.onSaveComplication(vals);
        this.popup.open = false;
    }

    formatDatetime(dt) {
        if (!dt) return '—';
        return dt.slice(11, 16); // HH:MM
    }
}
```

- [ ] **Step 3 : Remplacer le stub `NurseSessionForm.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates>
    <t t-name="acs_hms_nephrology_dashboard.NurseSessionForm">
        <div class="o_nurse_session_form">

            <!-- Header sticky -->
            <div class="bg-white border-bottom px-3 py-2 d-flex justify-content-between align-items-center sticky-top">
                <div>
                    <span class="fw-bold fs-5"><t t-esc="patientName"/></span>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <!-- Timer -->
                    <span t-att-class="props.timer.isRinging ? 'badge bg-warning text-dark fs-6 blink' : 'badge bg-secondary fs-6'">
                        ⏱ <t t-esc="timerDisplay"/>
                    </span>
                    <button class="btn btn-sm btn-outline-secondary" t-on-click="props.onBackToList">
                        ← Retour liste
                    </button>
                </div>
            </div>

            <div class="p-3">

                <!-- Bannière RAPPEL VITAUX -->
                <div t-if="props.timer.isRinging"
                     class="alert alert-warning d-flex justify-content-between align-items-center mb-3">
                    <span><strong>⏰ Rappel :</strong> Saisir les signes vitaux maintenant.</span>
                    <button class="btn btn-sm btn-warning" t-on-click="props.onTimerReset">✓ Compris</button>
                </div>

                <!-- Bannière HYPOTENSION -->
                <div t-if="props.procedure.has_active_hypotension"
                     class="alert alert-danger d-flex align-items-center gap-2 mb-3" role="alert">
                    <i class="fa fa-exclamation-triangle fa-lg"/>
                    <strong>HYPOTENSION DÉTECTÉE</strong> — TA systolique &lt; 90 mmHg
                </div>

                <!-- Bloc pré-dialyse (lecture seule) -->
                <div class="card mb-3">
                    <div class="card-header fw-semibold">Données à l'arrivée</div>
                    <div class="card-body">
                        <div class="row row-cols-2 row-cols-md-4 g-2">
                            <div class="col"><small class="text-muted">TA pré</small><div class="fw-bold"><t t-esc="props.procedure.pre_dialysis_bp or '—'"/></div></div>
                            <div class="col"><small class="text-muted">Statut arrivée</small><div class="fw-bold"><t t-esc="props.procedure.arrival_status or '—'"/></div></div>
                            <div class="col"><small class="text-muted">Poids arrivée</small><div class="fw-bold"><t t-esc="props.procedure.arrival_weight"/> kg</div></div>
                            <div class="col"><small class="text-muted">Prise interdialytique</small><div class="fw-bold"><t t-esc="props.procedure.interdialysis_increase"/> kg</div></div>
                        </div>
                    </div>
                </div>

                <!-- Saisie signes vitaux -->
                <div class="card mb-3">
                    <div class="card-header fw-semibold">Saisir les signes vitaux</div>
                    <div class="card-body">
                        <div class="row g-2 mb-3">
                            <div class="col-6 col-md-4">
                                <label class="form-label small">TA (ex: 120/80)</label>
                                <input type="text" class="form-control" placeholder="120/80"
                                       t-model="vitalsForm.blood_pressure"/>
                            </div>
                            <div class="col-6 col-md-4">
                                <label class="form-label small">FC (bpm)</label>
                                <input type="number" class="form-control" placeholder="72"
                                       t-model="vitalsForm.heart_rate"/>
                            </div>
                            <div class="col-6 col-md-4">
                                <label class="form-label small">FR (/min)</label>
                                <input type="number" class="form-control" placeholder="16"
                                       t-model="vitalsForm.respiratory_rate"/>
                            </div>
                            <div class="col-6 col-md-4">
                                <label class="form-label small">SpO2 (%)</label>
                                <input type="number" step="0.1" class="form-control" placeholder="98"
                                       t-model="vitalsForm.spo2"/>
                            </div>
                            <div class="col-6 col-md-4">
                                <label class="form-label small">Temp (°C)</label>
                                <input type="number" step="0.1" class="form-control" placeholder="37.0"
                                       t-model="vitalsForm.temperature"/>
                            </div>
                            <div class="col-6 col-md-4">
                                <label class="form-label small">Glycémie (g/L)</label>
                                <input type="number" step="0.01" class="form-control" placeholder="—"
                                       t-model="vitalsForm.glycemia"/>
                            </div>
                        </div>
                        <button class="btn btn-primary" t-on-click="saveVitals"
                                t-att-disabled="saving.vitals or !vitalsForm.blood_pressure">
                            <t t-if="saving.vitals">Enregistrement...</t>
                            <t t-else="">Enregistrer les signes vitaux</t>
                        </button>
                    </div>
                </div>

                <!-- Historique signes vitaux -->
                <div t-if="props.vitals.length > 0" class="card mb-3">
                    <div class="card-header fw-semibold">Historique mesures</div>
                    <div class="table-responsive">
                        <table class="table table-sm mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th>Heure</th><th>TA</th><th>FC</th>
                                    <th>SpO2</th><th>Temp</th><th>Glycémie</th><th>Alerte</th>
                                </tr>
                            </thead>
                            <tbody>
                                <t t-foreach="props.vitals" t-as="v" t-key="v.id">
                                    <tr t-att-class="v.is_hypotension ? 'table-danger' : ''">
                                        <td><t t-esc="formatDatetime(v.measurement_time)"/></td>
                                        <td><t t-esc="v.blood_pressure or '—'"/></td>
                                        <td><t t-esc="v.heart_rate or '—'"/></td>
                                        <td><t t-esc="v.spo2 or '—'"/></td>
                                        <td><t t-esc="v.temperature or '—'"/></td>
                                        <td><t t-esc="v.glycemia or '—'"/></td>
                                        <td>
                                            <span t-if="v.is_hypotension" class="badge bg-danger">HYPOTENSION</span>
                                        </td>
                                    </tr>
                                </t>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Footer actions -->
                <div class="d-flex gap-2 flex-wrap">
                    <button class="btn btn-warning" t-on-click="() => popup.open = true">
                        Signaler une complication
                    </button>
                    <button class="btn btn-success" t-on-click="props.onGoToEnd">
                        Terminer la séance →
                    </button>
                </div>

            </div><!-- /p-3 -->

            <!-- Popup complication (overlay) -->
            <NurseComplicationPopup
                t-if="popup.open"
                onSave.bind="onComplicationSave"
                onCancel="() => popup.open = false"
            />

        </div>
    </t>
</templates>
```

- [ ] **Step 4 : Vérification manuelle**

Démarrer une séance depuis l'Écran 1. Vérifier :
- Header avec patient + timer décompte
- Formulaire signes vitaux saisie + save
- Bannière HYPOTENSION si TA < 90 après save
- Historique mesures affiché en tableau
- Bouton "Signaler une complication" ouvre le stub popup

- [ ] **Step 5 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseSessionForm.js \
        acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseSessionForm.xml \
        acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseComplicationPopup.js \
        acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseComplicationPopup.xml
git commit -m "feat(dashboard): implement NurseSessionForm screen (Écran 2) + complication popup stubs"
```

---

## Task 5 : NurseComplicationPopup — Écran 3

**Files :**
- Modify: `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseComplicationPopup.js`
- Modify: `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseComplicationPopup.xml`

- [ ] **Step 1 : Remplacer le stub `NurseComplicationPopup.js`**

```js
/** @odoo-module **/
import { Component, useState } from "@odoo/owl";

const COMPLICATION_TYPES = [
    { value: 'hypotension',  label: 'Hypotension' },
    { value: 'cramps',       label: 'Crampes' },
    { value: 'nausea',       label: 'Nausées / Vomissements' },
    { value: 'chest_pain',   label: 'Douleur thoracique' },
    { value: 'fever',        label: 'Fièvre' },
    { value: 'pruritus',     label: 'Prurit' },
    { value: 'early_stop',   label: 'Arrêt prématuré' },
    { value: 'other',        label: 'Autre' },
];

export class NurseComplicationPopup extends Component {
    static template = "acs_hms_nephrology_dashboard.NurseComplicationPopup";
    static props = {
        onSave: Function,
        onCancel: Function,
    };

    setup() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const defaultTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
                            `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
        this.form = useState({
            complication_type: '',
            occurrence_time: defaultTime,
            bp_at_occurrence: '',
            action_taken: '',
            resolution: '',
            early_stop_duration: 0,
        });
        this.types = COMPLICATION_TYPES;
        this.saving = useState({ pending: false });
    }

    get isValid() {
        return this.form.complication_type && this.form.action_taken && this.form.resolution;
    }

    get showEarlyStop() {
        return this.form.complication_type === 'early_stop';
    }

    selectType(value) {
        this.form.complication_type = value;
    }

    async onSave() {
        if (!this.isValid) return;
        this.saving.pending = true;
        const vals = {
            complication_type: this.form.complication_type,
            occurrence_time: this.form.occurrence_time,
            bp_at_occurrence: this.form.bp_at_occurrence || false,
            action_taken: this.form.action_taken,
            resolution: this.form.resolution,
        };
        if (this.showEarlyStop && this.form.early_stop_duration) {
            vals.early_stop_duration = parseInt(this.form.early_stop_duration) || 0;
        }
        await this.props.onSave(vals);
        this.saving.pending = false;
    }
}
```

- [ ] **Step 2 : Remplacer le stub `NurseComplicationPopup.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates>
    <t t-name="acs_hms_nephrology_dashboard.NurseComplicationPopup">
        <!-- Backdrop -->
        <div class="o_complication_backdrop position-fixed top-0 start-0 w-100 h-100"
             style="background: rgba(0,0,0,0.5); z-index: 1050;"
             t-on-click="props.onCancel"/>

        <!-- Modal -->
        <div class="o_complication_modal position-fixed bg-white rounded shadow-lg p-4"
             style="top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1060; width: min(560px, 95vw); max-height: 90vh; overflow-y: auto;">

            <h5 class="mb-3 fw-bold">Signaler une complication</h5>

            <!-- Type complication — boutons tactiles -->
            <div class="mb-3">
                <label class="form-label fw-semibold">Type de complication <span class="text-danger">*</span></label>
                <div class="d-flex flex-wrap gap-2">
                    <t t-foreach="types" t-as="ct" t-key="ct.value">
                        <button
                            t-att-class="form.complication_type === ct.value
                                ? 'btn btn-danger'
                                : 'btn btn-outline-secondary'"
                            t-on-click="() => selectType(ct.value)">
                            <t t-esc="ct.label"/>
                        </button>
                    </t>
                </div>
            </div>

            <!-- Durée arrêt prématuré (conditionnel) -->
            <div t-if="showEarlyStop" class="mb-3">
                <label class="form-label fw-semibold">Durée d'arrêt (minutes)</label>
                <input type="number" class="form-control" t-model="form.early_stop_duration"/>
            </div>

            <!-- Heure de survenue -->
            <div class="mb-3">
                <label class="form-label fw-semibold">Heure de survenue</label>
                <input type="datetime-local" class="form-control"
                       t-model="form.occurrence_time"/>
            </div>

            <!-- TA au moment -->
            <div class="mb-3">
                <label class="form-label fw-semibold">TA au moment (ex: 85/50)</label>
                <input type="text" class="form-control" placeholder="—" t-model="form.bp_at_occurrence"/>
            </div>

            <!-- Action prise -->
            <div class="mb-3">
                <label class="form-label fw-semibold">Action prise <span class="text-danger">*</span></label>
                <textarea class="form-control" rows="2"
                          placeholder="Décrivez l'action prise..."
                          t-model="form.action_taken"/>
            </div>

            <!-- Résolution -->
            <div class="mb-3">
                <label class="form-label fw-semibold">Résolution <span class="text-danger">*</span></label>
                <div class="d-flex gap-2">
                    <button t-att-class="form.resolution === 'yes' ? 'btn btn-success' : 'btn btn-outline-success'"
                            t-on-click="() => form.resolution = 'yes'">Résolue</button>
                    <button t-att-class="form.resolution === 'partial' ? 'btn btn-warning' : 'btn btn-outline-warning'"
                            t-on-click="() => form.resolution = 'partial'">Partielle</button>
                    <button t-att-class="form.resolution === 'no' ? 'btn btn-danger' : 'btn btn-outline-danger'"
                            t-on-click="() => form.resolution = 'no'">Non résolue</button>
                </div>
            </div>

            <!-- Boutons -->
            <div class="d-flex justify-content-end gap-2 mt-3">
                <button class="btn btn-secondary" t-on-click="props.onCancel">Annuler</button>
                <button class="btn btn-danger"
                        t-att-disabled="!isValid or saving.pending"
                        t-on-click="onSave">
                    <t t-if="saving.pending">Enregistrement...</t>
                    <t t-else="">Enregistrer la complication</t>
                </button>
            </div>

        </div>
    </t>
</templates>
```

- [ ] **Step 3 : Vérification manuelle**

Ouvrir l'Écran 2, cliquer "Signaler une complication". Vérifier :
- Backdrop semi-transparent derrière le modal
- 8 boutons type complication, sélection active en rouge
- Champ durée arrêt visible seulement si "Arrêt prématuré"
- Validation bloquée si type/action/résolution manquants
- Enregistrement crée une ligne dans `acs.dialysis.complication`

- [ ] **Step 4 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseComplicationPopup.js \
        acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseComplicationPopup.xml
git commit -m "feat(dashboard): implement NurseComplicationPopup (Écran 3)"
```

---

## Task 6 : NurseEndSession — Écran 4

**Files :**
- Modify: `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseEndSession.js`
- Modify: `acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseEndSession.xml`

- [ ] **Step 1 : Remplacer le stub `NurseEndSession.js`**

```js
/** @odoo-module **/
import { Component, useState } from "@odoo/owl";

export class NurseEndSession extends Component {
    static template = "acs_hms_nephrology_dashboard.NurseEndSession";
    static props = {
        procedure: Object,
        vitals: Array,
        onValidateSession: Function,
        onBackToSession: Function,
    };

    setup() {
        this.form = useState({
            departure_weight: this.props.procedure.departure_weight || '',
            actual_duration: this.props.procedure.actual_duration || '',
            global_tolerance: this.props.procedure.global_tolerance || '',
            end_notes: this.props.procedure.end_notes || '',
        });
        this.validated = useState({ done: false });
        this.saving = useState({ pending: false });
    }

    get patientName() {
        const p = this.props.procedure.patient_id;
        return Array.isArray(p) ? p[1] : '—';
    }

    get actualUfPreview() {
        const dw = parseFloat(this.form.departure_weight);
        const aw = this.props.procedure.arrival_weight || 0;
        if (dw && aw && aw > dw) {
            return Math.round((aw - dw) * 1000);
        }
        return null;
    }

    get ktvBadgeClass() {
        const status = this.props.procedure.ktv_status;
        if (status === 'adequate') return 'badge bg-success fs-6';
        if (status === 'insufficient') return 'badge bg-danger fs-6';
        return 'badge bg-secondary fs-6';
    }

    get ktvLabel() {
        const status = this.props.procedure.ktv_status;
        if (status === 'adequate') return 'Adéquat ≥ 1.2';
        if (status === 'insufficient') return 'Insuffisant < 1.2';
        return '—';
    }

    async onValidate() {
        if (!this.form.departure_weight || !this.form.global_tolerance) return;
        this.saving.pending = true;
        const vals = {
            departure_weight: parseFloat(this.form.departure_weight),
            global_tolerance: this.form.global_tolerance,
            end_notes: this.form.end_notes || false,
            state: 'done',
        };
        if (this.form.actual_duration) {
            vals.actual_duration = parseFloat(this.form.actual_duration);
        }
        await this.props.onValidateSession(vals);
        this.validated.done = true;
        this.saving.pending = false;
    }
}
```

- [ ] **Step 2 : Remplacer le stub `NurseEndSession.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates>
    <t t-name="acs_hms_nephrology_dashboard.NurseEndSession">
        <div class="o_nurse_end_session p-3">

            <!-- Header -->
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h4 class="mb-0">Fin de séance — <t t-esc="patientName"/></h4>
                <button class="btn btn-sm btn-outline-secondary" t-on-click="props.onBackToSession">
                    ← Retour séance
                </button>
            </div>

            <!-- Résumé lecture seule -->
            <div class="card mb-3 bg-light">
                <div class="card-header fw-semibold">Résumé</div>
                <div class="card-body">
                    <div class="row row-cols-2 row-cols-md-4 g-2">
                        <div class="col">
                            <small class="text-muted">Durée calculée</small>
                            <div class="fw-bold"><t t-esc="props.procedure.actual_duration or '—'"/> h</div>
                        </div>
                        <div class="col">
                            <small class="text-muted">UF habituelle</small>
                            <div class="fw-bold"><t t-esc="props.procedure.uf_habituelle or '—'"/> ml</div>
                        </div>
                        <div class="col">
                            <small class="text-muted">Nb complications</small>
                            <div class="fw-bold"><t t-esc="props.procedure.complication_count or 0"/></div>
                        </div>
                        <div class="col">
                            <small class="text-muted">Signes vitaux</small>
                            <div class="fw-bold"><t t-esc="props.vitals.length"/> mesures</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Saisie fin de séance -->
            <div class="card mb-3">
                <div class="card-header fw-semibold">Données de sortie</div>
                <div class="card-body">

                    <!-- Poids sortie + UF réelle preview -->
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <label class="form-label fw-semibold">Poids sortie (kg) <span class="text-danger">*</span></label>
                            <input type="number" step="0.1" class="form-control form-control-lg"
                                   placeholder="ex: 70.5" t-model="form.departure_weight"/>
                            <div t-if="actualUfPreview !== null" class="form-text text-success fw-semibold">
                                UF réelle calculée : <t t-esc="actualUfPreview"/> ml
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-semibold">Durée effective (h) <span class="text-muted fw-normal">(optionnel — override)</span></label>
                            <input type="number" step="0.25" class="form-control form-control-lg"
                                   placeholder="ex: 4.0" t-model="form.actual_duration"/>
                        </div>
                    </div>

                    <!-- Tolérance globale -->
                    <div class="mb-3">
                        <label class="form-label fw-semibold">Tolérance globale <span class="text-danger">*</span></label>
                        <div class="d-flex gap-2">
                            <button t-att-class="form.global_tolerance === 'good' ? 'btn btn-success btn-lg' : 'btn btn-outline-success btn-lg'"
                                    t-on-click="() => form.global_tolerance = 'good'">Bonne</button>
                            <button t-att-class="form.global_tolerance === 'average' ? 'btn btn-warning btn-lg' : 'btn btn-outline-warning btn-lg'"
                                    t-on-click="() => form.global_tolerance = 'average'">Moyenne</button>
                            <button t-att-class="form.global_tolerance === 'poor' ? 'btn btn-danger btn-lg' : 'btn btn-outline-danger btn-lg'"
                                    t-on-click="() => form.global_tolerance = 'poor'">Mauvaise</button>
                        </div>
                    </div>

                    <!-- Notes de fin -->
                    <div class="mb-3">
                        <label class="form-label fw-semibold">Notes de fin de séance</label>
                        <textarea class="form-control" rows="3"
                                  placeholder="Observations, incidents, remarques..."
                                  t-model="form.end_notes"/>
                    </div>

                </div>
            </div>

            <!-- KT/V affiché après validation -->
            <div t-if="validated.done" class="card mb-3 border-success">
                <div class="card-header bg-success text-white fw-semibold">✓ Séance validée</div>
                <div class="card-body">
                    <div class="row row-cols-2 row-cols-md-3 g-3 text-center">
                        <div class="col">
                            <div class="fs-4 fw-bold"><t t-esc="props.procedure.ktv_calculated or '—'"/></div>
                            <small class="text-muted">KT/V</small><br/>
                            <span t-att-class="ktvBadgeClass"><t t-esc="ktvLabel"/></span>
                        </div>
                        <div class="col">
                            <div class="fs-4 fw-bold"><t t-esc="props.procedure.urr_calculated or '—'"/>%</div>
                            <small class="text-muted">URR</small>
                        </div>
                        <div class="col">
                            <div class="fs-4 fw-bold"><t t-esc="props.procedure.actual_uf or '—'"/> ml</div>
                            <small class="text-muted">UF réelle</small>
                        </div>
                    </div>
                    <p class="text-muted mt-2 mb-0 text-center small">Retour automatique à la liste dans 2 secondes…</p>
                </div>
            </div>

            <!-- Bouton VALIDER -->
            <div t-if="!validated.done">
                <button
                    class="btn btn-success btn-lg w-100 py-3"
                    t-att-disabled="!form.departure_weight or !form.global_tolerance or saving.pending"
                    t-on-click="onValidate">
                    <t t-if="saving.pending">Validation en cours...</t>
                    <t t-else="">✓ VALIDER LA SÉANCE</t>
                </button>
            </div>

        </div>
    </t>
</templates>
```

- [ ] **Step 3 : Vérification manuelle**

Depuis l'Écran 2, cliquer "Terminer la séance". Vérifier :
- Résumé (durée calculée, UF habituelle, nb complications)
- Preview UF réelle se met à jour en temps réel quand on saisit le poids sortie
- 3 boutons tolérance mutually exclusive
- Bouton VALIDER désactivé si poids sortie ou tolérance manquants
- Après validation : badge KT/V vert/rouge affiché + retour liste après 2s

- [ ] **Step 4 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseEndSession.js \
        acs_hms_nephrology_dashboard/static/src/components/nurse_dashboard/NurseEndSession.xml
git commit -m "feat(dashboard): implement NurseEndSession screen (Écran 4) with KT/V display"
```

---

## Task 7 : Tests Python d'intégration + self-review finale

**Files :**
- Modify: `acs_hms_nephrology_dashboard/tests/test_nurse_dashboard.py`

- [ ] **Step 1 : Ajouter les tests de filtre données**

Ajouter dans `test_nurse_dashboard.py`, après `TestNurseDashboardACL` :

```python
class TestNurseDashboardFilter(TransactionCase):
    """Vérifie que le domaine de filtre "patients du jour" fonctionne."""

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Filtre'})
        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1) or self.env['product.product'].create({
            'name': 'Hémodialyse', 'type': 'service',
            'hospital_product_type': 'nephrology_procedure',
        })
        nephro_dept = self.env['hr.department'].search([
            ('department_type', '=', 'nephrology')
        ], limit=1) or self.env['hr.department'].create({
            'name': 'Néphrologie Test',
            'department_type': 'nephrology',
        })
        from datetime import datetime, date
        today_start = datetime.combine(date.today(), datetime.min.time().replace(hour=0))
        self.procedure_today = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
            'department_id': nephro_dept.id,
            'date': today_start,
        })
        self.procedure_old = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
            'department_id': nephro_dept.id,
            'date': '2020-01-01 08:00:00',
        })

    def test_today_filter_includes_today_procedure(self):
        """La procédure d'aujourd'hui est dans le domaine du filtre"""
        from datetime import date
        today = date.today()
        today_start = f"{today} 00:00:00"
        today_end = f"{today} 23:59:59"
        results = self.env['acs.patient.procedure'].search([
            ('department_id.department_type', '=', 'nephrology'),
            ('date', '>=', today_start),
            ('date', '<=', today_end),
        ])
        self.assertIn(self.procedure_today, results)

    def test_today_filter_excludes_old_procedure(self):
        """Une ancienne procédure n'est pas dans le filtre du jour"""
        from datetime import date
        today = date.today()
        today_start = f"{today} 00:00:00"
        today_end = f"{today} 23:59:59"
        results = self.env['acs.patient.procedure'].search([
            ('department_id.department_type', '=', 'nephrology'),
            ('date', '>=', today_start),
            ('date', '<=', today_end),
        ])
        self.assertNotIn(self.procedure_old, results)

    def test_schedule_filter(self):
        """Le filtre par schedule fonctionne"""
        station = self.env['acs.dialysis.station'].create({
            'name': 'Poste Test', 'room': 'Salle Test', 'station_type': 'standard',
        })
        schedule = self.env['acs.nephrology.schedule'].create({
            'name': 'Planning Test', 'monday': True, 'start_time': 7.0, 'end_time': 11.0,
            'station_id': station.id,
        })
        self.procedure_today.write({'nephrology_schedule_ids': [(4, schedule.id)]})

        from datetime import date
        today = date.today()
        results = self.env['acs.patient.procedure'].search([
            ('department_id.department_type', '=', 'nephrology'),
            ('date', '>=', f"{today} 00:00:00"),
            ('date', '<=', f"{today} 23:59:59"),
            ('nephrology_schedule_ids', 'in', [schedule.id]),
        ])
        self.assertIn(self.procedure_today, results)
```

- [ ] **Step 2 : Lancer tous les tests du module**

```bash
cd /path/to/odoo && python odoo-bin \
  -i acs_hms_nephrology_dashboard \
  --test-enable \
  --test-tags acs_hms_nephrology_dashboard \
  -d test_db --stop-after-init 2>&1 | grep -E "FAIL|ERROR|OK|Ran"
```

Expected : `Ran 6 tests ... OK`

- [ ] **Step 3 : Commit final**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/tests/test_nurse_dashboard.py
git commit -m "test(dashboard): add ACL and filter integration tests for nurse dashboard"
```

---

## Self-Review

**Couverture spec :**
- ✅ Module `acs_hms_nephrology_dashboard` créé avec dépendances correctes — Task 1
- ✅ ACL write infirmier sur `acs.patient.procedure` — Task 1
- ✅ Machine à états OWL (`list|session|end`) — Task 2
- ✅ Timer 30 min visuel + bannière orange clignotante + reset manuel — Task 2, 4
- ✅ `_reloadProcedure()` après chaque write — Task 2
- ✅ Filtre planning + sélecteur manuel + état vide "Aucun poste assigné" — Task 3
- ✅ Tableau patients du jour avec statuts et actions contextuelles — Task 3
- ✅ Bannière HYPOTENSION persistante rechargée après save vitaux — Task 4
- ✅ Formulaire signes vitaux + historique lectures — Task 4
- ✅ Popup complication overlay avec 8 types tactiles + validation — Task 5
- ✅ Poids sortie + UF réelle preview temps réel — Task 6
- ✅ Tolérance globale 3 boutons — Task 6
- ✅ KT/V + URR + badge adéquation après validation — Task 6
- ✅ Retour liste automatique 2s + reset timer — Task 2, 6
- ✅ Menu item groupe nurse/manager — Task 1
- ✅ Tests Python ACL (3 tests) + filtre (3 tests) — Tasks 1, 7

**Cohérence des noms :**
- `onSaveVitals` : défini Task 2 (`NurseDashboard`), consommé Task 4 (`NurseSessionForm`) ✅
- `onSaveComplication` : défini Task 2, consommé Task 4 ✅
- `onValidateSession` : défini Task 2, consommé Task 6 ✅
- `timer.secondsLeft` / `timer.isRinging` : défini Task 2, lu Tasks 4 et 6 ✅
- `PROCEDURE_FIELDS` inclut `vital_sign_ids` et `complication_count` ✅
- `state: 'done'` écrit dans `onValidateSession` correspond aux valeurs Odoo (`scheduled|running|done|cancel`) ✅

**Absent hors scope confirmé :** son/vibration, persistance timer après refresh, deep-linking, alerts Bus Odoo ✅
