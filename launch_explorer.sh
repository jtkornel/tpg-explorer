#!/usr/bin/env bash
# ==============================================================================
# launch_explorer.sh
#
# Generic interactive launcher for TPG Explorer connected to a TrueSpar Traverse
# graph database instance (.tvdb).
#
# Starts:
#   1. TrueSpar Traverse graph database server (:7691) [unless --external-db]
#   2. FastAPI backend (:8000)
#   3. Vite frontend (:5173)
#
# Usage:
#   ./launch_explorer.sh /path/to/database.tvdb
#   ./launch_explorer.sh --demo
#   DATA_FILE=/path/to/database.tvdb ./launch_explorer.sh
#   ./launch_explorer.sh --external-db
#
# Supports graceful shutdown on Ctrl+C (SIGINT/SIGTERM).
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKEND_DIR="${SCRIPT_DIR}/backend"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"

HTTP_PORT="${HTTP_PORT:-7691}"
BOLT_PORT="${BOLT_PORT:-7690}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
DATABASE_NAME="${DATABASE_NAME:-traverse}"
API_KEY="${API_KEY:-tvs_dev_secret_key_12345}"
TRAVERSE_URL="${TRAVERSE_URL:-http://localhost:${HTTP_PORT}}"

DATA_FILE="${DATA_FILE:-}"
TRAVERSE_BIN="${TRAVERSE_BIN:-}"
DEMO_MODE=0
EXTERNAL_DB=0

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] [PATH_TO_TVDB]

Launch TPG Explorer (Traverse server, FastAPI backend, and Vite frontend).

Options:
  -d, --data <FILE>       Path to the Traverse .tvdb database file (or set DATA_FILE)
  -b, --traverse-bin <P>  Path to the traverse-server binary (or set TRAVERSE_BIN)
      --demo              Launch with a built-in seeded demo graph (.demo/demo.tvdb)
      --external-db       Skip starting local traverse-server; connect to TRAVERSE_URL
  -h, --help              Show this help message and exit

Environment Variables:
  DATA_FILE               Path to .tvdb file
  TRAVERSE_BIN            Path to traverse-server executable (default: searched in PATH)
  DATABASE_NAME           Traverse database name (default: traverse)
  API_KEY                 Traverse HTTP API key (default: tvs_dev_secret_key_12345)
  HTTP_PORT               Traverse HTTP port (default: 7691)
  BOLT_PORT               Traverse Bolt port (default: 7690)
  BACKEND_PORT            FastAPI backend port (default: 8000)
  FRONTEND_PORT           Vite frontend port (default: 5173)
  TRAVERSE_URL            External Traverse HTTP URL (default: http://localhost:7691)
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--data)
            DATA_FILE="$2"
            shift 2
            ;;
        -b|--traverse-bin)
            TRAVERSE_BIN="$2"
            shift 2
            ;;
        --demo)
            DEMO_MODE=1
            shift
            ;;
        --external-db)
            EXTERNAL_DB=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            echo "Error: Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
        *)
            if [ -z "${DATA_FILE}" ]; then
                DATA_FILE="$1"
                shift
            else
                echo "Error: Unexpected argument: $1" >&2
                usage >&2
                exit 1
            fi
            ;;
    esac
done

if [ "${DEMO_MODE}" -eq 1 ] && [ -z "${DATA_FILE}" ]; then
    mkdir -p "${SCRIPT_DIR}/.demo"
    DATA_FILE="${SCRIPT_DIR}/.demo/demo.tvdb"
fi

