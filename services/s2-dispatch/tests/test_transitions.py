from app.transitions import can_transition


def test_asignado_puede_pasar_a_en_ruta():
    assert can_transition("asignado", "en_ruta") is True


def test_no_se_puede_saltar_de_asignado_a_completado():
    assert can_transition("asignado", "completado") is False


def test_completado_es_estado_final():
    assert can_transition("completado", "en_ruta") is False


def test_se_puede_cancelar_desde_en_sitio():
    assert can_transition("en_sitio", "cancelado") is True
