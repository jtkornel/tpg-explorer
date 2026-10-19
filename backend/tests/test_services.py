"""Service-layer unit tests.

These tests exercise SchemaService and ObjectQueryService directly with a
stub GraphDatabaseClient, without going through the FastAPI TestClient.
This gives deeper coverage of business logic (truncation, parsing, error
handling) without ballooning test code.
"""

from typing import Any

import pytest
from fastapi import HTTPException

from tpg_explorer.models import QueryResponse
from tpg_explorer.services import (
    DEFAULT_MAX_PROPERTY_LENGTH,
    ObjectQueryService,
    SchemaService,
    make_property_value,
    node_id_params,
)


class StubGraphClient:
    """Minimal stub implementing GraphDatabaseClient for unit tests."""

    def __init__(
        self, responses: list[QueryResponse] | None = None, raw_schema: dict | None = None
    ):
        self._responses = list(responses or [])
        self._raw_schema = raw_schema or {}
        self.queries: list[dict[str, Any]] = []

    async def execute_query(
        self,
        query: str,
        dialect: str = "gql",
        database: str | None = None,
        parameters: dict[str, Any] | None = None,
    ) -> QueryResponse:
        self.queries.append({"query": query, "dialect": dialect, "parameters": parameters})
        if self._responses:
            return self._responses.pop(0)
        return QueryResponse()

    async def get_raw_schema(self, database: str | None = None) -> dict[str, Any]:
        return self._raw_schema

    async def check_health(self) -> dict[str, Any]:
        return {"status": "ok"}

    async def close(self) -> None:
        pass


# ---------------------------------------------------------------------------
# node_id_params
# ---------------------------------------------------------------------------


def test_node_id_params_with_numeric_string():
    params = node_id_params("42")
    assert params == {"id": "42", "int_id": 42}


def test_node_id_params_with_element_id():
    params = node_id_params("4:abc:0")
    assert params == {"id": "4:abc:0", "int_id": -1}


# ---------------------------------------------------------------------------
# make_property_value (truncation protocol)
# ---------------------------------------------------------------------------


def test_property_value_short_string_not_truncated():
    pv = make_property_value("hello", max_length=100)
    assert pv.value == "hello"
    assert pv.type == "string"
    assert pv.truncated is False
    assert pv.original_length is None


def test_property_value_long_string_truncated():
    long_str = "x" * 500
    pv = make_property_value(long_str, max_length=100)
    assert pv.truncated is True
    assert pv.type == "string"
    assert pv.original_length == 500
    assert len(pv.value) == 101  # 100 chars + ellipsis
    assert pv.value.endswith("…")


def test_property_value_integer():
    pv = make_property_value(42, max_length=100)
    assert pv.value == 42
    assert pv.type == "integer"
    assert pv.truncated is False


def test_property_value_boolean():
    pv = make_property_value(True, max_length=100)
    assert pv.type == "boolean"


def test_property_value_null():
    pv = make_property_value(None, max_length=100)
    assert pv.type == "null"


def test_property_value_list_shows_length():
    pv = make_property_value(["a", "b", "c"], max_length=100)
    assert pv.type == "list"
    assert pv.original_length == 3
    assert pv.value == {"_type": "list", "length": 3}


def test_property_value_map_shows_keys():
    pv = make_property_value({"x": 1, "y": 2}, max_length=100)
    assert pv.type == "map"
    assert pv.original_length == 2
    assert pv.value == {"_type": "map", "keys": ["x", "y"]}


# ---------------------------------------------------------------------------
# SchemaService
# ---------------------------------------------------------------------------


async def test_schema_service_normalizes_dict_property_keys():
    client = StubGraphClient(
        raw_schema={
            "labels": ["Person"],
            "relationship_types": ["ACTED_IN"],
            "property_keys": {"name": "string", "born": "integer"},
            "patterns": [{"from_label": "Person", "type": "ACTED_IN", "to_label": "Movie"}],
        }
    )
    service = SchemaService(client)
    schema = await service.get_schema()
    assert schema.labels == ["Person"]
    assert schema.property_keys == {"name": "string", "born": "integer"}
    assert len(schema.patterns) == 1
    assert schema.patterns[0].from_label == "Person"


