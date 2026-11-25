from sqlalchemy import select

from app.models import User
from scripts import load_demo


def test_demo_creation_and_repeat_preserve_account_and_allow_local_demo(client, database, monkeypatch, capsys):
    monkeypatch.setattr(load_demo, "SessionLocal", database)

    load_demo.load_demo()
    with database() as db:
        user = db.scalar(select(User).where(User.email == load_demo.DEMO_EMAIL))
        assert user is not None
        user_id = user.id
        original_hash = user.password_hash
        assert original_hash

    load_demo.load_demo()
    with database() as db:
        user = db.scalar(select(User).where(User.email == load_demo.DEMO_EMAIL))
        assert user.id == user_id
        assert user.password_hash == original_hash

    assert original_hash not in capsys.readouterr().out
    response = client.post("/auth/demo")
    assert response.status_code == 200
    assert client.get("/auth/session").json()["authenticated"] is True
