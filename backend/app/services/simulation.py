from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import Alert, Device, Event, Reading, Room, Simulation, now_utc
from app.services.analysis import record_event

SCENARIOS = {"normal", "inatividade", "possivel_queda", "ambiental", "desconectado", "rotina"}


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _room(db: Session, residence_id: int, preferred: str | None = None) -> Room:
    query = select(Room).where(Room.residence_id == residence_id)
    if preferred:
        room = db.scalar(query.where(Room.name == preferred))
        if room:
            return room
    room = db.scalar(query.order_by(Room.sort_order).limit(1))
    if not room:
        raise HTTPException(status_code=409, detail="Configure ao menos um ambiente para usar a simulação.")
    return room


def _device(db: Session, residence_id: int, device_type: str, room_id: int | None = None) -> Device:
    query = select(Device).where(Device.residence_id == residence_id, Device.device_type == device_type)
    if room_id is not None:
        query = query.where(Device.room_id == room_id)
    device = db.scalar(query.order_by(Device.id).limit(1))
    if not device:
        device = db.scalar(select(Device).where(Device.residence_id == residence_id).order_by(Device.id).limit(1))
    if not device:
        raise HTTPException(status_code=409, detail="Configure dispositivos virtuais antes de iniciar a simulação.")
    return device


def _write_environment(db: Session, residence_id: int, temperature: float, humidity: float) -> None:
    device = _device(db, residence_id, "ambiental")
    room = db.get(Room, device.room_id) if device.room_id else _room(db, residence_id)
    now = now_utc()
    db.add_all([
        Reading(residence_id=residence_id, room_id=room.id, device_id=device.id, metric="temperatura", value=temperature, observed_at=now, is_simulated=True),
        Reading(residence_id=residence_id, room_id=room.id, device_id=device.id, metric="umidade", value=humidity, observed_at=now, is_simulated=True),
    ])
    device.last_seen_at = now
    record_event(db, residence_id=residence_id, room_id=room.id, device_id=device.id, event_type="temperature", summary=f"Temperatura registrada · {temperature:.1f} °C", details={"value": temperature})
    record_event(db, residence_id=residence_id, room_id=room.id, device_id=device.id, event_type="humidity", summary=f"Umidade registrada · {humidity:.0f}%", details={"value": humidity})


# Absolute logical seconds, matching the approved visual narrative.
DURATIONS = {"normal": 22, "inatividade": 28, "possivel_queda": 34, "ambiental": 28, "desconectado": 26, "rotina": 26}
SCENARIO_IDS = {"normal": "normal", "inatividade": "idle", "possivel_queda": "fall", "ambiental": "heat", "desconectado": "offline", "rotina": "routine"}
MARKERS = {"normal": [0, 5, 10, 15, 20, 22], "inatividade": [0, 6, 12, 20, 24, 28], "possivel_queda": [0, 7, 9, 11, 12, 15, 21, 30, 34], "ambiental": [0, 6, 12, 20, 24, 28], "desconectado": [0, 5, 11, 17, 22, 26], "rotina": [0, 5, 11, 17, 22, 26]}

def _steps(scenario: str) -> list[tuple[int, str]]:
    return {
        "normal": [(0, "baseline"), (22, "finish")],
        "inatividade": [(0, "movement"), (20, "inactivity"), (28, "finish")],
        "possivel_queda": [(0, "movement"), (7, "burst"), (9, "inactivity_observed"), (11, "fall"), (12, "alert_available"), (15, "rescue_requested"), (21, "team_arrived"), (30, "care_started"), (34, "finish")],
        "ambiental": [(0, "movement"), (20, "temperature_high"), (28, "finish")],
        "desconectado": [(0, "movement"), (5, "offline"), (22, "online"), (26, "finish")],
        "rotina": [(0, "movement"), (17, "routine_change"), (26, "finish")],
    }[scenario]

def logical_elapsed(run: Simulation, now: datetime | None = None) -> float:
    elapsed = run.elapsed_base or 0.0
    if run.status == "rodando" and run.updated_at:
        elapsed += max(0.0, ((_utc(now or now_utc()) - _utc(run.updated_at)).total_seconds())) * (run.speed or 1.0)
    elapsed = min(elapsed, DURATIONS.get(run.scenario, 0))
    # Do not present a domain event until it has actually been processed.
    steps = _steps(run.scenario) if run.scenario in SCENARIOS else []
    if run.step < len(steps):
        elapsed = min(elapsed, steps[run.step][0])
    return round(elapsed, 3)

