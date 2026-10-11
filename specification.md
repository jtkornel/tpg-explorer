# Typed property graph explorer

tpg-explorer will be a web-based tool to explore property graph databases with schemas, to get insights and overview without necessarily writing detailed queries.

### Object detail views
Many tools can visualize objects and relations as a graph, but this can often result in a cluttered view which is hard to interpret, unless a query has already narrowed down the scope.

An alternative approach taken by tpg-explorer is to offer generated summary pages per object, which in addition to properties show:
* Summaries of incoming and outgoing relations sorted by relation type.
    * Each relation summary is simple (number of relations as a minimum) but is selectable in a way that affects the rest of the page.
* For a selected relation type, the related objects are listed:
    * Listed related objects have a more condensed per-object summary than the top-level object of the page. In particular, it enables browsing to other full object summaries through clickable links.
    * Relation properties are also shown in the list of related objects.
* Navigation/entry point:
    * Search bar to locate nodes by ID, label, or property values.
    * Click-through links from the Schema and Table/Graph query results.

This is similar to the detail view in TypeDB Studio, described for instance in:
https://typedb.com/blog/inside-typedb-studio-part-3-exploration

### Table and graph view

The explorer should also be able to show the result of a query like `MATCH (a)-[r]->(b) RETURN a, r, b LIMIT 250` as either:
* A table / list view (tabular representation of records, nodes, and relationships).
* An interactive graph view powered by **Cytoscape.js** with layout options (e.g., cose/force-directed, hierarchical/breadthfirst), node inspection, and pan/zoom controls.

### Schema view

The explorer should be able to show the database schema:
* Inspects graph schema through the connection layer:
    * Primary approach (Truespar Traverse HTTP/REST): `GET /api/schema` (which returns node labels, relationship types, property keys with data types, indexes, and constraints).
    * Secondary/alternative approaches: MCP `schema` tool via `POST /api/mcp`, Cypher introspection/procedures if available, or sampling-based schema inference.
* Displays node types/labels, relationship types, expected source/target types, and associated property types.

## Architecture and tech stack

* **Frontend**:
    * **React** with **TypeScript** and **Vite**.
    * **Graph Visualization**: Cytoscape.js (with react-cytoscapejs).
    * **State & Data Fetching**: TanStack Query (React Query) and lightweight UI components.
* **Backend**:
    * **Python 3.11+** with **FastAPI**.
    * **Environment & Package Management**: **`uv`** for Python virtual environments, dependency locking, and package management (`uv venv`, `uv pip`, `pyproject.toml` with `uv.lock`).
    * REST endpoints for executing queries, introspecting schemas, and fetching per-object summaries.
* **Target Database**:
    * **Truespar Traverse** (primary target for testing and compatibility).
* **Connection Layer Abstraction**:
    * Pluggable database driver interface (e.g. `GraphDatabaseClient` protocol/ABC) to decouple connection and query transport from the rest of the application.
    * **Traverse HTTP Client** (Primary implementation for initial release):
        * Uses HTTP API (`http://<host>:7691`) with API key authentication (`Authorization: Bearer tvs_...` or `X-API-Key`).
        * Query execution via `POST /api/query` supporting **GQL** (via `X-Query-Dialect: gql` header or `"dialect": "gql"` body parameter) and **Cypher** fallback.
        * Schema retrieval via `GET /api/schema` (with MCP `POST /api/mcp` schema tool as alternative).
    * **Bolt Driver** (Optional / Future implementation):
        * Uses `neo4j` Python driver for Cypher-only Bolt endpoints (Bolt does not support GQL in Traverse).
* **Query Languages**:
    * Primary query language: **GQL** (ISO/IEC 39075).
    * Fallback query language: **Cypher**.
    * Dialect negotiation: UI allows selecting GQL vs. Cypher, with backend automatically sending appropriate headers to the target database.

## Testing and validation strategy

### Backend testing strategy (per PR)
* **Framework**: `pytest` + `httpx` (`TestClient`) with `pytest-asyncio`.
* **Testing levels**:
    * **Unit tests (Mocked transport)**: Use `pytest-mock` or `respx` to mock external Traverse HTTP calls (`respx.mock`), simulating Traverse responses (success, error envelopes, GQL dialect header validations, row limits/truncation). Runs in seconds without running database instances.
    * **Integration tests (Live / Containerized / Ephemeral)**: Integration test harness that connects to a live Traverse instance if available (via environment variable `TRAVERSE_URL` / `TRAVERSE_API_KEY`), running queries and verifying schema endpoints against a standard sample graph (e.g. Movies / Pokec). Tests automatically skip or run against mock fixtures if the live server is unreachable.
