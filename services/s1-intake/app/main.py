"""S1 · Intake — recepcion y registro de reportes ciudadanos."""

from __future__ import annotations

import logging

from emergencias_common import ReportCreate, ReportOut, get_supabase_client, publish_event
from fastapi import FastAPI, HTTPException
from mangum import Mangum

from .priority import compute_priority

logger = logging.getLogger("s1-intake")
app = FastAPI(title="S1 Intake")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "s1-intake"}


@app.post("/reports", status_code=202, response_model=ReportOut)
def create_report(payload: ReportCreate) -> ReportOut:
    supabase = get_supabase_client()

    existing = (
        supabase.table("reports")
        .select("*")
        .eq("idempotency_key", str(payload.idempotency_key))
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        return _to_report_out(existing.data)

    priority = compute_priority(payload.report_type, payload.description)

    point_wkt = f"POINT({payload.lon} {payload.lat})"
    zone_result = supabase.rpc("find_zone_for_point", {"p_location": point_wkt}).execute()
    zone_id = zone_result.data if zone_result.data else None

    insert_payload = {
        "report_type": payload.report_type,
        "priority": int(priority),
        "description": payload.description,
        "location": point_wkt,
        "zone_id": zone_id,
        "device_id": payload.device_id,
        "idempotency_key": str(payload.idempotency_key),
        "contact_phone": payload.contact_phone,
        "photo_url": payload.photo_url,
        "raw_payload": payload.model_dump(mode="json"),
    }

    result = supabase.table("reports").insert(insert_payload).execute()
    report = result.data[0]

    publish_event(
        "report.created",
        {
            "report_id": report["id"],
            "zone_id": zone_id,
            "priority": int(priority),
            "report_type": payload.report_type,
        },
    )

    return _to_report_out(report)


@app.get("/reports/{report_id}/status", response_model=ReportOut)
def get_report_status(report_id: str, device_id: str) -> ReportOut:
    supabase = get_supabase_client()
    result = (
        supabase.table("reports")
        .select("*")
        .eq("id", report_id)
        .eq("device_id", device_id)
        .maybe_single()
        .execute()
    )
    if not result or not result.data:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    return _to_report_out(result.data)


def _to_report_out(row: dict) -> ReportOut:
    return ReportOut(
        id=row["id"],
        report_type=row["report_type"],
        priority=row["priority"],
        status=row["status"],
        zone_id=row.get("zone_id"),
        created_at=str(row["created_at"]),
    )


handler = Mangum(app)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
