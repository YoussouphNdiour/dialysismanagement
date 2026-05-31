# -*- coding: utf-8 -*-
{
    'name': 'Complications Hémodialyse',
    'version': '1.0.0',
    'category': 'Medical',
    'summary': 'Suivi des complications et incidents per-séance de dialyse',
    'description': 'Enregistrement des complications survenant pendant les séances '
                   "d'hémodialyse : hypotension, crampes, arrêts prématurés, etc.",
    'author': 'As-Shafi Custom',
    'license': 'LGPL-3',
    'depends': ['acs_hms_nephrology'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'views/complication_view.xml',
        'views/menu_item.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
