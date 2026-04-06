from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from simulator_studio.storage import StudioStorage
from simulator_studio.templates import get_template, load_scenarios


class StudioStorageTestCase(unittest.TestCase):
    def test_create_factory_from_template_persists_factory_and_sensors(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            storage = StudioStorage(Path(temp_dir) / "studio.db")
            storage.seed_scenarios(load_scenarios())
            template = get_template("factor")

            created = storage.create_factory_from_template(
                template,
                name="Factory A",
                factory_key="factory-a",
                contract_id="contract-factor-a-001",
                product_name="Gear Batch",
                quantity_total=400,
                delivery_date="2026-08-01",
            )

            self.assertEqual(created["name"], "Factory A")
            self.assertEqual(created["pilotType"], "FACTOR")
            self.assertEqual(created["profileKey"], "FACTOR_DEFAULT")
            self.assertGreaterEqual(len(created["sensors"]), 1)
            self.assertEqual(storage.get_scenario("factor_normal")["pilotType"], "FACTOR")

    def test_delete_and_archive_factory_cleanup_behaves_safely(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            storage = StudioStorage(Path(temp_dir) / "studio.db")
            storage.seed_scenarios(load_scenarios())
            template = get_template("factor")

            created = storage.create_factory_from_template(
                template,
                name="Factory B",
                factory_key="factory-b",
                contract_id="contract-factor-b-001",
                product_name="Gear Batch",
                quantity_total=400,
                delivery_date="2026-08-01",
            )
            factory_id = created["id"]
            sensor_count = len(created["sensors"])
            self.assertGreater(sensor_count, 0)

            storage.mark_factory_provisioned(
                factory_id,
                contract_id="contract-factor-b-001",
                profile_key="FACTOR_DEFAULT",
                profile_version=1,
            )
            storage.archive_factory(factory_id)
            self.assertEqual(storage.list_factories(), [])

            created_draft = storage.create_factory_from_template(
                template,
                name="Factory C",
                factory_key="factory-c",
                contract_id="contract-factor-c-001",
                product_name="Gear Batch",
                quantity_total=400,
                delivery_date="2026-08-01",
            )
            storage.delete_factory(created_draft["id"])
            self.assertEqual(
                [factory["id"] for factory in storage.list_factories()],
                [],
            )
