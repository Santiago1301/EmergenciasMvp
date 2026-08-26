import pytest
from app.webhook import InvalidClusterTrigger, extract_zone_id


def test_extrae_zone_id_directo():
    assert extract_zone_id({"zone_id": "abc-123"}) == "abc-123"


def test_extrae_zone_id_desde_record_de_supabase_webhook():
    payload = {"type": "INSERT", "table": "reports", "record": {"zone_id": "xyz-789"}}
    assert extract_zone_id(payload) == "xyz-789"


def test_payload_sin_zone_id_lanza_error():
    with pytest.raises(InvalidClusterTrigger):
        extract_zone_id({"record": {}})
