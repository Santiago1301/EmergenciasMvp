"""Extraccion de zone_id del payload de trigger de clusters."""

from __future__ import annotations


class InvalidClusterTrigger(ValueError):
    pass


def extract_zone_id(payload: dict) -> str:
    if "zone_id" in payload and payload["zone_id"]:
        return payload["zone_id"]

    record = payload.get("record") or {}
    zone_id = record.get("zone_id")
    if not zone_id:
        raise InvalidClusterTrigger("El payload no trae zone_id ni record.zone_id")

    return zone_id
