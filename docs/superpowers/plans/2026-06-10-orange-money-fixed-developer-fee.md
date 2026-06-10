# Orange Money Fixed Developer Fee (200 XOF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la marge variable dans `payment_orange_money` par un frais fixe de 200 XOF par transaction, reversés à `+221777671661` via Orange Money Cash In.

**Architecture:** Même approche que `payment_wave` : constantes dans `const.py`, référencées dans `payment_transaction.py`. Deux points de modification : le calcul du montant facturé au client (dans `_orange_money_generate_qr_code`) et le cron payout (`_cron_process_orange_money_margin_payouts`).

**Tech Stack:** Python 3, Odoo 19, Orange Money API v4 (QR) / v1 (Cash In)

---

## Résumé des changements

Pour une facture de **1000 XOF** :

| Composant | Calcul | Montant |
|---|---|---|
| Montant facture | — | 1000 XOF |
| Frais Orange Money (1%) | `math.ceil(1000 × 0.01)` | 10 XOF |
| Frais développeur | **fixe** | 200 XOF |
| **Total client** | | **1210 XOF** |

---

## File Map

| Fichier | Action | Rôle |
|---|---|---|
| `payment_orange_money/const.py` | Modifier | Ajouter `OM_DEVELOPER_FEE` et `OM_DEVELOPER_MOBILE` |
| `payment_orange_money/models/payment_transaction.py` | Modifier | Ajouter `import math`, corriger montant QR, corriger cron payout |
| `payment_orange_money/tests/__init__.py` | Créer | Exposer le module de tests |
| `payment_orange_money/tests/test_om_fees.py` | Créer | Tests unitaires des constantes et du calcul des frais |

---

## Task 1 : Ajouter les constantes dans `const.py`

**Files:**
- Modify: `payment_orange_money/const.py`

- [ ] **Étape 1 : Ajouter les deux constantes à la fin de `payment_orange_money/const.py`**

  Ajouter après la section `WALLET_TYPE_SALAIRE` :

  ```python
  # Developer fee configuration
  OM_DEVELOPER_FEE = 200                  # Fixed developer fee in XOF per transaction
  OM_DEVELOPER_MOBILE = '+221777671661'   # Orange Money number for developer fee payouts
  ```

- [ ] **Étape 2 : Vérifier la syntaxe**

  ```bash
  python3 -c "exec(open('payment_orange_money/const.py').read()); print(OM_DEVELOPER_FEE, OM_DEVELOPER_MOBILE)"
  ```

  Résultat attendu : `200 +221777671661`

- [ ] **Étape 3 : Commit**

  ```bash
  git add payment_orange_money/const.py
  git commit -m "feat(orange_money): add OM_DEVELOPER_FEE and OM_DEVELOPER_MOBILE constants"
  ```

---

## Task 2 : Écrire les tests unitaires (TDD)

**Files:**
- Create: `payment_orange_money/tests/__init__.py`
- Create: `payment_orange_money/tests/test_om_fees.py`

- [ ] **Étape 1 : Créer `payment_orange_money/tests/__init__.py`**

  ```python
  from . import test_om_fees
  ```

