from datetime import datetime, timedelta, timezone

import jwt

from app.main import settings
from test_senso_flow import seed_account


def test_session_expires_and_logout_removes_access(client, database):
    user_id, _ = seed_account(database)
    login = client.post("/auth/demo")
    assert login.status_code == 200
    assert "httponly" in login.headers["set-cookie"].lower()
    assert client.get("/dashboard").status_code == 200

    expired = jwt.encode(
        {"sub": str(user_id), "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.secret_key,
        algorithm="HS256",
    )
    client.cookies.set(settings.cookie_name, expired)
    assert client.get("/dashboard").status_code == 401
    assert client.get("/auth/session").json()["authenticated"] is False

    client.post("/auth/demo")
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/dashboard").status_code == 401


def test_incorrect_password_does_not_create_session(client, database):
    seed_account(database)
    response = client.post("/auth/login", json={"email": "demo@senso.local", "password": "incorrect-password"})
    assert response.status_code == 401
    assert client.get("/auth/session").json()["authenticated"] is False
    assert client.get("/dashboard").status_code == 401
