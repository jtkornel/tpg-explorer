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


def test_api_schema_endpoint(schema_fixture):
    with respx.mock(base_url="http://mock-traverse:7691") as respx_mock:
        respx_mock.get("/api/schema").respond(json=schema_fixture)

        with TestClient(app) as test_client:
            response = test_client.get("/api/schema")
            assert response.status_code == 200
            data = response.json()
            assert "Person" in data["labels"]
            assert "Movie" in data["labels"]
            assert "ACTED_IN" in data["relationship_types"]
            assert data["property_keys"]["born"] == "integer"
            assert len(data["patterns"]) == 3


def test_api_node_detail_endpoint():
    # New query shape: [props, labels] (no eid column)
    node_query_response = {
        "columns": ["props", "labels"],
        "rows": [
            [
                {"name": "Keanu Reeves", "born": 1964},
                ["Person"],
            ]
        ],
        "total_rows": 1,
    }
    # Merged UNION ALL query: [direction, rel_type, cnt]
    summary_response = {
        "columns": ["direction", "rel_type", "cnt"],
        "rows": [["outgoing", "ACTED_IN", 5]],
        "total_rows": 1,
    }

    with respx.mock(base_url="http://mock-traverse:7691") as respx_mock:
        respx_mock.post("/api/query").side_effect = [
            respx.MockResponse(200, json=node_query_response),
            respx.MockResponse(200, json=summary_response),
        ]

        with TestClient(app) as test_client:
            response = test_client.get("/api/nodes/4:123")
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "4:123"
            assert data["labels"] == ["Person"]
            assert data["properties"]["name"]["value"] == "Keanu Reeves"
            assert data["properties"]["name"]["type"] == "string"
            assert data["properties"]["born"]["value"] == 1964
            assert data["properties"]["born"]["type"] == "integer"
            assert data["relations_summary"]["outgoing"]["ACTED_IN"] == 5
            assert data["relations_summary"]["incoming"] == {}


def test_api_node_detail_not_found():
    empty_response = {
        "columns": ["props", "labels"],
        "rows": [],
        "total_rows": 0,
    }
    with respx.mock(base_url="http://mock-traverse:7691") as respx_mock:
        respx_mock.post("/api/query").respond(json=empty_response)

        with TestClient(app) as test_client:
            response = test_client.get("/api/nodes/nonexistent")
            assert response.status_code == 404


def test_api_related_nodes_endpoint():
    count_response = {
        "columns": ["total"],
        "rows": [[1]],
        "total_rows": 1,
    }
    # New query shape: [r_props, m_props, m_labels, m_id]
    related_response = {
        "columns": ["r_props", "m_props", "m_labels", "m_id"],
        "rows": [
            [
                {"roles": ["Neo"]},
                {"title": "The Matrix", "released": 1999},
                ["Movie"],
                "4:456",
            ]
        ],
        "total_rows": 1,
    }

    with respx.mock(base_url="http://mock-traverse:7691") as respx_mock:
        respx_mock.post("/api/query").side_effect = [
            respx.MockResponse(200, json=count_response),
            respx.MockResponse(200, json=related_response),
        ]

        with TestClient(app) as test_client:
            response = test_client.get("/api/nodes/4:123/relations/ACTED_IN?direction=outgoing")
            assert response.status_code == 200
            data = response.json()
            assert data["relation_type"] == "ACTED_IN"
            assert data["direction"] == "outgoing"
            assert data["total"] == 1
            assert len(data["items"]) == 1
            item = data["items"][0]
            assert item["relation_properties"]["roles"]["type"] == "list"
            assert item["relation_properties"]["roles"]["original_length"] == 1
            assert item["node"]["id"] == "4:456"
            assert item["node"]["labels"] == ["Movie"]
            assert item["node"]["summary_properties"]["title"]["value"] == "The Matrix"


def test_api_related_nodes_invalid_direction():
    """Invalid direction values are rejected with 422 (Literal type validation)."""
    with TestClient(app) as test_client:
        response = test_client.get("/api/nodes/4:123/relations/ACTED_IN?direction=sideways")
        assert response.status_code == 422
