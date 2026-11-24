from datetime import datetime, timedelta, timezone

from test_senso_flow import seed_account


def test_schedule_confirmation_and_residence_isolation(client, database):
    seed_account(database)
    seed_account(database, 'outra@example.com')
    assert client.get('/medications').status_code == 401
    client.post('/auth/login', json={'email': 'demo@senso.local', 'password': 'Senso-Demo-2026!'})
    today = (datetime.now(timezone.utc) - timedelta(hours=3)).date()
    payload = {'name': 'Medicamento demonstrativo', 'dosage': '1 comprimido', 'instructions': '', 'time_of_day': '08:30', 'weekdays': [today.weekday()], 'start_date': today.isoformat(), 'end_date': None}
    created = client.post('/medications', json=payload)
    assert created.status_code == 201
    med_id = created.json()['id']
    assert client.put(f'/medications/{med_id}/confirmation', json={'scheduled_date': today.isoformat(), 'confirmed': True}).status_code == 200
    assert client.get('/medications').json()[0]['confirmations'][0]['date'] == today.isoformat()
    assert client.put(f'/medications/{med_id}/confirmation', json={'scheduled_date': today.isoformat(), 'confirmed': True}).status_code == 200
    assert len(client.get('/medications').json()[0]['confirmations']) == 1
    assert client.post('/medications', json={**payload, 'time_of_day': '25:00'}).status_code == 422
    client.post('/auth/logout')
    client.post('/auth/login', json={'email': 'outra@example.com', 'password': 'Senso-Demo-2026!'})
    assert client.get('/medications').json() == []
    assert client.delete(f'/medications/{med_id}').status_code == 404
