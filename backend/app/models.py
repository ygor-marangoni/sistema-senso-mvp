from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(40), default="", server_default="", nullable=False)
    cpf: Mapped[str] = mapped_column(String(11), default="", server_default="", nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    residences: Mapped[list["Residence"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Residence(Base):
    __tablename__ = "residences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    resident_name: Mapped[str] = mapped_column(String(120), nullable=False)
    resident_gender: Mapped[str] = mapped_column(String(16), default="nao_informado", server_default="nao_informado", nullable=False)
    resident_age: Mapped[int | None] = mapped_column(Integer)
    resident_birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    address: Mapped[str] = mapped_column(String(240), default="", nullable=False)
    city: Mapped[str] = mapped_column(String(100), default="Uberlândia", nullable=False)
    state: Mapped[str] = mapped_column(String(2), default="MG", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    owner: Mapped[User] = relationship(back_populates="residences")
    rooms: Mapped[list["Room"]] = relationship(back_populates="residence", cascade="all, delete-orphan")
    devices: Mapped[list["Device"]] = relationship(back_populates="residence", cascade="all, delete-orphan")
    readings: Mapped[list["Reading"]] = relationship(back_populates="residence", cascade="all, delete-orphan")
    events: Mapped[list["Event"]] = relationship(back_populates="residence", cascade="all, delete-orphan")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="residence", cascade="all, delete-orphan")
    contacts: Mapped[list["Contact"]] = relationship(back_populates="residence", cascade="all, delete-orphan")
    settings: Mapped["MonitoringSettings | None"] = relationship(back_populates="residence", cascade="all, delete-orphan", uselist=False)
    simulation: Mapped["Simulation | None"] = relationship(back_populates="residence", cascade="all, delete-orphan", uselist=False)


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("residence_id", "name", name="uq_room_residence_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    plan_x: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    plan_y: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    plan_w: Mapped[float] = mapped_column(Float, default=1, nullable=False)
    plan_h: Mapped[float] = mapped_column(Float, default=1, nullable=False)
    residence: Mapped[Residence] = relationship(back_populates="rooms")
    devices: Mapped[list["Device"]] = relationship(back_populates="room")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id", ondelete="CASCADE"), index=True, nullable=False)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    device_type: Mapped[str] = mapped_column(String(40), nullable=False)
    serial: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="online", nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    residence: Mapped[Residence] = relationship(back_populates="devices")
    room: Mapped[Room | None] = relationship(back_populates="devices")


class Reading(Base):
    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id", ondelete="CASCADE"), index=True, nullable=False)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), index=True, nullable=False)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), index=True, nullable=False)
    metric: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    residence: Mapped[Residence] = relationship(back_populates="readings")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id", ondelete="CASCADE"), index=True, nullable=False)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id", ondelete="SET NULL"), index=True)
    device_id: Mapped[int | None] = mapped_column(ForeignKey("devices.id", ondelete="SET NULL"), index=True)
    event_type: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    summary: Mapped[str] = mapped_column(String(240), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    residence: Mapped[Residence] = relationship(back_populates="events")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id", ondelete="CASCADE"), index=True, nullable=False)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id", ondelete="SET NULL"), index=True)
    device_id: Mapped[int | None] = mapped_column(ForeignKey("devices.id", ondelete="SET NULL"), index=True)
    alert_type: Mapped[str] = mapped_column(String(48), index=True, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="novo", index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    fingerprint: Mapped[str | None] = mapped_column(String(160), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True, nullable=False)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledged_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolution_note: Mapped[str | None] = mapped_column(String(300))
    residence: Mapped[Residence] = relationship(back_populates="alerts")
    acknowledged_by: Mapped[User | None] = relationship(foreign_keys=[acknowledged_by_id])
    resolved_by: Mapped[User | None] = relationship(foreign_keys=[resolved_by_id])


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    relationship_label: Mapped[str] = mapped_column(String(80), default="Familiar", nullable=False)
    phone: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    email: Mapped[str] = mapped_column(String(254), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    residence: Mapped[Residence] = relationship(back_populates="contacts")


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    dosage: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    instructions: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    time_of_day: Mapped[str] = mapped_column(String(5), nullable=False)
    weekdays: Mapped[list] = mapped_column(JSON, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)


class MedicationConfirmation(Base):
    __tablename__ = "medication_confirmations"
    __table_args__ = (UniqueConstraint("medication_id", "scheduled_date", name="uq_medication_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    medication_id: Mapped[int] = mapped_column(ForeignKey("medications.id", ondelete="CASCADE"), index=True, nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    confirmed_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    appointment_type: Mapped[str] = mapped_column(String(20), default="consulta", nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    time_of_day: Mapped[str] = mapped_column(String(5), nullable=False)
    professional: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    location: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    notes: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)


class MonitoringSettings(Base):
    __tablename__ = "monitoring_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id", ondelete="CASCADE"), unique=True, nullable=False)
    inactivity_minutes: Mapped[int] = mapped_column(Integer, default=180, nullable=False)
    temperature_min: Mapped[float] = mapped_column(Float, default=18, nullable=False)
    temperature_max: Mapped[float] = mapped_column(Float, default=30, nullable=False)
    humidity_min: Mapped[float] = mapped_column(Float, default=30, nullable=False)
    humidity_max: Mapped[float] = mapped_column(Float, default=70, nullable=False)
    notify_attention: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_critical: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    residence: Mapped[Residence] = relationship(back_populates="settings")


class Simulation(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    residence_id: Mapped[int] = mapped_column(ForeignKey("residences.id", ondelete="CASCADE"), unique=True, nullable=False)
    scenario: Mapped[str] = mapped_column(String(32), default="normal", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pausado", nullable=False)
    step: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_step_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    elapsed_base: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    speed: Mapped[float] = mapped_column(Float, default=1, nullable=False)
    run_token: Mapped[str | None] = mapped_column(String(36))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)
    residence: Mapped[Residence] = relationship(back_populates="simulation")
