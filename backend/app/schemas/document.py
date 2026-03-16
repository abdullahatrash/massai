from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    id: str
    milestone_id: str = Field(alias="milestoneId")
    milestone_name: str = Field(alias="milestoneName")
    name: str
    url: str
    format: str | None = None
    uploaded_at: datetime | None = Field(alias="uploadedAt")

    model_config = {
        "populate_by_name": True,
    }
