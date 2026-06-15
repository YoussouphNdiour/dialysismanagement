/** @odoo-module **/

import { loadJS } from "@web/core/assets";
import paymentForm from "@payment/js/payment_form";

paymentForm.include({
    /**
     * @override
     */
    async _processPayment(provider, paymentOptionId, flow) {
        if (provider !== 'orange_money') {
            return this._super(...arguments);
        }

        // For QR Code payment, redirect to the payment form
        if (flow === 'redirect') {
            return this._super(...arguments);
        }

        // For direct payment, collect phone number and process
        if (flow === 'direct') {
            const msisdn = document.getElementById('orange_money_msisdn')?.value;
            if (!msisdn) {
                this.displayError(
                    this.el.querySelector('.o_payment_form'),
                    'Please enter your Orange Money number'
                );
                return Promise.resolve();
            }

            // Validate phone number format
            const phoneRegex = /^[7][0-9]{8}$/;
            if (!phoneRegex.test(msisdn)) {
                this.displayError(
                    this.el.querySelector('.o_payment_form'),
                    'Invalid Orange Money number format (should be 9 digits starting with 7)'
                );
                return Promise.resolve();
            }

            // Add phone number to transaction data
            const transactionRoute = '/payment/transaction';
            return this._rpc({
                route: transactionRoute,
                params: {
                    ...this._prepareTransactionRouteParams(provider, paymentOptionId, flow),
                    orange_money_customer_msisdn: msisdn,
                },
            }).then(() => this._handleRedirectPayment(provider, paymentOptionId, flow))
              .guardedCatch((error) => {
                  error.event.preventDefault();
                  this._displayError(
                      this.el.querySelector('.o_payment_form'),
                      error.message?.data?.message || 'Payment processing failed'
                  );
              });
        }

        return this._super(...arguments);
    },

    /**
     * Auto-refresh page for pending Orange Money payments
     * @override
     */
    async _pollTransactionStatus(processingValues) {
        if (processingValues.provider_code === 'orange_money') {
            // Poll every 5 seconds for Orange Money transactions
            const pollInterval = 5000;
            return this._super(processingValues).then(() => {
                setTimeout(() => {
                    window.location.reload();
                }, pollInterval);
            });
        }
        return this._super(...arguments);
    },
});
