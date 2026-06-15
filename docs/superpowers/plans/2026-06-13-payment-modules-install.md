# Payment Modules Install — Smoke Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installer `payment_orange_money` et `payment_wave` via `odoo -i` et vérifier qu'ils s'affichent correctement dans Odoo sans erreur, providers en état `disabled`.

**Architecture:** Installation pure sans modification de code. Le module `payment` (dépendance commune) est déjà installé. Les deux modules utilisent `selection_add` sur `payment.provider.code` — pattern standard Odoo, aucun conflit attendu.

**Tech Stack:** Odoo 19, PostgreSQL, psql, curl

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| Aucun | — | Installation pure, pas de code modifié |

---

## Task 1 : Arrêter Odoo et lancer l'installation

**Files:** (aucun)

- [ ] **Step 1 : Arrêter Odoo s'il tourne**

```bash
pkill -f "odoo.*asshafi" 2>/dev/null
sleep 3
echo "Odoo stopped"
```

Expected : pas d'erreur (ou `no process found` — normal si Odoo n'était pas lancé).

- [ ] **Step 2 : Vider le log et lancer l'installation**

```bash
> /tmp/odoo.log

cd "/Users/yusper/Downloads/modules 19"
nohup ./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 --log-level=info \
  -i payment_orange_money,payment_wave \
  --stop-after-init > /tmp/odoo.log 2>&1
echo "Exit code: $?"
```

Expected : exit code `0`. Le processus s'arrête seul (`--stop-after-init`).

- [ ] **Step 3 : Vérifier l'absence d'erreurs dans le log**

```bash
grep -c "ERROR" /tmp/odoo.log || echo "0 erreurs"
grep "ERROR" /tmp/odoo.log | head -20
```

Expected : `0 erreurs` (ou grep retourne 0 lignes).

En cas d'erreur, afficher les 50 dernières lignes pour diagnostic :

```bash
tail -50 /tmp/odoo.log
```

- [ ] **Step 4 : Chercher les modules dans le log d'installation**

```bash
grep -E "(payment_orange_money|payment_wave)" /tmp/odoo.log | grep -E "(Loading|installed|module)" | head -20
```

Expected : lignes indiquant que les modules ont été chargés/installés.

---

## Task 2 : Vérifier l'état en base de données

**Files:** (aucun)

- [ ] **Step 1 : Vérifier `state = 'installed'` pour les deux modules**

```bash
psql -h localhost -p 5432 -U yusper -d asshafi -c \
  "SELECT name, state, latest_version FROM ir_module_module WHERE name IN ('payment_orange_money', 'payment_wave') ORDER BY name;"
```

Expected :

```
       name          |   state   | latest_version
---------------------+-----------+----------------
 payment_orange_money | installed | 1.1
 payment_wave         | installed | 1.0
(2 rows)
```

Si `state != 'installed'`, relire le log (`/tmp/odoo.log`) pour identifier l'erreur.

- [ ] **Step 2 : Vérifier les providers créés**

```bash
psql -h localhost -p 5432 -U yusper -d asshafi -c \
  "SELECT name, code, state FROM payment_provider WHERE code IN ('orange_money', 'wave') ORDER BY code;"
```

Expected : 2 lignes avec `state = 'disabled'` pour les deux providers.

---

## Task 3 : Démarrer Odoo en mode normal et vérifier HTTP + UI

**Files:** (aucun)

- [ ] **Step 1 : Démarrer Odoo en arrière-plan**

```bash
cd "/Users/yusper/Downloads/modules 19"
nohup ./odoo19-venv/bin/python odoo-19.0.post20260601/setup/odoo \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 --log-level=warn \
  >> /tmp/odoo.log 2>&1 &
echo "PID: $!"
```

- [ ] **Step 2 : Attendre que le serveur soit prêt**

```bash
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8069/web/health 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "Odoo ready after ${i}s"
    break
  fi
  sleep 2
done
echo "Final HTTP code: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:8069/web/health)"
```

Expected : `Odoo ready after Xs` + `Final HTTP code: 200`.

- [ ] **Step 3 : Vérifier l'endpoint health**

```bash
curl -s http://localhost:8069/web/health | python3 -m json.tool
```

Expected : `{"status": "pass"}` (HTTP 200).

- [ ] **Step 4 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add docs/superpowers/plans/2026-06-13-payment-modules-install.md
git commit -m "docs: plan installation smoke test payment_orange_money + payment_wave"
```

---

## Critères d'acceptance (rappel de la spec)

1. `ir_module_module.state = 'installed'` pour `payment_orange_money` ET `payment_wave`
2. Aucune `ERROR` dans `/tmp/odoo.log` pendant l'installation
3. `GET /web/health` → HTTP 200 après démarrage
4. Les deux providers existent en DB avec `code IN ('orange_money', 'wave')`
5. Les providers sont en état `disabled` (pas activés accidentellement)

---

## En cas d'erreur

| Symptôme | Diagnostic | Action |
|---|---|---|
| `ModuleNotFoundError: No module named 'cryptography'` | Lib Python absente | `./odoo19-venv/bin/pip install cryptography` |
| `ERROR: module 'payment_wave' not found` | Module hors addons-path | Vérifier que `as shafi/` est bien dans `--addons-path` |
| `psycopg2.errors.DuplicateColumn` | Conflit champ `code` | Vérifier que les deux modules utilisent `selection_add` (non `override`) |
| `XML parsing error` | Erreur data XML | Lire le log, corriger le fichier XML incriminé dans le module |
| `state = 'to install'` après arrêt | Installation incomplète | Relancer sans `--stop-after-init`, attendre la fin |
