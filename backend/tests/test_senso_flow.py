from datetime import timedelta, timezone, datetime

from pwdlib import PasswordHash
from sqlalchemy import select

from app.db.session import make_engine
from app.models import Alert, Event, Residence, Simulation, User
from app.services.demo import populate_demo_history
from app.services.residence import create_residence
from app.services.simulation import advance_simulation


def seed_account(database, email="demo@senso.local"):
    db = database()
    user = User(name="Mariana Duarte", email=email, password_hash=PasswordHash.recommended().hash("Senso-Demo-2026!"))
    db.add(user)
    db.flush()
    residence = create_residence(db, user, demo=email == "demo@senso.local")
    if email == "demo@senso.local":
        populate_demo_history(db, residence, days=10)
    db.commit()
    ids = user.id, residence.id
    db.close()
    return ids


def start_fall_and_advance(database, residence_id):
    with database() as db:
        run = db.scalar(select(Simulation).where(Simulation.residence_id == residence_id))
        run.scenario = "possivel_queda"
        run.status = "rodando"
        run.step = 0
        run.started_at = datetime.now(timezone.utc)
        run.next_step_at = run.started_at
        db.commit()
    for _ in range(4):
        with database() as db:
            run = db.scalar(select(Simulation).where(Simulation.residence_id == residence_id))
            if run.status == "rodando":
                run.next_step_at = datetime.now(timezone.utc) - timedelta(seconds=1)
                db.commit()
                advance_simulation(db, residence_id)


def test_api_requires_login_and_returns_persisted_senso_dashboard(client, database):
    assert client.get("/dashboard").status_code == 401
    seed_account(database)
    response = client.post("/auth/login", json={"email": "demo@senso.local", "password": "Senso-Demo-2026!"})
    assert response.status_code == 200
    dashboard = client.get("/dashboard").json()
    assert dashboard["residence"]["resident_name"] == "Helena Duarte"
    assert dashboard["simulated"] is True
    assert dashboard["metrics"]["devices_online"] == dashboard["metrics"]["devices_total"]
    assert len(client.get("/history?days=7").json()["activity_by_day"]) > 0


def test_fall_rule_requires_brisk_motion_then_inactivity_and_preserves_acknowledgement(client, database):
    _, residence_id = seed_account(database)
    client.post("/auth/login", json={"email": "demo@senso.local", "password": "Senso-Demo-2026!"})
    start_fall_and_advance(database, residence_id)
    events = client.get("/history?days=30").json()["events"]
    assert any(event["type"] == "motion_burst" for event in events)
    assert any(event["type"] == "possible_fall" for event in events)
    active = client.get("/alerts?status=ativos").json()
    fall = next(alert for alert in active if alert["type"] == "possivel_queda")
    assert fall["severity"] == "critico"
    assert client.post(f"/alerts/{fall['id']}/acknowledge").json()["status"] == "reconhecido"
    still_active = client.get("/alerts?status=ativos").json()
    assert any(alert["id"] == fall["id"] for alert in still_active)
    assert client.post(f"/alerts/{fall['id']}/resolve", json={"note": "Verificação demonstrativa concluída."}).json()["status"] == "resolvido"
    historical = client.get("/alerts?status=todos").json()
    assert next(alert for alert in historical if alert["id"] == fall["id"])["status"] == "resolvido"
    with database() as db:
        assert db.scalar(select(Alert.id).where(Alert.id == fall["id"])) == fall["id"]
        assert db.scalar(select(Event.id).where(Event.event_type == "possible_fall", Event.residence_id == residence_id)) is not None


def test_monitoring_api_is_scoped_to_the_signed_in_user(client, database):
    seed_account(database)
    seed_account(database, "other@example.com")
    client.post("/auth/login", json={"email": "other@example.com", "password": "Senso-Demo-2026!"})
    assert client.get("/residence").json()["name"] == "Minha residência"
    patched = client.patch("/residence", json={"name": "Residência própria"})
    assert patched.status_code == 200
    assert patched.json()["name"] == "Residência própria"
    assert client.get("/dashboard").json()["residence"]["name"] == "Residência própria"


