# 🚀 Guide de démarrage rapide - WhatsApp Integration

## ⚡ Installation en 5 minutes

### 1️⃣ Installer le module (30 secondes)

```bash
# Le module est déjà dans addons/acs_hms_whatsapp
# Redémarrez simplement Odoo
sudo systemctl restart odoo
```

Dans Odoo:
- Apps > Update Apps List
- Recherchez "WhatsApp"
- Cliquez sur Install

### 2️⃣ Créer un compte WasenderApi (2 minutes)

1. 🌐 Allez sur https://www.wasenderapi.com
2. 📝 Créez un compte gratuit
3. ➕ Cliquez sur "Create Session"
4. 📱 Scannez le QR code avec WhatsApp
5. 🔑 Copiez votre API Key (Bearer Token)

### 3️⃣ Configurer Odoo (1 minute)

Dans Odoo:
1. Settings > General Settings
2. Section "WhatsApp Integration":
   - ✅ Enable WhatsApp Integration
   - 📝 API URL: `https://www.wasenderapi.com/api/send-message`
   - 🔑 API Key: [Collez votre clé]
   - 💬 Message: "Bonjour, voici votre ordonnance."
3. 💾 Save

### 4️⃣ Tester (1 minute)

1. 🏥 Ouvrez une ordonnance confirmée
2. 📱 Vérifiez que le patient a un numéro mobile (+221771234567)
3. 📤 Cliquez sur "Send via WhatsApp"
4. ✅ Send
5. 🎉 Vérifiez WhatsApp !

## 📋 Checklist de configuration

- [ ] Module installé
- [ ] Compte WasenderApi créé
- [ ] QR code scanné
- [ ] API Key copiée
- [ ] Configuration Odoo complétée
- [ ] Numéro patient au format +XXX
- [ ] Test d'envoi réussi

## 🔧 Configuration du numéro de téléphone

Les numéros **DOIVENT** être au format international:

✅ **CORRECT:**
- `+221771234567` (Sénégal)
- `+33612345678` (France)
- `+1234567890` (USA)

❌ **INCORRECT:**
- `771234567` (manque le code pays)
- `0771234567` (format local)
- `00221771234567` (utilisez + au lieu de 00)

## 💡 Astuce: Corriger les numéros existants

Si vos patients ont des numéros locaux, vous pouvez les corriger en masse:

1. Exportez les patients (Hospital > Patients > Export)
2. Ajoutez le code pays (+221 pour le Sénégal)
3. Réimportez

Ou utilisez le code Python dans Odoo:

```python
# Dans Odoo shell
patients = self.env['hms.patient'].search([])
for patient in patients:
    if patient.mobile and not patient.mobile.startswith('+'):
        # Pour le Sénégal, ajoutez +221
        if patient.mobile.startswith('7'):
            patient.mobile = '+221' + patient.mobile
        elif patient.mobile.startswith('0'):
            patient.mobile = '+221' + patient.mobile[1:]
```

## 🎯 Cas d'usage

### Envoyer une ordonnance

```
1. Hospital > Prescriptions
2. Ouvrir ordonnance
3. "Send via WhatsApp"
4. Vérifier/modifier message
5. Send
```

### Voir l'historique

```
1. Hospital > WhatsApp Messages
2. Filtrer par statut/date
```

### Réessayer un message échoué

```
1. Hospital > WhatsApp Messages
2. Ouvrir message "Failed"
3. Cliquer "Retry"
```

## 🆘 Problèmes courants

### "WhatsApp integration is not enabled"
👉 Settings > WhatsApp Integration > Cocher "Enable"

### "API key is not configured"
👉 Settings > WhatsApp Integration > Entrer API Key

### "Phone number must be in international format"
👉 Ajouter + devant le numéro (+221...)

### Le message n'arrive pas
👉 Vérifier:
- Connexion Internet
- API Key correcte
- Session WhatsApp active sur WasenderApi
- Numéro au bon format

### Module requests non trouvé
```bash
pip3 install requests
```

## 📞 Support

- 📧 Email: info@almightycs.com
- 🌐 Web: https://www.almightycs.com
- 📚 Documentation complète: Voir README.md
- 🔧 WasenderApi: https://www.wasenderapi.com/help

## 🎊 Félicitations !

Vous pouvez maintenant envoyer des ordonnances par WhatsApp ! 🚀

---

**Prochaines étapes suggérées:**

1. Configurez le message par défaut selon vos besoins
2. Formez votre équipe à l'utilisation
3. Testez avec différents formats de fichiers
4. Explorez les statistiques des messages envoyés

Bonne utilisation ! 👍
