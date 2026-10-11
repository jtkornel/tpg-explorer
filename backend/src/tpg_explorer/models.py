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