if [ "${EXTERNAL_DB}" -eq 0 ]; then
    if [ -z "${DATA_FILE}" ]; then
        echo "Error: No .tvdb data file specified." >&2
        echo "Provide a path via './launch_explorer.sh <path/to/file.tvdb>', DATA_FILE env var, or '--demo'." >&2
        echo "" >&2
        usage >&2
        exit 1
    fi

    if [ -z "${TRAVERSE_BIN}" ]; then
        if command -v traverse-server >/dev/null 2>&1; then
            TRAVERSE_BIN="$(command -v traverse-server)"
        elif [ -x "${SCRIPT_DIR}/backend/.venv/bin/traverse-server" ]; then
            TRAVERSE_BIN="${SCRIPT_DIR}/backend/.venv/bin/traverse-server"
        else
            echo "Error: 'traverse-server' binary not found in PATH." >&2
            echo "Install truespar-traverse or set TRAVERSE_BIN=/path/to/traverse-server." >&2
            exit 1
        fi
    fi

    if [ ! -x "${TRAVERSE_BIN}" ]; then
        echo "Error: traverse-server binary not found or not executable at ${TRAVERSE_BIN}" >&2
        exit 1
    fi

    if [ "${DEMO_MODE}" -eq 0 ] && [ ! -f "${DATA_FILE}" ]; then
        echo "Error: Data file not found at ${DATA_FILE}" >&2
        exit 1
    fi
fi

TRAVERSE_PID=""
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo "============================================================"
    echo " Shutting down TPG Explorer services..."
    echo "============================================================"

    if [ -n "${FRONTEND_PID}" ] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
        echo "Stopping frontend (PID ${FRONTEND_PID})..."
        kill -TERM "${FRONTEND_PID}" 2>/dev/null || true
    fi

    if [ -n "${BACKEND_PID}" ] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
        echo "Stopping backend (PID ${BACKEND_PID})..."
        kill -TERM "${BACKEND_PID}" 2>/dev/null || true
    fi

    if [ -n "${TRAVERSE_PID}" ] && kill -0 "${TRAVERSE_PID}" 2>/dev/null; then
        echo "Stopping Traverse server (PID ${TRAVERSE_PID})..."
        kill -TERM "${TRAVERSE_PID}" 2>/dev/null || true
    fi

    # Wait briefly for graceful termination
    sleep 1

    # Force kill if still hanging
    for pid in "${FRONTEND_PID}" "${BACKEND_PID}" "${TRAVERSE_PID}"; do
        if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
            kill -KILL "${pid}" 2>/dev/null || true
        fi
    done

    echo "All services stopped."
    exit 0
}

trap cleanup INT TERM EXIT

