from typing import Any

import httpx
from fastapi import HTTPException

from tpg_explorer.client_interface import GraphDatabaseClient
from tpg_explorer.models import QueryResponse


class TraverseHttpClient(GraphDatabaseClient):
    """Client implementing GraphDatabaseClient over Truespar Traverse REST API."""

    def __init__(self, base_url: str, api_key: str = "", default_database: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.default_database = default_database

        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=30.0,
        )

    async def execute_query(
        self,
        query: str,
        dialect: str = "gql",
        database: str | None = None,
        parameters: dict[str, Any] | None = None,
    ) -> QueryResponse:
        db = database or self.default_database
        payload: dict[str, Any] = {
            "query": query,
            "dialect": dialect.lower(),
        }
        if db:
            payload["database"] = db
        if parameters:
            payload["parameters"] = parameters

        headers: dict[str, str] = {}
        if dialect.lower() == "gql":
            headers["X-Query-Dialect"] = "gql"
        else:
            headers["X-Query-Dialect"] = "cypher"

        try:
            resp = await self._client.post("/api/query", json=payload, headers=headers)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502, detail=f"Database connection error: {exc}"
            ) from exc

        if resp.status_code >= 400:
            error_detail = resp.text
            try:
                err_json = resp.json()
                if "error" in err_json:
                    error_detail = err_json["error"]
                elif "message" in err_json:
                    error_detail = err_json["message"]
            except ValueError:
                pass
            raise HTTPException(status_code=resp.status_code, detail=f"Query error: {error_detail}")

        data = resp.json()
        return QueryResponse(
            columns=data.get("columns", []),
            rows=data.get("rows", []),
            total_rows=data.get("total_rows", len(data.get("rows", []))),
            truncated=data.get("truncated", False),
            time_ms=float(data.get("time_ms", 0.0)),
        )

    async def get_raw_schema(self, database: str | None = None) -> dict[str, Any]:
        params = {}
        db = database or self.default_database
        if db:
            params["database"] = db

        try:
            resp = await self._client.get("/api/schema", params=params)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502, detail=f"Database connection error: {exc}"
            ) from exc

        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=f"Schema error: {resp.text}")

        return resp.json()

    async def check_health(self) -> dict[str, Any]:
        try:
            resp = await self._client.get("/api/health")
            if resp.status_code == 200:
                return resp.json()
            return {"status": "unhealthy", "code": resp.status_code}
        except httpx.RequestError as exc:
            return {"status": "unreachable", "error": str(exc)}

    async def close(self) -> None:
        await self._client.aclose()
