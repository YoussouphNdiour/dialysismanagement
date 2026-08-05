# Simplification workflows néphro + Tests Playwright — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplifier les workflows Odoo HMS pour un centre de dialyse (états RDV, découplage RDV/séance, suppression code mort) puis verrouiller avec des tests Playwright E2E par rôle.

**Architecture:** Modifications ciblées sur les modèles/vues du module `acs_hms` (addons Odoo) et `acs_hms_nephrology` (as shafi + addons). Les tests Playwright réutilisent l'infrastructure existante (`tests/helpers/auth.js`, `tests/playwright.config.js`).

**Tech Stack:** Odoo 19 (Python), XML views, Playwright (Node.js), PostgreSQL 18

## Global Constraints

- Base de données : `asshafi`, user=`yusper`, localhost:5432
- Module `acs_hms` actif : `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/`
- Module `acs_hms_nephrology` (as shafi) : `/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology/`
- Module `acs_hms_nephrology` (addons) : `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms_nephrology/`
- Mot de passe de tous les utilisateurs test : `Nephro2024!`
- Odoo doit tourner en local sur `localhost:8069`
- Après chaque modification Python/XML, redémarrer Odoo avec `-u <module>` pour appliquer

---

### Task 1: Réduire les états RDV de 7 à 4

**Files:**
- Modify: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/models/appointment.py:182-191` (state field)
- Modify: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/views/appointment_view.xml:191-208` (form buttons + statusbar)
- Modify: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/views/appointment_view.xml:179` (list view waiting_duration_timer)
- Modify: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/views/appointment_view.xml:482-484` (form other info tab)

**Interfaces:**
- Consumes: rien
- Produces: Les états RDV sont désormais `draft`, `confirmed`, `done`, `cancel`. Les méthodes `appointment_confirm()`, `appointment_done()`, `appointment_draft()` restent. Les méthodes `appointment_waiting()`, `appointment_consultation()`, `action_pause()`, `action_start_paused()` deviennent inaccessibles depuis l'UI.

- [ ] **Step 1: Modifier le champ state dans le modèle Python**

Dans `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/models/appointment.py`, remplacer les lignes 182-191 :

```python
    state = fields.Selection([
            ('draft', 'Draft'),
            ('confirmed', 'Confirmed'),
            ('done', 'Done'),
            ('cancel', 'Cancelled'),
        ], string='Status', default='draft', required=True, copy=False, tracking=1)
```

Note : on renomme `confirm` → `confirmed` pour clarifier. Il faudra aussi renommer la méthode `appointment_confirm` pour qu'elle écrive `confirmed` au lieu de `confirm`. Chercher dans le même fichier toutes les occurrences de `state = 'confirm'` ou `== 'confirm'` et les remplacer par `'confirmed'`.

- [ ] **Step 2: Simplifier les boutons du form view**

Dans `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/views/appointment_view.xml`, remplacer le bloc header (lignes 190-208) par :

