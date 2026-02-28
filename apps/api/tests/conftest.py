"""Shared test fixtures for Boost API tests."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.app.deps import get_current_user
from apps.api.app.main import app


# ---------------------------------------------------------------------------
# Fake user dicts (mimic decoded Firebase custom-claim tokens)
# ---------------------------------------------------------------------------

OWNER_USER = {
    "uid": "owner-uid-001",
    "email": "owner@boost.test",
    "role": "owner",
    "is_primary": True,
}

MERCHANT_ADMIN_USER = {
    "uid": "admin-uid-001",
    "email": "admin@merchant.test",
    "role": "merchant_admin",
    "merchant_id": "merchant-001",
}

STAFF_USER = {
    "uid": "staff-uid-001",
    "email": "staff@merchant.test",
    "role": "staff",
    "merchant_id": "merchant-001",
}


# ---------------------------------------------------------------------------
# Firestore mock helpers
# ---------------------------------------------------------------------------


class FakeDocSnapshot:
    """Mimics a Firestore DocumentSnapshot."""

    def __init__(self, doc_id: str, data: dict | None = None, exists: bool = True):
        self.id = doc_id
        self._data = data or {}
        self.exists = exists
        self.reference = MagicMock()  # Used for .reference.update() etc.

    def to_dict(self):
        return self._data


class FakeDocRef:
    """Mimics a Firestore DocumentReference with chaining support."""

    def __init__(self, doc_id: str = "auto-id", snapshot: FakeDocSnapshot | None = None):
        self.id = doc_id
        self._snapshot = snapshot or FakeDocSnapshot(doc_id, exists=False)
        self.set = MagicMock()
        self.update = MagicMock()
        self.delete = MagicMock()

    def get(self):
        return self._snapshot


class FakeQuery:
    """Mimics a Firestore query with chaining (where / offset / limit / order_by / stream)."""

    def __init__(self, docs: list[FakeDocSnapshot] | None = None):
        self._docs = docs or []

    def where(self, *args, **kwargs):
        return self

    def offset(self, n):
        return self

    def limit(self, n):
        return self

    def order_by(self, field, **kwargs):
        return self

    def stream(self):
        return iter(self._docs)


class FakeCollection:
    """Mimics db.collection(...) supporting document() and query chaining."""

    def __init__(self, docs: list[FakeDocSnapshot] | None = None, doc_ref: FakeDocRef | None = None):
        self._docs = docs or []
        self._doc_ref = doc_ref or FakeDocRef()

    def document(self, doc_id: str | None = None):
        # Return a doc_ref that matches requested ID if available
        if doc_id:
            for d in self._docs:
                if d.id == doc_id:
                    return FakeDocRef(doc_id, d)
        return self._doc_ref

    # Query chaining
    def where(self, *args, **kwargs):
        return FakeQuery(self._docs)

    def offset(self, n):
        return FakeQuery(self._docs)

    def limit(self, n):
        return FakeQuery(self._docs)

    def order_by(self, field, **kwargs):
        return FakeQuery(self._docs)

    def stream(self):
        return iter(self._docs)


def build_mock_db(collections: dict[str, FakeCollection] | None = None) -> MagicMock:
    """Build a mock Firestore client.

    ``collections`` maps collection names to FakeCollection instances.
    """
    db = MagicMock()
    _collections = collections or {}

    def _collection(name):
        return _collections.get(name, FakeCollection())

    db.collection.side_effect = _collection
    db.collections.return_value = []  # used by /health
    return db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_client_with_user(user_dict):
    """Create a TestClient with a dependency override for auth."""
    app.dependency_overrides[get_current_user] = lambda: user_dict
    client = TestClient(app, raise_server_exceptions=False)
    return client


@pytest.fixture()
def mock_db():
    """Yield a basic empty mock DB, patching get_db."""
    db = build_mock_db()
    with patch("apps.api.app.main.get_db", return_value=db):
        yield db


@pytest.fixture()
def owner_client(mock_db):
    """TestClient authenticated as owner."""
    app.dependency_overrides[get_current_user] = lambda: OWNER_USER
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture()
def admin_client(mock_db):
    """TestClient authenticated as merchant_admin."""
    app.dependency_overrides[get_current_user] = lambda: MERCHANT_ADMIN_USER
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture()
def staff_client(mock_db):
    """TestClient authenticated as staff."""
    app.dependency_overrides[get_current_user] = lambda: STAFF_USER
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture()
def unauth_client():
    """TestClient with no auth override — the real dep will fire."""
    app.dependency_overrides.pop(get_current_user, None)
    return TestClient(app, raise_server_exceptions=False)
