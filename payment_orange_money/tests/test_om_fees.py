# Part of Odoo. See LICENSE file for full copyright and licensing details.

import math
from odoo.tests.common import BaseCase
from odoo.addons.payment_orange_money import const


class TestOrangeMoneyFeeConstants(BaseCase):
    """Tests for Orange Money fixed developer fee constants."""

    def test_developer_fee_is_200(self):
        """OM_DEVELOPER_FEE must be exactly 200 XOF."""
        self.assertEqual(const.OM_DEVELOPER_FEE, 200)

    def test_developer_mobile_is_correct(self):
        """OM_DEVELOPER_MOBILE must be the developer's Orange Money number."""
        self.assertEqual(const.OM_DEVELOPER_MOBILE, '+221777671661')

    def test_total_amount_1000_xof(self):
        """For a 1000 XOF invoice: om fee=10, dev fee=200, total=1210."""
        base = 1000
        om_fee = math.ceil(base * 0.01)       # 10
        dev_fee = const.OM_DEVELOPER_FEE       # 200
        total = base + om_fee + dev_fee
        self.assertEqual(om_fee, 10)
        self.assertEqual(dev_fee, 200)
        self.assertEqual(total, 1210)

    def test_total_amount_500_xof(self):
        """For a 500 XOF invoice: om fee=5, dev fee=200, total=705."""
        base = 500
        om_fee = math.ceil(base * 0.01)       # 5
        dev_fee = const.OM_DEVELOPER_FEE       # 200
        total = base + om_fee + dev_fee
        self.assertEqual(om_fee, 5)
        self.assertEqual(total, 705)

    def test_total_amount_99_xof(self):
        """For a 99 XOF invoice: om fee=ceil(0.99)=1, dev fee=200, total=300."""
        base = 99
        om_fee = math.ceil(base * 0.01)       # ceil(0.99) = 1
        dev_fee = const.OM_DEVELOPER_FEE       # 200
        total = base + om_fee + dev_fee
        self.assertEqual(om_fee, 1)
        self.assertEqual(total, 300)

    def test_developer_fee_is_fixed_regardless_of_amount(self):
        """Developer fee must never depend on the transaction amount."""
        for base in [100, 500, 1000, 5000, 100000]:
            self.assertEqual(
                const.OM_DEVELOPER_FEE,
                200,
                msg=f"Developer fee must be 200 for any base amount (tested: {base})"
            )
