PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082"
)


def test_create_and_get_incident(client, register, create_incident):
    headers = register()
    inc = create_incident(headers)
    assert inc["reference"].startswith("WW-")
    assert inc["status"] == "submitted"
    assert inc["is_owner"] is True
    assert len(inc["updates"]) == 1

    public = client.get(f"/api/incidents/{inc['incident_id']}").json()
    assert public["reporter_name"] is None and public["reporter_email"] is None
    # Public coordinates are rounded to protect reporters' exact locations.
    assert public["location"]["latitude"] == -26.176
    assert public["is_owner"] is False


def test_create_validation(client, register, incident_payload):
    headers = register()
    outside_sa = incident_payload(
        location={"province": "Gauteng", "municipality": "X City", "latitude": 51.5, "longitude": -0.12}
    )
    assert client.post("/api/incidents", json=outside_sa, headers=headers).status_code == 422
    assert client.post("/api/incidents", json=incident_payload(category_id=999), headers=headers).status_code == 422
    assert client.post("/api/incidents", json=incident_payload()).status_code == 401


def test_list_filters_and_radius(client, register, create_incident):
    headers = register()
    create_incident(headers)
    create_incident(
        headers,
        category_id=2,
        title="Burst pipe in Khayelitsha",
        location={
            "province": "Western Cape",
            "municipality": "City of Cape Town",
            "suburb": "Khayelitsha",
            "latitude": -34.04,
            "longitude": 18.677,
        },
    )
    assert client.get("/api/incidents").json()["total"] == 2
    assert client.get("/api/incidents", params={"province": "Western Cape"}).json()["total"] == 1
    assert client.get("/api/incidents", params={"category_id": 2}).json()["total"] == 1
    assert client.get("/api/incidents", params={"q": "melville"}).json()["total"] == 1
    near_jhb = {"lat": -26.17, "lng": 28.0, "radius_km": 5}
    items = client.get("/api/incidents", params=near_jhb).json()["items"]
    assert [i["location"]["suburb"] for i in items] == ["Melville"]
    assert len(client.get("/api/map/incidents").json()) == 2


def test_confirmation_is_unique_per_user(client, register, create_incident):
    owner = register("owner@example.com")
    other = register("other@example.com")
    inc = create_incident(owner)
    url = f"/api/incidents/{inc['incident_id']}/confirm"

    assert client.post(url, headers=owner).status_code == 400
    r = client.post(url, headers=other)
    assert r.status_code == 200 and r.json()["confirmation_count"] == 1
    assert client.post(url, headers=other).status_code == 409
    assert client.get(f"/api/incidents/{inc['incident_id']}").json()["confirmation_count"] == 1
    r = client.delete(url, headers=other)
    assert r.json()["confirmation_count"] == 0


def test_status_workflow_and_notifications(client, register, admin_headers, create_incident):
    owner = register("owner@example.com")
    follower = register("follower@example.com")
    inc = create_incident(owner)
    iid = inc["incident_id"]
    client.post(f"/api/incidents/{iid}/confirm", headers=follower)
    updates_url = f"/api/incidents/{iid}/updates"

    assert client.post(updates_url, json={"status": "verified"}, headers=owner).status_code == 403

    r = client.post(
        updates_url, json={"status": "under_review", "comments": "Checking with the depot."}, headers=admin_headers
    )
    assert r.status_code == 201
    assert r.json()["status"] == "under_review"

    # Assigning requires an assignee.
    assert client.post(updates_url, json={"status": "assigned"}, headers=admin_headers).status_code == 422
    admin_id = client.get("/api/admin/users", headers=admin_headers).json()[0]["user_id"]
    r = client.post(updates_url, json={"status": "assigned", "assigned_to": admin_id}, headers=admin_headers)
    assert r.status_code == 201 and r.json()["assigned_to"] == admin_id

    # No moving backwards.
    assert client.post(updates_url, json={"status": "submitted"}, headers=admin_headers).status_code == 409

    r = client.post(updates_url, json={"status": "resolved", "comments": "Pipe repaired."}, headers=admin_headers)
    detail = r.json()
    assert detail["status"] == "resolved" and detail["resolved_at"] is not None
    assert [u["status"] for u in detail["updates"]] == ["submitted", "under_review", "assigned", "resolved"]
    assert detail["allowed_transitions"] == []

    for headers in (owner, follower):
        notes = client.get("/api/notifications", headers=headers).json()
        assert notes["unread_count"] == 3
        assert "Resolved" in notes["items"][0]["message"]

    first = client.get("/api/notifications", headers=owner).json()["items"][0]
    client.post(f"/api/notifications/{first['notification_id']}/read", headers=owner)
    assert client.get("/api/notifications/unread-count", headers=owner).json()["unread_count"] == 2
    client.post("/api/notifications/read-all", headers=owner)
    assert client.get("/api/notifications/unread-count", headers=owner).json()["unread_count"] == 0

    # Closed incidents can no longer be confirmed.
    third = register("third@example.com")
    assert client.post(f"/api/incidents/{iid}/confirm", headers=third).status_code == 400


