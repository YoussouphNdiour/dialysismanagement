# -*- coding: utf-8 -*-

import base64
import logging
from odoo import api, fields, models, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class WhatsappComposeMessage(models.TransientModel):
    _name = 'whatsapp.compose.message'
    _description = 'WhatsApp Message Composer'

    prescription_id = fields.Many2one('prescription.order', string='Prescription', required=True)
    patient_id = fields.Many2one('hms.patient', string='Patient', required=True)
    phone = fields.Char(
        string='Phone Number',
        required=True,
        help='Phone number in international format (e.g., +221771234567)'
    )
    message_text = fields.Text(
        string='Message',
        required=True,
        default=lambda self: self.env['ir.config_parameter'].sudo().get_param(
            'acs_hms_whatsapp.default_message',
            'Bonjour, veuillez trouver ci-joint votre ordonnance.'
        )
    )
    send_as = fields.Selection([
        ('pdf', 'PDF Document'),
        ('image', 'Image'),
    ], string='Send As', default='pdf', required=True)

    attachment_id = fields.Many2one('ir.attachment', string='Attachment')
    attachment_url = fields.Char(string='Attachment URL', readonly=True)

    @api.onchange('prescription_id')
    def _onchange_prescription_id(self):
        """Update patient and phone when prescription changes"""
        if self.prescription_id:
            self.patient_id = self.prescription_id.patient_id
            self.phone = self.prescription_id.patient_id.phone

    @api.onchange('phone')
    def _onchange_phone(self):
        """Validate and format phone number"""
        if self.phone:
            # Remove spaces and dashes
            phone = self.phone.replace(' ', '').replace('-', '')
            # Ensure it starts with +
            if not phone.startswith('+'):
                # If it starts with 00, replace with +
                if phone.startswith('00'):
                    phone = '+' + phone[2:]
                # Otherwise, you might want to add default country code
                # For example, for Senegal: +221
                # else:
                #     phone = '+221' + phone
            self.phone = phone

    def _generate_prescription_pdf(self):
        """Generate prescription PDF and return attachment"""
        self.ensure_one()

        try:
            # Generate PDF using Odoo's report system
            pdf_content, _ = self.env['ir.actions.report']._render_qweb_pdf(
                'acs_hms.report_hms_prescription_id',
                res_ids=[self.prescription_id.id]
            )

            # Create attachment
            attachment = self.env['ir.attachment'].create({
                'name': f'Prescription_{self.prescription_id.name}.pdf',
                'type': 'binary',
                'datas': base64.b64encode(pdf_content),
                'res_model': 'prescription.order',
                'res_id': self.prescription_id.id,
                'mimetype': 'application/pdf',
                'public': True,  # Make it publicly accessible
                'description': f'Prescription PDF for WhatsApp - {self.prescription_id.name}',
            })

            # Ensure the attachment is committed to database before getting URL
            self.env.cr.commit()
            _logger.info(f"Created public attachment {attachment.id} for prescription {self.prescription_id.name}")

            return attachment
        except Exception as e:
            _logger.warning(f"Could not generate PDF (wkhtmltopdf may not be installed): {str(e)}")
            # Return None if PDF generation fails
            return None

    def _get_attachment_url(self, attachment):
        """Get public URL for attachment"""
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')

        # Ensure the attachment has a checksum (required for some endpoints)
        if not attachment.checksum:
            attachment._compute_checksum()

        # Generate access token for the attachment
        if not attachment.access_token:
            attachment.generate_access_token()

        # IMPORTANT: Make sure attachment is marked as public
        if not attachment.public:
            attachment.sudo().write({'public': True})

        # Use custom WhatsApp controller instead of /web/content/
        # This bypasses database routing issues with the standard endpoint
        url = f"{base_url}/whatsapp/file/{attachment.id}?access_token={attachment.access_token}"

        _logger.info(f"Generated public URL for attachment {attachment.id} using custom endpoint: {url}")

        # Test if URL is accessible
        try:
            import requests
            # Important: Don't follow redirects for HEAD requests
            response = requests.get(url, timeout=10, stream=True)
            if response.status_code == 200:
                content_type = response.headers.get('Content-Type', '')
                _logger.info(f"✅ URL is accessible: {response.status_code}, Content-Type: {content_type}")
            else:
                _logger.warning(f"⚠️ URL returned status {response.status_code}. Response: {response.text[:200]}")
        except Exception as e:
            _logger.warning(f"⚠️ Could not verify URL accessibility: {str(e)}")

        return url

    def _format_phone_number(self, phone):
        """Format phone number to E.164 format (like in Wave payment).

        :param str phone: The phone number to format
        :return: The formatted phone number or None if invalid
        :rtype: str|None
        """
        if not phone:
            return None

        # Remove all non-digit characters
        digits = ''.join(c for c in phone if c.isdigit())

        # Senegal country code is +221, phone numbers are 9 digits
        if len(digits) == 9:
            # Assume Senegal if no country code
            return f'+221{digits}'
        elif len(digits) == 12 and digits.startswith('221'):
            return f'+{digits}'
        elif phone.startswith('+'):
            return phone

        _logger.warning("Unable to format phone number: %s", phone)
        return None

    def action_send_whatsapp(self):
        """Send prescription via WhatsApp to patient and emergency contacts"""
        self.ensure_one()

        # Validate phone number format
        if not self.phone.startswith('+'):
            raise UserError(_('Phone number must be in international format starting with + (e.g., +221771234567)'))

        try:
            _logger.info("Starting WhatsApp send process for prescription %s", self.prescription_id.name)
            # Generate or get attachment
            if self.send_as == 'pdf':
                attachment = self._generate_prescription_pdf()
            else:
                # For image, you might need to implement image generation
                # For now, we'll use PDF
                attachment = self._generate_prescription_pdf()

            # Get public URL (if attachment was generated)
            attachment_url = None
            attachment_id = None
            attachment_name = None

            if attachment:
                attachment_url = self._get_attachment_url(attachment)
                attachment_id = attachment.id
                attachment_name = attachment.name
                message_type = 'document' if self.send_as == 'pdf' else 'image'
            else:
                # If PDF generation failed, send as text-only message
                message_type = 'text'
                _logger.warning("PDF generation failed, sending as text-only message")

            # List to track all sent messages
            sent_to = []
            failed_to = []

            # 1. Send to patient
            try:
                _logger.info("Preparing to send to patient: %s", self.patient_id.name)
                formatted_patient_phone = self._format_phone_number(self.phone)
                if formatted_patient_phone:
                    _logger.info("Creating whatsapp.message record for patient")
                    patient_message = self.env['whatsapp.message'].create({
                        'recipient_phone': formatted_patient_phone,
                        'message_text': self.message_text,
                        'message_type': message_type,
                        'document_url': attachment_url if (attachment_url and self.send_as == 'pdf') else False,
                        'image_url': attachment_url if (attachment_url and self.send_as == 'image') else False,
                        'file_name': attachment_name or False,
                        'attachment_id': attachment_id or False,
                        'model': 'prescription.order',
                        'res_id': self.prescription_id.id,
                    })
                    _logger.info("Sending message to patient")
                    patient_message.action_send_message()
                    sent_to.append(f"{self.patient_id.name} ({formatted_patient_phone})")
                    _logger.info("Prescription sent to patient: %s", formatted_patient_phone)
            except Exception as e:
                failed_to.append(f"{self.patient_id.name}: {str(e)}")
                _logger.error("Failed to send to patient: %s", str(e), exc_info=True)

            # 2. Send to emergency contacts
            if self.patient_id.emergency_contact_ids:
                _logger.info("Found %d emergency contacts", len(self.patient_id.emergency_contact_ids))
                for emergency_contact in self.patient_id.emergency_contact_ids:
                    try:
                        _logger.info("Processing emergency contact: %s", emergency_contact.name)
                        formatted_emergency_phone = self._format_phone_number(emergency_contact.phone)
                        if formatted_emergency_phone:
                            # Customize message for emergency contact
                            _logger.info("Formatting message for emergency contact")
                            emergency_message_text = _(
                                "Ordonnance de %(patient_name)s (%(relationship)s)\n\n%(original_message)s"
                            ) % {
                                'patient_name': self.patient_id.name,
                                'relationship': emergency_contact.relationship or 'Contact d\'urgence',
                                'original_message': self.message_text
                            }
                            _logger.info("Message formatted successfully")

                            emergency_whatsapp = self.env['whatsapp.message'].create({
                                'recipient_phone': formatted_emergency_phone,
                                'message_text': emergency_message_text,
                                'message_type': message_type,
                                'document_url': attachment_url if (attachment_url and self.send_as == 'pdf') else False,
                                'image_url': attachment_url if (attachment_url and self.send_as == 'image') else False,
                                'file_name': attachment_name or False,
                                'attachment_id': attachment_id or False,
                                'model': 'prescription.order',
                                'res_id': self.prescription_id.id,
                            })
                            emergency_whatsapp.action_send_message()
                            sent_to.append(f"{emergency_contact.name} - {emergency_contact.relationship} ({formatted_emergency_phone})")
                            _logger.info("Prescription sent to emergency contact: %s", formatted_emergency_phone)
                    except Exception as e:
                        failed_to.append(f"{emergency_contact.name}: {str(e)}")
                        _logger.error("Failed to send to emergency contact %s: %s", emergency_contact.name, str(e), exc_info=True)

            # Prepare result message
            if sent_to:
                if attachment:
                    success_msg = _('Prescription sent successfully via WhatsApp to:\n') + '\n'.join([f"• {recipient}" for recipient in sent_to])
                else:
                    success_msg = _('Prescription sent successfully via WhatsApp to:\n') + '\n'.join([f"• {recipient}" for recipient in sent_to])
                    success_msg += _('\n\nNote: PDF attachment could not be generated (wkhtmltopdf not installed). Message sent as text only.')

                if failed_to:
                    success_msg += _('\n\nFailed to send to:\n') + '\n'.join([f"• {recipient}" for recipient in failed_to])

                return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                    'params': {
                        'title': _('Success'),
                        'message': success_msg,
                        'type': 'success' if not failed_to else 'warning',
                        'sticky': True,
                    }
                }
            else:
                raise UserError(_('Failed to send prescription to any recipient. Please check the phone numbers.'))

        except Exception as e:
            _logger.error(f'Error sending WhatsApp message: {str(e)}', exc_info=True)
            raise UserError(_('Error sending WhatsApp message: %s') % str(e))

    def action_send_and_close(self):
        """Send message and close wizard"""
        self.action_send_whatsapp()
        return {'type': 'ir.actions.act_window_close'}
