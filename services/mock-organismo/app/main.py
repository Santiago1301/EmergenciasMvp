"""Mock de organismo externo (bomberos, Cruz Roja) para pruebas de webhook."""

from __future__ import annotations

import logging

from fastapi import FastAPI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mock-organismo")

app = FastAPI(title="Mock organismo de emergencia")

received: list[dict] = []


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "mock-organismo"}


@app.post("/webhook")
def receive_webhook(payload: dict) -> dict:
    logger.info("Notificacion recibida del sistema de emergencias: %s", payload)
    received.append(payload)
    return {"received": True}


@app.get("/webhook/history")
def history() -> list[dict]:
    return received


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