- [ ] **Étape 2 : Créer `payment_orange_money/tests/test_om_fees.py`**

  ```python
  # Part of Odoo. See LICENSE file for full copyright and licensing details.

  import math
  from odoo.tests.common import BaseCase
  from odoo.addons.payment_orange_money import const


  class TestOrangeMoneyFeeConstants(BaseCase):
      """Tests for Orange Money fixed developer fee constants."""

      def test_developer_fee_is_200(self):
          """OM_DEVELOPER_FEE must be exactly 200 XOF."""
          self.assertEqual(const.OM_DEVELOPER_FEE, 200)

      def test_developer_mobile_is_correct(self):
          """OM_DEVELOPER_MOBILE must be the developer's Orange Money number."""
          self.assertEqual(const.OM_DEVELOPER_MOBILE, '+221777671661')

      def test_total_amount_1000_xof(self):
          """For a 1000 XOF invoice: om fee=10, dev fee=200, total=1210."""
          base = 1000
          om_fee = math.ceil(base * 0.01)       # 10
          dev_fee = const.OM_DEVELOPER_FEE       # 200
          total = base + om_fee + dev_fee
          self.assertEqual(om_fee, 10)
          self.assertEqual(dev_fee, 200)
          self.assertEqual(total, 1210)

      def test_total_amount_500_xof(self):
          """For a 500 XOF invoice: om fee=5, dev fee=200, total=705."""
          base = 500
          om_fee = math.ceil(base * 0.01)       # 5
          dev_fee = const.OM_DEVELOPER_FEE       # 200
          total = base + om_fee + dev_fee
          self.assertEqual(om_fee, 5)
          self.assertEqual(total, 705)

      def test_total_amount_99_xof(self):
          """For a 99 XOF invoice: om fee=ceil(0.99)=1, dev fee=200, total=300."""
          base = 99
          om_fee = math.ceil(base * 0.01)       # ceil(0.99) = 1
          dev_fee = const.OM_DEVELOPER_FEE       # 200
          total = base + om_fee + dev_fee
          self.assertEqual(om_fee, 1)
          self.assertEqual(total, 300)

      def test_developer_fee_is_fixed_regardless_of_amount(self):
          """Developer fee must never depend on the transaction amount."""
          for base in [100, 500, 1000, 5000, 100000]:
              self.assertEqual(
                  const.OM_DEVELOPER_FEE,
                  200,
                  msg=f"Developer fee must be 200 for any base amount (tested: {base})"
              )
  ```

- [ ] **Étape 3 : Vérifier la syntaxe**

  ```bash
  python3 -m py_compile payment_orange_money/tests/__init__.py && echo "__init__ OK"
  python3 -m py_compile payment_orange_money/tests/test_om_fees.py && echo "test_om_fees OK"
  ```

- [ ] **Étape 4 : Commit**

  ```bash
  git add payment_orange_money/tests/__init__.py payment_orange_money/tests/test_om_fees.py
  git commit -m "test(orange_money): add unit tests for fixed 200 XOF developer fee"
  ```

---

## Task 3 : Corriger le montant facturé dans `_orange_money_generate_qr_code`

**Files:**
- Modify: `payment_orange_money/models/payment_transaction.py`

- [ ] **Étape 1 : Ajouter `import math` en haut du fichier**

  Les imports actuels commencent ainsi :
  ```python
  import logging
  import uuid
  from datetime import datetime, timedelta, timezone
  ```

  Ajouter `import math` à la deuxième ligne :
  ```python
  import logging
  import math
  import uuid
  from datetime import datetime, timedelta, timezone
  ```

- [ ] **Étape 2 : Localiser la ligne du montant dans `_orange_money_generate_qr_code` (~ligne 120)**

  Avant :
  ```python
              'amount': {
                  'value': int(int(self.amount)+(int(self.amount)* 0.015)),
                  'unit': self.currency_id.name
              },
  ```

  Après :
  ```python
              'amount': {
                  'value': int(self.amount) + math.ceil(int(self.amount) * 0.01) + const.OM_DEVELOPER_FEE,
                  'unit': self.currency_id.name
              },
  ```

- [ ] **Étape 3 : Ajouter un log informatif juste avant le `try:` (~ligne 135)**

  Trouver la ligne `try:` qui suit `_logger.info("payload : %s", payload)`. Remplacer le log existant :

  Avant :
  ```python
          _logger.info("payload : %s", payload)
  ```

  Après :
  ```python
          base_amount = int(self.amount)
          om_fee = math.ceil(base_amount * 0.01)
          _logger.info(
              "Orange Money QR payload - Base: %s XOF, OM fee (1%%): %s XOF, "
              "Developer fee (fixed): %s XOF, Total: %s XOF",
              base_amount, om_fee, const.OM_DEVELOPER_FEE, base_amount + om_fee + const.OM_DEVELOPER_FEE
          )
  ```

