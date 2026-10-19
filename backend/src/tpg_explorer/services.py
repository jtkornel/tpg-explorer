"""Schema introspection and object query services.

These services sit between the FastAPI routes and the GraphDatabaseClient,
translating raw database responses into typed Pydantic models.
"""

from typing import Any, Literal

from fastapi import HTTPException

from tpg_explorer.client_interface import GraphDatabaseClient
from tpg_explorer.models import (
    NodeDetailResponse,
    PropertyValue,
    RelatedItem,
    RelatedNodesResponse,
    RelatedNodeSummary,
    RelationsSummary,
    SchemaPattern,
    SchemaResponse,
)

# ---------------------------------------------------------------------------
# Node identity matching
# ---------------------------------------------------------------------------
# Traverse/Neo4j exposes node identity in three forms depending on the
# database version and query dialect:
#   1. elementId(n)    — canonical Neo4j 5.x+ element ID, e.g. "4:abc123:0"
#   2. id(n)           — legacy internal numeric ID (integer)
#   3. toString(id(n)) — the numeric ID rendered as a string
# We match against all three so the API accepts any ID format the caller
# has, regardless of which form the underlying database produced.
NODE_ID_PREDICATE = "elementId(n) = $id OR toString(id(n)) = $id OR id(n) = $int_id"


def node_id_params(node_id: str) -> dict[str, Any]:
    """Build query parameters for matching a node by any identity flavour."""
    try:
        int_id = int(node_id)
    except ValueError:
        int_id = -1
    return {"id": node_id, "int_id": int_id}


# ---------------------------------------------------------------------------
# Property value protocol
# ---------------------------------------------------------------------------

DEFAULT_MAX_PROPERTY_LENGTH = 200


def _value_type(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, int):
        return "integer"
    if isinstance(v, float):
        return "float"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "list"
    if isinstance(v, dict):
        return "map"
    return "unknown"


def make_property_value(value: Any, max_length: int) -> PropertyValue:
    """Wrap a raw property value with type and truncation metadata.

    Strings longer than `max_length` are truncated with a recognisable marker.
    Lists and maps are replaced by a type/length descriptor so the frontend
    knows the shape without receiving potentially huge payloads.
    """
    vtype = _value_type(value)

    if vtype == "string" and len(value) > max_length:
        return PropertyValue(
            value=value[:max_length] + "…",
            type="string",
            truncated=True,
            original_length=len(value),
        )

    if vtype == "list":
        return PropertyValue(
            value={"_type": "list", "length": len(value)},
            type="list",
            truncated=False,
            original_length=len(value),
        )

    if vtype == "map":
        return PropertyValue(
            value={"_type": "map", "keys": list(value.keys())},
            type="map",
            truncated=False,
            original_length=len(value),
        )

    return PropertyValue(value=value, type=vtype)


def make_property_map(raw: dict[str, Any], max_length: int) -> dict[str, PropertyValue]:
    """Convert a raw property dict into a PropertyValue map."""
    return {k: make_property_value(v, max_length) for k, v in raw.items()}


# ---------------------------------------------------------------------------
# SchemaService
# ---------------------------------------------------------------------------


class SchemaService:
    def __init__(self, db_client: GraphDatabaseClient):
        self.db_client = db_client

    async def get_schema(self, database: str | None = None) -> SchemaResponse:
        raw = await self.db_client.get_raw_schema(database=database)
        return SchemaResponse(
            labels=raw.get("labels", []),
            relationship_types=raw.get("relationship_types", []),
            property_keys=self._normalize_property_keys(raw.get("property_keys", {})),
            patterns=self._normalize_patterns(raw.get("patterns", [])),
        )

    @staticmethod
    def _normalize_property_keys(raw_props: Any) -> dict[str, str]:
        """Normalize property keys to a {name: type} string mapping.

        Traverse may return property_keys as either a dict {name: type}
        or a list of {"property"/"name": ..., "type": ...} objects.
        """
        props: dict[str, str] = {}
        match raw_props:
            case dict():
                for k, v in raw_props.items():
                    props[str(k)] = str(v)
            case list():
                for item in raw_props:
                    match item:
                        case {"property": name, "type": ptype}:
                            props[str(name)] = str(ptype)
                        case {"name": name, "type": ptype}:
                            props[str(name)] = str(ptype)
                        case _:
                            props[str(item)] = "any"
        return props

    @staticmethod
    def _normalize_patterns(raw_patterns: Any) -> list[SchemaPattern]:
        """Extract valid {from_label, type, to_label} patterns from raw data."""
        patterns: list[SchemaPattern] = []
        if not isinstance(raw_patterns, list):
            return patterns
        for pat in raw_patterns:
            match pat:
                case {"from_label": fl, "type": t, "to_label": tl}:
                    patterns.append(
                        SchemaPattern(from_label=str(fl), type=str(t), to_label=str(tl))
                    )
        return patterns


# ---------------------------------------------------------------------------
# ObjectQueryService
# ---------------------------------------------------------------------------

Direction = Literal["incoming", "outgoing"]


