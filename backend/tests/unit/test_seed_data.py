from __future__ import annotations

import unittest

from app.seeds.seed import expected_e4m_approval_refs, load_seed_contracts


class SeedDataTestCase(unittest.TestCase):
    def test_seed_files_define_three_contracts_and_fourteen_milestones(self) -> None:
        contracts = load_seed_contracts()

        self.assertEqual(len(contracts), 3)
        self.assertEqual(sum(len(contract["milestones"]) for contract in contracts), 14)

    def test_e4m_approval_required_milestones_match_plan(self) -> None:
        contracts = load_seed_contracts()

        self.assertEqual(
            expected_e4m_approval_refs(contracts),
            ("M2", "M3", "M5", "M6"),
        )
