/** @odoo-module **/

import { patch } from '@web/core/utils/patch';
import { PaymentForm } from '@payment/interactions/payment_form';

patch(PaymentForm.prototype, {
    // Wave uses server-side redirect — no frontend override needed.
    // This file registers the module so Odoo's asset loader resolves
    // @payment_wave/interactions/payment_form without errors.
});