* **Per-PR validation plan**:
    * **PR 1**:
        * Test FastAPI client lifecycle and configuration loading.
        * Mock tests for `GraphDatabaseClient` interface and `TraverseHttpClient` handling `X-Query-Dialect: gql` vs `cypher`, query parameters, and error status envelopes.
        * Test healthcheck forwarding from Traverse `GET /api/health`.
    * **PR 2**:
        * Unit tests for schema parsing and model normalization from `GET /api/schema` JSON response.
        * Object query tests for `GET /api/nodes/{id}` and `GET /api/nodes/{id}/relations/{type}`: verify generated GQL/Cypher queries, aggregation of relation counts by type, handling of missing node IDs (404), and pagination.
    * **PR 3–5**:
        * Regression testing of backend endpoints as new frontend queries are added.
    * **PR 6**:
        * End-to-end integration tests validating round-trip flows: schema fetch -> search node -> get object summary -> traverse relation -> run custom GQL query.

### Frontend testing & visual multimodal verification strategy
To enable fast iteration and leverage the **multimodal capabilities of Gemini 3.8 Flash**, the frontend employs a lightweight headless visual testing workflow:

* **Headless browser CLI (Playwright)**:
    * A lightweight Playwright script (e.g. `npm run screenshot:views` or a test runner) spins up the Vite dev server with a mocked API layer (or MSW / FastAPI backend fixture).
    * It navigates to each core view (Query Table, Cytoscape Graph, Object Detail View, Schema View) and saves viewport screenshots into a `.debug-screenshots/` directory.
* **Multimodal agent debugging loop**:
    * Gemini 3.8 Flash can inspect the rendered screenshot images directly to:
        * Verify Cytoscape canvas layout, node overlap, zoom/pan bounds, and link styling.
        * Check layout alignment, badges, spacing, and visual clarity of the Object Detail View.
        * Spot UI glitches, clipping, or unstyled states without human intervention.
* **Component unit tests**:
    * `vitest` + `@testing-library/react` for logic-heavy components (query state management, relation grouping filters, pagination controls).

### Continuous Integration (GitHub Actions)
Every PR triggers an automated GitHub Actions CI workflow to run unit tests and linters:
* **Backend CI Job**:
    * Python 3.11 environment setup with **`astral-sh/setup-uv`** action.
    * Dependency synchronization via `uv sync --frozen` (or `uv pip install`).
    * Linting & formatting check with `ruff` (`uv run ruff check` & `uv run ruff format --check`).
    * Unit testing via `uv run pytest` (mocked transport, failing on errors).
* **Frontend CI Job**:
    * Node.js LTS setup.
    * Dependency installation (`npm ci`).
    * Typechecking (`tsc --noEmit`) and linting (`eslint`).
    * Unit test suite execution (`vitest run`).
* **Stacked PR Workflow Compatibility**:
    * CI checks must pass before PRs are marked as ready for review.

## Implementation approach

The implementation should be done as a set of stacked PRs that can go through human review:

1. **PR 1: Backend Scaffolding, Database Connection Abstraction & CI Workflow**
   * Backend environment and project initialization with `uv` (`pyproject.toml`, `uv.lock`).
   * FastAPI service setup with configuration (target host, port, API key, database name).
   * Connection layer abstraction (`GraphDatabaseClient` interface).
   * Traverse HTTP client implementation:
     - Health check (`GET /api/health`).
     - Query execution endpoint `POST /api/query` supporting GQL (`X-Query-Dialect: gql`) and Cypher fallback.
   * **CI Setup**: GitHub Actions workflow (`.github/workflows/ci.yml`) using `astral-sh/setup-uv`, running `uv run ruff check` and `uv run pytest`.
   * **Testing**: `pytest` suite with `respx` mocking Traverse HTTP responses (dialects, error envelopes, healthcheck).

2. **PR 2: Schema Introspection & Object Query Services**
   * Schema service consuming Traverse `GET /api/schema` (with normalized models for labels, relation types, and property types).
   * Object detail query service: retrieving a node's properties, counts of incoming/outgoing relations grouped by type, and paginated related nodes.
   * Endpoints: `GET /api/schema`, `GET /api/nodes/{id}`, `GET /api/nodes/{id}/relations/{type}`.
   * **Testing**: Unit tests for schema model normalization and node query generators; mock tests for relationship aggregations and pagination.

