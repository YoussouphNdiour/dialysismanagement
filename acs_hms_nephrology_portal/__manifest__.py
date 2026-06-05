# -*- coding: utf-8 -*-
{
    'name': 'ACS Nephrology — Portail Patient',
    'version': '1.0.1',
    'category': 'Healthcare',
    'summary': 'Portail web responsive pour les patients en hémodialyse',
    'author': 'As-Shafi Custom',
    'license': 'LGPL-3',
    'depends': [
        'portal',
        'website',
        'acs_hms_nephrology',
        'acs_hms_nephrology_bilans',
        'acs_hms_nephrology_billing',
    ],
    'data': [
        'data/mail_template.xml',
        'security/portal_rules.xml',
        'security/ir.model.access.csv',
        'views/hms_patient_views.xml',
        'views/res_config_settings_view.xml',
        'report/report_seance_portal.xml',
        'templates/portal_layout.xml',
        'templates/portal_home.xml',
        'templates/portal_seances.xml',
        'templates/portal_bilans.xml',
        'templates/portal_rdv.xml',
        'templates/portal_ordonnances.xml',
        'templates/portal_factures.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'acs_hms_nephrology_portal/static/src/css/portal_nephro.css',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
