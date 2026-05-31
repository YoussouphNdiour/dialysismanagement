# -*- coding: utf-8 -*-
# Post-migration: recompute interdialysis_increase for all existing procedures
# This field was converted from a plain Float to a computed/stored field.

from odoo import api, SUPERUSER_ID


def migrate(cr, version):
    if not version:
        return
    env = api.Environment(cr, SUPERUSER_ID, {})
    procedures = env['acs.patient.procedure'].search([
        ('arrival_weight', '>', 0),
        ('dry_weight', '>', 0),
    ])
    if procedures:
        procedures._compute_weight_fields()
