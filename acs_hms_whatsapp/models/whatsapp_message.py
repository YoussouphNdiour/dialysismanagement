# -*- coding: utf-8 -*-

import json
import logging
import requests
from odoo import api, fields, models, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class WhatsappMessage(models.Model):
    _name = 'whatsapp.message'
    _description = 'WhatsApp Message'
    _order = 'create_date desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string='Reference', readonly=True, default='New')
    recipient_phone = fields.Char(
        string='Recipient Phone',
        required=True,
        help='Phone number in E.164 format (e.g., +221771234567)'
    )
    message_text = fields.Text(string='Message Text')
    document_url = fields.Char(string='Document URL', help='Public URL of the document to send')
    image_url = fields.Char(string='Image URL', help='Public URL of the image to send')
    file_name = fields.Char(string='File Name')
    attachment_id = fields.Many2one('ir.attachment', string='Attachment')

    state = fields.Selection([
        ('draft', 'Draft'),
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('failed', 'Failed')
    ], string='Status', default='draft', tracking=True)

    message_type = fields.Selection([
        ('text', 'Text Only'),
        ('document', 'Document'),
        ('image', 'Image')
    ], string='Message Type', default='text', required=True)

    model = fields.Char(string='Related Document Model', index=True)
    res_id = fields.Integer(string='Related Document ID', index=True)

    response_data = fields.Text(string='API Response', readonly=True)
    error_message = fields.Text(string='Error Message', readonly=True)

    msg_id = fields.Char(string='Message ID', readonly=True, help='ID returned by WhatsApp API')
    jid = fields.Char(string='JID', readonly=True, help='WhatsApp JID from API response')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code('whatsapp.message') or 'New'
        return super().create(vals_list)

    def _get_api_credentials(self):
        """Get WhatsApp API credentials from settings"""
        ICP = self.env['ir.config_parameter'].sudo()
        api_url = ICP.get_param('acs_hms_whatsapp.api_url', 'https://www.wasenderapi.com/api/send-message')
        api_key = ICP.get_param('acs_hms_whatsapp.api_key')
        enabled = ICP.get_param('acs_hms_whatsapp.enabled', False)

        if not enabled:
            raise UserError(_('WhatsApp integration is not enabled. Please enable it in Settings.'))

        if not api_key:
            raise UserError(_('WhatsApp API key is not configured. Please configure it in Settings.'))

        return api_url, api_key

    def _prepare_message_data(self):
        """Prepare message data for API call"""
        self.ensure_one()

        data = {
            'to': self.recipient_phone,
        }

        if self.message_text:
            data['text'] = self.message_text

        if self.message_type == 'document' and self.document_url:
            data['documentUrl'] = self.document_url
            if self.file_name:
                data['fileName'] = self.file_name
        elif self.message_type == 'image' and self.image_url:
            data['imageUrl'] = self.image_url

        return data

    def action_send_message(self):
        """Send WhatsApp message via API"""
        for record in self:
            try:
                # Get API credentials
                api_url, api_key = record._get_api_credentials()

                # Prepare headers
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                }

                # Prepare message data
                data = record._prepare_message_data()

                # Update state to sending
                record.write({'state': 'sending'})

                # Make API call
                _logger.info(f'Sending WhatsApp message to {record.recipient_phone}')
                response = requests.post(api_url, json=data, headers=headers, timeout=30)

                # Process response
                response_json = response.json()
                record.write({'response_data': json.dumps(response_json, indent=2)})

                if response.status_code == 200 and response_json.get('success'):
                    # Success
                    response_data = response_json.get('data', {})
                    record.write({
                        'state': 'sent',
                        'msg_id': response_data.get('msgId'),
                        'jid': response_data.get('jid'),
                    })
                    _logger.info(f'WhatsApp message sent successfully. Msg ID: {response_data.get("msgId")}')
                else:
                    # Failed
                    error_msg = response_json.get('message', f'API returned status code {response.status_code}')
                    record.write({
                        'state': 'failed',
                        'error_message': error_msg
                    })
                    _logger.error(f'Failed to send WhatsApp message: {error_msg}')
                    raise UserError(_('Failed to send WhatsApp message: %s') % error_msg)

            except requests.exceptions.RequestException as e:
                error_msg = str(e)
                record.write({
                    'state': 'failed',
                    'error_message': error_msg
                })
                _logger.error(f'Request exception while sending WhatsApp message: {error_msg}')
                raise UserError(_('Network error while sending WhatsApp message: %s') % error_msg)

            except Exception as e:
                error_msg = str(e)
                record.write({
                    'state': 'failed',
                    'error_message': error_msg
                })
                _logger.error(f'Unexpected error while sending WhatsApp message: {error_msg}')
                raise

    def action_retry(self):
        """Retry sending failed messages"""
        self.write({'state': 'draft', 'error_message': False})
        return self.action_send_message()
