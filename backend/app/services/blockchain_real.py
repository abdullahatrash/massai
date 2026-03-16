from __future__ import annotations

from typing import Any

from app.core.blockchain import BlockchainWriteResult
from app.core.config import get_settings


class RealBlockchainService:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._rpc_url = "https://entrynet-maasai.euinno.eu"

    async def get_contract_metadata(self, address: str) -> Any:
        raise RuntimeError(
            "Real blockchain metadata sync is blocked until the manufacturing contract ABI is available."
        )

    async def log_alert_event(self, contract, alert) -> BlockchainWriteResult:
        del contract, alert
        raise RuntimeError(
            "Real blockchain alert logging is blocked until the manufacturing contract ABI is available."
        )

    def is_connected(self) -> bool:
        try:
            from web3 import HTTPProvider, Web3
        except ImportError:
            return False

        provider = HTTPProvider(self._rpc_url)
        return bool(Web3(provider).is_connected())
