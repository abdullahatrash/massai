from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.admin import router as admin_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.audit import router as audit_router
from app.api.v1.contracts import router as contracts_router
from app.api.v1.documents import router as documents_router
from app.api.v1.ingest import router as ingest_router
from app.api.v1.milestones import router as milestones_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.timeline import router as timeline_router
from app.core.config import get_settings
from app.core.response import success

router = APIRouter()
settings = get_settings()

router.include_router(auth_router)
router.include_router(admin_router)
router.include_router(alerts_router)
router.include_router(analytics_router)
router.include_router(audit_router)
router.include_router(contracts_router)
router.include_router(documents_router)
router.include_router(ingest_router)
router.include_router(milestones_router)
router.include_router(notifications_router)
router.include_router(timeline_router)


@router.get("/", tags=["meta"])
async def api_index() -> dict[str, object]:
    return success({
        "name": settings.app_name,
        "version": settings.api_version,
        "environment": settings.environment,
    })
