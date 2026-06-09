# Design : Frais développeur fixe 200 XOF — module payment_wave

**Date :** 2026-06-09
**Statut :** Approuvé

---

## Contexte

Le module `payment_wave` intègre Wave comme fournisseur de paiement pour Odoo.
Actuellement, un frais de marge de **0,5%** est ajouté au montant facturé au client,
puis reversé via Wave Payout à un numéro interne (`+221764018767`).

Le besoin est de passer à un **frais fixe de 200 XOF** par transaction,
reversés au numéro développeur `+221777671661`.

---

## Comportement cible

Pour une facture de **1000 XOF** :

| Composant             | Calcul                         | Montant |
|-----------------------|--------------------------------|---------|
| Montant facture       | —                              | 1000 XOF |
| Frais Wave (1%)       | `math.ceil(1000 × 0.01)`       | 10 XOF  |
| Frais développeur     | **fixe**                       | 200 XOF |
| **Total client**      |                                | **1210 XOF** |

Après confirmation du paiement, le cron `_cron_process_wave_margin_payouts`
envoie exactement **200 XOF** au numéro `+221777671661` via Wave Payout API.

---

## Fichiers modifiés

### 1. `payment_wave/const.py`

Ajouter deux constantes :

```python
WAVE_DEVELOPER_FEE = 200                    # Frais fixes développeur en XOF
WAVE_DEVELOPER_MOBILE = '+221777671661'     # Numéro Wave bénéficiaire
```

### 2. `payment_wave/models/payment_transaction.py`

**Méthode `_wave_prepare_checkout_payload`** (calcul du total client) :

```python
# AVANT
margin_fee = int(base_amount * 0.005)  # 0.5% margin

# APRÈS
margin_fee = const.WAVE_DEVELOPER_FEE  # 200 XOF fixe
```

**Méthode `_cron_process_wave_margin_payouts`** (payout développeur) :

```python
# AVANT
margin_amount = int(round(base_amount * 0.005)) - (int(round(base_amount * 0.005)) * 0.03)
recipient_mobile = '+221764018767'

# APRÈS
margin_amount = const.WAVE_DEVELOPER_FEE   # 200 XOF fixe
recipient_mobile = const.WAVE_DEVELOPER_MOBILE  # +221777671661
```

**Descriptions des champs `wave_margin_payout_*`** :
Mettre à jour les `help=` pour remplacer les références à "0.5%" par "200 XOF fixe".

---

## Ce qui ne change pas

- Le calcul de la commission Wave 1% (`math.ceil(base_amount * 0.01)`) reste identique.
- Le cron s'exécute toujours toutes les 5 minutes.
- Le délai de 2 minutes avant envoi du payout reste identique.
- L'envoi WhatsApp reste identique.
- Les index SQL restent identiques.
- Le webhook, les remboursements, et la logique de validation restent identiques.

---

## Gestion d'erreur

- Si `margin_amount <= 0` : transaction marquée comme payée sans payout (garde-fou existant, reste en place).
- En cas d'échec du payout : la transaction n'est pas marquée comme envoyée, et sera retentée au prochain passage du cron.

---

## Tests à effectuer après implémentation

1. Créer une facture de 1000 XOF → vérifier que le lien Wave demande 1210 XOF.
2. Créer une facture de 500 XOF → vérifier : `math.ceil(500×0.01)` = 5 XOF + 200 = **705 XOF**.
3. Simuler un webhook `checkout.session.completed` → vérifier que le payout de 200 XOF est déclenché vers `+221777671661`.
4. Vérifier les logs : `"Wave checkout payload prepared - Base: 1000, Transaction fee: 10, Margin: 200, Total: 1210"`.
