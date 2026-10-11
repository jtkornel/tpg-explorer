from fastapi import HTTPException

from tpg_explorer.client_interface import GraphDatabaseClient
from tpg_explorer.models import (
    NodeDetailResponse,
    RelatedItem,
    RelatedNodesResponse,
    RelatedNodeSummary,
    RelationsSummary,
    SchemaPattern,
    SchemaResponse,
)


class SchemaService:
    def __init__(self, db_client: GraphDatabaseClient):
        self.db_client = db_client

    async def get_schema(self, database: str | None = None) -> SchemaResponse:
        raw = await self.db_client.get_raw_schema(database=database)
        labels = raw.get("labels", [])
        rel_types = raw.get("relationship_types", [])
        raw_props = raw.get("property_keys", {})

        # Normalize property keys to string mapping
        props: dict[str, str] = {}
        if isinstance(raw_props, dict):
            for k, v in raw_props.items():
                props[str(k)] = str(v)
        elif isinstance(raw_props, list):
            for item in raw_props:
                if isinstance(item, dict):
                    props[str(item.get("property", item.get("name", "")))] = str(
                        item.get("type", "any")
                    )
                else:
                    props[str(item)] = "any"

        # Normalize patterns
        patterns: list[SchemaPattern] = []
        for pat in raw.get("patterns", []):
            if (
                isinstance(pat, dict)
                and "from_label" in pat
                and "type" in pat
                and "to_label" in pat
            ):
                patterns.append(
                    SchemaPattern(
                        from_label=str(pat["from_label"]),
                        type=str(pat["type"]),
                        to_label=str(pat["to_label"]),
                    )
                )

        return SchemaResponse(
            labels=labels,
            relationship_types=rel_types,
            property_keys=props,
            patterns=patterns,
        )


class ObjectQueryService:
    def __init__(self, db_client: GraphDatabaseClient):
        self.db_client = db_client

    async def get_node_detail(
        self, node_id: str, database: str | None = None
    ) -> NodeDetailResponse:
        query = (
            "MATCH (n) WHERE elementId(n) = $id OR toString(id(n)) = $id OR id(n) = $int_id "
            "RETURN n, labels(n) AS labels, elementId(n) AS eid"
        )
        try:
            int_id = int(node_id)
        except ValueError:
            int_id = -1

        result = await self.db_client.execute_query(
            query=query,
            dialect="cypher",
            database=database,
            parameters={"id": node_id, "int_id": int_id},
        )

        if not result.rows:
            raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found")

        row = result.rows[0]
        raw_node = row[0]
        raw_labels = row[1] if len(row) > 1 else []
        node_properties = raw_node if isinstance(raw_node, dict) else {}
        labels = [str(lbl) for lbl in raw_labels] if isinstance(raw_labels, list) else []

        out_summary: dict[str, int] = {}
        in_summary: dict[str, int] = {}

        # Query outgoing types
        out_query = (
            "MATCH (n) WHERE elementId(n) = $id OR toString(id(n)) = $id OR id(n) = $int_id "
            "MATCH (n)-[r]->() RETURN type(r) AS rel_type, count(r) AS cnt"
        )
        out_res = await self.db_client.execute_query(
            query=out_query,
            dialect="cypher",
            database=database,
            parameters={"id": node_id, "int_id": int_id},
        )
        for r in out_res.rows:
            if r and r[0] is not None:
                out_summary[str(r[0])] = int(r[1])

        # Query incoming types
        in_query = (
            "MATCH (n) WHERE elementId(n) = $id OR toString(id(n)) = $id OR id(n) = $int_id "
            "MATCH (n)<-[r]-() RETURN type(r) AS rel_type, count(r) AS cnt"
        )
        in_res = await self.db_client.execute_query(
            query=in_query,
            dialect="cypher",
            database=database,
            parameters={"id": node_id, "int_id": int_id},
        )
        for r in in_res.rows:
            if r and r[0] is not None:
                in_summary[str(r[0])] = int(r[1])

        return NodeDetailResponse(
            id=node_id,
            labels=labels,
            properties=node_properties,
            relations_summary=RelationsSummary(
                incoming=in_summary,
                outgoing=out_summary,
            ),
        )

    async def get_related_nodes(
        self,
        node_id: str,
        relation_type: str,
        direction: str = "outgoing",
        limit: int = 50,
        offset: int = 0,
        database: str | None = None,
    ) -> RelatedNodesResponse:
        try:
            int_id = int(node_id)
        except ValueError:
            int_id = -1

        # Sanitize relation type: alphanumeric and underscores only
        safe_rel_type = "".join(c for c in relation_type if c.isalnum() or c == "_")
        rel_pattern = f":`{safe_rel_type}`" if safe_rel_type else ""

        if direction == "incoming":
            match_clause = f"MATCH (n)<-[r{rel_pattern}]-(m)"
        else:
            match_clause = f"MATCH (n)-[r{rel_pattern}]->(m)"

        query = (
            f"MATCH (n) WHERE elementId(n) = $id OR toString(id(n)) = $id OR id(n) = $int_id "
            f"{match_clause} "
            f"RETURN properties(r) AS r_props, m, labels(m) AS m_labels, coalesce(elementId(m), toString(id(m))) AS m_id "
            f"SKIP $offset LIMIT $limit"
        )

        count_query = (
            f"MATCH (n) WHERE elementId(n) = $id OR toString(id(n)) = $id OR id(n) = $int_id "
            f"{match_clause} "
            f"RETURN count(m) AS total"
        )

        total_res = await self.db_client.execute_query(
            query=count_query,
            dialect="cypher",
            database=database,
            parameters={"id": node_id, "int_id": int_id},
        )
        total = total_res.rows[0][0] if total_res.rows else 0

        res = await self.db_client.execute_query(
            query=query,
            dialect="cypher",
            database=database,
            parameters={"id": node_id, "int_id": int_id, "offset": offset, "limit": limit},
        )

        items: list[RelatedItem] = []
        for row in res.rows:
            r_props = row[0] if isinstance(row[0], dict) else {}
            m_props = row[1] if isinstance(row[1], dict) else {}
            m_labels = [str(l) for l in row[2]] if isinstance(row[2], list) else []
            m_id = str(row[3]) if len(row) > 3 and row[3] is not None else "unknown"

            # Summary properties: exclude huge nested objects if any, take top properties
            summary_props = {
                k: v
                for k, v in m_props.items()
                if not isinstance(v, (dict, list)) or len(str(v)) < 100
            }

            items.append(
                RelatedItem(
                    relation_properties=r_props,
                    node=RelatedNodeSummary(
                        id=m_id,
                        labels=m_labels,
                        summary_properties=summary_props,
                    ),
                )
            )

        return RelatedNodesResponse(
            relation_type=relation_type,
            direction="incoming" if direction == "incoming" else "outgoing",
            items=items,
            total=int(total),
        )