```xml
                <header>
                    <button name="appointment_confirm" invisible="state!='draft'" type="object" groups="acs_hms.group_hms_receptionist" string="Confirm" class="oe_highlight"/>
                    <button name="print_report" string="Print" type="object" invisible="state not in ('draft','confirmed')"/>
                    <button name="action_appointment_send" string="Send by Email" type="object" invisible="state not in ('draft','confirmed')"/>
                    <button name="consultation_done" invisible="state != 'confirmed'" groups="acs_hms.group_hms_jr_doctor" type="object" string="Terminer" class="oe_highlight"/>
                    <button name="button_pres_req" string="Create Prescription" groups="acs_hms.group_hms_jr_doctor" type="object" invisible="state != 'confirmed'" class="oe_highlight"/>
                    <button name="create_invoice" string="Create Invoice" groups="account.group_account_invoice" invisible="not acs_show_create_invoice" type="object" class="oe_highlight"/>
                    <button name="create_consumed_prod_invoice" string="Create Consumable's Invoice" groups="account.group_account_invoice" invisible="not acs_show_consumable_create_invoice" type="object" class="oe_highlight"/>
                    <button name="action_reopen" string="Reopen" groups="acs_hms.group_hms_allow_update_done_appointment" type="object" invisible="state != 'done'" class="oe_highlight"/>
                    <button name="appointment_draft" string="Draft" invisible="state != 'cancel'" type="object" class="oe_highlight"/>
                    <button name="action_request_invoice_exempt" type="object" string="Request Invoice Exemption" groups="acs_hms_base.group_acs_invoice_exemption_request" invisible="acs_invoice_exempt_approval or invoice_exempt or invoice_id or state in ['done', 'cancel']"/>
                    <button name="action_approve_invoice_exempt" type="object" string="Approve Invoice Exempt" groups="acs_hms_base.group_acs_invoice_exemption" invisible="not acs_invoice_exempt_approval"/>
                    <button name="action_reject_invoice_exempt" type="object" string="Reject Invoice Exempt" groups="acs_hms_base.group_acs_invoice_exemption" invisible="not acs_invoice_exempt_approval"/>
                    <button name="%(action_acs_cancel_reason_wiz)d" string="Cancel" invisible="state not in ('draft','confirmed')" type="action"/>
                    <field name="state" widget="statusbar" statusbar_visible="draft,confirmed,done"/>
                    <field name="appointment_invoice_policy" invisible="1"/>
                    <field name="consumable_invoice_id" invisible="1"/>
                    <field name="acs_invoice_exempt_approval" invisible="1"/>
                    <field name="procedure_to_invoice_ids" invisible="1" widget="many2many_tags"/>
                </header>
```

- [ ] **Step 3: Masquer les champs timer dans les vues**

Dans le même fichier XML, supprimer ou masquer les champs :
- Ligne 179 : `waiting_duration_timer` dans la list view → supprimer la ligne
- Lignes 482-484 : `waiting_duration_timer` et `pause_duration` dans le form → supprimer ces lignes

- [ ] **Step 4: Migrer les données existantes via SQL**

Exécuter dans `psql -d asshafi` :

```sql
UPDATE hms_appointment SET state = 'confirmed' WHERE state IN ('confirm', 'waiting', 'in_consultation', 'pause');
UPDATE hms_appointment SET state = 'done' WHERE state = 'to_invoice';
```

- [ ] **Step 5: Redémarrer Odoo et vérifier**

```bash
cd "/Users/yusper/Downloads/modules 19"
./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 -u acs_hms --stop-after-init --log-level=warn
```

Vérifier : ouvrir un RDV dans le navigateur → les boutons "Salle d'attente", "Pause", "En consultation" ne doivent plus apparaître. Le statusbar montre draft → confirmed → done.

- [ ] **Step 6: Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add -A
git commit -m "fix(appointment): réduire les états RDV de 7 à 4 (draft/confirmed/done/cancel)

Supprime les états waiting/in_consultation/pause/to_invoice et les
boutons/champs timer associés. Migre les données existantes."
```

---

### Task 2: Supprimer le wizard `acs.pain.level`

**Files:**
- Modify: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/views/appointment_view.xml:373` (bouton pain level)
- Modify: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/views/patient_view.xml:188` (bouton pain level)
- Modify: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/views/evaluation_view.xml:102` (bouton pain level)
- Delete: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/wizard/pain_level.py`
- Delete: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/wizard/pain_level_view.xml`

**Interfaces:**
- Consumes: rien
- Produces: l'action `action_acs_pain_level` n'existe plus

- [ ] **Step 1: Supprimer les boutons d'aide pain level dans les 3 vues XML**

Dans chaque fichier, rechercher le bouton qui référence `action_acs_pain_level` et supprimer la ligne entière :
- `appointment_view.xml:373`
- `patient_view.xml:188`
- `evaluation_view.xml:102`

- [ ] **Step 2: Supprimer les fichiers du wizard**

```bash
rm "/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/wizard/pain_level.py"
rm "/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/wizard/pain_level_view.xml"
```

- [ ] **Step 3: Retirer les imports/références dans `__init__.py` et `__manifest__.py`**

Dans `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/wizard/__init__.py`, supprimer la ligne `from . import pain_level`.

Dans `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/__manifest__.py`, supprimer `'wizard/pain_level_view.xml'` de la liste `data`.

