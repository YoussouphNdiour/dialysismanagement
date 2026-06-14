# Spec : Notifications WhatsApp bilans critiques

**Date :** 2026-06-14
**Module cible :** `acs_hms_nephrology_whatsapp` (nouveau module)
**Périmètre :** Alerte automatique au médecin référent via WhatsApp quand un bilan dépasse les seuils critiques

---

## Contexte

Le module `acs_hms_nephrology_bilans` gère les bilans biologiques des patients dialysés. Il existe déjà un cron hebdomadaire qui envoie un **email** au médecin quand l'hémoglobine est basse sur 2 bilans consécutifs. Il n'y a aucune notification WhatsApp.

Le module `acs_hms_whatsapp` fournit l'infrastructure complète pour envoyer des messages WhatsApp via WasenderApi (credentials dans `ir.config_parameter`).

**Objectif :** Ajouter un canal WhatsApp pour les alertes critiques (Hb basse, K élevé, P élevé) sans modifier les modules existants.

---

## Architecture

Nouveau module `acs_hms_nephrology_whatsapp` :

- **Dépend de :** `acs_hms_nephrology_bilans`, `acs_hms_whatsapp`
- **Pattern :** `_inherit = 'acs.nephro.bilan'` pour ajouter la méthode cron sur le modèle existant
- **Aucun nouveau modèle** — utilise `whatsapp.message` (déjà dans `acs_hms_whatsapp`)
- **Isolation totale :** désactiver ce module ne touche pas aux bilans ni à l'email

```
acs_hms_nephrology_whatsapp/
├── __init__.py
├── __manifest__.py
├── models/
│   ├── __init__.py
│   └── bilan_alert.py        # _inherit acs.nephro.bilan, cron WhatsApp
├── data/
│   └── cron_data.xml         # cron quotidien 07h00
├── tests/
│   ├── __init__.py
│   └── test_bilan_whatsapp_alert.py
└── security/
    └── ir.model.access.csv   # aucun nouveau modèle — fichier minimal requis
```

---

## Logique d'alerte

### Seuils

| Paramètre | Seuil | Condition déclenchante |
|---|---|---|
| Hémoglobine (Hb) | < 10.0 g/dL | 2 derniers bilans avec Hb > 0 ont tous les deux `hemoglobin_status = 'low'` |
| Potassium (K) | > 5.5 mmol/L | Dernier bilan avec K > 0 a `potassium_status = 'high'` |
| Phosphore (P) | > 1.8 mmol/L | 2 derniers bilans avec P > 0 ont tous les deux `phosphorus_status = 'high'` |

### Déclencheur

Cron quotidien à 07h00 (`ir.cron`, `active=True`), méthode `_cron_whatsapp_bilans_alerts()`.

### Algorithme

```
Vérifier acs_hms_whatsapp.enabled en ir.config_parameter
  Si False → log warning "WhatsApp désactivé, alertes bilans ignorées" → return 0

Pour chaque patient néphro actif (nephrology_care=True, active=True) :
  Si patient.primary_physician_id est vide → skip
  Si physician.partner_id.mobile ET physician.partner_id.phone sont vides → skip (log debug)

  Pour chaque type d'alerte (Hb, K, P) :
    Vérifier la condition clinique (voir seuils)
    Si condition non remplie → skip
    Si message WhatsApp déjà envoyé (état sent/sending) pour ce patient+type dans les 7 derniers jours → skip (dédup)
    Sinon → créer whatsapp.message + appeler action_send_message()
             logger warning si UserError ou Exception (ne pas faire planter le cron)

Retourner le nombre total de messages envoyés
```

### Déduplication

Recherche d'un `whatsapp.message` avec :
- `model = 'hms.patient'`
- `res_id = patient.id`
- `message_text ilike '[ALERTE_K]'` (ou `[ALERTE_Hb]` / `[ALERTE_P]`)
- `state in ('sent', 'sending')`
- `create_date >= now() - 7 jours`

Chaque message contient un tag invisible `[ALERTE_K]` en fin de texte pour permettre la recherche.

---

## Format des messages

### Alerte Potassium (K > 5.5 — 1 bilan)

```
⚠️ ALERTE BIOLOGIQUE — As-Shafi Medical

Patient : {patient.name}
Médecin : Dr. {physician.name}

🔴 Potassium élevé
  Bilan {bilan.name} ({date}) : K = {valeur} mmol/L
  Seuil : > 5.5 mmol/L

Veuillez vérifier et ajuster le traitement.

[ALERTE_K]
```

### Alerte Hémoglobine (Hb < 10 — 2 bilans consécutifs)

```
⚠️ ALERTE BIOLOGIQUE — As-Shafi Medical

Patient : {patient.name}
Médecin : Dr. {physician.name}

🔴 Hémoglobine basse (2 bilans consécutifs)
  Bilan {b1.name} ({date1}) : Hb = {val1} g/dL
  Bilan {b2.name} ({date2}) : Hb = {val2} g/dL
  Seuil KDIGO : 10–12 g/dL

Veuillez vérifier et ajuster le traitement.

[ALERTE_Hb]
```

