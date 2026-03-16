from __future__ import annotations

import unittest

import app.models  # noqa: F401
from app.models.base import Base


class ModelMetadataTestCase(unittest.TestCase):
    def test_core_tables_are_registered_with_expected_defaults(self) -> None:
        table_names = set(Base.metadata.tables.keys())

        self.assertEqual(
            table_names,
            {
                "alerts",
                "blockchain_events",
                "contracts",
                "milestones",
                "notifications",
                "status_updates",
            },
        )
        self.assertEqual(
            str(Base.metadata.tables["milestones"].c.status.server_default.arg),
            "'PENDING'",
        )
        self.assertEqual(
            str(Base.metadata.tables["milestones"].c.evidence.server_default.arg),
            "'[]'::jsonb",
        )
        self.assertEqual(
            str(Base.metadata.tables["alerts"].c.blockchain_logged.server_default.arg),
            "false",
        )
