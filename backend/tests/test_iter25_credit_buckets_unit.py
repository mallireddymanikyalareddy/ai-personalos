# Iteration 25: exact credit bucket allocation (no database required)
import os
import sys

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "personalos-test")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from credits import allocate, consumed_from_hold, refund_from_hold  # noqa: E402


class TestAllocate:
    def test_spends_promotional_then_included_then_purchased(self):
        acc = {"promotional": 5, "included": 10, "purchased": 20}
        assert allocate(acc, 8) == {"promotional": 5, "included": 3, "purchased": 0, "unallocated": 0}
        assert allocate(acc, 20) == {"promotional": 5, "included": 10, "purchased": 5, "unallocated": 0}

    def test_legacy_unallocated_balance_is_usable(self):
        assert allocate({"promotional": 0, "included": 0, "purchased": 0}, 4) == {
            "promotional": 0, "included": 0, "purchased": 0, "unallocated": 4}

    def test_missing_bucket_fields_are_zero(self):
        assert allocate({"included": 2}, 3) == {
            "promotional": 0, "included": 2, "purchased": 0, "unallocated": 1}


class TestRefundFromHold:
    def test_charge_consumes_in_bucket_order(self):
        hold = {"promotional": 5, "included": 3, "purchased": 0, "unallocated": 0}
        assert refund_from_hold(hold, 5) == {"promotional": 0, "included": 3, "purchased": 0, "unallocated": 0}
        assert refund_from_hold(hold, 7) == {"promotional": 0, "included": 1, "purchased": 0, "unallocated": 0}

    def test_consumed_matches_the_charge(self):
        hold = {"promotional": 5, "included": 3, "purchased": 2, "unallocated": 1}
        assert consumed_from_hold(hold, 7) == {"promotional": 5, "included": 2, "purchased": 0, "unallocated": 0}
        assert sum(consumed_from_hold(hold, 0).values()) == 0
        assert consumed_from_hold(hold, 11) == hold

    def test_full_release_restores_every_bucket(self):
        hold = {"promotional": 5, "included": 3, "purchased": 2, "unallocated": 1}
        assert refund_from_hold(hold, 0) == hold

    def test_full_charge_leaves_nothing(self):
        hold = {"promotional": 5, "included": 3, "purchased": 2, "unallocated": 1}
        assert refund_from_hold(hold, sum(hold.values())) == {
            "promotional": 0, "included": 0, "purchased": 0, "unallocated": 0}
