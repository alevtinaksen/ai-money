"""SQLite HTTP timestamps preserve instants through browser-style read/edit cycles."""

from datetime import datetime, timezone
import pytest
from test_http import client as client


@pytest.mark.asyncio
async def test_http_utc_roundtrip_and_naive_rejection(client):
    login = await client.post("/api/auth/local")
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
    await client.post("/api/onboarding")
    account = (await client.get("/api/accounts")).json()[0]
    assert datetime.fromisoformat(account["created_at"].replace("Z", "+00:00")).tzinfo is not None
    category = (await client.get("/api/categories")).json()[0]
    assert datetime.fromisoformat(category["created_at"].replace("Z", "+00:00")).tzinfo is not None
    payload = {
        "account_id": account["id"],
        "amount": "1.00",
        "created_at": "2026-09-01T15:00:00+03:00",
    }
    response = await client.post("/api/transactions", json=payload)
    assert response.status_code == 200, response.text
    transaction = response.json()
    listed = (await client.get("/api/transactions")).json()[0]
    expected = datetime(2026, 9, 1, 12, tzinfo=timezone.utc)
    for stamp in [transaction["created_at"], listed["created_at"]]:
        assert datetime.fromisoformat(stamp.replace("Z", "+00:00")) == expected
    updated = await client.put(
        f"/api/transactions/{transaction['id']}",
        json={"revision": 1, "created_at": listed["created_at"], "note": "Edited"},
    )
    assert updated.status_code == 200, updated.text
    assert datetime.fromisoformat(updated.json()["created_at"].replace("Z", "+00:00")) == expected
    note_only = await client.put(
        f"/api/transactions/{transaction['id']}", json={"revision": 2, "note": "Again"}
    )
    assert note_only.status_code == 200, note_only.text
    assert datetime.fromisoformat(note_only.json()["created_at"].replace("Z", "+00:00")) == expected
    naive = "2026-09-01T12:00:00"
    assert (
        await client.post("/api/transactions", json=payload | {"created_at": naive})
    ).status_code == 422
    assert (
        await client.put(
            f"/api/transactions/{transaction['id']}", json={"revision": 3, "created_at": naive}
        )
    ).status_code == 422
