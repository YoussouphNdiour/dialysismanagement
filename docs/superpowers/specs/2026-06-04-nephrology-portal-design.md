# Portail Patient Néphro — Design Complet

**Date :** 2026-06-04
**Sprint :** 3 — Section 8
**Module :** `acs_hms_nephrology_portal`
**Projet :** As-Shafi — Clinique de Dialyse/Néphrologie
**Stack :** Odoo 19, portal natif, QWeb, Bootstrap mobile-first, Chart.js

---

## 1. Contexte & objectifs

Portail web responsive permettant au patient dialysé de consulter depuis son téléphone :
- Ses séances passées et à venir
- Ses résultats biologiques avec badges KDIGO
- Ses prochains RDV + annulation en ligne
- Ses ordonnances actives (EPO, Fer IV, etc.)
- Ses factures et attestations PDF

Authentification via portail Odoo natif (`base.group_portal`). Accès créé par la secrétaire via wizard Odoo standard.

---

## 2. Architecture

### Approche retenue

**Portal Odoo pur** (approche 1 + page résumé de l'approche 3) :
- Controllers HTTP héritant de `portal.CustomerPortal`
- Templates QWeb héritant de `portal.portal_layout`
- SSR (Server-Side Rendering) — rapide sur mobile 3G
- Chart.js via assets Odoo 19 natifs (pas de CDN)
- Pas d'OWL (inutile pour des listes statiques)

### Dépendances

```python
'depends': [
    'portal',
    'website',
    'acs_hms_nephrology',
    'acs_hms_nephrology_bilans',
    'acs_hms_nephrology_billing',
]
# acs_hms_whatsapp : dépendance optionnelle (vérification runtime)
```

### Arborescence

```
acs_hms_nephrology_portal/
├── __manifest__.py
├── __init__.py
├── controllers/
│   ├── __init__.py
│   └── portal.py
├── models/
│   ├── __init__.py
│   ├── res_config_settings.py
│   └── hms_patient.py
├── security/
│   ├── ir.model.access.csv
│   └── portal_rules.xml
├── views/
│   └── res_config_settings_view.xml
├── report/
│   └── report_seance_portal.xml
├── static/
│   └── src/
│       └── css/
│           └── portal_nephro.css
└── templates/
    ├── portal_layout.xml
    ├── portal_home.xml
    ├── portal_seances.xml
    ├── portal_bilans.xml
    ├── portal_rdv.xml
    ├── portal_ordonnances.xml
    └── portal_factures.xml
```

---

## 3. Sécurité & accès portal

### Lien res.users → hms.patient

Via `partner_id` natif Odoo — aucun champ supplémentaire :

```python
def _get_current_patient(self):
    partner = request.env.user.partner_id
    return request.env['hms.patient'].sudo().search(
        [('partner_id', '=', partner.id)], limit=1
    )
```

Si aucun patient lié → redirection `/my` avec message "Dossier non lié, contactez la clinique".

### Wizard invitation portail

Réutilisation du wizard Odoo natif `portal.wizard`. Bouton **"Inviter au portail"** ajouté sur la fiche `hms.patient` (visible secrétaire/admin) :

```python
def action_invite_portal(self):
    wizard = self.env['portal.wizard'].create({
        'user_ids': [(0, 0, {
            'partner_id': self.partner_id.id,
            'email': self.partner_id.email,
        })]
    })
    if 'acs_hms_whatsapp' in self.env.registry:
        self._send_portal_invite_whatsapp()
    return wizard._action_open_modal()
```

### ir.rule — isolation données patient

Toutes les règles s'appliquent au groupe `base.group_portal` uniquement.

| Modèle | Filtre domaine |
|---|---|
| `acs.patient.procedure` | `patient_id.partner_id = user.partner_id` |
| `acs.nephro.bilan` | `patient_id.partner_id = user.partner_id` |
| `hms.appointment` | `patient_id.partner_id = user.partner_id` |
| `prescription.order` | `patient_id.partner_id = user.partner_id` |
| `account.move` | `partner_id = user.partner_id` |

### Accès PDFs

- **Factures** : `/my/invoices/<id>` — portal natif Odoo `account`
- **Prescriptions** : `/report/pdf/acs_hms.action_prescription_report/<id>` avec vérification ownership dans le controller
- **CR séance simplifié** : `/report/pdf/acs_hms_nephrology_portal.action_report_seance_portal/<id>` idem

---

## 4. Controllers & routes

### Fichier : `controllers/portal.py`

Classe `NephrologyPortal(CustomerPortal)`.

| Route | Méthode | Description |
|---|---|---|
| `/my` | GET | Page résumé (override `_prepare_home_portal_values`) |
| `/my/seances` | GET | Liste séances paginée (20/page) |
| `/my/seances/<int:procedure_id>` | GET | Détail séance + lien PDF |
| `/my/bilans` | GET | Liste bilans + données Chart.js |
| `/my/bilans/<int:bilan_id>` | GET | Détail bilan |
| `/my/rdv` | GET | Liste RDV à venir |
| `/my/rdv/<int:appointment_id>/cancel` | POST | Flag annulation patient |
| `/my/ordonnances` | GET | Liste prescriptions actives |
| `/my/factures` | GET | Redirect `/my/invoices` filtré dialyse |

### Pattern GET standard

```python
@http.route('/my/seances', auth='user', website=True)
def portal_seances(self, page=1, **kw):
    patient = self._get_current_patient()
    if not patient:
        return request.redirect('/my')
    domain = [('patient_id', '=', patient.id), ('procedure_type', '=', 'dialysis')]
    total = Procedure.sudo().search_count(domain)
    pager = portal_pager(url='/my/seances', total=total, page=page, step=20)
    procedures = Procedure.sudo().search(
        domain, limit=20, offset=pager['offset'], order='date desc'
    )
    return request.render('acs_hms_nephrology_portal.portal_seances', {
        'procedures': procedures,
        'pager': pager,
        'patient': patient,
    })
```

### Route POST annulation

```python
@http.route('/my/rdv/<int:appointment_id>/cancel', auth='user',
            website=True, methods=['POST'], csrf=True)
def portal_rdv_cancel(self, appointment_id, cancel_reason='', **kw):
    patient = self._get_current_patient()
    appointment = Appointment.sudo().search([
        ('id', '=', appointment_id),
        ('patient_id', '=', patient.id),  # ownership check obligatoire
    ], limit=1)
    if not appointment:
        return request.redirect('/my/rdv')
    appointment.sudo().write({
        'patient_cancelled': True,
        'cancel_reason': cancel_reason,
        'cancel_date': fields.Datetime.now(),
    })
    appointment.sudo()._notify_cancel_to_secretary()
    return request.redirect('/my/rdv?cancelled=1')
```

### Données Chart.js (`/my/bilans`)

Le controller sérialise les 6 derniers mois en JSON :

```python
chart_data = {
    'labels': ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'],
    'hemoglobin': [10.2, 10.8, 11.0, 10.5, 11.2, 11.4],
    'potassium':  [5.1, 4.9, 5.3, 5.0, 4.8, 5.1],
    'phosphorus': [1.8, 2.0, 1.9, 2.1, 1.7, 1.8],
}
# Injecté dans le template via json.dumps(chart_data)
```

---

## 5. Modèles étendus

### `models/hms_patient.py` — extension `hms.appointment`

```python
class HmsAppointmentPortal(models.Model):
    _inherit = 'hms.appointment'

    patient_cancelled = fields.Boolean('Annulé par le patient', default=False)
    cancel_reason     = fields.Text('Motif annulation patient')
    cancel_date       = fields.Datetime('Date annulation', readonly=True)

    def _notify_cancel_to_secretary(self):
        # 1. Email template Odoo → groupe receptionist
        # 2. WhatsApp optionnel si acs_hms_whatsapp installé
```

Bouton "Inviter au portail" ajouté sur la vue form `hms.patient` (groups secrétaire/admin).

### `models/res_config_settings.py` — paramètres société

```python
class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    portal_simplified_language = fields.Boolean(
        related='company_id.portal_simplified_language', readonly=False,
        string='Langage simplifié (KT/V → texte patient)'
    )
    portal_show_raw_values = fields.Boolean(
        related='company_id.portal_show_raw_values', readonly=False,
        string='Afficher aussi la valeur brute'
    )
```

Valeurs par défaut : `portal_simplified_language=True`, `portal_show_raw_values=False`.

---

## 6. Templates QWeb

### Layout mobile (`portal_layout.xml`)

Hérite de `portal.portal_layout`. Ajoute une **barre de navigation bottom fixe** visible uniquement sur mobile (`max-width: 767px`) :

```
┌─────────────────────────────┐
│  [← Mon espace] Page titre  │  ← breadcrumb Odoo standard
├─────────────────────────────┤
│   contenu de la page        │
├─────────────────────────────┤
│  🏠   💉   📋   📄   💰    │  ← nav bottom (mobile only)
│ Accueil Séances Bilans ...  │
└─────────────────────────────┘
```

### Page `/my` — Résumé (`portal_home.xml`)

4 cartes en grille 2×2 sur mobile, row sur desktop :
- Prochain RDV (date, poste, médecin)
- Dernier bilan (Hb + badge statut KDIGO)
- Solde (montant + statut paiement)
- Ordonnances actives (count + noms courts)

### Page `/my/seances`

- Tableau responsive → cartes empilées sur mobile
- Colonnes : Date · Durée · KT/V ou badge "Efficace ✓" · UF · Tolérance · [Détail]
- Badge tolérance : vert / orange / rouge
- Détail : signes vitaux simplifiés + bouton "Télécharger CR PDF"

### Page `/my/bilans`

- Tableau : Paramètre · Valeur · Normale · Badge KDIGO
- Badges KDIGO : Normal (vert) · Cible (bleu) · Attention (orange) · Critique (rouge)
- 3 graphiques Chart.js (Hémoglobine, Potassium, Phosphore) empilés verticalement
- Dropdown pour afficher d'autres paramètres
- Message automatique si valeur anormale : "Votre médecin a été informé"

### Page `/my/rdv`

- Cartes RDV à venir : date/heure · poste · médecin
- Bouton "Je ne pourrai pas venir" → `<dialog>` natif HTML (pas de JS framework)
- Form POST avec CSRF token, textarea motif
- Badge "Annulé" sur les RDV déjà flaggués

### Page `/my/ordonnances`

- Cartes : médicament · posologie · fréquence · date prescription
- Toggle "En cours / Toutes"
- Bouton [PDF] → route PDF sécurisée

### Page `/my/factures`

- Redirect vers `/my/invoices` Odoo natif filtré sur `hospital_invoice_type in ['dialysis_session', 'dialysis_grouped']`
- Pas de duplication : portal account natif gère déjà le téléchargement PDF

---

## 7. CSS mobile-first (`portal_nephro.css`)

```css
/* Cartes résumé */
.nephro-card {
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
  margin-bottom: 1rem;
}

/* Badges KDIGO */
.badge-kdigo-normal { background: #28a745; color: #fff; }
.badge-kdigo-cible  { background: #007bff; color: #fff; }
.badge-kdigo-alert  { background: #fd7e14; color: #fff; }
.badge-kdigo-crit   { background: #dc3545; color: #fff; }

/* Nav bottom mobile */
.nephro-bottom-nav {
  position: fixed; bottom: 0; width: 100%;
  background: #fff; border-top: 1px solid #dee2e6;
  display: flex; justify-content: space-around;
  padding: .5rem 0; z-index: 1000;
}

/* Tableaux → cartes sur mobile */
@media (max-width: 767px) {
  .nephro-table-responsive td { display: block; }
  .nephro-table-responsive td::before {
    content: attr(data-label);
    font-weight: 600;
    display: block;
  }
  /* Masquer thead sur mobile */
  .nephro-table-responsive thead { display: none; }
  /* Espace pour nav bottom */
  .o_portal_wrap { padding-bottom: 70px; }
}

@media (min-width: 768px) {
  .nephro-bottom-nav { display: none; }
}
```

---

## 8. Rapport QWeb CR séance simplifié

Nouveau template `report/report_seance_portal.xml` :
- Action `action_report_seance_portal` sur `acs.patient.procedure`
- Données affichées : date, durée, UF retirée, KT/V (ou texte simplifié selon config), tolérance globale
- **Exclut** : notes internes, alertes cliniques, paramètres techniques machine
- Logo clinique en en-tête, coordonnées patient

---

## 9. Paramètres de configuration

Visibles dans **Paramètres → Hôpital → Portail patient** :

| Paramètre | Défaut | Description |
|---|---|---|
| Langage simplifié | ✓ activé | "Séance efficace" au lieu de KT/V brut |
| Afficher valeur brute | ✗ désactivé | Montre KT/V en plus du texte |

Règle d'affichage KT/V dans les templates :
- KT/V ≥ 1.2 → `✓ Séance efficace`
- KT/V < 1.2 → `⚠ Séance insuffisante`

---

## 10. Notifications

### Annulation RDV

`hms.appointment._notify_cancel_to_secretary()` :
1. Email Odoo → groupe `acs_hms_base.group_hms_receptionist`
2. WhatsApp si `acs_hms_whatsapp` installé : *"[PORTAIL] Patient X a annulé sa séance du JJ/MM. Motif : ..."*

### Invitation portail

Via wizard Odoo natif (email automatique avec lien portail) + WhatsApp optionnel.

---

## 11. Fichiers produits (récapitulatif)

| Fichier | Rôle |
|---|---|
| `controllers/portal.py` | 7 routes GET + 1 route POST |
| `models/res_config_settings.py` | 2 champs company (langage simplifié) |
| `models/hms_patient.py` | 3 champs hms.appointment + méthode notify + bouton wizard |
| `security/portal_rules.xml` | 5 ir.rule isolation données patient |
| `security/ir.model.access.csv` | Lecture portail sur 5 modèles |
| `report/report_seance_portal.xml` | CR séance simplifié QWeb |
| `templates/portal_layout.xml` | Layout + nav bottom mobile |
| `templates/portal_home.xml` | Page résumé /my |
| `templates/portal_seances.xml` | Liste + détail séances |
| `templates/portal_bilans.xml` | Bilans + Chart.js |
| `templates/portal_rdv.xml` | RDV + annulation dialog |
| `templates/portal_ordonnances.xml` | Ordonnances actives |
| `templates/portal_factures.xml` | Redirect factures |
| `views/res_config_settings_view.xml` | Section config portail |
| `static/src/css/portal_nephro.css` | CSS mobile-first |
| `__manifest__.py` | Déclaration module |

---

## 12. Contraintes techniques

- Odoo 19 — aucune migration de données
- Non-destructif vis-à-vis des modules ACS existants
- Pas de LLM, pas de CDN externe
- WhatsApp via WasenderAPI (module `acs_hms_whatsapp` existant, optionnel)
- PDFs via QWeb natif Odoo
- Chart.js via assets Odoo 19 (déjà présent, pas d'ajout de dépendance)