class ObjectQueryService:
    def __init__(self, db_client: GraphDatabaseClient):
        self.db_client = db_client

    # -- public API --------------------------------------------------------

    async def get_node_detail(
        self,
        node_id: str,
        database: str | None = None,
        max_property_length: int = DEFAULT_MAX_PROPERTY_LENGTH,
    ) -> NodeDetailResponse:
        params = node_id_params(node_id)

        # --- Fetch the node itself ---
        node_result = await self.db_client.execute_query(
            query=(
                f"MATCH (n) WHERE {NODE_ID_PREDICATE} "
                "RETURN properties(n) AS props, labels(n) AS labels"
            ),
            dialect="cypher",
            database=database,
            parameters=params,
        )
        match node_result.rows:
            case []:
                raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found")
            case [[dict() as raw_props, list() as raw_labels], *_]:
                pass  # expected shape: [properties_dict, labels_list]
            case _:
                raise HTTPException(status_code=502, detail="Unexpected node query response shape")

        # --- Fetch relation counts (single query, both directions) ---
        summary = await self._fetch_relations_summary(node_id, database, params)

        return NodeDetailResponse(
            id=node_id,
            labels=[str(lbl) for lbl in raw_labels],
            properties=make_property_map(raw_props, max_property_length),
            relations_summary=summary,
        )

    async def get_related_nodes(
        self,
        node_id: str,
        relation_type: str,
        direction: Direction = "outgoing",
        limit: int = 50,
        offset: int = 0,
        database: str | None = None,
        max_property_length: int = DEFAULT_MAX_PROPERTY_LENGTH,
    ) -> RelatedNodesResponse:
        params = node_id_params(node_id)
        params.update({"offset": offset, "limit": limit})

        match_clause = self._build_match_clause(relation_type, direction)

        # --- Count total ---
        count_result = await self.db_client.execute_query(
            query=(f"MATCH (n) WHERE {NODE_ID_PREDICATE} {match_clause} RETURN count(m) AS total"),
            dialect="cypher",
            database=database,
            parameters=params,
        )
        match count_result.rows:
            case [[int() as total], *_]:
                pass
            case _:
                total = 0

        # --- Fetch page ---
        # Row shape: [r_props: dict, m_props: dict, m_labels: list, m_id: str | None]
        page_result = await self.db_client.execute_query(
            query=(
                f"MATCH (n) WHERE {NODE_ID_PREDICATE} "
                f"{match_clause} "
                "RETURN properties(r) AS r_props, properties(m) AS m_props, "
                "labels(m) AS m_labels, coalesce(elementId(m), toString(id(m))) AS m_id "
                "SKIP $offset LIMIT $limit"
            ),
            dialect="cypher",
            database=database,
            parameters=params,
        )

        items: list[RelatedItem] = []
        for row in page_result.rows:
            match row:
                case [dict() as r_props, dict() as m_props, list() as m_labels, str() as m_id]:
                    pass
                case [dict() as r_props, dict() as m_props, list() as m_labels, None]:
                    m_id = "unknown"
                case _:
                    r_props = row[0] if len(row) > 0 and isinstance(row[0], dict) else {}
                    m_props = row[1] if len(row) > 1 and isinstance(row[1], dict) else {}
                    m_labels = (
                        [str(l) for l in row[2]]
                        if len(row) > 2 and isinstance(row[2], list)
                        else []
                    )
                    m_id = str(row[3]) if len(row) > 3 and row[3] is not None else "unknown"

            items.append(
                RelatedItem(
                    relation_properties=make_property_map(r_props, max_property_length),
                    node=RelatedNodeSummary(
                        id=m_id,
                        labels=[str(l) for l in m_labels],
                        summary_properties=make_property_map(m_props, max_property_length),
                    ),
                )
            )

        return RelatedNodesResponse(
            relation_type=relation_type,
            direction=direction,
            items=items,
            total=total,
        )

    # -- private helpers ---------------------------------------------------

    async def _fetch_relations_summary(
        self,
        node_id: str,
        database: str | None,
        params: dict[str, Any],
    ) -> RelationsSummary:
        """Fetch incoming and outgoing relation counts in a single query.

        Uses UNION ALL to combine both directions, returning rows of shape
        [direction, rel_type, count] where direction is 'incoming' or 'outgoing'.
        """
        result = await self.db_client.execute_query(
            query=(
                f"MATCH (n) WHERE {NODE_ID_PREDICATE} "
                "MATCH (n)-[r]->() "
                "RETURN 'outgoing' AS direction, type(r) AS rel_type, count(r) AS cnt "
                "UNION ALL "
                f"MATCH (n) WHERE {NODE_ID_PREDICATE} "
                "MATCH (n)<-[r]-() "
                "RETURN 'incoming' AS direction, type(r) AS rel_type, count(r) AS cnt"
            ),
            dialect="cypher",
            database=database,
            parameters=params,
        )

        incoming: dict[str, int] = {}
        outgoing: dict[str, int] = {}
        for row in result.rows:
            match row:
                case [str() as direction, str() as rel_type, int() as cnt]:
                    if direction == "outgoing":
                        outgoing[rel_type] = cnt
                    else:
                        incoming[rel_type] = cnt
                case [str() as direction, str() as rel_type, (int() | float()) as cnt]:
                    count = int(cnt)
                    if direction == "outgoing":
                        outgoing[rel_type] = count
                    else:
                        incoming[rel_type] = count
        return RelationsSummary(incoming=incoming, outgoing=outgoing)

    @staticmethod
    def _build_match_clause(relation_type: str, direction: Direction) -> str:
        """Build the MATCH clause for related nodes, sanitising the rel type."""
        safe_rel_type = "".join(c for c in relation_type if c.isalnum() or c == "_")
        rel_pattern = f":`{safe_rel_type}`" if safe_rel_type else ""
        arrow = "<-[r{pat}]-" if direction == "incoming" else "-[r{pat}]->"
        return f"MATCH (n){arrow.format(pat=rel_pattern)}(m)"
