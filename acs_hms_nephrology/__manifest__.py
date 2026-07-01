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
    'summary': 'Gestion des soins de néphrologie et hémodialyse en clinique',
    'description': """
Module de gestion de la néphrologie pour clinique de dialyse.

Menus Néphrologie (par étape du processus clinique) :
═══════════════════════════════════════════════════
Phase 1 — Organisation du jour (secrétaire / réceptionniste)
  • Résumé du jour      (secrétaire, manager)       seq=5
  • Rendez-vous         (tous)                       seq=10
  • Planning Dialyse    (médecin, réceptionniste)    seq=15
  • Liste d'attente     (réceptionniste, médecin)    seq=20
  • Absences patients   (réceptionniste, médecin)    seq=25

Phase 2 — Gestion patients (tous les rôles)
  • Patients                                         seq=30

Phase 3 — Sessions de dialyse (infirmier)
  • Interface Infirmier  (infirmier, manager)        seq=35
  • Hémodialyses         (tous)                      seq=40
  • Séances de Dialyse   (tous)                      seq=45

Phase 4 — Suivi médical (médecin)
  • Tableau de bord médecin (médecin, manager)       seq=50
  • Bilans Biologiques      (tous)                   seq=55
  • Ordonnances             (médecin)                seq=60

Phase 5 — Administration (managers uniquement)
  • Générer séances en masse                         seq=70
  • Configuration                                    seq=100
    """,
    'version': '1.0.9',
    'author': 'Almighty Consulting Solutions Pvt. Ltd.',
    'support': 'info@almightycs.com',
    'website': 'www.almightycs.com',
    'license': 'OPL-1',
    'depends': ['acs_hms'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/data.xml',
        'data/nephrology_holidays.xml',
        'data/nephro_medicament_groups.xml',
        'reports/nephrology_report.xml',
        'reports/patient_procedure_report.xml',
        'views/nephrology_base_view.xml',
        'views/nephrology_view.xml',
        'views/imaging_view.xml',
        'views/hms_base_view.xml',
        'views/appointment_generator_view.xml',
        'views/session_generator_view.xml',
        'views/patient_customization_view.xml',
        'views/patient_tabs_order.xml',
        'views/nephro_prescription_view.xml',
        'views/nephro_procedure_view.xml',
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
