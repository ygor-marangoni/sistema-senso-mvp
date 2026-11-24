from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated, Literal
import re
import asyncio
import logging
from uuid import uuid4
from contextlib import asynccontextmanager

import jwt
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pwdlib import PasswordHash
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal, get_db
from app.models import Alert, Appointment, Contact, Device, Event, Medication, MedicationConfirmation, MonitoringSettings, Reading, Residence, Room, Simulation, User, now_utc
from app.services.analysis import record_event
from app.services.demo import ensure_demo_appointments, ensure_demo_medications, populate_demo_history
from app.services.residence import create_residence
from app.services.simulation import SCENARIOS, SCENARIO_IDS, MARKERS, _steps, advance_simulation, logical_elapsed, schedule_next, simulation_snapshot

settings = get_settings()
password_hash = PasswordHash.recommended()
logger = logging.getLogger("senso.simulation")


def _tick_simulations() -> None:
    db = SessionLocal()
    try:
        active_runs = select(Simulation.residence_id).where(Simulation.status == "rodando")
        if not settings.demo_login_enabled:
            active_runs = active_runs.join(Residence, Residence.id == Simulation.residence_id).join(User, User.id == Residence.owner_id).where(User.email != "demo@senso.local")
        residence_ids = db.scalars(active_runs).all()
        for residence_id in residence_ids:
            try:
                advance_simulation(db, residence_id)
            except Exception:
                db.rollback()
                logger.exception("Falha ao avançar cenário da residência %s", residence_id)
    finally:
        db.close()


async def _simulation_loop():
    while True:
        await asyncio.sleep(settings.simulation_interval_seconds)
        await asyncio.to_thread(_tick_simulations)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    worker = None if settings.app_env.lower() == "test" else asyncio.create_task(_simulation_loop())
    try:
        yield
    finally:
        if worker:
            worker.cancel()
            try:
                await worker
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="Sistema Senso API",
    version="1.0.0",
    description="API de demonstração do Sistema Senso. Todos os dados de telemetria são simulados.",
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env.lower() in {"development", "local", "test"} else None,
    redoc_url="/redoc" if settings.app_env.lower() in {"development", "local", "test"} else None,
    openapi_url="/openapi.json" if settings.app_env.lower() in {"development", "local", "test"} else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def enforce_write_origin(request: Request, call_next):
    if settings.app_env.lower() not in {"development", "local", "test"} and request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if origin not in settings.origins:
            return JSONResponse(status_code=403, content={"detail": "Origem não autorizada."})
    return await call_next(request)

Db = Annotated[Session, Depends(get_db)]


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=12, max_length=128)


class DeviceIn(BaseModel):
    room_id: int = Field(gt=0)
    device_type: Literal["presenca", "ambiental"]


class MedicationIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    dosage: str = Field(default="", max_length=120)
    instructions: str = Field(default="", max_length=300)
    time_of_day: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    weekdays: list[int] = Field(min_length=1, max_length=7)
    start_date: date
    end_date: date | None = None

    @model_validator(mode="after")
    def validate_schedule(self):
        self.name = self.name.strip()
        if not self.name or any(day < 0 or day > 6 for day in self.weekdays) or len(set(self.weekdays)) != len(self.weekdays):
            raise ValueError("Informe um nome e dias da semana válidos.")
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("A data final deve ser igual ou posterior à inicial.")
        return self


class AppointmentIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    appointment_type: Literal["consulta", "exame", "retorno", "outro"] = "consulta"
    scheduled_date: date
    time_of_day: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    professional: str = Field(default="", max_length=120)
    location: str = Field(default="", max_length=200)
    notes: str = Field(default="", max_length=300)

    @model_validator(mode="after")
    def trim_fields(self):
        self.title = self.title.strip()
        self.professional = self.professional.strip()
        self.location = self.location.strip()
        self.notes = self.notes.strip()
        if not self.title:
            raise ValueError("Informe o compromisso da agenda.")
        return self


class ConfirmationIn(BaseModel):
    scheduled_date: date
    confirmed: bool


class LoginIn(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ProfilePatch(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    cpf: str | None = Field(default=None, max_length=14)

    @model_validator(mode="after")
    def validate_profile(self):
        self.name = self.name.strip()
        if self.phone is not None:
            self.phone = self.phone.strip()
        if self.cpf is not None:
            self.cpf = re.sub(r"[.\-\s]", "", self.cpf)
        if len(self.name) < 2:
            raise ValueError("Informe o nome do responsável.")
        if self.cpf and (len(self.cpf) != 11 or not self.cpf.isascii() or not self.cpf.isdigit()):
            raise ValueError("Informe um CPF com 11 dígitos.")
        return self


class ResidencePatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=140)
    resident_name: str | None = Field(default=None, min_length=2, max_length=120)
    resident_gender: Literal["feminino", "masculino", "nao_informado"] | None = None
    resident_age: int | None = Field(default=None, ge=60, le=120)
    resident_birth_date: date | None = None
    address: str | None = Field(default=None, max_length=240)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=2)

    @model_validator(mode="after")
    def validate_birth_date(self):
        if self.resident_birth_date and self.resident_birth_date > datetime.now(timezone(timedelta(hours=-3))).date():
            raise ValueError("A data de nascimento não pode estar no futuro.")
        return self


