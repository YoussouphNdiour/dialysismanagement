# -*- coding: utf-8 -*-
{
    'name': 'Traductions françaises personnalisées - Néphrologie',
    'version': '1.1.0',
    'category': 'Localization',
    'summary': 'Francisation complète des menus ACS HMS + organisation par rôle utilisateur',
    'description': """
        Ce module contient les traductions françaises personnalisées pour l'ensemble
        des modules ACS HMS utilisés en contexte de clinique de néphrologie.

        Traductions appliquées :
        - "Traitements" → "Séances de Dialyse"
        - "Procédure Patient" → "Hémodialyse du patient"
        - "Procédures" → "Hémodialyses"

        Renommages de menus (menu_overrides.xml) :
        - "Patient" → "Patients"
        - "Physician" → "Médecins"
        - "Medicines" → "Médicaments"
        - "Services" → "Services"
        - "Drug Form" → "Formes galéniques"
        - "Active Component" → "Composants actifs"
        - "Drug Company" → "Laboratoires"
        - "Therapeutic Effect" → "Effets thérapeutiques"
        - "Medical Alerts" → "Alertes médicales"
        - "Surgical History" → "Antécédents chirurgicaux"
        - "FAV Location" → "Accès vasculaire (FAV)"
        - "Diseases" → "Pathologies"
        - "Disease Categories" → "Catégories de pathologies"
        - "Genetic Disease" → "Pathologies génétiques"
        - "Lifestyle" → "Mode de vie"
        - "Ethnicity" → "Ethnicité"
        - "Medicament Group" → "Groupes médicamenteux"
        - "Medication Dosage" → "Posologies"
        - "Product Kit" → "Kits de produits"
        - "Pricelist" → "Tarifs"
        - "Settings" → "Paramètres"
        - "Cancel Reason" → "Motifs d'annulation"
        - "Appointment Purpose" → "Motifs de rendez-vous"
        - "Appointment Cabin" → "Cabines de consultation"
        - "Procedure Groups" → "Groupes de procédures"
        - "Prescription" → "Ordonnances"

        Ce module ne sera pas écrasé lors des mises à jour d'ACS.
    """,
    'author': 'Custom',
    'website': 'https://as-shafi.com',
    'depends': ['acs_hms_nephrology'],
    'data': [
        'views/menu_overrides.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
