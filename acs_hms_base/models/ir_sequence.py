# -*- coding: utf-8 -*-
# Part of AlmightyCS. See LICENSE file for full copyright and licensing details.

from odoo import api,fields,models,_


class IrSequence(models.Model):
    _inherit = 'ir.sequence'

    acs_auto_create = fields.Boolean('Auto Create On Company Creation',  default=False, help="Auto Create new sequence for new company.", copy=False)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: