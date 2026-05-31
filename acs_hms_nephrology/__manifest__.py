# -*- coding: utf-8 -*-
# Part of AlmightyCS. See LICENSE file for full copyright and licensing details.
#╔══════════════════════════════════════════════════════════════════╗
#║                                                                  ║
#║                ╔═══╦╗       ╔╗  ╔╗     ╔═══╦═══╗                 ║
#║                ║╔═╗║║       ║║ ╔╝╚╗    ║╔═╗║╔═╗║                 ║
#║                ║║ ║║║╔╗╔╦╦══╣╚═╬╗╔╬╗ ╔╗║║ ╚╣╚══╗                 ║
#║                ║╚═╝║║║╚╝╠╣╔╗║╔╗║║║║║ ║║║║ ╔╬══╗║                 ║
#║                ║╔═╗║╚╣║║║║╚╝║║║║║╚╣╚═╝║║╚═╝║╚═╝║                 ║
#║                ╚╝ ╚╩═╩╩╩╩╩═╗╠╝╚╝╚═╩═╗╔╝╚═══╩═══╝                 ║
#║                          ╔═╝║     ╔═╝║                           ║
#║                          ╚══╝     ╚══╝                           ║
#║ SOFTWARE DEVELOPED AND SUPPORTED BY ALMIGHTY CONSULTING SERVICES ║
#║                   COPYRIGHT (C) 2016 - TODAY                     ║
#║                   http://www.almightycs.com                      ║
#║                                                                  ║
#╚══════════════════════════════════════════════════════════════════╝
{
    'name': 'Nephrology Hospital Management System',
    'category': 'Medical',
    'summary': 'Manage your Nephrology related in your Hospital',
    'description': """
        Manage your Nephrology related in your Hospital By Almighty Consulting Solutions Pvt. Ltd.
    """,
    'version': '1.0.3',
    'author': 'Almighty Consulting Solutions Pvt. Ltd.',
    'support': 'info@almightycs.com',
    'website': 'www.almightycs.com',
    'license': 'OPL-1',
    'depends': ['acs_hms'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/data.xml',
        'reports/nephrology_report.xml',
        'reports/patient_procedure_report.xml',
        'views/nephrology_base_view.xml',
        'views/nephrology_view.xml',
        'views/imaging_view.xml',
        'views/hms_base_view.xml',
        'views/appointment_generator_view.xml',
        'views/patient_customization_view.xml',
        'views/patient_tabs_order.xml',
        'views/menu_item.xml',
    ],
    'demo': [],
    'images': [
        'static/description/hms_nephrology_almightycs_odoo_cover.png',
    ],
    'sequence': 1,
    'application': True,
    'price': 61,
    'currency': 'USD',
}