from fastapi import APIRouter

from app.api.v2.admin import router as admin_router
from app.api.v2.contracts import router as contracts_router
from app.api.v2.ingest import router as ingest_router
from app.core.config import get_settings
from app.core.response import success
from app.services.ingest_profiles import SCHEMA_VERSION

router = APIRouter()
settings = get_settings()

router.include_router(admin_router)
router.include_router(contracts_router)
router.include_router(ingest_router)


@router.get("/", tags=["meta"])
async def api_index() -> dict[str, object]:
    return success(
        {
            "name": f"{settings.app_name} v2",
            "version": SCHEMA_VERSION,
            "environment": settings.environment,
        }
    )
