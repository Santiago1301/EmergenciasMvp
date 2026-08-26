"""Esquemas Pydantic compartidos entre los 4 microservicios."""

from __future__ import annotations

from enum import IntEnum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class Priority(IntEnum):
    P1_CRITICO = 1
    P2_URGENTE = 2
    P3_MODERADO = 3
    P4_PREVENTIVO = 4


class ReportType(str):
    RESCATE = "rescate"
    MEDICO = "medico"
    ESTRUCTURAL = "estructural"
    PREVENTIVO = "preventivo"

    _VALID = {"rescate", "medico", "estructural", "preventivo"}


class ReportStatus:
    RECIBIDO = "recibido"
    VALIDADO = "validado"
    DESPACHADO = "despachado"
    EN_PROCESO = "en_proceso"
    RESUELTO = "resuelto"
    DESCARTADO = "descartado"


class ReportCreate(BaseModel):
    report_type: str = Field(..., description="rescate | medico | estructural | preventivo")
    description: str = Field(..., min_length=1, max_length=1000)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    device_id: str = Field(..., min_length=1)
    idempotency_key: UUID
    contact_phone: Optional[str] = None
    photo_url: Optional[str] = None

    @field_validator("report_type")
    @classmethod
    def validate_report_type(cls, v: str) -> str:
        if v not in ReportType._VALID:
            raise ValueError(f"report_type invalido: {v}")
        return v


class ReportOut(BaseModel):
    id: UUID
    report_type: str
    priority: int
    status: str
    zone_id: Optional[UUID] = None
    created_at: str


class DispatchAssignRequest(BaseModel):
    crew_id: Optional[UUID] = Field(
        default=None,
        description="Si se omite, S2 elige la cuadrilla disponible mas cercana",
    )
    crew_type: Optional[str] = None
    notes: Optional[str] = None


class DispatchStatusUpdate(BaseModel):
    status: str = Field(..., description="en_ruta | en_sitio | completado | cancelado")
