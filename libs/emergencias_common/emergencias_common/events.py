"""Publicacion de eventos en EventBridge (o log local si no hay AWS)."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger("emergencias.events")
logging.basicConfig(level=logging.INFO)

EVENT_BUS_NAME = os.environ.get("EVENT_BUS_NAME", "emergencias-bus")
EVENT_SOURCE = "emergencias.backend"


def publish_event(detail_type: str, detail: dict[str, Any]) -> None:
    payload = json.dumps(detail, default=str)

    if os.environ.get("AWS_LAMBDA_FUNCTION_NAME") is None and not os.environ.get(
        "EMERGENCIAS_FORCE_EVENTBRIDGE"
    ):
        logger.info("[LOCAL] evento %s -> %s", detail_type, payload)
        return

    import boto3

    client = boto3.client("events")
    client.put_events(
        Entries=[
            {
                "Source": EVENT_SOURCE,
                "DetailType": detail_type,
                "Detail": payload,
                "EventBusName": EVENT_BUS_NAME,
            }
        ]
    )
