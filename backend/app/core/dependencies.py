from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.core.auth import CurrentUser, get_current_user


def require_roles(*required_roles: str) -> Callable[..., CurrentUser]:
    async def dependency(
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if not current_user.has_role(*required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return dependency


def require_consumer() -> Callable[..., CurrentUser]:
    return require_roles("consumer")


def require_provider() -> Callable[..., CurrentUser]:
    return require_roles("provider")


def require_admin() -> Callable[..., CurrentUser]:
    return require_roles("admin")


def require_contract_access(contract_id_param: str = "contract_id") -> Callable[..., CurrentUser]:
    async def dependency(
        request: Request,
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        contract_id = request.path_params.get(contract_id_param)
        if contract_id is None:
            raise HTTPException(
                status_code=500,
                detail=f"Missing contract path parameter '{contract_id_param}'.",
            )
        if not current_user.can_access_contract(str(contract_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this contract.",
            )
        return current_user

    return dependency
