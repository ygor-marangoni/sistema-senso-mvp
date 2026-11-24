from test_senso_flow import seed_account


def test_appointments_crud_and_residence_isolation(client, database):
    seed_account(database)
    seed_account(database, "outra@example.com")
    assert client.get("/appointments").status_code == 401
    client.post("/auth/login", json={"email": "demo@senso.local", "password": "Senso-Demo-2026!"})

    payload = {
        "title": "Consulta geriátrica",
        "appointment_type": "consulta",
        "scheduled_date": "2030-04-21",
        "time_of_day": "10:30",
        "professional": "Dra. Exemplo",
        "location": "Clínica demonstrativa",
        "notes": "Levar exames recentes.",
    }
    created = client.post("/appointments", json=payload)
    assert created.status_code == 201
    appointment_id = created.json()["id"]
    assert created.json()["scheduled_date"] == "2030-04-21"
    assert client.get("/appointments").json()[0]["title"] == "Consulta geriátrica"

    updated = client.put(f"/appointments/{appointment_id}", json={**payload, "title": "Retorno"})
    assert updated.status_code == 200
    assert updated.json()["title"] == "Retorno"
    assert client.post("/appointments", json={**payload, "time_of_day": "25:00"}).status_code == 422

    client.post("/auth/logout")
    client.post("/auth/login", json={"email": "outra@example.com", "password": "Senso-Demo-2026!"})
    assert client.get("/appointments").json() == []
    assert client.delete(f"/appointments/{appointment_id}").status_code == 404