- [ ] **Étape 4 : Vérifier la syntaxe**

  ```bash
  python3 -m py_compile payment_orange_money/models/payment_transaction.py && echo "OK"
  ```

- [ ] **Étape 5 : Commit**

  ```bash
  git add payment_orange_money/models/payment_transaction.py
  git commit -m "feat(orange_money): replace 1.5% flat fee with 1% + 200 XOF fixed developer fee in QR payload"
  ```

---

## Task 4 : Corriger `_cron_process_orange_money_margin_payouts`

**Files:**
- Modify: `payment_orange_money/models/payment_transaction.py`

- [ ] **Étape 1 : Localiser le bloc à modifier dans `_cron_process_orange_money_margin_payouts` (~ligne 557)**

  Trouver ce bloc :
  ```python
          for tx in pending_payouts:
              try:
                  # Calculate  margin amount (same as Wave)
                  base_amount = int(tx.amount)
                  margin_amount = int(round(base_amount * 0.01) + 100)  # 0.5% margin minus 3% fees

                  if margin_amount <= 0:
                      _logger.warning(
                          "Margin amount too small for transaction %s (amount: %s)",
                          tx.reference, base_amount
                      )
                      tx.orange_money_margin_payout_sent = True
                      continue

                  # Send payout to +221764018767 (same recipient as Wave)
                  recipient_mobile = '221777671661'
                  recipient_name = 'Autres frais'
  ```

- [ ] **Étape 2 : Remplacer par le nouveau bloc**

  ```python
          for tx in pending_payouts:
              try:
                  # Fixed 200 XOF developer fee
                  margin_amount = const.OM_DEVELOPER_FEE  # 200 XOF fixed

                  if margin_amount <= 0:
                      _logger.warning(
                          "Developer fee is zero for transaction %s, skipping payout",
                          tx.reference
                      )
                      tx.orange_money_margin_payout_sent = True
                      continue

                  # Send payout to developer's Orange Money number
                  recipient_mobile = const.OM_DEVELOPER_MOBILE  # +221777671661
                  recipient_name = 'Frais développeur'
  ```

- [ ] **Étape 3 : Mettre à jour le log de confirmation (~ligne 595)**

  Avant :
  ```python
                  _logger.info(
                      "Margin payout sent for transaction %s - Amount: %s, Payout ID: %s",
                      tx.reference, margin_amount, payout_data.get('transactionId')
                  )
  ```

  Après :
  ```python
                  _logger.info(
                      "Developer fee payout sent for transaction %s - Amount: %s XOF, "
                      "Recipient: %s, Payout ID: %s",
                      tx.reference, margin_amount, recipient_mobile, payout_data.get('transactionId')
                  )
  ```

- [ ] **Étape 4 : Vérifier la syntaxe**

  ```bash
  python3 -m py_compile payment_orange_money/models/payment_transaction.py && echo "OK"
  ```

- [ ] **Étape 5 : Commit**

  ```bash
  git add payment_orange_money/models/payment_transaction.py
  git commit -m "feat(orange_money): send fixed 200 XOF developer fee to +221777671661 in payout cron"
  ```

---

## Task 5 : Mettre à jour les descriptions des champs et docstrings

**Files:**
- Modify: `payment_orange_money/models/payment_transaction.py`

