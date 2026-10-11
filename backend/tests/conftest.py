import json
from pathlib import Path

import pytest

from tpg_explorer.traverse_client import TraverseHttpClient

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def health_fixture():
    with open(FIXTURES_DIR / "health.json") as f:
        return json.load(f)


@pytest.fixture
def query_fixture():
    with open(FIXTURES_DIR / "query_gql_response.json") as f:
        return json.load(f)


@pytest.fixture
def mock_traverse_client():
    client = TraverseHttpClient(base_url="http://mock-traverse:7691", api_key="tvs_test_key_123")
    return client
