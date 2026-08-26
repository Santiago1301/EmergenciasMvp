from app.priority import compute_priority
from emergencias_common import Priority


def test_rescate_es_siempre_p1():
    assert compute_priority("rescate", "vecino atrapado en escombros") == Priority.P1_CRITICO


def test_estructural_base_es_p3():
    assert compute_priority("estructural", "grieta visible en fachada") == Priority.P3_MODERADO


def test_estructural_escala_a_p2_si_hay_atrapados():
    assert compute_priority("estructural", "edificio colapsado, hay atrapados") == Priority.P2_URGENTE


def test_preventivo_no_escala_mas_alla_de_p3():
    # "colapso" en un reporte preventivo sube un nivel (P4 -> P3), no mas.
    assert compute_priority("preventivo", "riesgo de colapso a futuro") == Priority.P3_MODERADO
