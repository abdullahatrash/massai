from __future__ import annotations

import json
import os
import time
from datetime import UTC, datetime
from urllib.error import URLError
from urllib.request import urlopen


def run_simulator(default_name: str) -> None:
    simulator_name = os.environ.get("SIMULATOR_NAME", default_name)
    contract_id = os.environ.get("CONTRACT_ID", f"contract-{default_name}-001")
    api_url = os.environ.get("API_URL", "http://backend:8000").rstrip("/")
    interval_seconds = float(os.environ.get("INTERVAL_SECONDS", "15"))

    while True:
        payload = {
            "simulator": simulator_name,
            "contract_id": contract_id,
            "timestamp": datetime.now(UTC).isoformat(),
        }
        try:
            with urlopen(f"{api_url}/health", timeout=5) as response:
                backend_status = response.status
        except URLError as exc:
            backend_status = f"unreachable ({exc.reason})"

        print(json.dumps({"event": "heartbeat", "backend_status": backend_status, **payload}))
        time.sleep(interval_seconds)
