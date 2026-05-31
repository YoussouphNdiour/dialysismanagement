# Hospital Management System - WhatsApp Integration

Ce module permet d'envoyer des ordonnances et documents médicaux via WhatsApp en utilisant l'API WasenderApi.

## Fonctionnalités

- ✅ Envoi d'ordonnances en PDF via WhatsApp
- ✅ Envoi d'images médicales via WhatsApp
- ✅ Configuration des identifiants API WhatsApp
- ✅ Suivi du statut des messages WhatsApp
- ✅ Interface similaire à l'envoi d'emails
- ✅ Support de WasenderApi

## Prérequis

1. **Compte WasenderApi**: Vous devez avoir un compte actif sur [WasenderApi](https://www.wasenderapi.com)
2. **Clé API**: Obtenez votre clé API depuis le tableau de bord WasenderApi
3. **Python requests**: La bibliothèque `requests` doit être installée

## Installation

1. Copiez le module dans le dossier `addons` d'Odoo
2. Redémarrez le serveur Odoo
3. Activez le mode développeur
4. Allez dans Apps et mettez à jour la liste des applications
5. Recherchez "WhatsApp Integration" et installez-le

## Configuration

### 1. Configurer l'API WhatsApp

Allez dans **Paramètres > WhatsApp Integration** et configurez:

- **Enable WhatsApp Integration**: Cochez cette case pour activer l'intégration
- **API URL**: URL de l'API (par défaut: https://www.wasenderapi.com/api/send-message)
- **API Key**: Votre clé API WasenderApi (Bearer Token)
- **Default Message**: Message par défaut à envoyer avec les ordonnances

### 2. Obtenir votre clé API

1. Connectez-vous à [WasenderApi Dashboard](https://www.wasenderapi.com)
2. Créez une session WhatsApp
3. Scannez le code QR avec WhatsApp
4. Copiez votre clé API depuis le tableau de bord
5. Collez-la dans la configuration Odoo

### 3. Format du numéro de téléphone

Les numéros de téléphone doivent être au format international E.164:
- ✅ Bon: `+221771234567` (Sénégal)
- ✅ Bon: `+33612345678` (France)
- ❌ Mauvais: `771234567`
- ❌ Mauvais: `0771234567`

## Utilisation

### Envoyer une ordonnance via WhatsApp

1. Ouvrez une ordonnance confirmée
2. Cliquez sur le bouton **"Send via WhatsApp"**
3. Vérifiez/modifiez le numéro de téléphone du patient
4. Choisissez le format d'envoi (PDF ou Image)
5. Personnalisez le message si nécessaire
6. Cliquez sur **"Send"**

### Consulter l'historique des messages

1. Allez dans **Hospital > WhatsApp Messages**
2. Vous verrez tous les messages envoyés avec leur statut
3. Vous pouvez réessayer d'envoyer les messages en échec

### Voir les messages d'une ordonnance

1. Ouvrez une ordonnance
2. Cliquez sur le bouton **"WhatsApp"** dans le coin supérieur droit (s'affiche si des messages ont été envoyés)
3. Vous verrez tous les messages WhatsApp liés à cette ordonnance

## API WasenderApi

Le module utilise les endpoints suivants de WasenderApi:

### Envoyer un document PDF

```python
POST https://www.wasenderapi.com/api/send-message
Headers: Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

Body:
{
    "to": "+221771234567",
    "text": "Votre message",
    "documentUrl": "https://your-domain.com/prescription.pdf",
    "fileName": "Prescription.pdf"
}
```

### Envoyer une image

```python
POST https://www.wasenderapi.com/api/send-message
Headers: Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

Body:
{
    "to": "+221771234567",
    "text": "Votre message",
    "imageUrl": "https://your-domain.com/image.png"
}
```

## Structure du module

```
acs_hms_whatsapp/
├── __init__.py
├── __manifest__.py
├── README.md
├── data/
│   └── sequence.xml
├── models/
│   ├── __init__.py
│   ├── res_config_settings.py
│   ├── whatsapp_message.py
│   └── prescription_order.py
├── security/
│   └── ir.model.access.csv
├── views/
│   ├── res_config_settings_views.xml
│   ├── whatsapp_message_views.xml
│   └── prescription_order_views.xml
└── wizard/
    ├── __init__.py
    ├── whatsapp_compose_message.py
    └── whatsapp_compose_message_views.xml
```

## Modèles

### whatsapp.message
Stocke tous les messages WhatsApp envoyés avec leur statut et réponse de l'API.

### whatsapp.compose.message (Transient)
Wizard pour composer et envoyer des messages WhatsApp.

## Dépannage

### Le message n'est pas envoyé

1. Vérifiez que l'intégration WhatsApp est activée dans les paramètres
2. Vérifiez que la clé API est correctement configurée
3. Vérifiez que le numéro de téléphone est au format international (+xxx...)
4. Vérifiez la connexion Internet
5. Consultez les logs Odoo pour plus de détails

### Erreur "WhatsApp integration is not enabled"

Allez dans **Paramètres > WhatsApp Integration** et cochez "Enable WhatsApp Integration"

### Erreur "WhatsApp API key is not configured"

Allez dans **Paramètres > WhatsApp Integration** et entrez votre clé API

### Le PDF ne s'affiche pas dans WhatsApp

1. Vérifiez que le fichier est accessible publiquement
2. Vérifiez que l'URL est correcte
3. Le fichier PDF ne doit pas dépasser 100MB

## Sécurité

- Les clés API sont stockées de manière sécurisée dans les paramètres système
- Les messages ne sont envoyés qu'aux numéros de téléphone configurés dans les fiches patients
- Les fichiers PDF sont générés avec un token d'accès pour la sécurité

## Support

Pour toute question ou problème:
- Email: info@almightycs.com
- Website: https://www.almightycs.com

## Licence

OPL-1 (Odoo Proprietary License v1.0)

## Auteur

AlmightyCS - Almighty Consulting Solutions Pvt. Ltd.

## Version

1.0.0

## Changelog

### Version 1.0.0 (2025-01-27)
- Première version
- Support d'envoi de PDF
- Support d'envoi d'images
- Intégration avec WasenderApi
- Suivi des messages envoyés
