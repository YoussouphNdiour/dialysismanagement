# -*- coding: utf-8 -*-
import base64
import io

from odoo import fields, models
from odoo.exceptions import UserError


class AcsDialysisExcelExportWizard(models.TransientModel):
    _name = 'acs.dialysis.excel.export.wizard'
    _description = 'Export Excel séances dialyse'

    date_from = fields.Date(string='Du', required=True)
    date_to = fields.Date(string='Au', required=True)
    patient_ids = fields.Many2many(
        'hms.patient',
        'excel_export_wizard_patient_rel',
        'wizard_id', 'patient_id',
        string='Patients (vide = tous)',
    )
    excel_file = fields.Binary(string='Fichier Excel', readonly=True, attachment=False)
    excel_filename = fields.Char(string='Nom fichier', readonly=True)

    def action_generate_excel(self):
        """Generates the Excel file and reloads the wizard form."""
        self.ensure_one()
        try:
            import xlsxwriter
        except ImportError:
            raise UserError(
                "Le module Python 'xlsxwriter' est requis pour l'export Excel. "
                "Installez-le avec: pip install xlsxwriter"
            )

        domain = [
            ('move_type', '=', 'out_invoice'),
            ('hospital_invoice_type', 'in', ['dialysis_session', 'dialysis_grouped']),
            ('state', '=', 'posted'),
            ('invoice_date', '>=', self.date_from),
            ('invoice_date', '<=', self.date_to),
        ]
        if self.patient_ids:
            domain.append(('partner_id', 'in', self.patient_ids.mapped('partner_id').ids))

        invoices = self.env['account.move'].search(domain, order='invoice_date asc')

        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        worksheet = workbook.add_worksheet('Séances Dialyse')

        # Formats
        bold = workbook.add_format({'bold': True, 'bg_color': '#4472C4', 'font_color': '#FFFFFF'})
        date_fmt = workbook.add_format({'num_format': 'dd/mm/yyyy'})
        money_fmt = workbook.add_format({'num_format': '#,##0.00'})

        # Headers
        headers = [
            'N° Facture', 'Patient', 'Date Séance', 'Type',
            'Montant HT', 'TVA', 'Montant TTC', 'Part Assurance',
            'Part Patient', 'Statut', 'Date Paiement', 'Médecin',
            'Note', 'Référence Assurance',
        ]
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, bold)
            worksheet.set_column(col, col, 18)

        # Data rows
        row = 1
        for inv in invoices:
            # Sum non-section invoice lines
            lines = inv.invoice_line_ids.filtered(
                lambda l: l.display_type not in ('line_section', 'line_note')
            )
            insurance_total = sum(lines.mapped('acs_insurance_amount'))
            patient_total = sum(lines.mapped('acs_patient_amount'))
            worksheet.write(row, 0, inv.name or '')
            worksheet.write(row, 1, inv.partner_id.name or '')
            worksheet.write_datetime(row, 2, inv.invoice_date, date_fmt) if inv.invoice_date else worksheet.write(row, 2, '')
            worksheet.write(row, 3, dict(inv._fields['hospital_invoice_type'].selection).get(inv.hospital_invoice_type, ''))
            worksheet.write_number(row, 4, inv.amount_untaxed, money_fmt)
            worksheet.write_number(row, 5, inv.amount_tax, money_fmt)
            worksheet.write_number(row, 6, inv.amount_total, money_fmt)
            worksheet.write_number(row, 7, insurance_total, money_fmt)
            worksheet.write_number(row, 8, patient_total, money_fmt)
            worksheet.write(row, 9, inv.payment_state or '')
            worksheet.write_datetime(row, 10, inv.invoice_date_due, date_fmt) if inv.invoice_date_due else worksheet.write(row, 10, '')
            worksheet.write(row, 11, inv.invoice_user_id.name if inv.invoice_user_id else '')
            worksheet.write(row, 12, inv.narration or '')
            worksheet.write(row, 13, inv.ref or '')
            row += 1

        workbook.close()
        output.seek(0)
        excel_data = base64.b64encode(output.read())

        filename = 'dialyse_export_%s_%s.xlsx' % (self.date_from, self.date_to)
        self.write({
            'excel_file': excel_data,
            'excel_filename': filename,
        })
        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }
