# -*- coding: utf-8 -*-
{
    'name': 'Nephrology Dashboard',
    'version': '1.0.0',
    'category': 'Medical',
    'summary': 'Interface infirmier tablette + dashboard médecin (OWL)',
    'depends': ['acs_hms_nephrology', 'acs_hms_nephrology_complications'],
    'data': [
        'security/ir.model.access.csv',
        'views/nurse_dashboard_action.xml',
        'views/doctor_dashboard_action.xml',
        'views/dialysis_calendar_action.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'acs_hms_nephrology_dashboard/static/src/**/*.js',
            'acs_hms_nephrology_dashboard/static/src/**/*.xml',
            'acs_hms_nephrology_dashboard/static/src/**/*.css',
        ],
    },
    'application': False,
    'installable': True,
    'license': 'OPL-1',
}