class SettingsPatch(BaseModel):
    inactivity_minutes: int | None = Field(default=None, ge=30, le=720)
    temperature_min: float | None = Field(default=None, ge=5, le=35)
    temperature_max: float | None = Field(default=None, ge=10, le=45)
    humidity_min: float | None = Field(default=None, ge=10, le=80)
    humidity_max: float | None = Field(default=None, ge=20, le=95)
    notify_attention: bool | None = None
    notify_critical: bool | None = None


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    relationship_label: str = Field(default="Familiar", min_length=2, max_length=80)
    phone: str = Field(default="", max_length=40)
    email: str = Field(default="", max_length=254)


class AlertResolveIn(BaseModel):
    note: str | None = Field(default=None, max_length=300)


class ScenarioIn(BaseModel):
    scenario: str


class SimulationSpeedIn(BaseModel):
    speed: Literal[0.5, 1.0, 2.0]


class CurrentUser:
    pass


def current_user(request: Request, db: Db) -> User:
    raw = request.cookies.get(settings.cookie_name)
    if not raw:
        raise HTTPException(status_code=401, detail="Entre para continuar.")
    try:
        payload = jwt.decode(raw, settings.secret_key, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Conta indisponível.")
    if user.email == "demo@senso.local" and not settings.demo_login_enabled:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")
    return user


AuthenticatedUser = Annotated[User, Depends(current_user)]


def _token(user: User) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user.id), "iat": now, "exp": now + timedelta(hours=12)}, settings.secret_key, algorithm="HS256")


