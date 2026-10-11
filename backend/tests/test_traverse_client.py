import pytest
import respx
from fastapi import HTTPException

from tpg_explorer.traverse_client import TraverseHttpClient


@pytest.mark.asyncio
async def test_traverse_client_query_gql(query_fixture):
    client = TraverseHttpClient(base_url="http://mock-traverse:7691", api_key="tvs_test_key_123")

    with respx.mock(base_url="http://mock-traverse:7691") as respx_mock:
        route = respx_mock.post("/api/query").respond(json=query_fixture)

        response = await client.execute_query(
            query="MATCH (p:Person)-[:ACTED_IN]->(m:Movie) RETURN p.name, m.released",
            dialect="gql",
        )

        assert route.called
        last_request = route.calls.last.request
        assert last_request.headers["X-Query-Dialect"] == "gql"
        assert last_request.headers["Authorization"] == "Bearer tvs_test_key_123"
        assert response.columns == ["p.name", "decade"]
        assert len(response.rows) == 3
        assert response.total_rows == 3
        assert not response.truncated

    await client.close()


@pytest.mark.asyncio
async def test_traverse_client_query_cypher(query_fixture):
    client = TraverseHttpClient(base_url="http://mock-traverse:7691")

    with respx.mock(base_url="http://mock-traverse:7691") as respx_mock:
        route = respx_mock.post("/api/query").respond(json=query_fixture)

        await client.execute_query(
            query="MATCH (n) RETURN n LIMIT 10",
            dialect="cypher",
        )

        assert route.called
        assert route.calls.last.request.headers["X-Query-Dialect"] == "cypher"

    await client.close()


@pytest.mark.asyncio
async def test_traverse_client_error_envelope():
    client = TraverseHttpClient(base_url="http://mock-traverse:7691")

    with respx.mock(base_url="http://mock-traverse:7691") as respx_mock:
        respx_mock.post("/api/query").respond(
            status_code=400,
            json={"error": "Syntax error at or near 'INVALID'"},
        )

        with pytest.raises(HTTPException) as exc_info:
            await client.execute_query("INVALID QUERY", dialect="gql")

        assert exc_info.value.status_code == 400
        assert "Syntax error" in exc_info.value.detail

    await client.close()


@pytest.mark.asyncio
async def test_traverse_client_health(health_fixture):
    client = TraverseHttpClient(base_url="http://mock-traverse:7691")

    with respx.mock(base_url="http://mock-traverse:7691") as respx_mock:
        respx_mock.get("/api/health").respond(json=health_fixture)

        health = await client.check_health()
        assert health["features"]["gql"] is True
        assert health["version"] == "0.8.2"

    await client.close()
