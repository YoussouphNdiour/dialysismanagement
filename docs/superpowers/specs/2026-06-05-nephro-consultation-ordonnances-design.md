# Sprint 4 — Section 3.5 : Consultation néphro inter-séances + ordonnances type néphro

**Date :** 2026-06-05
**Module cible :** `acs_hms_nephrology` (existant)
**Dépendances :** `acs_hms`, `acs_hms_nephrology_bilans`
**Approche :** Extension légère via `_inherit` — zéro nouveau module, zéro migration destructive

---

## 1. Contexte et décisions de design

### Ce qui existe déjà (ne pas recréer)
- `prescription.order` — modèle d'ordonnance avec lignes, statut, lien `procedure_id` vers `acs.patient.procedure`
- `prescription.line` — champs existants : `dose`, `dosage_uom_id`, `route_id`, `common_dosage_id`, `short_comment` — couvrent tous les besoins néphro
- `medicament.group` — groupes de médicaments pré-configurables avec `onchange_group_id` déjà codé
- `acs.patient.procedure.prescription_count` — compteur calculé (reverse de `procedure_id`)
- Portail `/my/ordonnances` — affiche déjà `prescription.order` par patient

### Décisions prises
1. **Pas de nouveau modèle** — on étend `prescription.order` avec deux champs (`is_nephro_prescription`, `nephro_context`)
2. **`acs.patient.procedure.nephro_prescription_ids`** = One2many calculé (reverse filtré) — pas de Many2many redondant
3. **`acs.nephro.bilan.prescription_ids`** = Many2many stocké — lien nouveau, taguage manuel par médecin
4. **Données médicaments** = cinq `medicament.group` XML — pas de produits créés en dur (la pharmacie gère le catalogue)
5. **Portail** = une seule ligne modifiée dans le template QWeb existant (badge "Néphro")

---

## 2. Structure des fichiers

```
acs_hms_nephrology/
├── models/
│   ├── nephro_prescription.py    ← _inherit prescription.order + prescription.line
│   ├── nephro_procedure.py       ← _inherit acs.patient.procedure
│   └── nephro_bilan.py           ← _inherit acs.nephro.bilan
├── views/
│   ├── nephro_prescription_view.xml   ← onglet patient + amélioration form ordonnance + section bilan
│   └── nephro_procedure_view.xml      ← bouton stat séance
├── data/
│   └── nephro_medicament_groups.xml   ← 5 groupes médicaments pré-configurés
└── (pas de nouveau fichier security)
```

`__manifest__.py` → ajouter `acs_hms_nephrology_bilans` dans `depends` (conditionnel — si déjà listé, ne pas dupliquer).

---

## 3. Modèles

### 3.1 Extension `prescription.order`

```python
class PrescriptionOrderNephro(models.Model):
    _inherit = 'prescription.order'

    is_nephro_prescription = fields.Boolean(
        string='Ordonnance Néphro',
        default=False,
        help='Marquer comme ordonnance spécifique néphro/dialyse'
    )
    nephro_context = fields.Selection([
        ('background', 'Traitement de fond'),
        ('dose_adjustment', 'Ajustement de dose'),
        ('inter_session', 'Consultation inter-séances'),
    ], string='Contexte néphro')
```

Pas de champ sur `prescription.line` — les champs existants (`route_id`, `dose`, `dosage_uom_id`, `common_dosage_id`, `short_comment`) couvrent tous les besoins néphro (EPO dose+voie+fréquence, Fer IV dose par séance, etc.).

### 3.2 Extension `acs.patient.procedure`

```python
class AcsPatientProcedureNephro(models.Model):
    _inherit = 'acs.patient.procedure'

    nephro_prescription_ids = fields.One2many(
        'prescription.order', 'procedure_id',
        string='Ordonnances Néphro',
        domain=[('is_nephro_prescription', '=', True)],
    )
    nephro_prescription_count = fields.Integer(
        compute='_compute_nephro_prescription_count',
        string='Ordonnances Néphro'
    )

    def _compute_nephro_prescription_count(self):
        for rec in self:
            rec.nephro_prescription_count = self.env['prescription.order'].search_count([
                ('procedure_id', '=', rec.id),
                ('is_nephro_prescription', '=', True),
            ])
```

### 3.3 Extension `acs.nephro.bilan`

```python
class AcsNephroBilanPrescription(models.Model):
    _inherit = 'acs.nephro.bilan'

    prescription_ids = fields.Many2many(
        'prescription.order',
        'nephro_bilan_prescription_rel',
        'bilan_id', 'prescription_id',
        string='Ordonnances actives au moment du bilan',
        domain=[('is_nephro_prescription', '=', True)],
    )
```

---

## 4. Données de configuration

Cinq `medicament.group` pré-créés dans `data/nephro_medicament_groups.xml`.
Ces groupes s'utilisent via le champ `group_id` existant sur `prescription.order` — le médecin sélectionne un groupe, `onchange_group_id` pré-remplit les lignes automatiquement.

