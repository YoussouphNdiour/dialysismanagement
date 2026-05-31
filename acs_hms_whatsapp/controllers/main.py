# -*- coding: utf-8 -*-

import logging
import base64
from odoo import http
from odoo.http import request, Response
from odoo.exceptions import AccessError

_logger = logging.getLogger(__name__)


class WhatsAppFileController(http.Controller):
    """Controller to serve WhatsApp files publicly"""

    @http.route('/whatsapp/file/<int:attachment_id>', type='http', auth='public', methods=['GET', 'HEAD'])
    def serve_whatsapp_file(self, attachment_id, access_token=None, **kwargs):
        """
        Serve attachment file for WhatsApp with token verification

        :param attachment_id: ID of the attachment
        :param access_token: Access token for verification
        :return: File content with appropriate headers
        """
        try:
            # Get attachment
            attachment = request.env['ir.attachment'].sudo().browse(attachment_id)

            if not attachment.exists():
                _logger.warning(f"Attachment {attachment_id} not found")
                return request.not_found()

            # Verify access token
            if not access_token or attachment.access_token != access_token:
                _logger.warning(f"Invalid access token for attachment {attachment_id}")
                return request.not_found()

            # Get file content
            if attachment.datas:
                filecontent = base64.b64decode(attachment.datas)
            else:
                _logger.warning(f"No data found for attachment {attachment_id}")
                return request.not_found()

            # Prepare headers
            headers = [
                ('Content-Type', attachment.mimetype or 'application/octet-stream'),
                ('Content-Length', len(filecontent)),
                ('Content-Disposition', f'attachment; filename="{attachment.name}"'),
                # CORS headers to allow WasenderApi to access the file
                ('Access-Control-Allow-Origin', '*'),
                ('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS'),
                ('Access-Control-Allow-Headers', 'Content-Type'),
                # Cache control
                ('Cache-Control', 'public, max-age=31536000'),  # Cache for 1 year
            ]

            _logger.info(f"✅ Serving file {attachment.name} (ID: {attachment_id}) to external service")

            return request.make_response(filecontent, headers)

        except Exception as e:
            _logger.error(f"Error serving WhatsApp file {attachment_id}: {str(e)}", exc_info=True)
            return request.not_found()

    @http.route('/whatsapp/file/<int:attachment_id>', type='http', auth='public', methods=['OPTIONS'], csrf=False)
    def serve_whatsapp_file_options(self, attachment_id, **kwargs):
        """Handle OPTIONS request for CORS preflight"""
        headers = [
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Content-Type'),
            ('Access-Control-Max-Age', '86400'),
        ]
        return request.make_response('', headers)
