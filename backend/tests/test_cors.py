import pytest


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173", "null"])
def test_the_vite_dev_server_and_electron_may_call_the_api(client, origin):
    response = client.options(
        "/api/courses",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_other_origins_are_not_allowed(client):
    response = client.get("/api/courses", headers={"Origin": "https://evil.example"})

    assert "access-control-allow-origin" not in response.headers
