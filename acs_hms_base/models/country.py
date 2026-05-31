# -*- coding: utf-8 -*-
# Part of AlmightyCS. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models ,_

class ResCountry(models.Model):
    _inherit = "res.country"

    gov_code_label = fields.Char(string='Government Identity Label', default="Government Identity")

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: