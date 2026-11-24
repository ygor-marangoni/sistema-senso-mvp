import math
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Alert, Appointment, Contact, Device, Event, Medication, Reading, Residence, Room


def ensure_demo_medications(db: Session, residence: Residence) -> None:
    """Add clearly fictional schedule entries so the demo calendar is populated."""
    existing = db.scalar(select(Medication.id).where(Medication.residence_id == residence.id).limit(1))
    if existing:
        return
    today = datetime.now(timezone(timedelta(hours=-3))).date()
    for name, time_of_day in (("Exemplo · manhã", "08:00"), ("Exemplo · noite", "20:00")):
        db.add(Medication(
            residence_id=residence.id,
            name=name,
            dosage="Dose demonstrativa",
            instructions="",
            time_of_day=time_of_day,
            weekdays=list(range(7)),
            start_date=today,
            end_date=None,
        ))


def ensure_demo_appointments(db: Session, residence: Residence) -> None:
    """Add one clearly fictional consultation to the demo agenda."""
    existing = db.scalar(select(Appointment.id).where(Appointment.residence_id == residence.id).limit(1))
    if existing:
        return
    today = datetime.now(timezone(timedelta(hours=-3))).date()
    db.add(Appointment(
        residence_id=residence.id,
        title="Exemplo · consulta geriátrica",
        appointment_type="consulta",
        scheduled_date=today + timedelta(days=3),
        time_of_day="10:30",
        professional="Profissional de saúde (exemplo)",
        location="Unidade de saúde (exemplo)",
        notes="Compromisso fictício para demonstração.",
    ))


def populate_demo_history(db: Session, residence: Residence, *, days: int = 31) -> None:
    """Insert a deterministic, plausible month of fictional home signals."""
    rooms = db.scalars(select(Room).where(Room.residence_id == residence.id).order_by(Room.sort_order)).all()
    devices = db.scalars(select(Device).where(Device.residence_id == residence.id).order_by(Device.id)).all()
    if not rooms or not devices:
        return
    movement_devices = {device.room_id: device for device in devices if device.device_type == "presenca"}
    environmental = next((device for device in devices if device.device_type == "ambiental"), None)
    if not environmental:
        return
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    for day_offset in range(days - 1, -1, -1):
        day = now - timedelta(days=day_offset)
        rng = random.Random(240517 + day_offset)
        for _ in range(rng.randint(9, 16)):
            hour = rng.choices([7, 8, 9, 11, 13, 15, 17, 19, 21, 22], weights=[3, 5, 5, 4, 5, 4, 6, 7, 3, 1])[0]
            minute = rng.choice([0, 10, 20, 30, 40, 50])
            occurred_at = day.replace(hour=hour, minute=minute)
            if occurred_at > now:
                continue
            room = rng.choices(rooms[:min(3, len(rooms))], weights=[4, 2, 3][:min(3, len(rooms))])[0]
            source_device = movement_devices.get(room.id)
            db.add(Event(
                residence_id=residence.id,
                room_id=room.id,
                device_id=source_device.id if source_device else None,
                event_type="movement",
                summary=f"Movimentação detectada · {room.name.lower()}",
                details={"confidence": round(rng.uniform(.78, .96), 2), "source": "simulador_base"},
                occurred_at=occurred_at,
                is_simulated=True,
            ))
        for hour in (8, 14, 20):
            observed_at = day.replace(hour=hour, minute=0)
            if observed_at > now:
                continue
            wave = math.sin((hour - 8) / 12 * math.pi)
            db.add(Reading(residence_id=residence.id, room_id=environmental.room_id or rooms[0].id, device_id=environmental.id, metric="temperatura", value=round(23 + 2.3 * wave + rng.uniform(-.6, .6), 1), observed_at=observed_at, is_simulated=True))
            db.add(Reading(residence_id=residence.id, room_id=environmental.room_id or rooms[0].id, device_id=environmental.id, metric="umidade", value=round(55 - 7 * wave + rng.uniform(-4, 4), 1), observed_at=observed_at, is_simulated=True))

    # Fresh values make the initial dashboard truthful immediately after setup.
    room = rooms[0]
    current_movement = movement_devices.get(room.id)
    if current_movement:
        db.add(Event(residence_id=residence.id, room_id=room.id, device_id=current_movement.id, event_type="movement", summary="Movimentação recente detectada · sala de estar", details={"confidence": .91, "source": "simulador_base"}, occurred_at=now - timedelta(minutes=12), is_simulated=True))
        current_movement.last_seen_at = now
    db.add(Reading(residence_id=residence.id, room_id=environmental.room_id or room.id, device_id=environmental.id, metric="temperatura", value=24.1, observed_at=now, is_simulated=True))
    db.add(Reading(residence_id=residence.id, room_id=environmental.room_id or room.id, device_id=environmental.id, metric="umidade", value=52.0, observed_at=now, is_simulated=True))
    for device in devices:
        device.status = "online"
        device.last_seen_at = now

    if days >= 8:
        older_room = rooms[min(2, len(rooms) - 1)]
        old_device = movement_devices.get(older_room.id)
        inactive_at = now - timedelta(days=12, hours=4)
        inactivity = Event(residence_id=residence.id, room_id=older_room.id, device_id=old_device.id if old_device else None, event_type="inactivity", summary="Inatividade fora do padrão · ocorrência encerrada", details={"duration_minutes": 225, "usual_rest_period": False, "sensors_online": True}, occurred_at=inactive_at, is_simulated=True)
        db.add(inactivity)
        db.flush()
        db.add(Alert(residence_id=residence.id, room_id=older_room.id, device_id=old_device.id if old_device else None, alert_type="inatividade_incomum", severity="atencao", status="resolvido", title="Período sem atividade fora da rotina", message="Os sensores conectados registraram menos movimento do que o esperado para aquele horário. A ocorrência foi verificada na demonstração.", evidence={"duration_minutes": 225, "historical_demo": True}, fingerprint=None, created_at=inactive_at, acknowledged_at=inactive_at + timedelta(minutes=3), acknowledged_by_id=residence.owner_id, resolved_at=inactive_at + timedelta(minutes=18), resolved_by_id=residence.owner_id, resolution_note="Verificação demonstrativa concluída."))
        environmental_at = now - timedelta(days=8)
        environmental_event = Event(residence_id=residence.id, room_id=room.id, device_id=environmental.id, event_type="temperature", summary="Temperatura acima do parâmetro · ocorrência encerrada", details={"value": 31.5}, occurred_at=environmental_at, is_simulated=True)
        db.add(environmental_event)
        db.flush()
        db.add(Alert(residence_id=residence.id, room_id=room.id, device_id=environmental.id, alert_type="temperatura_anormal", severity="atencao", status="resolvido", title="Temperatura fora da faixa configurada", message="Uma leitura ambiental ultrapassou o parâmetro demonstrativo e depois retornou à faixa configurada.", evidence={"value": 31.5, "historical_demo": True}, fingerprint=None, created_at=environmental_at, acknowledged_at=environmental_at + timedelta(minutes=6), acknowledged_by_id=residence.owner_id, resolved_at=environmental_at + timedelta(hours=1), resolved_by_id=residence.owner_id, resolution_note="Condição normalizada no histórico demonstrativo."))

    has_caregiver = db.scalar(select(Contact.id).where(Contact.residence_id == residence.id, Contact.relationship_label == "Cuidador"))
    if not has_caregiver:
        db.add(Contact(residence_id=residence.id, name="Rafael Duarte", relationship_label="Cuidador", phone="(34) 98888-0000", email="rafael@example.com"))