def schedule_next(run: Simulation, now: datetime) -> None:
    steps = _steps(run.scenario)
    run.next_step_at = now + timedelta(seconds=max(0, steps[run.step][0] - (run.elapsed_base or 0)) / (run.speed or 1)) if run.step < len(steps) else None


def advance_simulation(db: Session, residence_id: int) -> dict:
    run = db.scalar(select(Simulation).where(Simulation.residence_id == residence_id).with_for_update())
    if not run:
        raise HTTPException(status_code=409, detail="Simulador não configurado para esta residência.")
    now = now_utc()
    due_at = _utc(run.next_step_at)
    if run.status != "rodando" or due_at is None or due_at > now:
        return simulation_snapshot(run)
    timeline = _steps(run.scenario)
    if run.step >= len(timeline):
        run.status = "concluido"
        run.next_step_at = None
        db.commit()
        return simulation_snapshot(run)

    event_time, action = timeline[run.step]
    # The delays describe the gap after the previous step; the stored deadline is authoritative.
    room = _room(db, residence_id, "Cozinha" if action in {"burst", "fall", "offline"} else "Sala de estar" if action in {"movement", "baseline", "routine_change"} else None)
    if action == "baseline":
        device = _device(db, residence_id, "presenca", room.id)
        device.last_seen_at = now
        record_event(db, residence_id=residence_id, room_id=room.id, device_id=device.id, event_type="movement", summary="Rotina habitual · movimentação detectada", details={"source": "simulador", "confidence": 0.93})
        _write_environment(db, residence_id, 24.1, 52)
    elif action == "movement":
        device = _device(db, residence_id, "presenca", room.id)
        device.last_seen_at = now
        record_event(db, residence_id=residence_id, room_id=room.id, device_id=device.id, event_type="movement", summary="Movimentação habitual detectada", details={"source": "simulador", "confidence": 0.91})
    elif action == "burst":
        device = _device(db, residence_id, "presenca", room.id)
        device.last_seen_at = now
        record_event(db, residence_id=residence_id, room_id=room.id, device_id=device.id, event_type="motion_burst", summary="Movimento brusco detectado", details={"duration_seconds": 1.2, "confidence": 0.88, "interpretation": "evento isolado, sem conclusão de queda"})
    elif action == "fall":
        device = _device(db, residence_id, "presenca", room.id)
        burst = db.scalar(select(Event).where(Event.residence_id == residence_id, Event.room_id == room.id, Event.event_type == "motion_burst", Event.occurred_at >= run.started_at).order_by(Event.id.desc()).limit(1))
        subsequent_movement = db.scalar(select(Event.id).where(Event.residence_id == residence_id, Event.room_id == room.id, Event.event_type == "movement", Event.id > burst.id).limit(1)) if burst else None
        if burst and not subsequent_movement and device.status == "online":
            record_event(db, residence_id=residence_id, room_id=room.id, device_id=device.id, event_type="possible_fall", summary="Movimento brusco seguido de inatividade", details={"preceded_by_abrupt_motion": True, "inactive_seconds": 300, "sensors_online": True, "rule": "movimento brusco + ausência de nova atividade em janela curta", "simulated_accelerated": True})
    elif action in {"inactivity_observed", "alert_available", "rescue_requested", "team_arrived", "care_started"}:
        # These are narrative milestones, stored as simulated events and never sent externally.
        stages = {
            "inactivity_observed": ("inactivity_observed", "Imobilidade observada após movimento brusco"),
            "alert_available": ("simulated_alert_available", "Alerta disponibilizado ao familiar no roteiro simulado"),
            "rescue_requested": ("simulated_rescue_requested", "Solicitação fictícia de socorro pelo familiar"),
            "team_arrived": ("simulated_team_arrived", "Equipe de socorro chegou à residência na simulação"),
            "care_started": ("simulated_care_started", "Atendimento demonstrativo iniciado"),
        }
        event_type, summary = stages[action]
        record_event(
            db,
            residence_id=residence_id,
            room_id=room.id,
            device_id=None,
            event_type=event_type,
            summary=summary,
            details={"source": "roteiro_simulado", "run_id": run.run_token, "external_action": False},
        )
    elif action == "inactivity":
        room = _room(db, residence_id, "Quarto")
        device = _device(db, residence_id, "presenca", room.id)
        record_event(db, residence_id=residence_id, room_id=room.id, device_id=device.id, event_type="inactivity", summary="Inatividade prolongada fora do horário habitual de descanso", details={"duration_minutes": 240, "usual_rest_period": False, "sensors_online": True})
    elif action == "temperature_high":
        _write_environment(db, residence_id, 32.4, 67)
    elif action == "temperature_recovered":
        _write_environment(db, residence_id, 25.2, 55)
        _resolve_by_type(db, residence_id, "temperatura_anormal", "Parâmetro ambiental voltou à faixa configurada no simulador.")
    elif action == "offline":
        device = _device(db, residence_id, "presenca", room.id)
        device.status = "offline"
        record_event(db, residence_id=residence_id, room_id=room.id, device_id=device.id, event_type="device_offline", summary=f"{device.name} perdeu comunicação", details={"coverage_reduced": True})
    elif action == "online":
        device = db.scalar(select(Device).where(Device.residence_id == residence_id, Device.status == "offline").order_by(Device.id).limit(1))
        if device:
            device.status = "online"
            device.last_seen_at = now
            record_event(db, residence_id=residence_id, room_id=device.room_id, device_id=device.id, event_type="device_online", summary=f"{device.name} voltou a se comunicar", details={"coverage_restored": True})
            _resolve_by_type(db, residence_id, "dispositivo_desconectado", "Comunicação restabelecida no simulador.", device.id)
    elif action == "routine_change":
        room = _room(db, residence_id, "Cozinha")
        device = _device(db, residence_id, "presenca", room.id)
        record_event(db, residence_id=residence_id, room_id=room.id, device_id=device.id, event_type="routine_change", summary="Atividade em horário diferente da rotina de referência", details={"reference_window": "07:00–22:00", "observed_window": "fora do padrão simulado", "confidence": 0.84})

    elapsed_before = max(event_time, logical_elapsed(run, now))
    run.step += 1
    run.elapsed_base = elapsed_before
    if run.step >= len(timeline):
        run.status = "concluido"
        run.next_step_at = None
    else:
        schedule_next(run, now)
    run.updated_at = now
    db.commit()
    db.refresh(run)
    return simulation_snapshot(run)


