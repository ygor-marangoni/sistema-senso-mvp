from datetime import date, timedelta

from test_senso_flow import seed_account


def test_birth_date_is_optional_persisted_and_not_guessed(client, database):
    seed_account(database)
    client.post('/auth/login', json={'email': 'demo@senso.local', 'password': 'Senso-Demo-2026!'})
    initial = client.get('/residence').json()
    assert initial['resident_birth_date'] is None
    assert initial['resident_age'] == 78
    updated = client.patch('/residence', json={'resident_birth_date': '1948-05-14'})
    assert updated.status_code == 200
    today = date.today()
    assert updated.json()['resident_age'] == today.year - 1948 - ((today.month, today.day) < (5, 14))
    assert client.get('/dashboard').json()['residence']['resident_birth_date'] == '1948-05-14'
    assert client.patch('/residence', json={'resident_birth_date': (date.today() + timedelta(days=2)).isoformat()}).status_code == 422
    assert client.patch('/residence', json={'resident_birth_date': None}).json()['resident_birth_date'] is None