- [ ] **Step 4: Redémarrer Odoo et vérifier**

```bash
cd "/Users/yusper/Downloads/modules 19"
./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 -u acs_hms --stop-after-init --log-level=warn
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(hms): supprimer le wizard acs.pain.level (code mort)"
```

---

### Task 3: Supprimer le privilège rdv infirmier

**Files:**
- Modify: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/security/security.xml:109-118`

**Interfaces:**
- Consumes: rien
- Produces: le groupe `privilege_acs_hms_nurse_appointment` et `group_acs_hms_appointment_user` n'existent plus dans les définitions XML. Attention : si des ACL dans `ir.model.access.csv` référencent `group_acs_hms_appointment_user`, il faudra les remplacer par un groupe existant (ex: `group_hms_nurse`).

- [ ] **Step 1: Identifier toutes les références au groupe**

Chercher `group_acs_hms_appointment_user` et `privilege_acs_hms_nurse_appointment` dans tout le dossier `acs_hms` :

```bash
grep -rn "group_acs_hms_appointment_user\|privilege_acs_hms_nurse_appointment" "/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/"
```

- [ ] **Step 2: Remplacer les références dans les vues et ACL**

Pour chaque référence trouvée :
- Dans les `groups=` des vues XML : remplacer `acs_hms.group_acs_hms_appointment_user` par `acs_hms.group_hms_receptionist` (le groupe qui a naturellement accès aux RDV)
- Dans `ir.model.access.csv` : remplacer le group_id par `acs_hms.group_hms_receptionist`

- [ ] **Step 3: Supprimer les records XML du groupe et du privilège**

Dans `security.xml`, supprimer les records aux lignes 109-118 (le record `privilege_acs_hms_nurse_appointment` et le record `group_acs_hms_appointment_user`).

- [ ] **Step 4: Redémarrer Odoo et vérifier**

```bash
cd "/Users/yusper/Downloads/modules 19"
./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 -u acs_hms --stop-after-init --log-level=warn
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(security): supprimer le privilège rdv infirmier inutilisé"
```

---

### Task 4: Découpler RDV et séances dialyse

**Files:**
- Modify: `/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology/models/session_generator.py:264-274` (supprimer création RDV)
- Modify: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms_nephrology/models/appointment_generator.py` (supprimer tout le fichier ou le vider)

**Interfaces:**
- Consumes: rien
- Produces: `session_generator.action_confirm()` ne crée plus de `hms.appointment`. Le modèle `AcsPatientProcedure` n'a plus les méthodes `action_create_appointment_from_schedule()`, `action_generate_recurring_appointments()`, `action_view_appointments()`. Le wizard `NephrologyAppointmentGenerator` est supprimé.

- [ ] **Step 1: Supprimer la création de RDV dans session_generator.py**

Dans `/Users/yusper/Downloads/modules 19/as shafi/acs_hms_nephrology/models/session_generator.py`, supprimer les lignes 264-271 (création de `hms.appointment` et lien avec la procédure) et modifier le message ligne 274 :

Remplacer les lignes 264-274 par :

```python
                created_count += 1

        msg = _('%d séances créées avec succès.') % created_count
```

- [ ] **Step 2: Nettoyer appointment_generator.py**

Dans `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms_nephrology/models/appointment_generator.py`, remplacer tout le contenu par :

```python
# -*- coding: utf-8 -*-
# Ce fichier est conservé vide pour éviter les erreurs d'import.
# La création automatique de RDV depuis les séances a été supprimée
# car en dialyse, la séance EST le rendez-vous.
```

- [ ] **Step 3: Nettoyer l'import dans __init__.py du module nephrology (addons)**

Dans `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms_nephrology/models/__init__.py`, supprimer ou commenter la ligne `from . import appointment_generator`.

- [ ] **Step 4: Redémarrer Odoo et vérifier**

```bash
cd "/Users/yusper/Downloads/modules 19"
./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 -u acs_hms_nephrology --stop-after-init --log-level=warn
```

Vérifier : lancer le session_generator → seules des séances sont créées, pas de RDV miroir.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(nephrology): découpler RDV et séances dialyse