3. **PR 3: Frontend Scaffolding, Query Runner UI, CI Integration & Visual Harness**
   * React + TypeScript + Vite project setup with API client.
   * Query editor with execution trigger and toggle between GQL and Cypher.
   * Table / List view rendering query results.
   * Setup lightweight Playwright screenshot script (`screenshot:views`) for multimodal visual verification.
   * **CI Update**: Add frontend job to GitHub Actions (`npm test`, `tsc --noEmit`).
   * **Testing**: Vitest for query execution state; Playwright headless capture for table UI rendering.

4. **PR 4: Interactive Graph View**
   * Cytoscape.js integration for query results.
   * Layout switching, zooming/panning, and node/edge property tooltips.
   * Click-to-inspect interaction linking to the Object Detail View.
   * **Testing**: Multimodal visual inspection via screenshot harness to verify graph layouts, edge arrows, and canvas rendering.

5. **PR 5: Object Detail View & Search Navigation**
   * Object detail page displaying node properties.
   * Incoming/outgoing relation type summary badges with counts.
   * Interactive selection of relation type to reveal list of connected nodes with condensed summaries and relation properties.
   * Top search bar for quick node lookup by label, ID, or property values.
   * **Testing**: Multimodal verification of relation badges, expanded node lists, and interactive detail view hierarchy.

6. **PR 6: Schema View & End-to-End Integration**
   * Schema visualizer page showing types and relationships.
   * End-to-end integration and verification against Traverse HTTP API.
   * Full test suite verification (pytest + visual regression screenshots).
   * Documentation, setup scripts, and Docker / dev environment configuration.

As PRs are considered done, mark them as ready for review.
Moving patches between PRs that are marked as not ready for review is OK and encouraged if it creates cohesive PRs.
Use the `gh` tool to create PRs.

## Autonomous and Copilot agent execution requirements

To ensure autonomous execution in Autopilot and Assisted modes without hanging or ambiguous human prompts:

### 1. Workspace directory structure
```
.
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions running backend and frontend tests
├── backend/
│   ├── pyproject.toml         # Managed with uv
│   ├── uv.lock
│   ├── src/
│   │   └── tpg_explorer/      # FastAPI application, connection layers, schema, and query services
│   └── tests/
│       ├── fixtures/          # Canned Traverse HTTP mock responses
│       ├── conftest.py
│       └── test_*.py
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── src/                   # React components, Cytoscape graph, detail views
│   └── tests/                 # Vitest unit tests & Playwright visual screenshot script
└── specification.md
```

### 2. Standardized non-interactive commands
All test, lint, and build commands must run non-interactively with deterministic exit codes:
* **Backend**:
  * Setup: `uv sync`
  * Linting: `uv run ruff check .`
  * Tests: `uv run pytest -v`
* **Frontend**:
  * Setup: `npm --prefix frontend ci`
  * Linting: `npm --prefix frontend run lint`
  * Typecheck: `npm --prefix frontend run typecheck` (`tsc --noEmit`)
  * Tests: `npm --prefix frontend run test:run` (`vitest run`)
  * Visual capture: `npm --prefix frontend run test:screenshot` (Playwright headless script generating images into `.debug-screenshots/`)

### 3. Concrete API schemas
* `POST /api/query`:
  * Request: `{"query": string, "dialect": "gql" | "cypher", "database"?: string, "parameters"?: object}`
  * Response: `{"columns": string[], "rows": any[][], "total_rows": number, "truncated": boolean, "time_ms": number}`
* `GET /api/schema`:
  * Response: `{"labels": string[], "relationship_types": string[], "property_keys": Record<string, string>, "patterns"?: {"from_label": string, "type": string, "to_label": string}[]}`
* `GET /api/nodes/{id}`:
  * Response: `{"id": string, "labels": string[], "properties": Record<string, any>, "relations_summary": {"incoming": Record<string, number>, "outgoing": Record<string, number>}}`
* `GET /api/nodes/{id}/relations/{type}?direction=incoming|outgoing&limit=50&offset=0`:
  * Response: `{"relation_type": string, "direction": "incoming" | "outgoing", "items": [{"relation_properties": Record<string, any>, "node": {"id": string, "labels": string[], "summary_properties": Record<string, any>}}], "total": number}`

### 4. Offline mock fixtures
* Canned responses representing a Traverse sample database (e.g. Movies graph) must be stored in `backend/tests/fixtures/` and `frontend/tests/fixtures/` to enable 100% offline unit tests and visual screenshot runs without requiring a live database instance.

### 5. Git and PR automation guidelines
* For stacked PRs:
  * Branch naming: `feature/pr1-backend-client`, `feature/pr2-schema-service`, etc.
  * Create PRs using `gh pr create --title "<Title>" --body "<Summary>" --base <base-branch> --draft`
  * Mark ready when CI passes: `gh pr ready <pr-number>`
  * Never invoke interactive git or gh prompts.