def _set_session(response: Response, user: User) -> None:
    response.set_cookie(
        settings.cookie_name,
        _token(user),
        max_age=12 * 60 * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def _user_data(user: User) -> dict:
    return {"id": user.id, "name": user.name, "email": user.email, "phone": user.phone, "cpf": user.cpf, "is_demo": user.email == "demo@senso.local"}


def _residence(db: Session, user: User) -> Residence:
    residence = db.scalar(select(Residence).where(Residence.owner_id == user.id).order_by(Residence.id).limit(1))
    if not residence:
        residence = create_residence(db, user)
        db.commit()
        db.refresh(residence)
    return residence


def _resident_age(residence: Residence) -> int | None:
    if residence.resident_birth_date is None:
        return residence.resident_age
    today = datetime.now(timezone(timedelta(hours=-3))).date()
    born = residence.resident_birth_date
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def _owns_room(db: Session, residence_id: int, room_id: int | None) -> bool:
    return room_id is None or db.scalar(select(Room.id).where(Room.id == room_id, Room.residence_id == residence_id)) is not None


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _ensure_aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _device_dict(device: Device, rooms: dict[int, Room]) -> dict:
    room = rooms.get(device.room_id) if device.room_id else None
    return {
        "id": device.id,
        "name": device.name,
        "type": device.device_type,
        "serial": device.serial,
        "room_id": device.room_id,
        "room_name": room.name if room else "Residência",
        "status": device.status,
        "last_seen_at": _iso(device.last_seen_at),
        "is_simulated": device.is_simulated,
    }


def _alert_dict(alert: Alert, rooms: dict[int, Room], devices: dict[int, Device]) -> dict:
    device = devices.get(alert.device_id) if alert.device_id else None
    room = rooms.get(alert.room_id) if alert.room_id else None
    return {
        "id": alert.id,
        "type": alert.alert_type,
        "severity": alert.severity,
        "status": alert.status,
        "title": alert.title,
        "message": alert.message,
        "room_id": alert.room_id,
        "room_name": room.name if room else None,
        "device_id": alert.device_id,
        "device_name": device.name if device else None,
        "evidence": alert.evidence or {},
        "created_at": _iso(alert.created_at),
        "acknowledged_at": _iso(alert.acknowledged_at),
        "acknowledged_by": alert.acknowledged_by.name if alert.acknowledged_by else None,
        "resolved_at": _iso(alert.resolved_at),
        "resolved_by": alert.resolved_by.name if alert.resolved_by else None,
        "resolution_note": alert.resolution_note,
    }


def _event_dict(event: Event, rooms: dict[int, Room], devices: dict[int, Device]) -> dict:
    room = rooms.get(event.room_id) if event.room_id else None
    device = devices.get(event.device_id) if event.device_id else None
    return {
        "id": event.id,
        "type": event.event_type,
        "summary": event.summary,
        "room_id": event.room_id,
        "room_name": room.name if room else None,
        "device_id": event.device_id,
        "device_name": device.name if device else None,
        "details": event.details or {},
        "occurred_at": _iso(event.occurred_at),
        "is_simulated": event.is_simulated,
    }


def _room_dict(room: Room, devices: list[Device], online_by_room: dict[int, int]) -> dict:
    return {
        "id": room.id,
        "name": room.name,
        "sort_order": room.sort_order,
        "plan": {"x": room.plan_x, "y": room.plan_y, "w": room.plan_w, "h": room.plan_h},
        "devices": [_device_dict(item, {room.id: room}) for item in devices if item.room_id == room.id],
        "online_count": online_by_room.get(room.id, 0),
    }


def _date_floor(days: int) -> datetime:
    return datetime.combine(date.today() - timedelta(days=days - 1), time.min).astimezone()


def _dashboard_payload(db: Session, user: User, residence: Residence) -> dict:
    rooms = db.scalars(select(Room).where(Room.residence_id == residence.id).order_by(Room.sort_order)).all()
    devices_list = db.scalars(select(Device).where(Device.residence_id == residence.id).order_by(Device.id)).all()
    room_map = {room.id: room for room in rooms}
    device_map = {device.id: device for device in devices_list}
    active_alerts = db.scalars(select(Alert).where(Alert.residence_id == residence.id, Alert.status != "resolvido").order_by(Alert.created_at.desc())).all()
    recent_events = db.scalars(select(Event).where(Event.residence_id == residence.id).order_by(Event.occurred_at.desc()).limit(12)).all()
    latest_movement = db.scalar(
        select(Event).where(Event.residence_id == residence.id, Event.event_type.in_(["movement", "motion_burst", "possible_fall", "routine_change"]))
        .order_by(Event.occurred_at.desc()).limit(1)
    )
    latest_temp = db.scalar(select(Reading).where(Reading.residence_id == residence.id, Reading.metric == "temperatura").order_by(Reading.observed_at.desc()).limit(1))
    latest_humidity = db.scalar(select(Reading).where(Reading.residence_id == residence.id, Reading.metric == "umidade").order_by(Reading.observed_at.desc()).limit(1))
    connected = [item for item in devices_list if item.status == "online"]
    newest_heartbeat = max((_ensure_aware(item.last_seen_at) for item in connected if item.last_seen_at), default=None)
    stale = newest_heartbeat is None or (datetime.now(timezone.utc) - newest_heartbeat > timedelta(minutes=20))
    critical = any(item.severity == "critico" for item in active_alerts)
    attention = any(item.severity == "atencao" for item in active_alerts)
    coverage_partial = not devices_list or len(connected) < len(devices_list) or stale
    if critical:
        monitor_status = "critico"
    elif not connected:
        monitor_status = "indisponivel"
    elif coverage_partial:
        monitor_status = "parcial"
    elif attention:
        monitor_status = "atencao"
    else:
        monitor_status = "normal"
    settings_row = db.scalar(select(MonitoringSettings).where(MonitoringSettings.residence_id == residence.id))
    today_start = _date_floor(1)
    recent_movement_count = db.scalar(select(func.count(Event.id)).where(Event.residence_id == residence.id, Event.event_type == "movement", Event.occurred_at >= today_start)) or 0
    env = lambda item: ({"value": item.value, "observed_at": _iso(item.observed_at), "is_simulated": item.is_simulated} if item else None)
    rooms_online = Counter(device.room_id for device in connected if device.room_id)
    return {
        "user": _user_data(user),
        "residence": {"id": residence.id, "name": residence.name, "resident_name": residence.resident_name, "resident_gender": residence.resident_gender, "resident_age": _resident_age(residence), "resident_birth_date": residence.resident_birth_date.isoformat() if residence.resident_birth_date else None, "address": residence.address, "city": residence.city, "state": residence.state},
        "status": monitor_status,
        "status_label": {"normal": "Nenhuma anomalia detectada", "atencao": "Situação de atenção", "critico": "Ocorrência crítica", "parcial": "Monitoramento parcial", "indisponivel": "Monitoramento indisponível"}[monitor_status],
        "updated_at": _iso(now_utc()),
        "last_activity": _event_dict(latest_movement, room_map, device_map) if latest_movement else None,
        "metrics": {
            "temperature": env(latest_temp),
            "humidity": env(latest_humidity),
            "movement_today": recent_movement_count,
            "devices_online": len(connected),
            "devices_total": len(devices_list),
            "active_alerts": len(active_alerts),
        },
        "rooms": [_room_dict(room, devices_list, rooms_online) for room in rooms],
        "devices": [_device_dict(item, room_map) for item in devices_list],
        "active_alerts": [_alert_dict(item, room_map, device_map) for item in active_alerts[:5]],
        "recent_events": [_event_dict(item, room_map, device_map) for item in recent_events],
        "settings": {"inactivity_minutes": settings_row.inactivity_minutes if settings_row else 180, "notify_attention": settings_row.notify_attention if settings_row else True, "notify_critical": settings_row.notify_critical if settings_row else True},
        "simulation": simulation_snapshot(db.scalar(select(Simulation).where(Simulation.residence_id == residence.id))) if db.scalar(select(Simulation).where(Simulation.residence_id == residence.id)) else {"scenario": "normal", "status": "pausado", "step": 0, "scenario_count": 0},
        "simulated": True,
    }


@app.get("/health/live")
def liveness():
    return {"status": "ok", "service": "senso-api"}


@app.get("/health/ready", include_in_schema=False)
@app.get("/health")
def health(db: Db):
    try:
        db.execute(select(1))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Banco de dados Senso indisponível.")
    return {"status": "ok", "service": "senso-api", "database": "connected", "simulated_data": True}


@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, response: Response, db: Db):
    email = data.email.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(status_code=422, detail="Informe um e-mail válido.")
    if email == "demo@senso.local" and not settings.demo_login_enabled:
        raise HTTPException(status_code=409, detail="Este e-mail está reservado.")
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Este e-mail já possui uma conta.")
    user = User(name=data.name.strip(), email=email, password_hash=password_hash.hash(data.password))
    db.add(user)
    try:
        db.flush()
        create_residence(db, user)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Este e-mail já possui uma conta.")
    _set_session(response, user)
    return _user_data(user)


