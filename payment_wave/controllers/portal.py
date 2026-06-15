# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import http, _
from odoo.exceptions import AccessError, MissingError, UserError
from odoo.http import request

_logger = logging.getLogger(__name__)


class WavePortalController(http.Controller):
    """
    Contrôleur pour gérer l'envoi de liens de paiement Wave depuis le portail client.
    """

    @http.route(['/my/invoices/<int:invoice_id>/send_wave_whatsapp'], type='http', auth='public', website=True)
    def portal_invoice_send_wave_whatsapp(self, invoice_id, access_token=None, **kw):
        """
        Route appelée depuis le portail client pour envoyer le lien de paiement Wave par WhatsApp.

        Cette route :
        1. Vérifie l'accès à la facture (via access_token si utilisateur public)
        2. Récupère le numéro de téléphone du client
        3. Crée une transaction de paiement Wave
        4. Envoie le lien par WhatsApp
        5. Redirige vers la page de détail de la facture avec un message de confirmation

        :param int invoice_id: ID de la facture
        :param str access_token: Token d'accès pour les utilisateurs publics
        :return: Redirection vers la page de la facture avec notification
        """
        try:
            # Vérifier l'accès à la facture
            invoice_sudo = self._get_invoice_with_access(invoice_id, access_token)

            if not invoice_sudo:
                _logger.warning("Tentative d'accès à la facture %s sans autorisation", invoice_id)
                return request.redirect('/my')

            # Vérifier que la facture est éligible
            if invoice_sudo.move_type not in ('out_invoice', 'out_refund'):
                return self._redirect_with_message(
                    invoice_sudo, access_token,
                    _("Erreur : Type de document invalide"),
                    'danger'
                )

            if invoice_sudo.state != 'posted':
                return self._redirect_with_message(
                    invoice_sudo, access_token,
                    _("Erreur : La facture doit être validée"),
                    'danger'
                )

            if invoice_sudo.payment_state in ('paid', 'in_payment', 'reversed'):
                return self._redirect_with_message(
                    invoice_sudo, access_token,
                    _("Cette facture est déjà payée ou en cours de paiement"),
                    'warning'
                )

            # Récupérer le client et son numéro
            customer = invoice_sudo.partner_id
            customer_phone = customer.mobile or customer.phone

            if not customer_phone:
                return self._redirect_with_message(
                    invoice_sudo, access_token,
                    _("Erreur : Aucun numéro de téléphone trouvé pour %s. Veuillez contacter le support.") % customer.name,
                    'danger'
                )

            # Appeler la méthode d'envoi
            try:
                invoice_sudo.action_send_wave_payment_link_whatsapp()

                _logger.info(
                    "Lien de paiement Wave envoyé avec succès pour la facture %s au client %s (%s)",
                    invoice_sudo.name, customer.name, customer_phone
                )

                return self._redirect_with_message(
                    invoice_sudo, access_token,
                    _("Le lien de paiement Wave a été envoyé à votre téléphone (%s) via WhatsApp !") % customer_phone,
                    'success'
                )

            except UserError as e:
                _logger.warning("Erreur métier lors de l'envoi Wave pour facture %s : %s", invoice_id, e)
                return self._redirect_with_message(
                    invoice_sudo, access_token,
                    str(e),
                    'danger'
                )

        except (AccessError, MissingError):
            _logger.warning("Accès refusé à la facture %s", invoice_id)
            return request.redirect('/my')

        except Exception as e:
            _logger.exception("Erreur inattendue lors de l'envoi Wave pour facture %s : %s", invoice_id, e)
            return self._redirect_with_message(
                invoice_sudo if 'invoice_sudo' in locals() else None,
                access_token,
                _("Une erreur s'est produite. Veuillez réessayer ou contacter le support."),
                'danger'
            )

    def _get_invoice_with_access(self, invoice_id, access_token=None):
        """
        Récupère la facture en vérifiant les droits d'accès.

        :param int invoice_id: ID de la facture
        :param str access_token: Token d'accès optionnel
        :return: Facture en mode sudo ou None si accès refusé
        """
        try:
            # Essayer de récupérer la facture
            invoice_sudo = request.env['account.move'].browse(invoice_id).sudo()

            if not invoice_sudo.exists():
                return None

            # Vérifier l'accès
            # Si l'utilisateur est connecté et que c'est son client
            if request.env.user._is_public():
                # Utilisateur public : vérifier le token
                if not access_token or invoice_sudo.access_token != access_token:
                    return None
            else:
                # Utilisateur connecté : vérifier que c'est bien son partenaire
                if invoice_sudo.partner_id.id != request.env.user.partner_id.id:
                    # Vérifier si l'utilisateur a les droits de voir toutes les factures
                    if not request.env['account.move'].check_access_rights('read', raise_exception=False):
                        return None

            return invoice_sudo

        except Exception as e:
            _logger.error("Erreur lors de la récupération de la facture %s : %s", invoice_id, e)
            return None

    def _redirect_with_message(self, invoice, access_token, message, message_type='info'):
        """
        Redirige vers la page de la facture avec un message flash.

        :param invoice: Objet facture
        :param str access_token: Token d'accès
        :param str message: Message à afficher
        :param str message_type: Type de message (success, info, warning, danger)
        :return: Redirection HTTP
        """
        # Construire l'URL de redirection
        if invoice:
            redirect_url = f'/my/invoices/{invoice.id}'
            if access_token:
                redirect_url += f'?access_token={access_token}'
        else:
            redirect_url = '/my/invoices'

        # Ajouter le message dans la session
        request.session['wave_payment_message'] = message
        request.session['wave_payment_message_type'] = message_type

        return request.redirect(redirect_url)
