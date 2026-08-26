"""S4 · Notification — consumo de eventos y notificaciones."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from mangum import Mangum

from .notifier import process_event

app = FastAPI(title="S4 Notification")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "s4-notification"}


@app.post("/internal/events")
def receive_event_http(event: dict) -> dict:
    return lambda_handler(event, context=None)


def lambda_handler(event: dict, context: Any) -> dict:
    detail_type = event.get("detail-type") or event.get("detailType")
    detail = event.get("detail", {})
    return process_event(detail_type, detail)


handler = Mangum(app)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8004)