| Groupe XML ID | Nom affiché | Médicaments types |
|---|---|---|
| `nephro_group_epo` | Protocole EPO / Aranesp | Époetin alfa SC, Darbépoétine (Aranesp) SC |
| `nephro_group_fer_iv` | Fer IV (Venofer) | Fer saccharose IV — dose par séance |
| `nephro_group_vit_d` | Vitamine D active | Calcitriol oral, Paricalcitol IV |
| `nephro_group_chelateurs` | Chélateurs de phosphore | Carbonate de calcium, Sevelamer, Lanthanum |
| `nephro_group_antihyp` | Antihypertenseurs / Diurétiques | Amlodipine, Furosémide, Ramipril |

> **Note :** Les groupes référencent des produits `product.product` existants dans le catalogue médicaments (type `medicament`). Si les produits n'existent pas encore, les groupes créent des entrées avec `noupdate="1"` — l'équipe pharmacie les complète en production.

---

## 5. Vues

### 5.1 Onglet "Ordonnances Néphro" sur `hms.patient`

- Héritage de `acs_hms_nephrology.view_patient_form`
- Position : `<page name="nephrology_history">` → `position="after"`
- Nom de page : `nephro_prescriptions`, libellé : "Ordonnances Néphro"
- Contenu :
  - Bouton "Nouvelle ordonnance néphro" (ouvre form avec contexte pré-rempli)
  - Liste `prescription.order` filtrée : `patient_id = active_id` + `is_nephro_prescription = True`
  - Colonnes : Date | Contexte | Médicaments (many2many_tags sur noms de lignes) | Statut | Médecin
  - Tri : actives (`state = 'prescription'`) en tête, annulées grisées
- Visibilité : tous les groupes qui voient le dossier patient (médecin + secrétaire)

### 5.2 Amélioration du formulaire `prescription.order`

- Ajout des champs `is_nephro_prescription` + `nephro_context` dans l'en-tête du form existant
- Groupe contextuel visible uniquement si `is_nephro_prescription = True`
- Les groupes médicaments (champ `group_id` existant) restent — le médecin sélectionne un groupe néphro

### 5.3 Bouton stat sur `acs.patient.procedure`

- Héritage de la vue form séance
- Ajout d'un bouton `oe_stat_button` `nephro_prescription_count`
- Clic → `action_prescription` filtré sur `is_nephro_prescription = True` + `procedure_id = self.id`
- Bouton "Prescrire" dans l'action → context `{'default_procedure_id': active_id, 'default_is_nephro_prescription': True}`

### 5.4 Section sur `acs.nephro.bilan`

- Héritage de la vue form bilan (dans `acs_hms_nephrology_bilans`)
- Ajout d'un groupe "Ordonnances actives au moment du bilan" avec widget `many2many_tags`
- Position : avant la section Notes

### 5.5 Portail `/my/ordonnances`

- Une seule modification dans `acs_hms_nephrology_portal/views/portal_ordonnances.xml`
- Ajout d'un badge `<span class="badge bg-info">Néphro</span>` conditionnel sur `prescription.is_nephro_prescription`

---

## 6. Flux utilisateur

### Médecin — consultation inter-séances
1. Ouvre dossier patient → onglet "Ordonnances Néphro"
2. Clique "Nouvelle ordonnance néphro"
3. Sélectionne groupe "Protocole EPO / Aranesp" → lignes pré-remplies
4. Ajuste dose, voie, fréquence sur chaque ligne
5. Confirme → ordonnance `prescription` active

### Médecin — rattachement bilan
1. Ouvre bilan biologique du mois
2. Section "Ordonnances actives" → sélectionne les ordonnances néphro en cours
3. Sauvegarde → traçabilité bilan ↔ prescriptions documentée

### Infirmier — séance
1. Ouvre fiche séance → bouton stat "Ordonnances Néphro"
2. Consulte les prescriptions actives (EPO, Fer IV)
3. Peut créer une nouvelle ordonnance depuis la séance si le médecin prescrit en séance

### Patient — portail
1. `/my/ordonnances` → liste avec badge "Néphro" sur les ordonnances concernées
2. Aucun accès à la création — lecture seule

---

## 7. Non-périmètre (hors scope 3.5)

- Génération automatique de rappels WhatsApp pour les renouvellements EPO → Sprint suivant
- Calcul automatique de la durée d'une ordonnance EPO en fonction des séances → non requis
- Interface de validation pharmacie → hors scope
- Signature électronique ordonnance → hors scope

---

## 8. Contraintes techniques

- Odoo 19 — `_inherit` uniquement, pas de migration de données
- Le champ `procedure_id` sur `prescription.order` existe déjà — ne pas le recréer
- `noupdate="1"` sur toutes les données XML pour éviter l'écrasement en mise à jour
- Le template portail est dans `acs_hms_nephrology_portal` — la modification est minimale (1 ligne)
- Dépendance sur `acs_hms_nephrology_bilans` dans `__manifest__.py` de `acs_hms_nephrology`
