from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Alert, Event, MonitoringSettings


def record_event(
    db: Session,
    *,
    residence_id: int,
    event_type: str,
    summary: str,
    room_id: int | None = None,
    device_id: int | None = None,
    details: dict | None = None,
    occurred_at: datetime | None = None,
) -> Event:
    event = Event(
        residence_id=residence_id,
        room_id=room_id,
        device_id=device_id,
        event_type=event_type,
        summary=summary,
        details=details or {},
        occurred_at=occurred_at or datetime.now(timezone.utc),
        is_simulated=True,
    )
    db.add(event)
    db.flush()
    analyze_event(db, event)
    return event


def _settings(db: Session, residence_id: int) -> MonitoringSettings:
    return db.scalar(select(MonitoringSettings).where(MonitoringSettings.residence_id == residence_id)) or MonitoringSettings(
        residence_id=residence_id,
        inactivity_minutes=180,
        temperature_min=18,
        temperature_max=30,
        humidity_min=30,
        humidity_max=70,
        notify_attention=True,
        notify_critical=True,
    )


def raise_alert(
    db: Session,
    *,
    event: Event,
    alert_type: str,
    severity: str,
    title: str,
    message: str,
    fingerprint: str,
    evidence: dict | None = None,
) -> Alert:
    existing = db.scalar(select(Alert).where(Alert.fingerprint == fingerprint, Alert.status != "resolvido"))
    if existing:
        return existing
    alert = Alert(
        residence_id=event.residence_id,
        room_id=event.room_id,
        device_id=event.device_id,
        alert_type=alert_type,
        severity=severity,
        status="novo",
        title=title,
        message=message,
        evidence=evidence or event.details,
        fingerprint=fingerprint,
        created_at=event.occurred_at,
    )
    db.add(alert)
    return alert


def analyze_event(db: Session, event: Event) -> list[Alert]:
    """Deterministic, contextual rules for simulated residential telemetry."""
    details = event.details or {}
    alerts: list[Alert] = []
    if event.event_type == "possible_fall" and details.get("preceded_by_abrupt_motion"):
        alerts.append(raise_alert(
            db,
            event=event,
            alert_type="possivel_queda",
            severity="critico",
            title="Possível queda identificada",
            message="Um movimento brusco foi seguido por um período sem nova atividade. A situação pede uma verificação do responsável.",
            fingerprint=f"fall:{event.residence_id}:{event.room_id or 0}",
            evidence={"movimento_brusco": True, "inatividade_segundos": details.get("inactive_seconds"), "regra": "movimento brusco seguido de inatividade"},
        ))
    elif event.event_type == "inactivity" and not details.get("usual_rest_period"):
        settings = _settings(db, event.residence_id)
        if float(details.get("duration_minutes", 0)) >= settings.inactivity_minutes:
            alerts.append(raise_alert(
                db,
                event=event,
                alert_type="inatividade_incomum",
                severity="atencao",
                title="Período sem atividade fora da rotina",
                message="Os sensores conectados registraram menos movimento do que o esperado para este horário. Isso não indica, por si só, uma emergência.",
                fingerprint=f"inactivity:{event.residence_id}:{event.room_id}:{event.occurred_at.date()}",
                evidence={"duration_minutes": details.get("duration_minutes"), "usual_rest_period": False},
            ))
    elif event.event_type == "temperature":
        settings = _settings(db, event.residence_id)
        value = float(details.get("value", 0))
        if value < settings.temperature_min or value > settings.temperature_max:
            alerts.append(raise_alert(
                db,
                event=event,
                alert_type="temperatura_anormal",
                severity="atencao",
                title="Temperatura fora da faixa configurada",
                message=f"A leitura de {value:.1f} °C está fora dos parâmetros demonstrativos configurados para esta residência.",
                fingerprint=f"temperature:{event.residence_id}:{event.room_id}",
                evidence={"value": value, "faixa": [settings.temperature_min, settings.temperature_max]},
            ))
    elif event.event_type == "humidity":
        settings = _settings(db, event.residence_id)
        value = float(details.get("value", 0))
        if value < settings.humidity_min or value > settings.humidity_max:
            alerts.append(raise_alert(
                db,
                event=event,
                alert_type="umidade_anormal",
                severity="atencao",
                title="Umidade fora da faixa configurada",
                message=f"A leitura de {value:.0f}% está fora dos parâmetros demonstrativos configurados para esta residência.",
                fingerprint=f"humidity:{event.residence_id}:{event.room_id}",
                evidence={"value": value, "faixa": [settings.humidity_min, settings.humidity_max]},
            ))
    elif event.event_type == "device_offline":
        alerts.append(raise_alert(
            db,
            event=event,
            alert_type="dispositivo_desconectado",
            severity="atencao",
            title="Dispositivo sem comunicação",
            message="A cobertura de monitoramento foi reduzida neste ambiente. A falta de comunicação não permite inferir ausência de movimento.",
            fingerprint=f"offline:{event.device_id}",
            evidence={"device_id": event.device_id, "monitoramento_parcial": True},
        ))
    elif event.event_type == "routine_change":
        alerts.append(raise_alert(
            db,
            event=event,
            alert_type="alteracao_rotina",
            severity="atencao",
            title="Atividade diferente do padrão habitual",
            message="Foi registrada atividade em um horário diferente da referência simulada. Consulte o histórico para entender o contexto.",
            fingerprint=f"routine:{event.residence_id}:{event.room_id or 0}:{event.occurred_at.date()}",
            evidence=details,
        ))
    elif event.event_type == "device_online":
        alerts.append(raise_alert(
            db,
            event=event,
            alert_type="conectividade_retorno",
            severity="informativo",
            title="Conectividade restabelecida",
            message="O dispositivo voltou a se comunicar. A ocorrência técnica continua disponível no histórico.",
            fingerprint=f"online:{event.device_id}:{event.id}",
            evidence={"device_id": event.device_id},
        ))
    return alerts
