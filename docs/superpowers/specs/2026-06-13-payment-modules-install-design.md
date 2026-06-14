# Spec : Installation payment_orange_money + payment_wave

**Date :** 2026-06-13  
**Périmètre :** Smoke test — installation des modules sans credentials API  
**Approche :** `odoo -i` (flag install au démarrage)

---

## Contexte

Deux modules de paiement sont présents dans `as shafi/` mais non installés en DB :

| Module | Dépendances | Version | Auteur |
|---|---|---|---|
| `payment_orange_money` | `payment` | 1.1 | Odoo S.A. |
| `payment_wave` | `payment` | 1.0 | Youssouph NDIOUR |

Le module `payment` est déjà installé (state=installed). La bibliothèque Python `cryptography` (requise par `payment_orange_money`) est disponible dans le venv Odoo 19 (v42.0.8).

---

## Objectif

Installer les deux modules via `odoo -i` et vérifier qu'ils s'affichent correctement dans Odoo sans erreur. **Pas de configuration de credentials API — les providers restent en état `disabled`.**

---

## Séquence d'installation

```
1. Arrêter Odoo (pkill)
2. Relancer avec -i payment_orange_money,payment_wave
3. Vérifier le log : aucune ERROR ni WARNING critique
4. Vérifier en DB : state = 'installed' pour les deux
5. Vérifier HTTP : /web/health → 200
6. Vérifier UI : fournisseurs visibles dans Comptabilité > Configuration > Fournisseurs de paiement
```

---

## Fichiers modifiés

Aucun fichier modifié — installation pure. En cas d'erreur, on corrige les fichiers incriminés.

---

## Critères d'acceptance

1. `ir_module_module.state = 'installed'` pour `payment_orange_money` ET `payment_wave`
2. Aucune `ERROR` dans `/tmp/odoo.log` pendant l'installation
3. `GET /web/health` → HTTP 200 après démarrage
4. Les deux fournisseurs apparaissent dans la liste des payment providers Odoo (UI backend)
5. Les providers sont en état `disabled` (pas activés accidentellement)

---

## Risques & mitigations

| Risque | Probabilité | Mitigation |
|---|---|---|
| Erreur XML data (`post_init_hook`) | Faible | Lire le log, corriger le XML incriminé |
| Dépendance Python manquante | Très faible | `cryptography` déjà vérifiée dans le venv |
| Conflit champ `code` sur `payment.provider` | Faible | Les deux modules utilisent `selection_add` — pattern standard Odoo |
| Module dans le mauvais addons-path | Nulle | `as shafi/` est dans l'addons-path |

---

## Hors périmètre

- Configuration credentials Orange Money (Client ID, Secret, Merchant Code, PIN)
- Configuration credentials Wave (API Key, Webhook Secret)
- Test de paiement bout-en-bout
- Mise en production
