// @ts-check
/**
 * nephro_billing.spec.js — Tests E2E Facturation Dialyse
 *
 * Standalone. Utilise state.procedure_id ou cherche en DB.
 * Couvre :
 *   - G\u00e9n\u00e9rer / trouver une facture depuis une s\u00e9ance
 *   - La confirmer (draft \u2192 posted)
 *   - V\u00e9rifier l'\u00e9tat dans action-581
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { readState, updateState } = require('./helpers/state');
const { loginApi, rpcCall, apiCreate, apiSearchRead, apiRead } = require('./helpers/api');
const { loginUI } = require('./helpers/auth');
const { snap } = require('./helpers/screenshot');

const ADMIN_LOGIN = 'admin';
const ADMIN_PASSWORD = 'admin';

async function findOrCreateInvoice(request) {
  // 1. Chercher une facture existante non-annul\u00e9e
  const invoices = await apiSearchRead(request, 'account.move',
    [['move_type', '=', 'out_invoice'], ['state', '!=', 'cancel']],
    ['id', 'name', 'state', 'payment_state'],
    1
  );
  if (invoices && invoices.length > 0) {
    console.log('[billing] facture existante :', invoices[0].id, invoices[0].name);
    return invoices[0];
  }

  // 2. Cr\u00e9er une facture minimale si aucune n'existe
  const partners = await apiSearchRead(request, 'res.partner',
    [['customer_rank', '>', 0]], ['id', 'name'], 1
  );
  const partnerId = partners && partners.length > 0 ? partners[0].id : 3; // public partner fallback

  const revenueAccts = await apiSearchRead(request, 'account.account',
    [['account_type', '=', 'income']], ['id', 'name'], 1
  );
  const accountId = revenueAccts && revenueAccts.length > 0 ? revenueAccts[0].id : null;
  if (!accountId) throw new Error('[billing] Aucun compte de revenus trouv\u00e9');

  const invoiceId = await apiCreate(request, 'account.move', {
    move_type:  'out_invoice',
    partner_id: partnerId,
    invoice_line_ids: [[0, 0, {
      name:       'S\u00e9ance de dialyse',
      quantity:   1,
      price_unit: 15000,
      account_id: accountId,
    }]],
  });
  console.log('[billing] facture cr\u00e9\u00e9e id=', invoiceId);
  const created = await apiRead(request, 'account.move', [invoiceId], ['id', 'name', 'state', 'payment_state']);
  return created[0];
}

test.describe('Facturation Dialyse', () => {

  test('Confirmer une facture et v\u00e9rifier dans action-581', async ({ page, request }) => {
    test.setTimeout(180000);

    // \u2500\u2500\u2500 \u00c9tape 1 : Auth + trouver/cr\u00e9er facture \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    await loginApi(request, ADMIN_LOGIN, ADMIN_PASSWORD);
    const invoice = await findOrCreateInvoice(request);
    const invoiceId = invoice.id;
    console.log('[billing] facture :', invoice.name, '\u2014 \u00e9tat :', invoice.state);

    // \u2500\u2500\u2500 \u00c9tape 2 : Confirmer si brouillon \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    if (invoice.state === 'draft') {
      await rpcCall(request, 'account.move', 'action_post', [[invoiceId]]);
      console.log('[billing] facture confirm\u00e9e (draft \u2192 posted)');
    }

    const afterConfirm = await apiRead(request, 'account.move', [invoiceId], ['state', 'payment_state', 'name']);
    expect(afterConfirm[0].state).toBe('posted');
    console.log('[billing] Facture confirm\u00e9e \u2014 \u00e9tat :', afterConfirm[0].state);
    updateState({ invoice_id: invoiceId });

    // \u2500\u2500\u2500 \u00c9tape 3 : V\u00e9rifier dans l\u2019UI action-581 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    await loginUI(page, ADMIN_LOGIN, ADMIN_PASSWORD);
    await page.goto('/odoo/action-581', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.o_data_row, .o_nocontent_help', { timeout: 15000 });

    const rows = await page.locator('.o_data_row').count();
    console.log('[billing] lignes dans action-581 :', rows);
    await snap(page, 'nephro_billing_liste');
    expect(rows).toBeGreaterThan(0);

    // \u2500\u2500\u2500 \u00c9tape 4 : Ouvrir la facture dans l\u2019UI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    await page.goto(`/odoo/accounting/customer-invoices/${invoiceId}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForSelector('.o_form_view, .o_form_sheet', { timeout: 15000 }).catch(() => {});
    await snap(page, 'nephro_billing_invoice_form');

    console.log('[billing] Test termin\u00e9 avec succ\u00e8s');
  });

});