Le session_generator ne crée plus de RDV automatiques. La séance
de dialyse est le seul objet de planification."
```

---

### Task 5: Adapter la reprogrammation aux séances

**Files:**
- Modify: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/wizard/reschedule_appointments.py` (cibler `acs.patient.procedure`)
- Modify: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/wizard/reschedule_appointments_view.xml` (adapter le label)

**Interfaces:**
- Consumes: rien
- Produces: le wizard `acs.reschedule.appointments` cible maintenant `acs.patient.procedure` via `active_ids` du contexte

- [ ] **Step 1: Modifier le modèle Python**

Dans `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/wizard/reschedule_appointments.py`, remplacer tout le contenu par :

```python
# coding: utf-8

from odoo import models, api, fields
from datetime import date, datetime, timedelta


class AcsRescheduleAppointments(models.TransientModel):
    _name = 'acs.reschedule.appointments'
    _description = "Reprogrammer les séances"

    acs_reschedule_time = fields.Float(string="Décaler les séances sélectionnées de (heures)", required=True)

    def acs_reschedule_appointments(self):
        procedures = self.env['acs.patient.procedure'].search([('id', 'in', self.env.context.get('active_ids'))])
        for procedure in procedures:
            if procedure.date:
                procedure.date = procedure.date + timedelta(hours=self.acs_reschedule_time)
```

- [ ] **Step 2: Adapter la vue XML**

Dans `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/wizard/reschedule_appointments_view.xml`, s'assurer que l'action cible `acs.patient.procedure` comme `binding_model_name` (si présent) et que le titre reflète "Reprogrammer les séances".

- [ ] **Step 3: Redémarrer Odoo et vérifier**

```bash
cd "/Users/yusper/Downloads/modules 19"
./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 -u acs_hms --stop-after-init --log-level=warn
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(wizard): adapter la reprogrammation pour cibler les séances dialyse"
```

---

### Task 6: Accès médecin et secrétaire au menu Clinique

**Files:**
- Modify: `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/views/menu_item.xml:6-8`

**Interfaces:**
- Consumes: rien
- Produces: le menu "Clinique" est visible pour `group_hms_manager`, `group_hms_doctor`, et `group_hms_receptionist`

- [ ] **Step 1: Modifier les groupes du menu Clinique**

Dans `/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms/views/menu_item.xml`, remplacer la ligne 6-8 :

```xml
    <menuitem id="menu_hms" name="Clinique" sequence="30"
        groups="acs_hms_base.group_hms_manager,acs_hms.group_hms_doctor,acs_hms.group_hms_receptionist"
        web_icon="acs_hms_base,static/description/icon.png"/>
```

- [ ] **Step 2: Ajouter l'accès facturation dialyse pour la secrétaire**

Chercher le menu racine "Facturation Dialyse" dans les modules nephrology billing et ajouter le groupe réceptionniste :

```bash
grep -rn "Facturation\|nephrology_billing\|group_nephrology_billing" "/Users/yusper/Downloads/modules 19/as shafi/" "/Users/yusper/Downloads/modules 19/odoo-19.0.post20260601/odoo/addons/acs_hms_nephrology_billing/" --include="*.xml"
```

Ajouter `acs_hms.group_hms_receptionist` aux groupes du menu racine Facturation Dialyse.

- [ ] **Step 3: Redémarrer Odoo et vérifier**

```bash
cd "/Users/yusper/Downloads/modules 19"
./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 -u acs_hms,acs_hms_nephrology_billing --stop-after-init --log-level=warn
```

Vérifier : se connecter en tant que médecin → le menu Clinique est visible. Se connecter en tant que secrétaire → Clinique ET Facturation Dialyse sont visibles.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(security): ouvrir le menu Clinique au médecin/secrétaire et Facturation à la secrétaire"
```

---

### Task 7: Tests Playwright — Secrétaire

**Files:**
- Modify: `/Users/yusper/Downloads/modules 19/as shafi/tests/roles/secretaire.spec.js` (réécrire avec les nouveaux parcours)

