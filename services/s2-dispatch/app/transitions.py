"""Maquina de estados de una asignacion de despacho."""

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "asignado": {"en_ruta", "cancelado"},
    "en_ruta": {"en_sitio", "cancelado"},
    "en_sitio": {"completado", "cancelado"},
    "completado": set(),
    "cancelado": set(),
}


def can_transition(current_status: str, new_status: str) -> bool:
    return new_status in ALLOWED_TRANSITIONS.get(current_status, set())
