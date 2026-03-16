from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import CurrentUser, get_current_user
from app.core.response import success

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
async def get_me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict[str, object]:
    return success({
        "id": current_user.id,
        "email": current_user.email,
        "preferred_username": current_user.preferred_username,
        "roles": list(current_user.roles),
        "contract_ids": list(current_user.contract_ids),
    })
