# -*- coding: utf-8 -*-
{
    'name': 'Bilans Biologiques Dialyse',
    'version': '1.0.0',
    'category': 'Medical',
    'summary': 'Bilans biologiques complets pour les patients en hémodialyse',
    'description': 'Suivi des bilans biologiques (NFS, biochimie, électrolytes, '
                   "minéraux-os, nutrition, sérologies) avec seuils KDIGO paramétrables "
                   "et alertes automatiques.",
    'author': 'As-Shafi Custom',
    'license': 'LGPL-3',
    'depends': ['acs_hms_nephrology'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/default_thresholds.xml',
        'data/cron_data.xml',
        'report/bilan_report.xml',
        'views/bilan_threshold_view.xml',
        'views/bilan_view.xml',
        'views/patient_bilan_tab.xml',
        'views/nephro_bilan_prescription_view.xml',
        'views/menu_item.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'acs_hms_nephrology_bilans/static/src/components/bilan_chart.js',
            'acs_hms_nephrology_bilans/static/src/components/bilan_chart.xml',
            'acs_hms_nephrology_bilans/static/src/css/bilan_chart.css',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
