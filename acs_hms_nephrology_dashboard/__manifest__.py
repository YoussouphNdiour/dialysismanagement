# -*- coding: utf-8 -*-
{
    'name': 'Nephrology Dashboard',
    'version': '1.0.2',
    'category': 'Medical',
    'summary': 'Interface infirmier tablette + dashboard médecin + gestion absences (OWL)',
    'depends': [
        'acs_hms_nephrology',
        'acs_hms_nephrology_complications',
        'acs_hms_whatsapp',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/cron_reprise_whatsapp.xml',
        'views/nurse_dashboard_action.xml',
        'views/doctor_dashboard_action.xml',
        'views/dialysis_calendar_action.xml',
        'views/dialysis_absence_views.xml',
        'views/dialysis_waitlist_views.xml',
        'views/dialysis_reschedule_views.xml',
        'views/procedure_views_ext.xml',
        'views/secretary_widget_action.xml',
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
