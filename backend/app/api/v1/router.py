from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()

router.include_router(auth_router)


@router.get("/", tags=["meta"])
async def api_index() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": settings.api_version,
        "environment": settings.environment,
    }
