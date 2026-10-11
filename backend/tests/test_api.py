import pytest
import respx
from fastapi.testclient import TestClient

from tpg_explorer.main import app, set_db_client
from tpg_explorer.traverse_client import TraverseHttpClient


@pytest.fixture(autouse=True)
def setup_client():
    client = TraverseHttpClient(base_url="http://mock-traverse:7691", api_key="test-key")
    set_db_client(client)
    yield
    set_db_client(None)


def test_api_health_endpoint(health_fixture):
    with respx.mock(base_url="http://mock-traverse:7691") as respx_mock:
        respx_mock.get("/api/health").respond(json=health_fixture)

        with TestClient(app) as test_client:
            response = test_client.get("/api/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert data["database_connected"] is True
            assert data["features"]["gql"] is True


def test_api_query_endpoint(query_fixture):
    with respx.mock(base_url="http://mock-traverse:7691") as respx_mock:
        route = respx_mock.post("/api/query").respond(json=query_fixture)

        with TestClient(app) as test_client:
            payload = {
                "query": "MATCH (p:Person) RETURN p.name",
                "dialect": "gql",
            }
            response = test_client.post("/api/query", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["columns"] == ["p.name", "decade"]
            assert len(data["rows"]) == 3
            assert data["total_rows"] == 3

        assert route.called
        assert route.calls.last.request.headers["X-Query-Dialect"] == "gql"
