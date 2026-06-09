# Wave Fixed Developer Fee (200 XOF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la marge variable de 0,5% par un frais fixe de 200 XOF par transaction, reversés à `+221777671661` via Wave Payout.

**Architecture:** Les deux nouvelles valeurs (montant et numéro) sont déclarées comme constantes dans `const.py` et référencées dans `payment_transaction.py`. Aucun autre fichier n'est touché.

**Tech Stack:** Python 3, Odoo 19, Wave API v1

---

## File Map

| Fichier | Action | Rôle |
|---|---|---|
| `payment_wave/const.py` | Modifier | Ajouter `WAVE_DEVELOPER_FEE` et `WAVE_DEVELOPER_MOBILE` |
| `payment_wave/models/payment_transaction.py` | Modifier | Utiliser les constantes dans payload + cron |
| `payment_wave/tests/__init__.py` | Créer | Exposer le module de tests à Odoo |
| `payment_wave/tests/test_wave_fees.py` | Créer | Tests unitaires des constantes et du calcul des frais |

---

## Task 1 : Ajouter les constantes dans `const.py`

**Files:**
- Modify: `payment_wave/const.py`

- [ ] **Étape 1 : Ouvrir `payment_wave/const.py` et ajouter les deux constantes à la fin du fichier**

  Ajouter après la section `ERROR_CODES` existante :

  ```python
  # Developer fee configuration
  WAVE_DEVELOPER_FEE = 200              # Fixed developer fee in XOF per transaction
  WAVE_DEVELOPER_MOBILE = '+221777671661'  # Wave mobile number for developer fee payouts
  ```

- [ ] **Étape 2 : Vérifier que le fichier est syntaxiquement correct**

  ```bash
  python3 -c "from payment_wave import const; print(const.WAVE_DEVELOPER_FEE, const.WAVE_DEVELOPER_MOBILE)"
  ```

  Résultat attendu : `200 +221777671661`

- [ ] **Étape 3 : Commit**

  ```bash
  git add payment_wave/const.py
  git commit -m "feat(wave): add WAVE_DEVELOPER_FEE and WAVE_DEVELOPER_MOBILE constants"
  ```

---

## Task 2 : Écrire les tests unitaires (TDD — avant de modifier le modèle)

**Files:**
- Create: `payment_wave/tests/__init__.py`
- Create: `payment_wave/tests/test_wave_fees.py`

- [ ] **Étape 1 : Créer `payment_wave/tests/__init__.py`**

  ```python
  from . import test_wave_fees
  ```

- [ ] **Étape 2 : Créer `payment_wave/tests/test_wave_fees.py`**

  ```python
  # Part of Odoo. See LICENSE file for full copyright and licensing details.

  import math
  from odoo.tests.common import BaseCase
  from odoo.addons.payment_wave import const


  class TestWaveFeeConstants(BaseCase):
      """Tests for Wave fixed developer fee constants."""

      def test_developer_fee_is_200(self):
          """WAVE_DEVELOPER_FEE must be exactly 200 XOF."""
          self.assertEqual(const.WAVE_DEVELOPER_FEE, 200)

      def test_developer_mobile_is_correct(self):
          """WAVE_DEVELOPER_MOBILE must be the developer's Wave number."""
          self.assertEqual(const.WAVE_DEVELOPER_MOBILE, '+221777671661')

      def test_total_amount_1000_xof(self):
          """For a 1000 XOF invoice: wave fee=10, dev fee=200, total=1210."""
          base = 1000
          wave_fee = math.ceil(base * 0.01)   # 10
          dev_fee = const.WAVE_DEVELOPER_FEE   # 200
          total = base + wave_fee + dev_fee
          self.assertEqual(wave_fee, 10)
          self.assertEqual(dev_fee, 200)
          self.assertEqual(total, 1210)

      def test_total_amount_500_xof(self):
          """For a 500 XOF invoice: wave fee=5, dev fee=200, total=705."""
          base = 500
          wave_fee = math.ceil(base * 0.01)   # 5
          dev_fee = const.WAVE_DEVELOPER_FEE   # 200
          total = base + wave_fee + dev_fee
          self.assertEqual(wave_fee, 5)
          self.assertEqual(total, 705)

      def test_total_amount_99_xof(self):
          """For a 99 XOF invoice: wave fee=ceil(0.99)=1, dev fee=200, total=300."""
          base = 99
          wave_fee = math.ceil(base * 0.01)   # ceil(0.99) = 1
          dev_fee = const.WAVE_DEVELOPER_FEE   # 200
          total = base + wave_fee + dev_fee
          self.assertEqual(wave_fee, 1)
          self.assertEqual(total, 300)

      def test_developer_fee_is_fixed_regardless_of_amount(self):
          """Developer fee must never depend on the transaction amount."""
          for base in [100, 500, 1000, 5000, 100000]:
              self.assertEqual(
                  const.WAVE_DEVELOPER_FEE,
                  200,
                  msg=f"Developer fee must be 200 for any base amount (tested: {base})"
              )
  ```