async def test_schema_service_normalizes_list_property_keys():
    client = StubGraphClient(
        raw_schema={
            "labels": [],
            "relationship_types": [],
            "property_keys": [
                {"property": "name", "type": "string"},
                {"name": "born", "type": "integer"},
            ],
            "patterns": [],
        }
    )
    service = SchemaService(client)
    schema = await service.get_schema()
    assert schema.property_keys == {"name": "string", "born": "integer"}


async def test_schema_service_handles_empty_schema():
    client = StubGraphClient(raw_schema={})
    service = SchemaService(client)
    schema = await service.get_schema()
    assert schema.labels == []
    assert schema.property_keys == {}
    assert schema.patterns == []


async def test_schema_service_normalizes_non_string_keys_and_types():
    """Property keys and types are coerced to strings during normalization."""
    client = StubGraphClient(
        raw_schema={
            "labels": [],
            "relationship_types": [],
            "property_keys": {123: 456, "name": None, True: "boolean"},
            "patterns": [],
        }
    )
    service = SchemaService(client)
    schema = await service.get_schema()
    assert schema.property_keys == {"123": "456", "name": "None", "True": "boolean"}


async def test_schema_service_normalizes_list_with_mixed_items():
    """List-form property_keys handles both 'property' and 'name' key styles,
    plus non-dict items and dicts with unexpected shapes."""
    client = StubGraphClient(
        raw_schema={
            "labels": [],
            "relationship_types": [],
            "property_keys": [
                {"property": "title", "type": "string"},
                {"name": "born", "type": "integer"},
                "orphan_key",
                {"unexpected": "shape"},
            ],
            "patterns": [],
        }
    )
    service = SchemaService(client)
    schema = await service.get_schema()
    assert schema.property_keys["title"] == "string"
    assert schema.property_keys["born"] == "integer"
    assert schema.property_keys["orphan_key"] == "any"
    # Dicts without 'property'/'name' keys fall through to the catch-all
    assert schema.property_keys["{'unexpected': 'shape'}"] == "any"


async def test_schema_service_normalizes_non_dict_non_list_property_keys():
    """Non-dict, non-list property_keys (e.g. a string) yields an empty mapping."""
    client = StubGraphClient(
        raw_schema={
            "labels": [],
            "relationship_types": [],
            "property_keys": "unexpected",
            "patterns": [],
        }
    )
    service = SchemaService(client)
    schema = await service.get_schema()
    assert schema.property_keys == {}


# ---------------------------------------------------------------------------
# ObjectQueryService — get_node_detail
# ---------------------------------------------------------------------------


async def test_get_node_detail_success():
    client = StubGraphClient(
        responses=[
            QueryResponse(rows=[[{"name": "Keanu", "born": 1964}, ["Person"]]]),
            QueryResponse(rows=[["outgoing", "ACTED_IN", 5], ["incoming", "DIRECTED", 2]]),
        ]
    )
    service = ObjectQueryService(client)
    result = await service.get_node_detail("4:123")

    assert result.id == "4:123"
    assert result.labels == ["Person"]
    assert result.properties["name"].value == "Keanu"
    assert result.properties["name"].type == "string"
    assert result.properties["born"].value == 1964
    assert result.relations_summary.outgoing == {"ACTED_IN": 5}
    assert result.relations_summary.incoming == {"DIRECTED": 2}


async def test_get_node_detail_not_found():
    client = StubGraphClient(responses=[QueryResponse(rows=[])])
    service = ObjectQueryService(client)
    with pytest.raises(HTTPException) as exc_info:
        await service.get_node_detail("nonexistent")
    assert exc_info.value.status_code == 404


async def test_get_node_detail_truncates_long_string():
    long_name = "A" * 500
    client = StubGraphClient(
        responses=[
            QueryResponse(rows=[[{"name": long_name}, ["Person"]]]),
            QueryResponse(rows=[]),
        ]
    )
    service = ObjectQueryService(client)
    result = await service.get_node_detail("4:123", max_property_length=50)

    pv = result.properties["name"]
    assert pv.truncated is True
    assert pv.original_length == 500
    assert len(pv.value) == 51  # 50 + ellipsis