- [ ] **Étape 1 : Mettre à jour les 3 champs `orange_money_margin_payout_*` (~lignes 45-60)**

  Avant :
  ```python
      orange_money_margin_payout_scheduled = fields.Datetime(
          string="Margin Payout Scheduled At",
          help="The date and time when the 0.5% margin payout is scheduled",
          readonly=True,
      )
      orange_money_margin_payout_sent = fields.Boolean(
          string="Margin Payout Sent",
          help="Whether the 0.5% margin payout has been sent",
          default=False,
          readonly=True,
      )
      orange_money_margin_payout_id = fields.Char(
          string="Margin Payout Transaction ID",
          help="The transaction ID returned by Orange Money for the margin payout",
          readonly=True,
      )
  ```

  Après :
  ```python
      orange_money_margin_payout_scheduled = fields.Datetime(
          string="Developer Fee Payout Scheduled At",
          help="The date and time when the 200 XOF fixed developer fee payout is scheduled",
          readonly=True,
      )
      orange_money_margin_payout_sent = fields.Boolean(
          string="Developer Fee Payout Sent",
          help="Whether the 200 XOF fixed developer fee payout has been sent to +221777671661",
          default=False,
          readonly=True,
      )
      orange_money_margin_payout_id = fields.Char(
          string="Developer Fee Payout Transaction ID",
          help="The transaction ID returned by Orange Money for the 200 XOF developer fee payout",
          readonly=True,
      )
  ```

- [ ] **Étape 2 : Mettre à jour la docstring du cron (~ligne 537)**

  Avant :
  ```python
      """Cron job to process pending Orange Money margin payouts.

      This method is called periodically to check for transactions that have
      a scheduled margin payout time in the past and sends the 0.5% payout.
      """
  ```

  Après :
  ```python
      """Cron job to process pending Orange Money developer fee payouts.

      This method is called periodically to check for transactions that have
      a scheduled payout time in the past and sends the fixed 200 XOF developer fee.
      """
  ```

- [ ] **Étape 3 : Mettre à jour le log de `_orange_money_handle_status` (~ligne 421)**

  Avant :
  ```python
          _logger.info(
              "Orange Money payment succeeded - Margin payout scheduled for %s (Tx: %s)",
              scheduled_time, self.reference
          )
  ```

  Après :
  ```python
          _logger.info(
              "Orange Money payment succeeded - Developer fee payout scheduled for %s (Tx: %s)",
              scheduled_time, self.reference
          )
  ```

- [ ] **Étape 4 : Vérifier la syntaxe**

  ```bash
  python3 -m py_compile payment_orange_money/models/payment_transaction.py && echo "OK"
  ```

- [ ] **Étape 5 : Commit**

  ```bash
  git add payment_orange_money/models/payment_transaction.py
  git commit -m "refactor(orange_money): update field labels, help texts and docstrings to reflect 200 XOF fixed developer fee"
  ```

---

## Task 6 : Vérification finale

- [ ] **Étape 1 : Syntaxe de tous les fichiers modifiés**

  ```bash
  python3 -m py_compile payment_orange_money/const.py && echo "const.py OK"
  python3 -m py_compile payment_orange_money/models/payment_transaction.py && echo "payment_transaction.py OK"
  python3 -m py_compile payment_orange_money/tests/__init__.py && echo "tests/__init__.py OK"
  python3 -m py_compile payment_orange_money/tests/test_om_fees.py && echo "test_om_fees.py OK"
  ```

- [ ] **Étape 2 : Aucune référence obsolète**

  ```bash
  grep -rn "0\.015\|0\.5%\|0\.005\|0\.01.*100\|221764018767" payment_orange_money/ --include="*.py"
  ```

  Résultat attendu : aucune ligne (zéro match dans les fichiers Python).

- [ ] **Étape 3 : Les nouvelles constantes sont utilisées**

  ```bash
  grep -rn "OM_DEVELOPER_FEE\|OM_DEVELOPER_MOBILE" payment_orange_money/ --include="*.py"
  ```

  Résultat attendu : entrées dans `const.py` (définitions), `payment_transaction.py` (usages), `test_om_fees.py` (tests).

- [ ] **Étape 4 : Git log de la feature**

  ```bash
  git log --oneline 3bf37ee..HEAD
  ```

  Résultat attendu : 5 commits (Tasks 1-5).
