# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Payment Provider: Orange Money',
    'version': '1.1',
    'category': 'Accounting/Payment Providers',
    'summary': 'Payment Provider: Orange Money implementation for Senegal and West Africa',
    'description': """
Orange Money Payment Provider
==============================

This module integrates Orange Money payment gateway for Senegal and West Africa.

Features:
- Cash In operations
- Merchant Payments
- QR Code generation
- Transaction status tracking
- Webhook support for async notifications
- Balance inquiry
- Multiple currency support (XOF, etc.)

API Documentation: https://developers.orange-sonatel.com
    """,
    'depends': ['payment'],
    'data': [
        'security/ir.model.access.csv',
        'data/payment_method_data.xml',
        'data/ir_cron_data.xml',
        'views/payment_form_templates.xml',
        'views/payment_status_templates.xml',
        'data/payment_provider_data.xml',
        'views/payment_provider_views.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'payment_orange_money/static/src/interactions/payment_form.js',
        ],
    },
    'post_init_hook': 'post_init_hook',
    'uninstall_hook': 'uninstall_hook',
    'license': 'LGPL-3',
    'author': 'Odoo S.A.',
    'application': False,
}
