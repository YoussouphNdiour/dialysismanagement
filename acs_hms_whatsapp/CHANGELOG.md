# Changelog - WhatsApp Integration for HMS

## [1.0.0] - 2025-12-27

### ✨ Ajouté
- Module complet d'intégration WhatsApp pour Hospital Management System
- Envoi d'ordonnances en PDF via WhatsApp
- Envoi d'images médicales via WhatsApp
- Configuration de l'API WasenderApi dans les paramètres
- Wizard de composition de messages WhatsApp
- Historique complet des messages envoyés
- Suivi du statut des messages (Draft, Sending, Sent, Failed)
- Bouton "Send via WhatsApp" sur les ordonnances
- Smart button pour voir les messages WhatsApp d'une ordonnance
- Génération automatique de PDF avec token d'accès sécurisé
- Validation du format de numéro de téléphone (E.164)
- Menu "WhatsApp Messages" dans Hospital
- Possibilité de réessayer l'envoi des messages échoués
- Documentation complète (README, INSTALLATION, QUICK_START)
- Interface similaire à l'envoi d'emails Odoo

### 🔧 Technique
- Modèle `whatsapp.message` pour stocker les messages
- Modèle transient `whatsapp.compose.message` pour le wizard
- Extension du modèle `prescription.order` avec méthodes WhatsApp
- Configuration dans `res.config.settings`
- Intégration avec l'API WasenderApi
- Support des fichiers attachés avec URLs publiques
- Logging complet pour le débogage
- Gestion des erreurs et exceptions
- Séquences automatiques pour les messages

### 📚 Documentation
- README.md - Documentation complète
- INSTALLATION.md - Guide d'installation détaillé
- QUICK_START.md - Démarrage rapide en 5 minutes
- CHECK_BEFORE_INSTALL.md - Checklist de vérification
- index.html - Page de description du module
- CHANGELOG.md - Ce fichier

### 🔒 Sécurité
- Droits d'accès configurés pour tous les groupes HMS
- Clé API stockée de manière sécurisée
- Token d'accès pour les fichiers PDF
- Validation des numéros de téléphone
- Logging des erreurs

### 🐛 Corrections
- **2025-12-27 19:40** - Correction des groupes de sécurité (acs_hms_base.group_hms_user au lieu de acs_hms.group_hms_user)
- **2025-12-27 19:40** - Correction de l'ID de la vue héritée (view_hms_prescription_order_form)
- **2025-12-27 19:43** - Correction de la vue res_config_settings pour Odoo 19 (utilisation de <block> et <setting> au lieu de divs)
- **2025-12-27 19:51** - Correction du menu parent (main_menu_prescription au lieu de main_menu_hms)
- **2025-12-27 19:56** - Correction du champ téléphone (phone au lieu de mobile) pour correspondre au modèle hms.patient

### ✨ Améliorations
- **2025-12-27 19:56** - Ajout de l'envoi automatique aux contacts d'urgence du patient
- **2025-12-27 19:56** - Ajout de la méthode de formatage de numéro (inspirée du module payment_wave)
- **2025-12-27 19:56** - Messages personnalisés pour les contacts d'urgence avec indication de la relation
- **2025-12-27 19:56** - Notification détaillée du succès/échec pour chaque destinataire

### 📋 Dépendances
- acs_hms (Hospital Management System)
- acs_hms_base (Hospital Management System Base)
- mail (Module Mail Odoo)
- requests (Bibliothèque Python)

### ⚙️ Configuration requise
- Odoo 19.0
- Python 3.8+
- Compte WasenderApi actif
- Connexion Internet

### 🎯 Fonctionnalités à venir (v1.1.0)
- [ ] Envoi de messages groupés
- [ ] Templates de messages personnalisables
- [ ] Support des messages programmés
- [ ] Statistiques d'envoi
- [ ] Notification de lecture (si API disponible)
- [ ] Support de plusieurs sessions WhatsApp
- [ ] Envoi automatique après confirmation d'ordonnance
- [ ] Webhooks pour recevoir les réponses
- [ ] Interface pour gérer les sessions WasenderApi
- [ ] Export des statistiques en PDF

### 📞 Support
- Email: info@almightycs.com
- Website: https://www.almightycs.com
- WasenderApi: https://www.wasenderapi.com/help

### 👨‍💻 Auteur
AlmightyCS - Almighty Consulting Solutions Pvt. Ltd.

### 📄 Licence
OPL-1 (Odoo Proprietary License v1.0)

---

## Notes de version

### Version 1.0.0 - Première version stable

Cette première version inclut toutes les fonctionnalités de base nécessaires pour envoyer des ordonnances via WhatsApp. Le module a été testé avec:
- Odoo 19.0
- WasenderApi
- Python 3.12
- Différents formats de numéros de téléphone

**Points importants:**
- Assurez-vous que le module `acs_hms` est installé avant d'installer ce module
- Configurez votre clé API WasenderApi dans Settings
- Les numéros de téléphone doivent être au format international (+XXX...)
- Les fichiers PDF sont générés automatiquement à partir du rapport existant

**Limitations connues:**
- Taille maximale des fichiers: 100MB (limitation WasenderApi)
- Formats d'image supportés: JPEG, PNG (limitation WasenderApi)
- Une seule session WhatsApp par installation

**Problèmes résolus:**
- Groupes de sécurité corrigés pour correspondre au module acs_hms_base
- ID de vue corrigé pour l'héritage de la vue prescription
- Validation XML de tous les fichiers
