from typing import Any, Literal

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(..., description="Query string in GQL or Cypher")
    dialect: Literal["gql", "cypher"] = Field("gql", description="Query language dialect")
    database: str | None = Field(None, description="Target database name")
    parameters: dict[str, Any] | None = Field(default_factory=dict, description="Query parameters")


class QueryResponse(BaseModel):
    columns: list[str] = Field(default_factory=list, description="Column names")
    rows: list[list[Any]] = Field(default_factory=list, description="Result rows")
    total_rows: int = Field(0, description="Total row count")
    truncated: bool = Field(False, description="Whether rows were truncated")
    time_ms: float = Field(0.0, description="Total execution time in milliseconds")


class HealthResponse(BaseModel):
    status: str = "ok"
    database_connected: bool = True
    target_url: str = ""
    features: dict[str, Any] = Field(default_factory=dict)


class SchemaPattern(BaseModel):
    from_label: str
    type: str
    to_label: str


class SchemaResponse(BaseModel):
    labels: list[str] = Field(default_factory=list)
    relationship_types: list[str] = Field(default_factory=list)
    property_keys: dict[str, str] = Field(default_factory=dict)
    patterns: list[SchemaPattern] = Field(default_factory=list)


class RelationsSummary(BaseModel):
    incoming: dict[str, int] = Field(default_factory=dict)
    outgoing: dict[str, int] = Field(default_factory=dict)


class PropertyValue(BaseModel):
    """A property value with truncation metadata.

    The frontend detects truncation via `truncated` and `original_length`.
    `type` reveals the value category, including container types and lengths.
    """

    value: Any
    type: str  # "string" | "integer" | "float" | "boolean" | "null" | "list" | "map" | "unknown"
    truncated: bool = False
    original_length: int | None = None  # char count for strings, element count for lists


class NodeDetailResponse(BaseModel):
    id: str
    labels: list[str] = Field(default_factory=list)
    properties: dict[str, PropertyValue] = Field(default_factory=dict)
    relations_summary: RelationsSummary = Field(default_factory=RelationsSummary)


class RelatedNodeSummary(BaseModel):
    id: str
    labels: list[str] = Field(default_factory=list)
    summary_properties: dict[str, PropertyValue] = Field(default_factory=dict)


class RelatedItem(BaseModel):
    relation_properties: dict[str, PropertyValue] = Field(default_factory=dict)
    node: RelatedNodeSummary


class RelatedNodesResponse(BaseModel):
    relation_type: str
    direction: Literal["incoming", "outgoing"]
    items: list[RelatedItem] = Field(default_factory=list)
    total: int = 0