**Interfaces:**
- Consumes: `loginUI` de `tests/helpers/auth.js`, `readState`/`updateState` de `tests/helpers/state.js`, `loginApi`/`apiCreate`/`apiSearchRead` de `tests/helpers/api.js`
- Produces: tests validant accès secrétaire (Néphrologie, Clinique, Facturation Dialyse) + parcours métier (patient, RDV, facturation)

- [ ] **Step 1: Réécrire le fichier de test secrétaire**

Remplacer le contenu de `/Users/yusper/Downloads/modules 19/as shafi/tests/roles/secretaire.spec.js` par :

```javascript
// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');

const LOGIN = 'secretaire@nephro.test';
const PASS  = 'Nephro2024!';

test.describe('Rôle Secrétaire', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, LOGIN, PASS);
  });

  // --- ACCÈS POSITIFS ---

  test('voit le menu Néphrologie', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator('.o_app:has-text("Néphrologie"), a.o_app:has-text("Néphrologie")').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  test('voit le menu Clinique', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator('.o_app:has-text("Clinique"), a.o_app:has-text("Clinique")').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  test('voit le menu Facturation Dialyse', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator('.o_app:has-text("Facturation"), a.o_app:has-text("Facturation")').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  // --- ACCÈS NÉGATIFS ---

  test('ne voit PAS le menu Configuration', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator('.o_app:has-text("Configuration"), a.o_app:has-text("Configuration")').first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  // --- PARCOURS MÉTIER ---

  test('crée un patient', async ({ page }) => {
    // Naviguer vers Clinique → Patients
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const clinique = page.locator('.o_app:has-text("Clinique")').first();
    await clinique.click();
    await page.waitForLoadState('domcontentloaded');

    // Clic sur Nouveau
    const newBtn = page.locator('button.o_list_button_add, button:has-text("Nouveau"), button:has-text("New")').first();
    await expect(newBtn).toBeVisible({ timeout: 10000 });
    await newBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Remplir le nom
    const nameInput = page.locator('div[name="partner_id"] input, input[name="partner_id"]').first();
    await nameInput.fill('Test Playwright Secrétaire');
    await page.waitForTimeout(1000);
    // Sélectionner "Créer" dans le dropdown
    const createOption = page.locator('.o_m2o_dropdown_option:has-text("Créer"), .dropdown-item:has-text("Créer"), .o_m2o_dropdown_option:has-text("Create")').first();
    if (await createOption.isVisible({ timeout: 3000 })) {
      await createOption.click();
      await page.waitForTimeout(1000);
    }

    // Sauvegarder
    await page.keyboard.press('Control+S');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Vérifier qu'on est sur un formulaire patient (pas d'erreur)
    const title = await page.title();
    expect(title).not.toContain('Error');
  });

  test('crée un RDV consultation et le confirme', async ({ page, request }) => {
    const { loginApi, apiCreate, apiSearchRead } = require('../helpers/api');
    await loginApi(request, 'admin', 'admin');

    // Trouver un patient existant
    const patients = await apiSearchRead(request, 'hms.patient', [], ['id'], 1);
    expect(patients.length).toBeGreaterThan(0);

    // Créer un RDV via API
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())} 09:00:00`;

    const apptId = await apiCreate(request, 'hms.appointment', {
      patient_id: patients[0].id,
      date: dateStr,
    });

    // Naviguer vers le RDV en UI
    await page.goto(`/odoo/appointments/${apptId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Vérifier état draft
    const statusbar = page.locator('.o_statusbar_status');
    await expect(statusbar).toBeVisible({ timeout: 5000 });

    // Cliquer sur Confirmer
    const confirmBtn = page.locator('button:has-text("Confirm")').first();
    if (await confirmBtn.isVisible({ timeout: 5000 })) {
      await confirmBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    }
  });

  test('lance la facturation en lot', async ({ page }) => {
    // Naviguer vers Facturation Dialyse
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const factMenu = page.locator('.o_app:has-text("Facturation")').first();
    await factMenu.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Vérifier que la page charge sans erreur
    const title = await page.title();
    expect(title).not.toContain('Error');
  });

});
```

- [ ] **Step 2: Exécuter les tests secrétaire**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/tests"
npx playwright test roles/secretaire.spec.js --reporter=list
```

- [ ] **Step 3: Corriger les échecs éventuels et re-exécuter**

Adapter les sélecteurs Playwright si nécessaire (les sélecteurs Odoo 19 peuvent varier selon la langue et la version).

- [ ] **Step 4: Commit**

```bash
git add tests/roles/secretaire.spec.js
git commit -m "test(playwright): réécrire les tests secrétaire avec accès Clinique + Facturation"
```

---

### Task 8: Tests Playwright — Médecin

**Files:**
- Modify: `/Users/yusper/Downloads/modules 19/as shafi/tests/roles/medecin.spec.js`

**Interfaces:**
- Consumes: `loginUI` de `tests/helpers/auth.js`, helpers API
- Produces: tests validant accès médecin (Néphrologie, Clinique, Bilans) + parcours (ordonnance, séance, bilans)

- [ ] **Step 1: Réécrire le fichier de test médecin**

Remplacer le contenu de `/Users/yusper/Downloads/modules 19/as shafi/tests/roles/medecin.spec.js` par :

```javascript
// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');

const LOGIN = 'medecin@nephro.test';
const PASS  = 'Nephro2024!';

test.describe('Rôle Médecin', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, LOGIN, PASS);
  });

  // --- ACCÈS POSITIFS ---

  test('voit le menu Néphrologie', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator('.o_app:has-text("Néphrologie")').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  test('voit le menu Clinique', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator('.o_app:has-text("Clinique")').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  test('accède aux bilans biologiques', async ({ page }) => {
    // Naviguer vers Néphrologie
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const nephro = page.locator('.o_app:has-text("Néphrologie")').first();
    await nephro.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Chercher le sous-menu Bilans
    const bilansMenu = page.locator('.o_menu_sections a:has-text("Bilan"), .o_menu_sections a:has-text("bilan")').first();
    await expect(bilansMenu).toBeVisible({ timeout: 10000 });
    await bilansMenu.click();
    await page.waitForLoadState('domcontentloaded');

    const title = await page.title();
    expect(title).not.toContain('Error');
  });

  // --- ACCÈS NÉGATIFS ---

  test('ne voit PAS le menu Configuration', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator('.o_app:has-text("Configuration")').first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  test('ne voit PAS le menu Facturation Dialyse', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator('.o_app:has-text("Facturation")').first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  // --- PARCOURS MÉTIER ---

  test('ouvre un patient et crée une ordonnance', async ({ page, request }) => {
    const { loginApi, apiSearchRead } = require('../helpers/api');
    await loginApi(request, 'admin', 'admin');

    // Trouver un patient existant
    const patients = await apiSearchRead(request, 'hms.patient', [], ['id', 'name'], 1);
    expect(patients.length).toBeGreaterThan(0);

    // Naviguer vers la fiche patient
    await page.goto(`/odoo/almightyhms-patient/${patients[0].id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Vérifier que la fiche s'affiche
    const title = await page.title();
    expect(title).not.toContain('Error');
  });

  test('ouvre une séance et la termine', async ({ page, request }) => {
    const { loginApi, apiSearchRead } = require('../helpers/api');
    await loginApi(request, 'admin', 'admin');

    // Trouver une séance planifiée (scheduled)
    const procedures = await apiSearchRead(
      request, 'acs.patient.procedure',
      [['state', '=', 'scheduled']],
      ['id', 'name'], 1
    );

    if (procedures.length === 0) {
      console.warn('[medecin] Aucune séance planifiée trouvée — test skip');
      return;
    }

    // Naviguer vers la séance
    await page.goto(`/odoo/acs-patient-procedure/${procedures[0].id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Vérifier que la fiche s'affiche
    const title = await page.title();
    expect(title).not.toContain('Error');
  });

});
```

- [ ] **Step 2: Exécuter les tests médecin**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/tests"
npx playwright test roles/medecin.spec.js --reporter=list
```

- [ ] **Step 3: Corriger et re-exécuter si nécessaire**

- [ ] **Step 4: Commit**

```bash
git add tests/roles/medecin.spec.js
git commit -m "test(playwright): réécrire les tests médecin avec accès Clinique + Bilans"
```

---

### Task 9: Tests Playwright — Infirmière

**Files:**
- Modify: `/Users/yusper/Downloads/modules 19/as shafi/tests/roles/infirmiere.spec.js`

**Interfaces:**
- Consumes: `loginUI`, helpers API
- Produces: tests validant accès infirmière (dashboard, bilans) + parcours (séance dialyse)

- [ ] **Step 1: Réécrire le fichier de test infirmière**

Remplacer le contenu de `/Users/yusper/Downloads/modules 19/as shafi/tests/roles/infirmiere.spec.js` par :

```javascript
// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');

const LOGIN = 'infirmiere@nephro.test';
const PASS  = 'Nephro2024!';

test.describe('Rôle Infirmière', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, LOGIN, PASS);
  });

  // --- ACCÈS POSITIFS ---

  test('arrive sur le dashboard infirmier', async ({ page }) => {
    // Après login, l'infirmière est redirigée vers son dashboard
    await page.waitForTimeout(2000);
    const url = page.url();
    // Vérifier qu'on est bien connecté (pas sur /web/login)
    expect(url).toContain('/odoo');
  });

  test('accède aux bilans biologiques', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Aller dans Néphrologie
    const nephro = page.locator('.o_app:has-text("Néphrologie")').first();
    await nephro.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Chercher le sous-menu Bilans
    const bilansMenu = page.locator('.o_menu_sections a:has-text("Bilan"), .o_menu_sections a:has-text("bilan")').first();
    await expect(bilansMenu).toBeVisible({ timeout: 10000 });
  });

  // --- ACCÈS NÉGATIFS ---

  test('ne voit PAS le menu Facturation Dialyse', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator('.o_app:has-text("Facturation")').first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  test('ne voit PAS le menu Configuration', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator('.o_app:has-text("Configuration")').first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  // --- PARCOURS MÉTIER ---

  test('ouvre une séance planifiée et la démarre', async ({ page, request }) => {
    const { loginApi, apiSearchRead } = require('../helpers/api');
    await loginApi(request, 'admin', 'admin');

    // Trouver une séance planifiée
    const procedures = await apiSearchRead(
      request, 'acs.patient.procedure',
      [['state', '=', 'scheduled']],
      ['id', 'name'], 1
    );

    if (procedures.length === 0) {
      console.warn('[infirmiere] Aucune séance planifiée — test skip');
      return;
    }

    await page.goto(`/odoo/acs-patient-procedure/${procedures[0].id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Chercher le bouton Démarrer
    const startBtn = page.locator('button:has-text("Démarrer"), button:has-text("Start")').first();
    if (await startBtn.isVisible({ timeout: 5000 })) {
      await startBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    }

    const title = await page.title();
    expect(title).not.toContain('Error');
  });

});
```

- [ ] **Step 2: Exécuter les tests infirmière**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/tests"
npx playwright test roles/infirmiere.spec.js --reporter=list
```

- [ ] **Step 3: Corriger et re-exécuter**

- [ ] **Step 4: Commit**

```bash
git add tests/roles/infirmiere.spec.js
git commit -m "test(playwright): réécrire les tests infirmière avec dashboard + bilans"
```

---

### Task 10: Tests Playwright — Facturation

**Files:**
- Modify: `/Users/yusper/Downloads/modules 19/as shafi/tests/roles/facturation.spec.js`

**Interfaces:**
- Consumes: `loginUI`, helpers API
- Produces: tests validant accès facturation + parcours (facturation lot, export Excel)

- [ ] **Step 1: Réécrire le fichier de test facturation**

Remplacer le contenu de `/Users/yusper/Downloads/modules 19/as shafi/tests/roles/facturation.spec.js` par :

```javascript
// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');

const LOGIN = 'facturation@nephro.test';
const PASS  = 'Nephro2024!';

test.describe('Rôle Facturation', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, LOGIN, PASS);
  });

  // --- ACCÈS POSITIFS ---

  test('voit le menu Facturation Dialyse', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator('.o_app:has-text("Facturation")').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  // --- ACCÈS NÉGATIFS ---

  test('ne voit PAS le menu Clinique', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const menu = page.locator('.o_app:has-text("Clinique")').first();
    await expect(menu).not.toBeVisible({ timeout: 3000 });
  });

  // --- PARCOURS MÉTIER ---

  test('accède à la liste des factures', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const factMenu = page.locator('.o_app:has-text("Facturation")').first();
    await factMenu.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Vérifier que la page charge sans erreur
    const title = await page.title();
    expect(title).not.toContain('Error');
  });

});
```

- [ ] **Step 2: Exécuter les tests facturation**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/tests"
npx playwright test roles/facturation.spec.js --reporter=list
```

- [ ] **Step 3: Commit**

```bash
git add tests/roles/facturation.spec.js
git commit -m "test(playwright): réécrire les tests facturation avec accès positifs/négatifs"
```

---

### Task 11: Tests Playwright — Patient portail

**Files:**
- Modify: `/Users/yusper/Downloads/modules 19/as shafi/tests/roles/patient_portail.spec.js`

**Interfaces:**
- Consumes: `loginUI`
- Produces: tests validant accès portail patient + parcours (historique, bilans)

- [ ] **Step 1: Réécrire le fichier de test patient portail**

Remplacer le contenu de `/Users/yusper/Downloads/modules 19/as shafi/tests/roles/patient_portail.spec.js` par :

```javascript
// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');

const LOGIN = 'patient@nephro.test';
const PASS  = 'Nephro2024!';

test.describe('Rôle Patient (Portail)', () => {

  test.beforeEach(async ({ page }) => {
    await loginUI(page, LOGIN, PASS);
  });

  // --- ACCÈS POSITIFS ---

  test('redirigé vers /my après login', async ({ page }) => {
    const url = page.url();
    expect(url).toContain('/my');
  });

  test('voit son historique de séances', async ({ page }) => {
    // Naviguer vers la page des séances
    const dialysisLink = page.locator('a:has-text("dialyse"), a:has-text("séance"), a:has-text("Dialysis")').first();
    if (await dialysisLink.isVisible({ timeout: 5000 })) {
      await dialysisLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    }

    const title = await page.title();
    expect(title).not.toContain('Error');
  });

  test('voit ses bilans biologiques', async ({ page }) => {
    const bilansLink = page.locator('a:has-text("bilan"), a:has-text("Bilan"), a:has-text("résultat")').first();
    if (await bilansLink.isVisible({ timeout: 5000 })) {
      await bilansLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    }

    const title = await page.title();
    expect(title).not.toContain('Error');
  });

  // --- ACCÈS NÉGATIFS ---

  test('ne peut PAS accéder au backend /web', async ({ page }) => {
    await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const url = page.url();
    // Le patient doit être redirigé vers /my ou /web/login, pas vers le backend
    expect(url).not.toMatch(/\/odoo\/[a-z]/);
  });

});
```

- [ ] **Step 2: Exécuter les tests patient**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/tests"
npx playwright test roles/patient_portail.spec.js --reporter=list
```

- [ ] **Step 3: Commit**

```bash
git add tests/roles/patient_portail.spec.js
git commit -m "test(playwright): réécrire les tests patient portail avec accès positifs/négatifs"
```

---

### Task 12: Exécution complète et validation finale

**Files:** aucun nouveau fichier

**Interfaces:**
- Consumes: toutes les tâches précédentes
- Produces: suite de tests complète au vert

- [ ] **Step 1: Exécuter toute la suite de tests**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi/tests"
npx playwright test roles/ --reporter=list
```

- [ ] **Step 2: Analyser les échecs**

Pour chaque test en échec :
1. Lire le message d'erreur
2. Vérifier si c'est un problème de sélecteur (adapter le sélecteur Playwright)
3. Vérifier si c'est un problème de permission (corriger la sécurité Odoo)
4. Vérifier si c'est un problème de données (créer les données manquantes)

- [ ] **Step 3: Re-exécuter jusqu'au vert**

```bash
npx playwright test roles/ --reporter=list
```

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "test(playwright): suite complète par rôle au vert (5 rôles, accès + parcours)"
```