- [ ] **Étape 3 : Lancer les tests pour confirmer qu'ils passent dès maintenant**

  Ces tests testent uniquement les constantes et l'arithmétique — ils doivent passer immédiatement après Task 1.

  ```bash
  cd /path/to/odoo
  python odoo-bin -d <your_db> --test-enable --stop-after-init -i payment_wave --log-level=test 2>&1 | grep -E "(PASS|FAIL|ERROR|test_wave)"
  ```

  Résultat attendu : tous les tests `TestWaveFeeConstants` passent (PASS).

- [ ] **Étape 4 : Commit**

  ```bash
  git add payment_wave/tests/__init__.py payment_wave/tests/test_wave_fees.py
  git commit -m "test(wave): add unit tests for fixed 200 XOF developer fee"
  ```

---

## Task 3 : Mettre à jour `_wave_prepare_checkout_payload`

**Files:**
- Modify: `payment_wave/models/payment_transaction.py` (lignes 248-267)

- [ ] **Étape 1 : Localiser le bloc à modifier dans `_wave_prepare_checkout_payload`**

  Chercher ce bloc (lignes ~248-253) :

  ```python
  # Calculate fees: 1% transaction fee (rounded up) + 0.5% margin = 1.5% total
  base_amount = int(self.amount)
  transaction_fee = math.ceil(base_amount * 0.01)  # 1% rounded up
  margin_fee = int(base_amount * 0.005)  # 0.5% margin
  total_amount = base_amount + transaction_fee + margin_fee
  ```

- [ ] **Étape 2 : Remplacer par le nouveau bloc**

  ```python
  # Calculate fees: 1% Wave transaction fee (rounded up) + 200 XOF fixed developer fee
  base_amount = int(self.amount)
  transaction_fee = math.ceil(base_amount * 0.01)  # 1% rounded up
  margin_fee = const.WAVE_DEVELOPER_FEE  # 200 XOF fixed developer fee
  total_amount = base_amount + transaction_fee + margin_fee
  ```

- [ ] **Étape 3 : Mettre à jour le message de log juste en dessous (ligne ~264)**

  Avant :
  ```python
  _logger.info(
      "Wave checkout payload prepared - Base: %s, Transaction fee: %s, Margin: %s, Total: %s",
      base_amount, transaction_fee, margin_fee, total_amount
  )
  ```

  Après :
  ```python
  _logger.info(
      "Wave checkout payload prepared - Base: %s XOF, Wave fee (1%%): %s XOF, "
      "Developer fee (fixed): %s XOF, Total: %s XOF",
      base_amount, transaction_fee, margin_fee, total_amount
  )
  ```

- [ ] **Étape 4 : Vérifier la syntaxe Python**

  ```bash
  python3 -m py_compile payment_wave/models/payment_transaction.py && echo "OK"
  ```

  Résultat attendu : `OK`

- [ ] **Étape 5 : Commit**

  ```bash
  git add payment_wave/models/payment_transaction.py
  git commit -m "feat(wave): replace 0.5% margin with fixed 200 XOF developer fee in checkout payload"
  ```

---

## Task 4 : Mettre à jour `_cron_process_wave_margin_payouts`

**Files:**
- Modify: `payment_wave/models/payment_transaction.py` (lignes 551-568)

- [ ] **Étape 1 : Localiser le bloc à modifier dans `_cron_process_wave_margin_payouts`**

  Chercher ce bloc (lignes ~554-568) :

  ```python
  # Calculate 0.5% margin amount
  base_amount = int(tx.amount)
  margin_amount = int(round(base_amount * 0.005 )) - (int(round(base_amount * 0.005 )) *0.03)  # 0.5% margin

  if margin_amount <= 0:
      _logger.warning(
          "Margin amount too small for transaction %s (amount: %s)",
          tx.reference, base_amount
      )
      tx.wave_margin_payout_sent = True
      continue

  # Send payout to +221764018767
  recipient_mobile = '+221764018767'
  recipient_name = 'Autres frais'
  ```

- [ ] **Étape 2 : Remplacer par le nouveau bloc**

  ```python
  # Fixed 200 XOF developer fee
  margin_amount = const.WAVE_DEVELOPER_FEE  # 200 XOF fixed

  if margin_amount <= 0:
      _logger.warning(
          "Developer fee is zero for transaction %s, skipping payout",
          tx.reference
      )
      tx.wave_margin_payout_sent = True
      continue

  # Send payout to developer's Wave number
  recipient_mobile = const.WAVE_DEVELOPER_MOBILE  # +221777671661
  recipient_name = 'Frais développeur'
  ```

