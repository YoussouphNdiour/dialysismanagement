# Simplification Treatment → Séances : Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplifier le flux de génération de séances en masquant `hms.treatment` de l'UI néphro et en ajoutant une option "Créer aussi les RDV" dans le wizard de génération en masse.

**Architecture:** Masquage UI uniquement — aucun modèle Python supprimé. On masque 1 menu et 2 boutons dans les vues XML, et on ajoute 1 champ Boolean + 3 lignes de logique dans le wizard de validation.

**Tech Stack:** Odoo 19, Python 3, XML (vues Odoo)

## Global Constraints

- Ne supprimer aucun modèle Python ni aucun champ existant
- Ne pas modifier les modules `acs_hms` ou `acs_hms_base` (uniquement `acs_hms_nephrology`)
- Toutes les modifications doivent être réversibles (masquage, pas suppression)

---

### Task 1: Masquer le menu Treatment et les boutons de flux C/D

**Files:**
- Modify: `acs_hms_nephrology/views/menu_item.xml:43-47`
- Modify: `acs_hms_nephrology/views/appointment_generator_view.xml:22-35`

**Interfaces:**
- Consumes: rien
- Produces: menu Treatment invisible, boutons "Créer RDV depuis planning" et "Générer RDV récurrents" invisibles sur le formulaire séance

- [ ] **Step 1: Masquer le menuitem Treatment**

Dans `acs_hms_nephrology/views/menu_item.xml`, remplacer le menuitem `menu_acs_treatment` (lignes 43-47) :

```xml
    <!-- 4. Séances de Dialyse — MASQUÉ (remplacé par le wizard de génération en masse) -->
    <menuitem id="menu_acs_treatment"
        name="Séances de Dialyse"
        parent="menu_acs_main_nephrology"
        action="action_acs_treatment"
        sequence="45"
        active="0"/>
```

Le changement est l'ajout de `active="0"` qui masque le menu sans le supprimer.

- [ ] **Step 2: Masquer les 2 boutons sur le formulaire séance**

Dans `acs_hms_nephrology/views/appointment_generator_view.xml`, ajouter `invisible="1"` aux deux boutons dans le header (lignes 23-35). Remplacer le bloc xpath du header :

```xml
            <!-- Ajouter les boutons dans le header -->
            <xpath expr="//header" position="inside">
                <button name="action_create_appointment_from_schedule"
                        string="Créer RDV depuis planning"
                        type="object"
                        class="btn-primary"
                        invisible="1"
                        help="Créer un rendez-vous automatiquement basé sur le planning de néphrologie"/>

                <button name="action_generate_recurring_appointments"
                        string="Générer RDV récurrents"
                        type="object"
                        class="btn-secondary"
                        invisible="1"
                        help="Générer plusieurs rendez-vous récurrents selon le planning"/>
            </xpath>
```

- [ ] **Step 3: Vérifier dans le navigateur**

Lancer Odoo, aller dans le menu Néphrologie :
- Vérifier que le menu "Séances de Dialyse" n'apparaît plus
- Ouvrir une séance existante (Hémodialyses) → vérifier que les boutons "Créer RDV depuis planning" et "Générer RDV récurrents" ne sont plus visibles dans le header
- Vérifier que le stat button "Rendez-vous" est toujours visible
- Vérifier que le champ `appointment_id` est toujours visible

- [ ] **Step 4: Commit**

```bash
git add acs_hms_nephrology/views/menu_item.xml acs_hms_nephrology/views/appointment_generator_view.xml
git commit -m "refactor: masquer menu Treatment et boutons RDV manuels du flux néphro"
```

---

### Task 2: Ajouter l'option "Créer aussi les RDV" au wizard masse

**Files:**
- Modify: `acs_hms_nephrology/models/session_generator.py:21-49` (modèle `nephrology.session.generator`)
- Modify: `acs_hms_nephrology/models/session_generator.py:219-279` (méthode `action_confirm` du validator)
- Modify: `acs_hms_nephrology/views/session_generator_view.xml:32-40` (formulaire wizard étape 1)

**Interfaces:**
- Consumes: méthode `acs.patient.procedure.action_create_appointment_from_schedule()` existante dans `appointment_generator.py:57-98` — appel sans arguments, crée un `hms.appointment` lié à la procédure via `self.appointment_id`
- Produces: champ `create_appointments` (Boolean) sur `nephrology.session.generator`, logique de création RDV dans `action_confirm()`

- [ ] **Step 1: Ajouter le champ Boolean au modèle generator**

Dans `acs_hms_nephrology/models/session_generator.py`, ajouter le champ après `exclude_holidays` (après la ligne 44) :

```python
    create_appointments = fields.Boolean(
        string='Créer aussi les RDV',
        default=False,
        help="Si coché, un rendez-vous sera automatiquement créé pour chaque séance générée.",
    )
```

- [ ] **Step 2: Modifier action_confirm() pour créer les RDV**

Dans `acs_hms_nephrology/models/session_generator.py`, dans la méthode `action_confirm()` du `NephrologySessionValidator`, ajouter la création de RDV après la ligne `created_count += 1` (ligne 264). Le bloc de la boucle `for d in valid_dates:` devient :

```python
            for d in valid_dates:
                hour = int(line.schedule_id.start_time)
                minute = int((line.schedule_id.start_time % 1) * 60)
                dt = datetime.combine(d, datetime.min.time()).replace(
                    hour=hour, minute=minute, second=0, microsecond=0)

                procedure = self.env['acs.patient.procedure'].create({
                    'patient_id': line.patient_id.id,
                    'product_id': product.id,
                    'date': dt,
                    'physician_id': line.physician_id.id if line.physician_id else False,
                    'department_id': generator.department_id.id if generator.department_id else False,
                    'nephrology_schedule_ids': [(4, line.schedule_id.id)],
                })
                created_count += 1

                if generator.create_appointments:
                    try:
                        procedure.action_create_appointment_from_schedule()
                    except Exception:
                        pass  # Ne pas bloquer si la création du RDV échoue
```

- [ ] **Step 3: Ajouter le champ checkbox dans la vue XML**

Dans `acs_hms_nephrology/views/session_generator_view.xml`, ajouter le champ `create_appointments` dans le groupe "2. Période", après `exclude_holidays` (après la ligne 39). Le second `<group>` dans la section "2. Période" devient :

```xml
                        <group>
                            <field name="exclude_holidays"/>
                            <field name="create_appointments"/>
                        </group>
```

- [ ] **Step 4: Vérifier dans le navigateur**

Lancer Odoo, aller dans Néphrologie → Générer séances en masse :
1. Sélectionner un planning, des patients, une période
2. Vérifier que la checkbox "Créer aussi les RDV" apparaît
3. **Test sans checkbox** : générer → vérifier que les séances sont créées SANS RDV (comportement existant préservé)
4. **Test avec checkbox** : générer → vérifier que les séances sont créées AVEC un RDV lié (1:1) visible dans le champ `appointment_id` de chaque séance
5. Vérifier que les RDV créés apparaissent dans le menu Rendez-vous

- [ ] **Step 5: Commit**

```bash
git add acs_hms_nephrology/models/session_generator.py acs_hms_nephrology/views/session_generator_view.xml
git commit -m "feat: option 'Créer aussi les RDV' dans le wizard de génération de séances"
```
