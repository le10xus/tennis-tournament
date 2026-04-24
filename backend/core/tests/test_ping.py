import pytest


@pytest.mark.django_db
def test_ping_ok(api_client):
    response = api_client.get("/api/ping/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": 1}