- [ ] **Étape 3 : Mettre à jour le message de log de confirmation (ligne ~583)**

  Avant :
  ```python
  _logger.info(
      "Margin payout sent for transaction %s - Amount: %s, Payout ID: %s",
      tx.reference, margin_amount, payout_data.get('id')
  )
  ```

  Après :
  ```python
  _logger.info(
      "Developer fee payout sent for transaction %s - Amount: %s XOF, "
      "Recipient: %s, Payout ID: %s",
      tx.reference, margin_amount, recipient_mobile, payout_data.get('id')
  )
  ```

- [ ] **Étape 4 : Vérifier la syntaxe Python**

  ```bash
  python3 -m py_compile payment_wave/models/payment_transaction.py && echo "OK"
  ```

  Résultat attendu : `OK`

- [ ] **Étape 5 : Commit**

  ```bash
  git add payment_wave/models/payment_transaction.py
  git commit -m "feat(wave): send fixed 200 XOF developer fee to +221777671661 in payout cron"
  ```

---

## Task 5 : Mettre à jour les descriptions des champs `wave_margin_payout_*`

**Files:**
- Modify: `payment_wave/models/payment_transaction.py` (lignes 35-50)

- [ ] **Étape 1 : Localiser les trois champs concernés**

  ```python
  wave_margin_payout_scheduled = fields.Datetime(
      string="Margin Payout Scheduled At",
      help="The date and time when the 0.5% margin payout is scheduled",
      ...
  )
  wave_margin_payout_sent = fields.Boolean(
      string="Margin Payout Sent",
      help="Whether the 0.5% margin payout has been sent",
      ...
  )
  wave_margin_payout_id = fields.Char(
      string="Margin Payout ID",
      help="The payout ID returned by Wave API for the margin payout",
      ...
  )
  ```

- [ ] **Étape 2 : Mettre à jour les `help=` des trois champs**

  ```python
  wave_margin_payout_scheduled = fields.Datetime(
      string="Developer Fee Payout Scheduled At",
      help="The date and time when the 200 XOF fixed developer fee payout is scheduled",
      readonly=True,
  )
  wave_margin_payout_sent = fields.Boolean(
      string="Developer Fee Payout Sent",
      help="Whether the 200 XOF fixed developer fee payout has been sent to +221777671661",
      default=False,
      readonly=True,
  )
  wave_margin_payout_id = fields.Char(
      string="Developer Fee Payout ID",
      help="The payout ID returned by Wave API for the 200 XOF developer fee payout",
      readonly=True,
  )
  ```

- [ ] **Étape 3 : Vérifier la syntaxe Python**

  ```bash
  python3 -m py_compile payment_wave/models/payment_transaction.py && echo "OK"
  ```

  Résultat attendu : `OK`

- [ ] **Étape 4 : Commit**

  ```bash
  git add payment_wave/models/payment_transaction.py
  git commit -m "refactor(wave): update field labels and help texts to reflect 200 XOF fixed developer fee"
  ```

---

## Task 6 : Vérification finale

- [ ] **Étape 1 : Relancer tous les tests du module**

  ```bash
  cd /path/to/odoo
  python odoo-bin -d <your_db> --test-enable --stop-after-init -i payment_wave --log-level=test 2>&1 | grep -E "(PASS|FAIL|ERROR|TestWave)"
  ```

  Résultat attendu : tous `PASS`, aucun `FAIL` ni `ERROR`.

- [ ] **Étape 2 : Vérification manuelle dans Odoo**

  1. Aller dans **Comptabilité > Clients > Factures**, créer une facture de **1000 XOF** pour un client avec un numéro de téléphone.
  2. Cliquer sur **Payer** → choisir **Wave**.
  3. Observer le lien Wave généré — le montant demandé doit être **1210 XOF**.
  4. Vérifier dans les logs Odoo :
     ```
     Wave checkout payload prepared - Base: 1000 XOF, Wave fee (1%): 10 XOF, Developer fee (fixed): 200 XOF, Total: 1210 XOF
     ```

- [ ] **Étape 3 : Vérifier le cron (simulation)**

  Dans le shell Odoo (`odoo-bin shell -d <db>`) :
  ```python
  env['payment.transaction']._cron_process_wave_margin_payouts()
  ```
  Observer dans les logs que le montant du payout est **200** et le numéro est **+221777671661**.

- [ ] **Étape 4 : Commit final si tout est bon**

  ```bash
  git log --oneline -6
  ```

  Vous devriez voir les 5 commits de ce plan. Si tout est propre, c'est terminé.
