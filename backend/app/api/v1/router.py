from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/", tags=["meta"])
async def api_index() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": settings.api_version,
        "environment": settings.environment,
    }
