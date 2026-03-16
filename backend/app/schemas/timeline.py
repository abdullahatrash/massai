from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class TimelineEventResponse(BaseModel):
    id: str
    timestamp: datetime
    type: str
    description: str
    icon: str
