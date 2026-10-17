import os
import sys
from pathlib import Path

import pytest

# isolated database per test session, no auto demo load
TMP = Path(__file__).parent / ".test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TMP}"
os.environ["AUTO_LOAD_DEMO"] = "false"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(scope="session", autouse=True)
def _cleanup():
    yield
    if TMP.exists():
        TMP.unlink()
