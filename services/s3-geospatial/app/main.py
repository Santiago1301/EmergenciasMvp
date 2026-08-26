"""S3 · Geospatial — clustering DBSCAN de reportes por zona."""

from __future__ import annotations

from emergencias_common import get_supabase_client
from fastapi import FastAPI, HTTPException
from mangum import Mangum

from .webhook import InvalidClusterTrigger, extract_zone_id

app = FastAPI(title="S3 Geospatial")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "s3-geospatial"}


@app.post("/internal/clusters/refresh", status_code=200)
def refresh_clusters(payload: dict) -> dict:
    try:
        zone_id = extract_zone_id(payload)
    except InvalidClusterTrigger as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    supabase = get_supabase_client()
    result = supabase.rpc("refresh_zone_clusters", {"p_zone_id": zone_id}).execute()

    return {"zone_id": zone_id, "clusters_computed": len(result.data or [])}


@app.get("/clusters/{zone_id}")
def list_clusters(zone_id: str) -> list:
    supabase = get_supabase_client()
    result = supabase.table("clusters").select("*").eq("zone_id", zone_id).execute()
    return result.data


handler = Mangum(app)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8003)
