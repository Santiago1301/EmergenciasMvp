from app.notifier import build_message


def test_reporte_p1_genera_mensaje_critico():
    msg = build_message("report.created", {"report_id": "r1", "priority": 1})
    assert "critico" in msg["summary"].lower()


def test_reporte_p3_genera_mensaje_generico():
    msg = build_message("report.created", {"report_id": "r1", "priority": 3})
    assert msg["summary"] == "Nuevo reporte P3 registrado"


def test_cambio_de_estado_incluye_el_nuevo_estado():
    msg = build_message("dispatch.status_changed", {"report_id": "r1", "status": "en_sitio"})
    assert "en_sitio" in msg["summary"]