### Alerte Phosphore (P > 1.8 — 2 bilans consécutifs)

```
⚠️ ALERTE BIOLOGIQUE — As-Shafi Medical

Patient : {patient.name}
Médecin : Dr. {physician.name}

🔴 Phosphore élevé (2 bilans consécutifs)
  Bilan {b1.name} ({date1}) : P = {val1} mmol/L
  Bilan {b2.name} ({date2}) : P = {val2} mmol/L
  Seuil : ≤ 1.8 mmol/L

Veuillez vérifier et ajuster le traitement.

[ALERTE_P]
```

---

## Gestion d'erreurs

| Situation | Comportement |
|---|---|
| `acs_hms_whatsapp.enabled = False` | Log warning, cron retourne 0, pas d'exception |
| `acs_hms_whatsapp.api_key` vide | UserError attrapée, log warning, continue |
| Médecin sans téléphone | Skip silencieux (log debug), continue |
| Erreur réseau API | Log warning pour ce patient, continue les autres |
| Exception inattendue | Log error pour ce patient, continue les autres |

Le cron ne lève jamais d'exception non attrapée — il est tolérant aux pannes individuelles.

---

## Envoi via whatsapp.message

```python
phone = physician.partner_id.mobile or physician.partner_id.phone
msg = self.env['whatsapp.message'].sudo().create({
    'recipient_phone': phone,
    'message_type': 'text',
    'message_text': text,          # texte avec tag [ALERTE_X] inclus
    'model': 'hms.patient',
    'res_id': patient.id,
})
try:
    msg.action_send_message()
    count += 1
except Exception as e:
    _logger.warning('WhatsApp alerte %s patient %s : %s', alert_type, patient.name, e)
```

---

## Tests unitaires

Fichier : `tests/test_bilan_whatsapp_alert.py`, classe `TestBilanWhatsappAlert(TransactionCase)`

`action_send_message` est **monkeypatché** (ne pas appeler l'API réelle) :

```python
def setUp(self):
    super().setUp()
    # Activer WhatsApp dans les paramètres
    ICP = self.env['ir.config_parameter'].sudo()
    ICP.set_param('acs_hms_whatsapp.enabled', 'True')
    ICP.set_param('acs_hms_whatsapp.api_key', 'test_key')
    # Patcher action_send_message pour ne pas appeler l'API
    self.env['whatsapp.message']._patch_method(
        'action_send_message', lambda self: self.write({'state': 'sent'})
    )
```

| Test | Scénario | Résultat attendu |
|---|---|---|
| `test_k_alert_single_bilan` | K = 5.8 sur dernier bilan | 1 `whatsapp.message` créé avec `[ALERTE_K]` |
| `test_k_no_alert_normal` | K = 4.5 | 0 message |
| `test_hb_alert_two_consecutive` | 2 bilans Hb = 9.5 et 9.8 | 1 message avec `[ALERTE_Hb]` |
| `test_hb_no_alert_one_low_bilan` | 1 bilan Hb < 10, l'autre Hb = 11 | 0 message |
| `test_p_alert_two_consecutive` | 2 bilans P = 1.9 et 2.1 | 1 message avec `[ALERTE_P]` |
| `test_dedup_no_resend` | Alerte K déjà envoyée il y a 3 jours | 0 nouveau message |
| `test_dedup_resend_after_7_days` | Alerte K envoyée il y a 8 jours | 1 nouveau message |
| `test_no_physician_skip` | Patient sans primary_physician_id | 0 message, pas d'exception |
| `test_no_phone_skip` | Médecin sans mobile ni phone | 0 message, pas d'exception |
| `test_whatsapp_disabled_skip` | `enabled=False` | cron retourne 0, pas d'exception |

---

## Critères d'acceptance

1. Le cron `_cron_whatsapp_bilans_alerts` tourne quotidiennement à 07h00
2. Un WhatsApp est envoyé au médecin référent quand K > 5.5 sur le dernier bilan
3. Un WhatsApp est envoyé quand Hb < 10 sur 2 bilans consécutifs
4. Un WhatsApp est envoyé quand P > 1.8 sur 2 bilans consécutifs
5. Aucun doublon dans les 7 jours pour le même patient + même type d'alerte
6. Le cron ne plante pas si WhatsApp est désactivé ou si un patient n'a pas de médecin
7. Les 10 tests unitaires passent

---

## Hors périmètre

- Notification au patient lui-même (uniquement le médecin)
- Alertes pour albumine, PTH, CaxP (ajout possible ultérieurement)
- Acquittement des alertes depuis WhatsApp (webhook entrant)
- Interface UI pour paramétrer les seuils (seuils codés en dur, identiques à `_compute_statuses`)
