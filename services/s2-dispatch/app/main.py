"""S2 · Dispatch — asignacion de cuadrillas y ciclo de vida de despachos."""

from __future__ import annotations

from emergencias_common import DispatchAssignRequest, DispatchStatusUpdate, get_supabase_client, publish_event
from fastapi import FastAPI, HTTPException
from mangum import Mangum

from .transitions import can_transition

app = FastAPI(title="S2 Dispatch")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "s2-dispatch"}


@app.post("/dispatch/{report_id}/assign", status_code=201)
def assign_crew(report_id: str, payload: DispatchAssignRequest) -> dict:
    supabase = get_supabase_client()

    report_result = supabase.table("reports").select("*").eq("id", report_id).maybe_single().execute()
    if not report_result or not report_result.data:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    report = report_result.data

    if payload.crew_id:
        crew_id = str(payload.crew_id)
    else:
        nearest = supabase.rpc(
            "nearest_available_crew",
            {
                "p_zone_id": report["zone_id"],
                "p_location": report["location"],
                "p_crew_type": payload.crew_type,
            },
        ).execute()
        if not nearest.data:
            raise HTTPException(
                status_code=409,
                detail="No hay cuadrillas disponibles en la zona ahora mismo",
            )
        crew_id = nearest.data[0]["id"]

    assignment = (
        supabase.table("dispatch_assignments")
        .insert(
            {
                "report_id": report_id,
                "crew_id": crew_id,
                "notes": payload.notes,
            }
        )
        .execute()
        .data[0]
    )

    supabase.table("crews").update({"status": "en_ruta"}).eq("id", crew_id).execute()
    supabase.table("reports").update({"status": "despachado"}).eq("id", report_id).execute()

    publish_event(
        "dispatch.assigned",
        {
            "assignment_id": assignment["id"],
            "report_id": report_id,
            "crew_id": crew_id,
            "zone_id": report["zone_id"],
        },
    )

    return assignment


@app.patch("/dispatch/{assignment_id}/status")
def update_status(assignment_id: str, payload: DispatchStatusUpdate) -> dict:
    supabase = get_supabase_client()

    current = (
        supabase.table("dispatch_assignments")
        .select("*")
        .eq("id", assignment_id)
        .maybe_single()
        .execute()
    )
    if not current or not current.data:
        raise HTTPException(status_code=404, detail="Asignacion no encontrada")

    assignment = current.data
    if not can_transition(assignment["status"], payload.status):
        raise HTTPException(
            status_code=409,
            detail=f"No se puede pasar de {assignment['status']} a {payload.status}",
        )

    updated = (
        supabase.table("dispatch_assignments")
        .update({"status": payload.status})
        .eq("id", assignment_id)
        .execute()
        .data[0]
    )

    if payload.status in ("completado", "cancelado"):
        supabase.table("crews").update({"status": "disponible"}).eq("id", assignment["crew_id"]).execute()
    if payload.status == "completado":
        supabase.table("reports").update({"status": "resuelto"}).eq("id", assignment["report_id"]).execute()

    publish_event(
        "dispatch.status_changed",
        {
            "assignment_id": assignment_id,
            "report_id": assignment["report_id"],
            "status": payload.status,
        },
    )

    return updated


handler = Mangum(app)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002)
