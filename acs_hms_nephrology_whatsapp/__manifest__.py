# -*- coding: utf-8 -*-
{
    'name': 'Nephrology — WhatsApp Alertes Bilans Critiques',
    'version': '1.0.0',
    'category': 'Medical',
    'summary': 'Notifications WhatsApp au médecin référent pour les bilans critiques (Hb, K, P)',
    'author': 'As-Shafi Custom',
    'license': 'LGPL-3',
    'depends': ['acs_hms_nephrology_bilans', 'acs_hms_whatsapp'],
    'data': [
        'data/cron_data.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