def test_connection_guard_rejects_other_database_names():
    try:
        make_engine("postgresql+psycopg://user:pass@localhost:5432/outro_banco")
    except ValueError as error:
        assert "senso" in str(error)
    else:
        raise AssertionError("The legacy database URL must be rejected before connection.")


def test_sqlite_is_restricted_to_isolated_test_environment():
    from pydantic import ValidationError
    from app.core.config import Settings

    assert Settings(app_env="test", database_url="sqlite://").database_url == "sqlite://"
    for environment in ("development", "production"):
        try:
            Settings(app_env=environment, database_url="sqlite://")
        except ValidationError as error:
            assert "SQLite" in str(error)
        else:
            raise AssertionError(f"SQLite must be rejected in {environment}.")


def test_only_postgresql_senso_is_accepted():
    from pydantic import ValidationError
    from app.core.config import Settings

    for database_url in (
        "mysql+pymysql://senso:secret@localhost/senso",
        "postgresql+psycopg://senso:secret@localhost:5432/triton",
    ):
        try:
            Settings(app_env="development", database_url=database_url)
        except ValidationError:
            pass
        else:
            raise AssertionError("Only the dedicated PostgreSQL senso database is allowed.")


def test_shared_environment_requires_production_credentials_and_disables_shared_demo():
    from pydantic import ValidationError
    from app.core.config import Settings

    Settings(
        app_env="production",
        database_url="postgresql+psycopg://senso:secret@db.example:5432/senso",
        secret_key="production-secret-with-enough-randomized-characters",
        cookie_secure=True,
        demo_login_enabled=False,
        cors_origins="https://app.example.com",
    )
    try:
        Settings(
            app_env="production",
            database_url="postgresql+psycopg://senso:secret@db.example:5432/senso",
            secret_key="troque-por-uma-chave-aleatoria-com-ao-menos-32-caracteres",
            cookie_secure=True,
            demo_login_enabled=False,
            cors_origins="https://app.example.com",
        )
    except ValidationError as error:
        assert "SECRET_KEY" in str(error)
    else:
        raise AssertionError("Example secrets must not be accepted in shared environments.")

    for overrides in (
        {"cookie_secure": False, "demo_login_enabled": False},
        {"cookie_secure": True, "demo_login_enabled": True},
        {"cookie_secure": True, "demo_login_enabled": False, "cors_origins": "*"},
        {"cookie_secure": True, "demo_login_enabled": False, "cors_origins": "https://*"},
        {
            "cookie_secure": True,
            "demo_login_enabled": False,
            "database_url": "postgresql+psycopg://senso:senso_dev@db.example:5432/senso",
        },
        {"cookie_secure": True, "demo_login_enabled": False, "cors_origins": "http://app.example.com"},
    ):
        try:
            options = {
                "app_env": "production",
                "database_url": "postgresql+psycopg://senso:secret@db.example:5432/senso",
                "secret_key": "production-secret-with-enough-randomized-characters",
                "cors_origins": "https://app.example.com",
            }
            options.update(overrides)
            Settings(**options)
        except ValidationError:
            pass
        else:
            raise AssertionError("Production must use secure cookies and disable the shared demo account.")


def test_live_health_does_not_depend_on_database(client):
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "senso-api"}


def test_ready_health_checks_database(client):
    assert client.get("/health/ready").json()["database"] == "connected"


def test_shared_environment_rejects_mutations_without_allowed_origin(client, monkeypatch):
    from app.main import settings as api_settings

    monkeypatch.setattr(api_settings, "app_env", "production")
    monkeypatch.setattr(api_settings, "cors_origins", "https://app.example.com")

    assert client.post("/auth/logout").status_code == 403
    assert client.post("/auth/logout", headers={"Origin": "https://other.example.com"}).status_code == 403
    assert client.post("/auth/logout", headers={"Origin": "https://app.example.com"}).status_code == 204


def test_disabled_demo_account_cannot_authenticate(client, database, monkeypatch):
    from app.main import settings as api_settings

    seed_account(database)
    monkeypatch.setattr(api_settings, "demo_login_enabled", False)
    response = client.post("/auth/login", json={"email": "demo@senso.local", "password": "Senso-Demo-2026!"})
    assert response.status_code == 401
    assert response.json()["detail"] == "E-mail ou senha incorretos."


