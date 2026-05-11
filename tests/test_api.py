"""
Unit Tests for Transcript Auditor Pro Backend.

Focuses on:
  - API Health
  - Authentication middleware
  - Audit engine integration
"""

import pytest
from httpx import ASGITransport, AsyncClient
from backend.main import app
from backend.database import Base, async_engine


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create test tables and cleanup after."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await async_engine.dispose()


@pytest.fixture
def client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_health_check(client):
    """Verify system health endpoint."""
    async with client as ac:
        response = await ac.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "version" in data


@pytest.mark.asyncio
async def test_list_programs(client):
    """Verify programs endpoint returns list."""
    async with client as ac:
        response = await ac.get("/api/programs")

    assert response.status_code == 200
    assert "programs" in response.json()


@pytest.mark.asyncio
async def test_unauthorized_history(client):
    """Verify history endpoint is protected by auth."""
    async with client as ac:
        response = await ac.get("/api/history")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unauthorized_csv_audit(client):
    """Verify CSV audit endpoint requires auth."""
    async with client as ac:
        response = await ac.post("/api/audit/csv")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unauthorized_image_audit(client):
    """Verify image audit endpoint requires auth."""
    async with client as ac:
        response = await ac.post("/api/audit/image")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_health_has_required_fields(client):
    """Health response includes all expected fields."""
    async with client as ac:
        response = await ac.get("/api/health")

    data = response.json()
    assert "status" in data
    assert "version" in data
    assert "database" in data
    assert "ocr_available" in data
