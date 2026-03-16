from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, contract_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[contract_id].add(websocket)

    async def disconnect(self, contract_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(contract_id)
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                self._connections.pop(contract_id, None)

    async def broadcast(
        self,
        contract_id: str,
        *,
        message_type: str,
        data: dict[str, Any],
        timestamp: str | None = None,
    ) -> None:
        payload = {
            "type": message_type,
            "data": data,
            "timestamp": timestamp or datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        }
        sockets = await self._snapshot(contract_id)
        stale: list[WebSocket] = []
        for websocket in sockets:
            try:
                await websocket.send_json(payload)
            except Exception:
                stale.append(websocket)

        for websocket in stale:
            await self.disconnect(contract_id, websocket)

    async def _snapshot(self, contract_id: str) -> list[WebSocket]:
        async with self._lock:
            return list(self._connections.get(contract_id, set()))

    async def clear(self) -> None:
        async with self._lock:
            self._connections.clear()

    async def count(self, contract_id: str) -> int:
        async with self._lock:
            return len(self._connections.get(contract_id, set()))


connection_manager = ConnectionManager()