@app.post("/auth/login")
def login(data: LoginIn, response: Response, db: Db):
    email = data.email.strip().lower()
    if email == "demo@senso.local" and not settings.demo_login_enabled:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    user = db.scalar(select(User).where(User.email == email))
    if not user or not password_hash.verify(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    _set_session(response, user)
    return _user_data(user)


@app.post("/auth/demo", include_in_schema=False)
def demo_login(response: Response, db: Db):
    if settings.app_env.lower() not in {"development", "local", "test"} or not settings.demo_login_enabled:
        raise HTTPException(status_code=404, detail="Demonstração indisponível.")
    user = db.scalar(select(User).where(User.email == "demo@senso.local"))
    if not user:
        raise HTTPException(status_code=404, detail="Demonstração indisponível.")
    _set_session(response, user)
    return _user_data(user)


@app.patch("/auth/profile")
def update_profile(data: ProfilePatch, db: Db, user: AuthenticatedUser):
    user.name = data.name
    if data.phone is not None:
        user.phone = data.phone
    if data.cpf is not None:
        user.cpf = data.cpf
    db.commit()
    return _user_data(user)


@app.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(settings.cookie_name, path="/")


@app.get("/auth/session")
def session_status(request: Request, db: Db):
    raw = request.cookies.get(settings.cookie_name)
    if not raw:
        return {"authenticated": False}
    try:
        payload = jwt.decode(raw, settings.secret_key, algorithms=["HS256"])
        user = db.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError):
        return {"authenticated": False}
    return {"authenticated": bool(user), "user": _user_data(user) if user else None}


