"""Logica de notificacion hacia organismos externos."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx
from emergencias_common import get_supabase_client

ORGANISMO_WEBHOOK_URL = os.environ.get("ORGANISMO_WEBHOOK_URL", "http://mock-organismo:8000/webhook")

NOTIFIABLE_EVENTS = {
    "report.created",
    "dispatch.assigned",
    "dispatch.status_changed",
}


def build_message(detail_type: str, detail: dict) -> dict:
    return {
        "event": detail_type,
        "report_id": detail.get("report_id"),
        "zone_id": detail.get("zone_id"),
        "priority": detail.get("priority"),
        "summary": _summary(detail_type, detail),
    }


def _summary(detail_type: str, detail: dict) -> str:
    if detail_type == "report.created":
        priority = detail.get("priority")
        if priority == 1:
            return "Nuevo reporte P1 critico: se requiere atencion inmediata"
        return f"Nuevo reporte P{priority} registrado"
    if detail_type == "dispatch.assigned":
        return "Cuadrilla asignada a un reporte"
    if detail_type == "dispatch.status_changed":
        return f"Estado de despacho actualizado a {detail.get('status')}"
    return detail_type


def process_event(detail_type: str, detail: dict) -> dict:
    if detail_type not in NOTIFIABLE_EVENTS:
        return {"skipped": True, "reason": f"evento no notificable: {detail_type}"}

    message = build_message(detail_type, detail)
    supabase = get_supabase_client()

    notification_row = {
        "report_id": detail.get("report_id"),
        "channel": "webhook",
        "recipient": ORGANISMO_WEBHOOK_URL,
        "status": "pendiente",
        "payload": message,
    }
    inserted = supabase.table("notifications").insert(notification_row).execute().data[0]

    try:
        response = httpx.post(ORGANISMO_WEBHOOK_URL, json=message, timeout=5.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        supabase.table("notifications").update({"status": "fallido"}).eq("id", inserted["id"]).execute()
        raise

    supabase.table("notifications").update(
        {"status": "enviado", "sent_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", inserted["id"]).execute()

    return {"skipped": False, "notification_id": inserted["id"]}
