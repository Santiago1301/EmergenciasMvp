"""Reglas de priorizacion P1-P4."""

from __future__ import annotations

from emergencias_common import Priority

BASE_PRIORITY: dict[str, Priority] = {
    "rescate": Priority.P1_CRITICO,
    "medico": Priority.P2_URGENTE,
    "estructural": Priority.P3_MODERADO,
    "preventivo": Priority.P4_PREVENTIVO,
}

URGENT_KEYWORDS = (
    "atrapado",
    "atrapados",
    "colapso",
    "colapsada",
    "colapsado",
    "no respira",
    "sangrado",
    "inconsciente",
)


def compute_priority(report_type: str, description: str) -> Priority:
    base = BASE_PRIORITY[report_type]
    text = description.lower()

    if base > Priority.P1_CRITICO and any(keyword in text for keyword in URGENT_KEYWORDS):
        return Priority(base - 1)

    return base