@app.get("/residence")
def get_residence(db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    return _dashboard_payload(db, user, residence)["residence"]


@app.patch("/residence")
def patch_residence(data: ResidencePatch, db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(residence, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(residence)
    return {"id": residence.id, "name": residence.name, "resident_name": residence.resident_name, "resident_gender": residence.resident_gender, "resident_age": _resident_age(residence), "resident_birth_date": residence.resident_birth_date.isoformat() if residence.resident_birth_date else None, "address": residence.address, "city": residence.city, "state": residence.state}


@app.get("/dashboard")
def dashboard(db: Db, user: AuthenticatedUser):
    return _dashboard_payload(db, user, _residence(db, user))


@app.get("/rooms")
def list_rooms(db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    return _dashboard_payload(db, user, residence)["rooms"]


@app.get("/devices")
def list_devices(db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    rooms = {room.id: room for room in db.scalars(select(Room).where(Room.residence_id == residence.id)).all()}
    return [_device_dict(device, rooms) for device in db.scalars(select(Device).where(Device.residence_id == residence.id).order_by(Device.id)).all()]


@app.post("/devices", status_code=status.HTTP_201_CREATED)
def add_virtual_device(data: DeviceIn, db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    room = db.scalar(select(Room).where(Room.id == data.room_id, Room.residence_id == residence.id))
    if room is None:
        raise HTTPException(status_code=404, detail="Ambiente não encontrado.")
    label = "Nó de presença" if data.device_type == "presenca" else "Sensor ambiental"
    device = Device(residence_id=residence.id, room_id=room.id, name=f"{label} · {room.name}", device_type=data.device_type, serial=f"SEN-V-{uuid4().hex[:12].upper()}", status="online", last_seen_at=now_utc(), is_simulated=True)
    db.add(device)
    db.commit()
    db.refresh(device)
    return _device_dict(device, {room.id: room})


def _medication_dict(item: Medication, confirmations: list[MedicationConfirmation]) -> dict:
    return {"id": item.id, "name": item.name, "dosage": item.dosage, "instructions": item.instructions,
            "time_of_day": item.time_of_day, "weekdays": item.weekdays, "start_date": item.start_date.isoformat(),
            "end_date": item.end_date.isoformat() if item.end_date else None,
            "confirmations": [{"date": entry.scheduled_date.isoformat(), "confirmed_at": _iso(entry.confirmed_at), "confirmed_by_id": entry.confirmed_by_id} for entry in confirmations]}


@app.get("/medications")
def list_medications(db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    items = db.scalars(select(Medication).where(Medication.residence_id == residence.id).order_by(Medication.time_of_day, Medication.id)).all()
    ids = [item.id for item in items]
    records = db.scalars(select(MedicationConfirmation).where(MedicationConfirmation.medication_id.in_(ids))).all() if ids else []
    return [_medication_dict(item, [entry for entry in records if entry.medication_id == item.id]) for item in items]


@app.post("/medications", status_code=status.HTTP_201_CREATED)
def add_medication(data: MedicationIn, db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    item = Medication(residence_id=residence.id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _medication_dict(item, [])


def _owned_medication(db: Session, user: User, medication_id: int) -> Medication:
    residence = _residence(db, user)
    item = db.scalar(select(Medication).where(Medication.id == medication_id, Medication.residence_id == residence.id))
    if not item:
        raise HTTPException(status_code=404, detail="Medicamento não encontrado.")
    return item


@app.put("/medications/{medication_id}")
def update_medication(medication_id: int, data: MedicationIn, db: Db, user: AuthenticatedUser):
    item = _owned_medication(db, user, medication_id)
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    db.commit()
    records = db.scalars(select(MedicationConfirmation).where(MedicationConfirmation.medication_id == item.id)).all()
    return _medication_dict(item, records)


@app.delete("/medications/{medication_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medication(medication_id: int, db: Db, user: AuthenticatedUser):
    item = _owned_medication(db, user, medication_id)
    for entry in db.scalars(select(MedicationConfirmation).where(MedicationConfirmation.medication_id == item.id)).all():
        db.delete(entry)
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.put("/medications/{medication_id}/confirmation")
def confirm_medication(medication_id: int, data: ConfirmationIn, db: Db, user: AuthenticatedUser):
    item = _owned_medication(db, user, medication_id)
    day = data.scheduled_date
    if day < item.start_date or (item.end_date and day > item.end_date) or day.weekday() not in item.weekdays:
        raise HTTPException(status_code=400, detail="Não há dose programada para esta data.")
    if day > datetime.now(timezone(timedelta(hours=-3))).date():
        raise HTTPException(status_code=400, detail="Não é possível confirmar uma dose futura.")
    record = db.scalar(select(MedicationConfirmation).where(MedicationConfirmation.medication_id == item.id, MedicationConfirmation.scheduled_date == day))
    if data.confirmed and not record:
        db.add(MedicationConfirmation(medication_id=item.id, scheduled_date=day, confirmed_by_id=user.id))
    elif not data.confirmed and record:
        db.delete(record)
    db.commit()
    return {"confirmed": data.confirmed}


def _appointment_dict(item: Appointment) -> dict:
    return {"id": item.id, "title": item.title, "appointment_type": item.appointment_type,
            "scheduled_date": item.scheduled_date.isoformat(), "time_of_day": item.time_of_day,
            "professional": item.professional, "location": item.location, "notes": item.notes}


@app.get("/appointments")
def list_appointments(db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    items = db.scalars(select(Appointment).where(Appointment.residence_id == residence.id)
                       .order_by(Appointment.scheduled_date, Appointment.time_of_day, Appointment.id)).all()
    return [_appointment_dict(item) for item in items]


@app.post("/appointments", status_code=status.HTTP_201_CREATED)
def add_appointment(data: AppointmentIn, db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    item = Appointment(residence_id=residence.id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _appointment_dict(item)


def _owned_appointment(db: Session, user: User, appointment_id: int) -> Appointment:
    residence = _residence(db, user)
    item = db.scalar(select(Appointment).where(Appointment.id == appointment_id, Appointment.residence_id == residence.id))
    if not item:
        raise HTTPException(status_code=404, detail="Compromisso não encontrado.")
    return item


@app.put("/appointments/{appointment_id}")
def update_appointment(appointment_id: int, data: AppointmentIn, db: Db, user: AuthenticatedUser):
    item = _owned_appointment(db, user, appointment_id)
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return _appointment_dict(item)


@app.delete("/appointments/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(appointment_id: int, db: Db, user: AuthenticatedUser):
    item = _owned_appointment(db, user, appointment_id)
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/history")
def history(
    db: Db,
    user: AuthenticatedUser,
    days: int = Query(default=7, ge=1, le=30),
    room_id: int | None = Query(default=None, ge=1),
    event_type: str | None = Query(default=None, max_length=48),
):
    residence = _residence(db, user)
    if not _owns_room(db, residence.id, room_id):
        raise HTTPException(status_code=404, detail="Ambiente não encontrado.")
    since = _date_floor(days)
    event_query = select(Event).where(Event.residence_id == residence.id, Event.occurred_at >= since)
    reading_query = select(Reading).where(Reading.residence_id == residence.id, Reading.observed_at >= since)
    if room_id:
        event_query = event_query.where(Event.room_id == room_id)
        reading_query = reading_query.where(Reading.room_id == room_id)
    if event_type:
        event_query = event_query.where(Event.event_type == event_type)
    events = db.scalars(event_query.order_by(Event.occurred_at.desc()).limit(1000)).all()
    readings = db.scalars(reading_query.order_by(Reading.observed_at).limit(3000)).all()
    rooms = {room.id: room for room in db.scalars(select(Room).where(Room.residence_id == residence.id)).all()}
    devices = {device.id: device for device in db.scalars(select(Device).where(Device.residence_id == residence.id)).all()}
    by_day = Counter(_ensure_aware(event.occurred_at).astimezone().date().isoformat() for event in events if event.event_type == "movement")
    by_room = Counter(rooms[event.room_id].name for event in events if event.event_type == "movement" and event.room_id in rooms)
    baseline = db.scalars(select(Event).where(Event.residence_id == residence.id, Event.event_type == "movement", Event.occurred_at < since, Event.occurred_at >= since - timedelta(days=30)).order_by(Event.occurred_at.desc()).limit(1000)).all()
    baseline_by_weekday = Counter(_ensure_aware(event.occurred_at).astimezone().weekday() for event in baseline)
    daily_rows = []
    for day_label, count in sorted(by_day.items()):
        day_value = date.fromisoformat(day_label)
        weekdays = [baseline_by_weekday[day_value.weekday()]]
        reference = round(sum(weekdays) / 4) if baseline else None
        daily_rows.append({"date": day_label, "events": count, "reference": reference})
    alert_rows = db.scalars(select(Alert).where(Alert.residence_id == residence.id, Alert.created_at >= since).order_by(Alert.created_at.desc())).all()
    return {
        "days": days,
        "room_id": room_id,
        "event_type": event_type,
        "activity_by_day": daily_rows,
        "activity_by_room": [{"room": label, "events": count} for label, count in by_room.most_common()],
        "readings": [{"metric": item.metric, "value": item.value, "room_id": item.room_id, "room_name": rooms[item.room_id].name if item.room_id in rooms else None, "observed_at": _iso(item.observed_at), "is_simulated": item.is_simulated} for item in readings],
        "events": [_event_dict(item, rooms, devices) for item in events],
        "alerts": [_alert_dict(item, rooms, devices) for item in alert_rows],
        "simulated": True,
    }


@app.get("/alerts")
def list_alerts(
    db: Db,
    user: AuthenticatedUser,
    status_filter: str | None = Query(default=None, alias="status", pattern="^(ativos|novo|reconhecido|resolvido|todos)$"),
    severity: str | None = Query(default=None, pattern="^(informativo|atencao|critico)$"),
):
    residence = _residence(db, user)
    query = select(Alert).where(Alert.residence_id == residence.id)
    if status_filter == "ativos":
        query = query.where(Alert.status != "resolvido")
    elif status_filter and status_filter != "todos":
        query = query.where(Alert.status == status_filter)
    if severity:
        query = query.where(Alert.severity == severity)
    rooms = {room.id: room for room in db.scalars(select(Room).where(Room.residence_id == residence.id)).all()}
    devices = {device.id: device for device in db.scalars(select(Device).where(Device.residence_id == residence.id)).all()}
    alerts = db.scalars(query.order_by(Alert.created_at.desc()).limit(300)).all()
    return [_alert_dict(alert, rooms, devices) for alert in alerts]


@app.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    alert = db.scalar(select(Alert).where(Alert.id == alert_id, Alert.residence_id == residence.id))
    if not alert:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada.")
    if alert.status == "resolvido":
        raise HTTPException(status_code=409, detail="Esta ocorrência já foi resolvida.")
    if alert.status == "novo":
        alert.status = "reconhecido"
        alert.acknowledged_at = now_utc()
        alert.acknowledged_by_id = user.id
    db.commit()
    return {"id": alert.id, "status": alert.status, "acknowledged_at": _iso(alert.acknowledged_at)}


@app.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, data: AlertResolveIn, db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    alert = db.scalar(select(Alert).where(Alert.id == alert_id, Alert.residence_id == residence.id))
    if not alert:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada.")
    if alert.status != "resolvido":
        alert.status = "resolvido"
        alert.resolved_at = now_utc()
        alert.resolved_by_id = user.id
        alert.resolution_note = data.note or "Verificação demonstrativa concluída pelo responsável."
        alert.fingerprint = None
        db.commit()
    return {"id": alert.id, "status": alert.status, "resolved_at": _iso(alert.resolved_at), "resolution_note": alert.resolution_note}


@app.get("/settings")
def get_settings_route(db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    row = db.scalar(select(MonitoringSettings).where(MonitoringSettings.residence_id == residence.id))
    if not row:
        row = MonitoringSettings(residence_id=residence.id, inactivity_minutes=180, temperature_min=18, temperature_max=30, humidity_min=30, humidity_max=70, notify_attention=True, notify_critical=True)
        db.add(row)
        db.commit()
        db.refresh(row)
    return {"inactivity_minutes": row.inactivity_minutes, "temperature_min": row.temperature_min, "temperature_max": row.temperature_max, "humidity_min": row.humidity_min, "humidity_max": row.humidity_max, "notify_attention": row.notify_attention, "notify_critical": row.notify_critical, "simulation_parameters": True}


@app.put("/settings")
def put_settings(data: SettingsPatch, db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    row = db.scalar(select(MonitoringSettings).where(MonitoringSettings.residence_id == residence.id))
    if not row:
        row = MonitoringSettings(residence_id=residence.id, inactivity_minutes=180, temperature_min=18, temperature_max=30, humidity_min=30, humidity_max=70, notify_attention=True, notify_critical=True)
        db.add(row)
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(row, key, value)
    if row.temperature_min >= row.temperature_max or row.humidity_min >= row.humidity_max:
        raise HTTPException(status_code=422, detail="O limite mínimo precisa ser menor que o máximo.")
    db.commit()
    db.refresh(row)
    return {"inactivity_minutes": row.inactivity_minutes, "temperature_min": row.temperature_min, "temperature_max": row.temperature_max, "humidity_min": row.humidity_min, "humidity_max": row.humidity_max, "notify_attention": row.notify_attention, "notify_critical": row.notify_critical, "simulation_parameters": True}


@app.get("/contacts")
def list_contacts(db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    return [{"id": item.id, "name": item.name, "relationship_label": item.relationship_label, "phone": item.phone, "email": item.email} for item in db.scalars(select(Contact).where(Contact.residence_id == residence.id).order_by(Contact.id)).all()]


@app.post("/contacts", status_code=status.HTTP_201_CREATED)
def create_contact(data: ContactIn, db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    if data.email and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", data.email.strip()):
        raise HTTPException(status_code=422, detail="Informe um e-mail válido.")
    contact = Contact(residence_id=residence.id, **data.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return {"id": contact.id, "name": contact.name, "relationship_label": contact.relationship_label, "phone": contact.phone, "email": contact.email}


@app.patch("/contacts/{contact_id}")
def patch_contact(contact_id: int, data: ContactIn, db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    contact = db.scalar(select(Contact).where(Contact.id == contact_id, Contact.residence_id == residence.id))
    if not contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado.")
    for key, value in data.model_dump().items():
        setattr(contact, key, value)
    db.commit()
    db.refresh(contact)
    return {"id": contact.id, "name": contact.name, "relationship_label": contact.relationship_label, "phone": contact.phone, "email": contact.email}


@app.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: int, db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    contact = db.scalar(select(Contact).where(Contact.id == contact_id, Contact.residence_id == residence.id))
    if not contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado.")
    db.delete(contact)
    db.commit()


@app.get("/simulation/state")
def simulation_state(db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    run = db.scalar(select(Simulation).where(Simulation.residence_id == residence.id))
    if not run:
        return {"scenario": "normal", "scenario_id": "normal", "status": "pausado", "step": 0, "elapsed": 0, "duration": 22, "speed": 1, "run_id": None, "scenario_count": 0, "fall_confirmed": False}
    snapshot = simulation_snapshot(run)
    alert = None
    if run.scenario == "possivel_queda" and run.started_at:
        fall_event = db.scalar(select(Event).where(Event.residence_id == residence.id, Event.event_type == "possible_fall", Event.occurred_at >= run.started_at).order_by(Event.id.desc()).limit(1))
        if fall_event:
            alert = db.scalar(select(Alert).where(Alert.residence_id == residence.id, Alert.alert_type == "possivel_queda", Alert.room_id == fall_event.room_id).order_by(Alert.id.desc()).limit(1))
    snapshot["fall_confirmed"] = bool(alert)
    snapshot["last_alert_id"] = alert.id if alert else None
    snapshot["last_alert_status"] = alert.status if alert else None
    return snapshot


@app.post("/simulation/run")
def simulation_run(data: ScenarioIn, db: Db, user: AuthenticatedUser):
    scenario = next((key for key, value in SCENARIO_IDS.items() if value == data.scenario), data.scenario)
    if scenario not in SCENARIOS:
        raise HTTPException(status_code=422, detail="Cenário de simulação desconhecido.")
    residence = _residence(db, user)
    run = db.scalar(select(Simulation).where(Simulation.residence_id == residence.id).with_for_update())
    if not run:
        run = Simulation(residence_id=residence.id)
        db.add(run)
        db.flush()
    if run.status == "rodando":
        raise HTTPException(status_code=409, detail="Já existe uma simulação em andamento. Pause ou restaure o cenário atual.")
    run.scenario = scenario
    run.run_token = str(uuid4())
    run.elapsed_base = 0
    run.speed = 1
    run.status = "rodando"
    run.step = 0
    run.started_at = now_utc()
    run.next_step_at = run.started_at
    run.updated_at = run.started_at
    db.commit()
    db.refresh(run)
    return simulation_snapshot(run)


@app.post("/simulation/pause")
def simulation_pause(db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    run = db.scalar(select(Simulation).where(Simulation.residence_id == residence.id).with_for_update())
    if not run:
        raise HTTPException(status_code=404, detail="Simulador não encontrado.")
    now = now_utc()
    run.elapsed_base = logical_elapsed(run, now)
    run.status = "pausado"
    run.next_step_at = None
    run.updated_at = now
    db.commit()
    return simulation_snapshot(run)


@app.post("/simulation/resume")
def simulation_resume(db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    run = db.scalar(select(Simulation).where(Simulation.residence_id == residence.id).with_for_update())
    if not run or run.status != "pausado" or not run.run_token or run.step >= len(_steps(run.scenario)):
        raise HTTPException(status_code=409, detail="Não há cenário pausado para retomar.")
    now = now_utc()
    run.status = "rodando"
    run.updated_at = now
    schedule_next(run, now)
    db.commit()
    return simulation_snapshot(run)


@app.post("/simulation/speed")
def simulation_speed(data: SimulationSpeedIn, db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    run = db.scalar(select(Simulation).where(Simulation.residence_id == residence.id).with_for_update())
    if not run or not run.run_token:
        raise HTTPException(status_code=409, detail="Inicie um cenário primeiro.")
    now = now_utc()
    run.elapsed_base = logical_elapsed(run, now)
    run.updated_at = now
    run.speed = data.speed
    if run.status == "rodando":
        schedule_next(run, now)
    db.commit()
    return simulation_snapshot(run)


@app.post("/simulation/next")
def simulation_next(db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    run = db.scalar(select(Simulation).where(Simulation.residence_id == residence.id).with_for_update())
    if not run or not run.run_token or run.status == "concluido":
        raise HTTPException(status_code=409, detail="Não há cenário para avançar.")
    was_paused = run.status == "pausado"
    now = now_utc()
    elapsed = logical_elapsed(run, now)
    marker = next((value for value in MARKERS[run.scenario] if value > elapsed + 0.001), MARKERS[run.scenario][-1])
    # Process every crossed domain event once in order. advance_simulation commits each event.
    while run.step < len(_steps(run.scenario)) and _steps(run.scenario)[run.step][0] <= marker:
        run.status = "rodando"
        run.next_step_at = now_utc() - timedelta(milliseconds=1)
        db.commit()
        advance_simulation(db, residence.id)
        run = db.scalar(select(Simulation).where(Simulation.residence_id == residence.id).with_for_update())
    now = now_utc()
    run.elapsed_base = float(marker)
    run.updated_at = now
    if run.status != "concluido":
        run.status = "pausado" if was_paused else "rodando"
        if run.status == "rodando":
            schedule_next(run, now)
        else:
            run.next_step_at = None
    db.commit()
    return simulation_snapshot(run)


@app.post("/simulation/restore")
def simulation_restore(db: Db, user: AuthenticatedUser):
    residence = _residence(db, user)
    run = db.scalar(select(Simulation).where(Simulation.residence_id == residence.id))
    now = now_utc()
    for device in db.scalars(select(Device).where(Device.residence_id == residence.id)).all():
        if device.status == "offline":
            device.status = "online"
            device.last_seen_at = now
            record_event(db, residence_id=residence.id, room_id=device.room_id, device_id=device.id, event_type="device_online", summary=f"{device.name} voltou a se comunicar", details={"coverage_restored": True, "restored_by": "responsável"})
    environmental = db.scalar(select(Device).where(Device.residence_id == residence.id, Device.device_type == "ambiental").limit(1))
    if environmental:
        room_id = environmental.room_id or db.scalar(select(Room.id).where(Room.residence_id == residence.id).order_by(Room.sort_order).limit(1))
        db.add_all([
            Reading(residence_id=residence.id, room_id=room_id, device_id=environmental.id, metric="temperatura", value=24.1, observed_at=now, is_simulated=True),
            Reading(residence_id=residence.id, room_id=room_id, device_id=environmental.id, metric="umidade", value=52.0, observed_at=now, is_simulated=True),
        ])
        record_event(db, residence_id=residence.id, room_id=room_id, device_id=environmental.id, event_type="temperature", summary="Temperatura dentro da faixa configurada", details={"value": 24.1, "restored_by": "responsável"})
        record_event(db, residence_id=residence.id, room_id=room_id, device_id=environmental.id, event_type="humidity", summary="Umidade dentro da faixa configurada", details={"value": 52.0, "restored_by": "responsável"})
    # Environmental and connection conditions can clear; event history is retained.
    for alert in db.scalars(select(Alert).where(Alert.residence_id == residence.id, Alert.status != "resolvido", Alert.alert_type.in_(["temperatura_anormal", "umidade_anormal", "dispositivo_desconectado"]))).all():
        alert.status = "resolvido"
        alert.resolved_at = now
        alert.resolution_note = "Condições normais restauradas no simulador."
        alert.fingerprint = None
    if run:
        run.scenario = "normal"
        run.status = "pausado"
        run.elapsed_base = 0
        run.run_token = None
        run.step = 0
        run.next_step_at = None
        run.updated_at = now
    db.commit()
    return simulation_snapshot(run) if run else {"scenario": "normal", "status": "pausado", "step": 0, "scenario_count": 0}


@app.post("/simulation/reset")
def simulation_reset(db: Db, user: AuthenticatedUser):
    if user.email != "demo@senso.local" or not settings.demo_login_enabled:
        raise HTTPException(status_code=403, detail="A reinicialização completa está disponível apenas na conta demonstrativa.")
    residence = _residence(db, user)
    # Scope is deliberately limited to this authenticated user's fictional telemetries.
    db.query(Alert).filter(Alert.residence_id == residence.id).delete(synchronize_session=False)
    db.query(Event).filter(Event.residence_id == residence.id).delete(synchronize_session=False)
    db.query(Reading).filter(Reading.residence_id == residence.id).delete(synchronize_session=False)
    for device in db.scalars(select(Device).where(Device.residence_id == residence.id)).all():
        device.status = "online"
        device.last_seen_at = None
    run = db.scalar(select(Simulation).where(Simulation.residence_id == residence.id))
    if run:
        run.scenario = "normal"
        run.status = "pausado"
        run.elapsed_base = 0
        run.run_token = None
        run.step = 0
        run.next_step_at = None
    populate_demo_history(db, residence, days=31)
    ensure_demo_medications(db, residence)
    ensure_demo_appointments(db, residence)
    db.commit()
    return {"status": "reiniciado", "message": "O histórico fictício de 31 dias foi restaurado. A conta e as configurações foram preservadas."}