seed_demo_database() {
    echo "Seeding demo graph data into ${DATA_FILE}..."
    local seed_query
    seed_query='CREATE (a1:Person {name: "Alice", role: "Researcher", department: "Robotics"}), (a2:Person {name: "Bob", role: "Engineer", department: "Control Systems"}), (p1:Project {name: "Autonomous Manipulator", status: "Active", priority: "High"}), (alg1:Algorithm {name: "MPC Controller", category: "Optimal Control", horizon_ms: 50}), (s1:Sensor {name: "Force-Torque Wrist Sensor", rate_hz: 1000}), (a1)-[:LEADS {since: 2025}]->(p1), (a2)-[:CONTRIBUTES_TO {role: "Core Developer"}]->(p1), (p1)-[:USES_ALGORITHM]->(alg1), (p1)-[:INTEGRATES_SENSOR]->(s1), (alg1)-[:PROCESSES_DATA_FROM]->(s1)'

    curl -s -f -X POST "http://localhost:${HTTP_PORT}/api/query" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: ${API_KEY}" \
        -d "{\"query\": $(printf '%s' "${seed_query}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'), \"dialect\": \"cypher\", \"database\": \"${DATABASE_NAME}\"}" >/dev/null
    echo "Demo dataset seeded (5 nodes, 5 relationships)."
}

echo "============================================================"
echo " Starting TPG Explorer Environment"
echo "============================================================"
if [ "${EXTERNAL_DB}" -eq 0 ]; then
    echo "Traverse binary: ${TRAVERSE_BIN}"
    echo "Database:        ${DATA_FILE}"
fi
echo "Database name:   ${DATABASE_NAME}"
echo "Traverse HTTP:   ${TRAVERSE_URL}"
echo "Backend URL:     http://localhost:${BACKEND_PORT}"
echo "Frontend UI:     http://localhost:${FRONTEND_PORT}"
echo "============================================================"

# 1. Start Traverse Server (unless external)
if [ "${EXTERNAL_DB}" -eq 0 ]; then
    NEED_SEED=0
    if [ "${DEMO_MODE}" -eq 1 ] && [ ! -f "${DATA_FILE}" ]; then
        NEED_SEED=1
    fi

    # Clean up any stale lock or recovery logs from unclean previous shutdowns
    DATA_DIR="$(dirname "${DATA_FILE}")"
    DB_BASENAME="$(basename "${DATA_FILE}")"
    rm -f "${DATA_DIR}/${DB_BASENAME}.lock" "${DATA_DIR}/${DB_BASENAME}".rlog* 2>/dev/null || true

    echo "[1/3] Starting Traverse server..."
    "${TRAVERSE_BIN}" \
        --data "${DATA_FILE}" \
        --default-db "${DATABASE_NAME}" \
        --http-listen "0.0.0.0:${HTTP_PORT}" \
        --listen "0.0.0.0:${BOLT_PORT}" \
        --api-key "${API_KEY}" \
        --log-level info &
    TRAVERSE_PID=$!

    echo "Waiting for Traverse server to be ready on port ${HTTP_PORT}..."
    READY=0
    for _ in $(seq 1 30); do
        if curl -s -f -H "X-API-Key: ${API_KEY}" "${TRAVERSE_URL}/api/health" >/dev/null 2>&1; then
            READY=1
            break
        fi
        sleep 0.5
    done

    if [ "${READY}" -ne 1 ]; then
        echo "Error: Traverse server failed to start within 15 seconds." >&2
        exit 1
    fi
    echo "Traverse server is ready (PID ${TRAVERSE_PID})."

    if [ "${NEED_SEED}" -eq 1 ]; then
        seed_demo_database
    fi
else
    echo "[1/3] Using external Traverse server at ${TRAVERSE_URL}..."
fi

# 2. Start FastAPI Backend
echo "[2/3] Starting FastAPI backend..."
(
    cd "${BACKEND_DIR}"
    export TPG_TRAVERSE_URL="${TRAVERSE_URL}"
    export TPG_TRAVERSE_API_KEY="${API_KEY}"
    export TPG_DEFAULT_DATABASE="${DATABASE_NAME}"
    exec uv run uvicorn tpg_explorer.main:app --host 0.0.0.0 --port "${BACKEND_PORT}"
) &
BACKEND_PID=$!

echo "Waiting for FastAPI backend to be ready on port ${BACKEND_PORT}..."
READY=0
for _ in $(seq 1 30); do
    if curl -s -f "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
        READY=1
        break
    fi
    sleep 0.5
done

if [ "${READY}" -ne 1 ]; then
    echo "Error: FastAPI backend failed to start within 15 seconds." >&2
    exit 1
fi
echo "FastAPI backend is ready (PID ${BACKEND_PID})."

# 3. Start Vite Frontend
echo "[3/3] Starting Vite frontend..."
(
    cd "${FRONTEND_DIR}"
    exec npm run dev -- --host 0.0.0.0 --port "${FRONTEND_PORT}"
) &
FRONTEND_PID=$!

echo "Waiting for Vite frontend to be ready on port ${FRONTEND_PORT}..."
READY=0
for _ in $(seq 1 30); do
    if curl -s "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1; then
        READY=1
        break
    fi
    sleep 0.5
done

if [ "${READY}" -ne 1 ]; then
    echo "Error: Vite frontend failed to start within 15 seconds." >&2
    exit 1
fi
echo "Vite frontend is ready (PID ${FRONTEND_PID})."

echo ""
echo "============================================================"
echo " TPG Explorer is running!"
echo ""
echo " Open in your browser:  http://localhost:${FRONTEND_PORT}"
echo " Backend Swagger docs:  http://localhost:${BACKEND_PORT}/docs"
echo " Traverse API Health:   ${TRAVERSE_URL}/api/health"
echo ""
echo " Press Ctrl+C to stop all services."
echo "============================================================"

# Wait indefinitely until interrupted
wait
