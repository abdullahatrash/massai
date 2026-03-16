from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, WebSocketException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, validate_access_token
from app.core.connection_manager import connection_manager
from app.core.contracts import get_contract_by_public_id
from app.core.database import get_db_session

router = APIRouter(tags=["websocket"])


async def get_websocket_current_user(
    token: Annotated[str | None, Query()] = None,
) -> CurrentUser:
    if not token:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Missing token.",
        )
    return await validate_access_token(token)


@router.websocket("/ws/contracts/{contract_id}")
async def contract_updates_websocket(
    websocket: WebSocket,
    contract_id: str,
    current_user: Annotated[CurrentUser, Depends(get_websocket_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> None:
    if not current_user.has_role("consumer", "admin"):
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="You do not have permission to connect.",
        )

    await connection_manager.connect(contract_id, websocket)
    try:
        try:
            contract = await get_contract_by_public_id(session, contract_id)
        except Exception:
            await connection_manager.broadcast(
                contract_id,
                message_type="CONTRACT_NOT_FOUND",
                data={"contractId": contract_id},
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        if not current_user.can_access_contract(contract.public_id or contract_id):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await connection_manager.disconnect(contract_id, websocket)