async def test_get_node_detail_uses_default_max_length():
    long_name = "B" * (DEFAULT_MAX_PROPERTY_LENGTH + 1)
    client = StubGraphClient(
        responses=[
            QueryResponse(rows=[[{"name": long_name}, ["Person"]]]),
            QueryResponse(rows=[]),
        ]
    )
    service = ObjectQueryService(client)
    result = await service.get_node_detail("4:123")
    assert result.properties["name"].truncated is True


async def test_get_node_detail_merged_summary_query():
    """Verify only 2 queries are made (node + merged UNION ALL summary)."""
    client = StubGraphClient(
        responses=[
            QueryResponse(rows=[[{"name": "X"}, ["Person"]]]),
            QueryResponse(rows=[["outgoing", "KNOWS", 3]]),
        ]
    )
    service = ObjectQueryService(client)
    await service.get_node_detail("4:123")
    assert len(client.queries) == 2
    # Second query should contain UNION ALL
    assert "UNION ALL" in client.queries[1]["query"]


# ---------------------------------------------------------------------------
# ObjectQueryService — get_related_nodes
# ---------------------------------------------------------------------------


async def test_get_related_nodes_outgoing():
    client = StubGraphClient(
        responses=[
            QueryResponse(rows=[[1]]),  # count
            QueryResponse(
                rows=[
                    [
                        {"roles": ["Neo"]},
                        {"title": "The Matrix"},
                        ["Movie"],
                        "4:456",
                    ]
                ]
            ),
        ]
    )
    service = ObjectQueryService(client)
    result = await service.get_related_nodes("4:123", "ACTED_IN", direction="outgoing")

    assert result.total == 1
    assert len(result.items) == 1
    item = result.items[0]
    assert item.node.id == "4:456"
    assert item.node.labels == ["Movie"]
    assert item.node.summary_properties["title"].value == "The Matrix"
    assert item.relation_properties["roles"].type == "list"


async def test_get_related_nodes_incoming():
    client = StubGraphClient(
        responses=[
            QueryResponse(rows=[[0]]),
            QueryResponse(rows=[]),
        ]
    )
    service = ObjectQueryService(client)
    result = await service.get_related_nodes("4:123", "ACTED_IN", direction="incoming")

    assert result.direction == "incoming"
    assert result.total == 0
    assert result.items == []
    # Verify the query uses incoming arrow pattern
    assert "<-[r" in client.queries[0]["query"]


async def test_get_related_nodes_pagination_params():
    client = StubGraphClient(
        responses=[
            QueryResponse(rows=[[0]]),
            QueryResponse(rows=[]),
        ]
    )
    service = ObjectQueryService(client)
    await service.get_related_nodes("4:123", "KNOWS", limit=10, offset=20)

    params = client.queries[0]["parameters"]
    assert params["limit"] == 10
    assert params["offset"] == 20


async def test_get_related_nodes_truncates_properties():
    long_title = "T" * 300
    client = StubGraphClient(
        responses=[
            QueryResponse(rows=[[1]]),
            QueryResponse(
                rows=[
                    [
                        {},
                        {"title": long_title},
                        ["Movie"],
                        "4:456",
                    ]
                ]
            ),
        ]
    )
    service = ObjectQueryService(client)
    result = await service.get_related_nodes("4:123", "ACTED_IN", max_property_length=50)
    pv = result.items[0].node.summary_properties["title"]
    assert pv.truncated is True
    assert pv.original_length == 300


async def test_get_related_nodes_sanitizes_relation_type():
    """Relation types with special characters are sanitized in the query."""
    client = StubGraphClient(
        responses=[
            QueryResponse(rows=[[0]]),
            QueryResponse(rows=[]),
        ]
    )
    service = ObjectQueryService(client)
    await service.get_related_nodes("4:123", "BAD;TYPE")
    query = client.queries[0]["query"]
    assert "BADTYPE" in query
    assert "BAD;TYPE" not in query
