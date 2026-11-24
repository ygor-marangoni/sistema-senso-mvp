from app.models import Contact, Device, MonitoringSettings, Residence, Room, Simulation, User


def create_residence(db, owner: User, *, demo: bool = False) -> Residence:
    residence = Residence(
        owner=owner,
        name="Casa da Dona Helena" if demo else "Minha residência",
        resident_name="Helena Duarte" if demo else "Pessoa acompanhada",
        resident_gender="feminino" if demo else "nao_informado",
        resident_age=78 if demo else None,
        address="Jardim das Acácias" if demo else "",
        city="Uberlândia",
        state="MG",
    )
    db.add(residence)
    db.flush()
    definitions = [
        ("Sala de estar", 1, 0.04, 0.08, 0.40, 0.43),
        ("Cozinha", 2, 0.46, 0.08, 0.25, 0.43),
        ("Quarto", 3, 0.04, 0.54, 0.40, 0.38),
        ("Banheiro", 4, 0.74, 0.08, 0.22, 0.30),
        ("Área de serviço", 5, 0.74, 0.44, 0.22, 0.48),
    ]
    rooms = []
    for name, order, x, y, w, h in definitions:
        room = Room(residence_id=residence.id, name=name, sort_order=order, plan_x=x, plan_y=y, plan_w=w, plan_h=h)
        db.add(room)
        rooms.append(room)
    db.flush()
    gateway = Device(residence_id=residence.id, room_id=None, name="Gateway Senso", device_type="gateway", serial=f"SEN-GW-{residence.id:04d}", status="online", is_simulated=True)
    db.add(gateway)
    for room, label in zip(rooms[:3], ("Sala", "Cozinha", "Quarto")):
        db.add(Device(residence_id=residence.id, room_id=room.id, name=f"Nó de presença · {label}", device_type="presenca", serial=f"SEN-MO-{residence.id:04d}-{room.id:02d}", status="online", is_simulated=True))
    db.add(Device(residence_id=residence.id, room_id=rooms[0].id, name="Sensor ambiental · Sala", device_type="ambiental", serial=f"SEN-AM-{residence.id:04d}", status="online", is_simulated=True))
    db.add(MonitoringSettings(residence_id=residence.id))
    db.add(Simulation(residence_id=residence.id, scenario="normal", status="pausado", step=0))
    if demo:
        db.add(Contact(residence_id=residence.id, name="Mariana Duarte", relationship_label="Filha", phone="(34) 99999-0000", email="mariana@example.com"))
    db.flush()
    return residence