def test_duplicate_and_rejected(client, register, admin_headers, create_incident):
    owner = register()
    original = create_incident(owner)
    dup = create_incident(owner, title="Same outage again")
    url = f"/api/incidents/{dup['incident_id']}/updates"
    assert client.post(url, json={"status": "duplicate"}, headers=admin_headers).status_code == 422
    r = client.post(url, json={"status": "duplicate", "duplicate_of": original["incident_id"]}, headers=admin_headers)
    assert r.status_code == 201
    assert r.json()["duplicate_of_reference"] == original["reference"]

    spam = create_incident(owner, title="Spam spam spam")
    client.post(
        f"/api/incidents/{spam['incident_id']}/updates",
        json={"status": "rejected", "comments": "Not a water issue"},
        headers=admin_headers,
    )
    # Rejected reports are hidden from the public but visible to their reporter and admins.
    assert client.get(f"/api/incidents/{spam['incident_id']}").status_code == 404
    assert client.get(f"/api/incidents/{spam['incident_id']}", headers=owner).status_code == 200
    assert client.get("/api/incidents").json()["total"] == 2
    assert client.get("/api/incidents", headers=admin_headers).json()["total"] == 3
    assert client.get("/api/incidents", params={"mine": True}, headers=owner).json()["total"] == 3


def test_edit_permissions(client, register, admin_headers, create_incident):
    owner = register("owner@example.com")
    other = register("other@example.com")
    inc = create_incident(owner)
    url = f"/api/incidents/{inc['incident_id']}"
    assert client.patch(url, json={"description": "Updated: still no water at 10am."}, headers=owner).status_code == 200
    assert client.patch(url, json={"title": "Hijacked title"}, headers=other).status_code == 403
    assert client.patch(url, json={"priority": "high"}, headers=owner).status_code == 403
    assert client.patch(url, json={"priority": "high"}, headers=admin_headers).json()["priority"] == "high"
    client.post(f"{url}/updates", json={"status": "under_review"}, headers=admin_headers)
    assert client.patch(url, json={"title": "Too late to edit"}, headers=owner).status_code == 409


def test_attachment_upload_validation(client, register, create_incident):
    owner = register("owner@example.com")
    other = register("other@example.com")
    inc = create_incident(owner)
    url = f"/api/incidents/{inc['incident_id']}/attachments"

    r = client.post(url, files={"file": ("x.png", PNG_1PX, "image/png")}, headers=owner)
    assert r.status_code == 201
    att = r.json()["attachments"][0]
    img = client.get(att["url"])
    assert img.status_code == 200 and img.headers["content-type"] == "image/png"

    fake = client.post(url, files={"file": ("evil.png", b"<script>alert(1)</script>", "image/png")}, headers=owner)
    assert fake.status_code == 415
    assert client.post(url, files={"file": ("x.png", PNG_1PX, "image/png")}, headers=other).status_code == 403
    big = PNG_1PX + b"0" * (5 * 1024 * 1024)
    assert client.post(url, files={"file": ("big.png", big, "image/png")}, headers=owner).status_code == 413


def test_analytics_distinguishes_reported_verified_resolved(client, register, admin_headers, create_incident):
    owner = register()
    a = create_incident(owner)
    b = create_incident(owner)
    create_incident(owner, category_id=3, title="Low pressure all week")
    client.post(f"/api/incidents/{a['incident_id']}/updates", json={"status": "verified"}, headers=admin_headers)
    client.post(f"/api/incidents/{b['incident_id']}/updates", json={"status": "resolved"}, headers=admin_headers)

    data = client.get("/api/admin/analytics", headers=admin_headers).json()
    t = data["totals"]
    assert (t["reported"], t["verified"], t["resolved"], t["open"]) == (3, 2, 1, 2)
    assert t["avg_resolution_hours"] is not None
    assert {c["label"]: c["count"] for c in data["by_category"]} == {"Water outage": 2, "Low pressure": 1}
    assert data["by_municipality"][0] == {"label": "City of Johannesburg", "count": 3}
    assert len(data["daily"]) == 30 and data["daily"][-1]["reported"] == 3
