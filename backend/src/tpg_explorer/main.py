from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from tpg_explorer.client_interface import GraphDatabaseClient
from tpg_explorer.config import settings
from tpg_explorer.models import (
    HealthResponse,
    NodeDetailResponse,
    QueryRequest,
    QueryResponse,
    RelatedNodesResponse,
    SchemaResponse,
)
from tpg_explorer.services import ObjectQueryService, SchemaService
from tpg_explorer.traverse_client import TraverseHttpClient

_client: GraphDatabaseClient | None = None


def get_db_client() -> GraphDatabaseClient:
    global _client
    if _client is None:
        _client = TraverseHttpClient(
            base_url=settings.traverse_url,
            api_key=settings.traverse_api_key,
            default_database=settings.default_database,
        )
    return _client


def set_db_client(client: GraphDatabaseClient | None) -> None:
    global _client
    _client = client


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    client = get_db_client()
    yield
    # Shutdown
    if client:
        await client.close()


app = FastAPI(
    title="Typed Property Graph Explorer API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
async def health():
    client = get_db_client()
    health_info = await client.check_health()
    is_connected = health_info.get("status") not in ("unreachable", "unhealthy")
    return HealthResponse(
        status="ok",
        database_connected=is_connected,
        target_url=settings.traverse_url,
        features=health_info.get("features", {}),
    )


@app.post("/api/query", response_model=QueryResponse)
async def run_query(request: QueryRequest):
    client = get_db_client()
    return await client.execute_query(
        query=request.query,
        dialect=request.dialect,
        database=request.database,
        parameters=request.parameters,
    )


@app.get("/api/schema", response_model=SchemaResponse)
async def get_schema(database: str | None = None):
    client = get_db_client()
    service = SchemaService(client)
    return await service.get_schema(database=database)


@app.get("/api/nodes/{node_id}", response_model=NodeDetailResponse)
async def get_node_detail(node_id: str, database: str | None = None):
    client = get_db_client()
    service = ObjectQueryService(client)
    return await service.get_node_detail(node_id=node_id, database=database)


@app.get("/api/nodes/{node_id}/relations/{relation_type}", response_model=RelatedNodesResponse)
async def get_related_nodes(
    node_id: str,
    relation_type: str,
    direction: str = Query("outgoing", pattern="^(outgoing|incoming)$"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    database: str | None = None,
):
    client = get_db_client()
    service = ObjectQueryService(client)
    return await service.get_related_nodes(
        node_id=node_id,
        relation_type=relation_type,
        direction=direction,
        limit=limit,
        offset=offset,
        database=database,
    )
