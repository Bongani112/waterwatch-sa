def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "ok"}


def test_register_login_me(client):
    r = client.post(
        "/api/auth/register",
        json={"name": "Thandi", "email": "Thandi@Example.com", "password": "password123"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["role"] == "resident"
    assert body["user"]["email"] == "thandi@example.com"
    assert "password_hash" not in body["user"]

    r = client.post("/api/auth/login", json={"email": "thandi@example.com", "password": "password123"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["name"] == "Thandi"


def test_duplicate_email_rejected(client, register):
    register("dup@example.com")
    r = client.post("/api/auth/register", json={"name": "Again", "email": "DUP@example.com", "password": "password123"})
    assert r.status_code == 409


def test_bad_password_and_short_password(client, register):
    register("a@example.com")
    assert client.post("/api/auth/login", json={"email": "a@example.com", "password": "wrong-pass"}).status_code == 401
    r = client.post("/api/auth/register", json={"name": "Bob", "email": "b@example.com", "password": "short"})
    assert r.status_code == 422


def test_invalid_token(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert r.status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_admin_endpoints_require_admin(client, register):
    headers = register()
    assert client.get("/api/admin/analytics", headers=headers).status_code == 403
    assert client.get("/api/admin/users", headers=headers).status_code == 403
    assert client.get("/api/admin/analytics").status_code == 401
