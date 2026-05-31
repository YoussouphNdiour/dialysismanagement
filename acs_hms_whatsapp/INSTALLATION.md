# Guide d'installation rapide - WhatsApp Integration

## Étape 1: Installation du module

```bash
# Redémarrer Odoo
sudo systemctl restart odoo

# Ou si vous utilisez le serveur de développement
./odoo-bin -c odoo.conf -u all
```

## Étape 2: Activer le module

1. Connectez-vous à Odoo
2. Activez le mode développeur (Settings > Activate Developer Mode)
3. Allez dans Apps > Update Apps List
4. Recherchez "WhatsApp Integration"
5. Cliquez sur "Install"

## Étape 3: Configuration WasenderApi

### 3.1 Créer un compte WasenderApi

1. Allez sur https://www.wasenderapi.com
2. Créez un compte ou connectez-vous
3. Créez une nouvelle session WhatsApp

### 3.2 Scanner le QR Code

1. Dans le dashboard WasenderApi, cliquez sur "Create Session"
2. Scannez le QR code avec votre application WhatsApp:
   - Ouvrez WhatsApp sur votre téléphone
   - Allez dans Paramètres > Appareils connectés
   - Scannez le QR code

### 3.3 Obtenir la clé API

1. Une fois connecté, allez dans "API Settings"
2. Copiez votre "Bearer Token" (API Key)

## Étape 4: Configuration dans Odoo

1. Allez dans **Settings > General Settings**
2. Faites défiler jusqu'à la section **WhatsApp Integration**
3. Configurez les paramètres:
   - ✅ Cochez "Enable WhatsApp Integration"
   - 📝 API URL: `https://www.wasenderapi.com/api/send-message`
   - 🔑 API Key: Collez votre Bearer Token
   - 💬 Default Message: Personnalisez le message par défaut

4. Cliquez sur **Save**

## Étape 5: Vérifier la configuration du patient

1. Allez dans **Hospital > Patients**
2. Ouvrez une fiche patient
3. Assurez-vous que le champ **Mobile** est rempli au format international:
   - Exemple: `+221771234567` (Sénégal)
   - Exemple: `+33612345678` (France)

## Étape 6: Test d'envoi

1. Créez ou ouvrez une ordonnance confirmée
2. Cliquez sur le bouton **"Send via WhatsApp"**
3. Vérifiez les informations
4. Cliquez sur **"Send"**
5. Vérifiez que le message est bien reçu sur WhatsApp

## Vérification du statut

1. Allez dans **Hospital > WhatsApp Messages**
2. Vous devriez voir le message avec le statut "Sent"
3. Si le statut est "Failed", vérifiez l'erreur affichée

## Dépendances Python

Si le module requests n'est pas installé:

```bash
pip3 install requests

# Ou avec le pip d'Odoo
/path/to/odoo/venv/bin/pip install requests
```

## Problèmes courants

### Le module n'apparaît pas dans Apps
- Vérifiez que le module est bien dans le dossier addons
- Redémarrez Odoo
- Mettez à jour la liste des applications

### Erreur "Module not found: requests"
```bash
pip3 install requests
```

### Le bouton WhatsApp n'apparaît pas
- Vérifiez que l'ordonnance est confirmée (statut = "Prescribed")
- Actualisez la page

### Le message n'est pas envoyé
1. Vérifiez la configuration de l'API dans Settings
2. Vérifiez que le numéro de téléphone commence par +
3. Consultez les logs Odoo: `/var/log/odoo/odoo.log`

## Tester l'API manuellement

Vous pouvez tester l'API WasenderApi avec curl:

```bash
curl -X POST https://www.wasenderapi.com/api/send-message \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+221771234567",
    "text": "Test message"
  }'
```

## Support

Pour plus d'aide:
- Documentation complète: Voir README.md
- Support WasenderApi: https://www.wasenderapi.com/help
- Email: info@almightycs.com
