from typing import Any, Protocol

from tpg_explorer.models import QueryResponse


class GraphDatabaseClient(Protocol):
    """Abstract interface for graph database connectivity."""

    async def execute_query(
        self,
        query: str,
        dialect: str = "gql",
        database: str | None = None,
        parameters: dict[str, Any] | None = None,
    ) -> QueryResponse:
        """Execute a graph query using GQL or Cypher."""
        ...

    async def get_raw_schema(self, database: str | None = None) -> dict[str, Any]:
        """Fetch raw schema definitions from the target database."""
        ...

    async def check_health(self) -> dict[str, Any]:
        """Check status of target database."""
        ...

    async def close(self) -> None:
        """Close client connection resources."""
        ...