def test_demo_shortcut_is_limited_to_local_environment(client, database, monkeypatch):
    from app.main import settings as api_settings

    seed_account(database)
    monkeypatch.setattr(api_settings, "app_env", "development")
    monkeypatch.setattr(api_settings, "demo_login_enabled", True)
    response = client.post("/auth/demo")
    assert response.status_code == 200
    assert response.json()["is_demo"] is True
    assert client.get("/auth/session").json()["user"]["is_demo"] is True

    monkeypatch.setattr(api_settings, "app_env", "production")
    monkeypatch.setattr(api_settings, "cors_origins", "https://app.example.com")
    assert client.post("/auth/demo", headers={"Origin": "https://app.example.com"}).status_code == 404


def test_disabling_demo_invalidates_existing_sessions_and_reserves_email(client, database, monkeypatch):
    from app.main import settings as api_settings

    seed_account(database)
    login = client.post("/auth/login", json={"email": "demo@senso.local", "password": "Senso-Demo-2026!"})
    assert login.status_code == 200
    monkeypatch.setattr(api_settings, "demo_login_enabled", False)
    assert client.get("/dashboard").status_code == 401
    registration = client.post("/auth/register", json={"name": "Pessoa teste", "email": "demo@senso.local", "password": "valid-password-123"})
    assert registration.status_code == 409


def test_simulation_clock_controls_and_manual_steps_are_persisted(client, database):
    _, residence_id = seed_account(database)
    client.post('/auth/login', json={'email': 'demo@senso.local', 'password': 'Senso-Demo-2026!'})
    started = client.post('/simulation/run', json={'scenario': 'fall'}).json()
    assert started['scenario_id'] == 'fall' and started['duration'] == 34
    assert started['run_id']
    assert client.post('/simulation/pause').json()['status'] == 'pausado'
    assert client.post('/simulation/speed', json={'speed': 2}).json()['speed'] == 2
    assert client.post('/simulation/speed', json={'speed': 3}).status_code == 422
    assert client.post('/simulation/next').json()['elapsed'] == 7
    assert client.post('/simulation/next').json()['elapsed'] == 9
    assert client.post('/simulation/next').json()['elapsed'] == 11
    state = client.get('/simulation/state').json()
    assert state['fall_confirmed'] and state['last_alert_id']
    for _ in range(3):
        assert client.get('/simulation/state').json()['last_alert_id'] == state['last_alert_id']
    with database() as db:
        events = db.scalars(select(Event).where(Event.residence_id == residence_id, Event.event_type == 'possible_fall')).all()
        assert len(events) == 1
    assert client.post('/simulation/resume').json()['status'] == 'rodando'
    assert client.post('/simulation/pause').json()['status'] == 'pausado'
    assert client.get('/simulation/state').json()['elapsed'] >= 11


def test_each_scenario_completes_with_persisted_events(client, database):
    _, residence_id = seed_account(database)
    client.post('/auth/login', json={'email': 'demo@senso.local', 'password': 'Senso-Demo-2026!'})
    scenarios = {'normal': 'movement', 'idle': 'inactivity', 'fall': 'possible_fall', 'heat': 'temperature', 'offline': 'device_offline', 'routine': 'routine_change'}
    for scenario, expected in scenarios.items():
        response = client.post('/simulation/run', json={'scenario': scenario})
        assert response.status_code == 200
        assert client.post('/simulation/pause').status_code == 200
        state = response.json()
        for _ in range(10):
            state = client.post('/simulation/next').json()
            if state['status'] == 'concluido':
                break
        assert state['status'] == 'concluido', (scenario, state)
        assert state['elapsed'] == state['duration']
        with database() as db:
            assert db.scalar(select(Event.id).where(Event.residence_id == residence_id, Event.event_type == expected))
            if scenario == 'fall':
                milestones = db.scalars(select(Event).where(
                    Event.residence_id == residence_id,
                    Event.event_type.in_([
                        'inactivity_observed', 'simulated_alert_available',
                        'simulated_rescue_requested', 'simulated_team_arrived',
                        'simulated_care_started',
                    ]),
                )).all()
                assert len(milestones) == 5
                assert all(event.details['source'] == 'roteiro_simulado' for event in milestones)
                assert all(event.details['external_action'] is False for event in milestones)
