# ✅ Checklist avant installation

## Vérifications rapides

### 1. Modules dépendants installés

Assurez-vous que ces modules sont installés:
- ✅ `acs_hms` (Hospital Management System)
- ✅ `acs_hms_base` (Hospital Management System Base)
- ✅ `mail` (Mail module - inclus dans Odoo)

### 2. Dépendances Python

```bash
# Vérifier si requests est installé
python3 -c "import requests; print('requests OK')"

# Si erreur, installer:
pip3 install requests
```

### 3. Structure du module

Vérifier que tous les fichiers sont présents:

```bash
cd addons/acs_hms_whatsapp
find . -type f | sort
```

Vous devriez voir:
```
./INSTALLATION.md
./QUICK_START.md
./README.md
./__init__.py
./__manifest__.py
./data/sequence.xml
./models/__init__.py
./models/prescription_order.py
./models/res_config_settings.py
./models/whatsapp_message.py
./security/ir.model.access.csv
./static/description/index.html
./views/res_config_settings_views.xml
./views/whatsapp_message_views.xml
./wizard/__init__.py
./wizard/whatsapp_compose_message.py
./wizard/whatsapp_compose_message_views.xml
```

### 4. Vérification des erreurs de syntaxe

```bash
# Vérifier la syntaxe Python
python3 -m py_compile models/*.py
python3 -m py_compile wizard/*.py

# Si pas d'erreur, tout est OK
```

### 5. Vérification des fichiers XML

```bash
# Vérifier la syntaxe XML
xmllint --noout views/*.xml
xmllint --noout wizard/*.xml
xmllint --noout data/*.xml

# Si pas d'erreur, tout est OK
```

## Installation

Une fois toutes les vérifications OK:

### Méthode 1: Via l'interface Odoo

1. Redémarrer Odoo:
```bash
sudo systemctl restart odoo
```

2. Dans Odoo:
   - Apps > Update Apps List
   - Rechercher "WhatsApp"
   - Cliquer sur "Install"

### Méthode 2: Via la ligne de commande

```bash
./odoo-bin -c odoo.conf -d your_database -u acs_hms_whatsapp
```

## Résolution des problèmes

### Erreur: "Module requests not found"
```bash
pip3 install requests
# Ou avec le pip d'Odoo
/path/to/odoo/venv/bin/pip install requests
```

### Erreur: "No matching record found for external id"
- Vérifiez que `acs_hms` et `acs_hms_base` sont bien installés
- Redémarrez Odoo
- Essayez à nouveau

### Erreur de syntaxe XML
- Vérifiez avec `xmllint`
- Corrigez les erreurs
- Redémarrez Odoo

### Le module n'apparaît pas
- Vérifiez que le dossier est bien dans `addons/`
- Mettez à jour la liste: Apps > Update Apps List
- Activez le mode développeur

## Après installation

1. Allez dans **Settings > General Settings**
2. Cherchez la section **WhatsApp Integration**
3. Configurez votre API Key
4. Testez avec une ordonnance

## Support

Si vous rencontrez des problèmes:
1. Consultez les logs Odoo: `/var/log/odoo/odoo.log`
2. Vérifiez ce guide: README.md
3. Guide rapide: QUICK_START.md
4. Contact: info@almightycs.com