def _resolve_by_type(db: Session, residence_id: int, alert_type: str, note: str, device_id: int | None = None) -> None:
    query = select(Alert).where(Alert.residence_id == residence_id, Alert.alert_type == alert_type, Alert.status != "resolvido")
    if device_id is not None:
        query = query.where(Alert.device_id == device_id)
    for alert in db.scalars(query).all():
        alert.status = "resolvido"
        alert.resolved_at = now_utc()
        alert.resolution_note = note
        alert.fingerprint = None


def simulation_snapshot(run: Simulation) -> dict:
    elapsed = logical_elapsed(run)
    return {
        "run_id": run.run_token, "scenario": run.scenario, "scenario_id": SCENARIO_IDS.get(run.scenario, "normal"),
        "status": run.status, "step": run.step, "elapsed": elapsed, "duration": DURATIONS.get(run.scenario, 0),
        "speed": run.speed or 1, "started_at": run.started_at, "updated_at": run.updated_at,
        "next_step_at": run.next_step_at, "scenario_count": len(_steps(run.scenario)) if run.scenario in SCENARIOS else 0,
        "fall_confirmed": False,  # GET /simulation/state enriches this with the actual persisted alert.
        "room_index": 1 if run.scenario in {"possivel_queda", "ambiental", "desconectado"} and elapsed >= 5 else 2 if run.scenario == "rotina" else 0,
        "severity": "response" if run.scenario == "possivel_queda" and run.step >= 3 and elapsed >= 21 else "critical" if run.scenario == "possivel_queda" and run.step >= 3 else "attention" if run.scenario == "desconectado" and run.step == 2 or run.scenario in {"inatividade", "ambiental", "rotina"} and run.step >= 2 else "normal",
        "offline": run.scenario == "desconectado" and 2 <= run.step < 3,
    }
