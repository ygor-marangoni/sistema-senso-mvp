from test_senso_flow import seed_account


def test_profile_contact_persists_and_rejects_invalid_cpf(client, database):
    seed_account(database)
    assert client.patch('/auth/profile', json={'name': 'Mariana'}).status_code == 401
    client.post('/auth/login', json={'email': 'demo@senso.local', 'password': 'Senso-Demo-2026!'})
    saved = client.patch('/auth/profile', json={'name': 'Mariana Duarte', 'phone': '(34) 99999-0000', 'cpf': '123.456.789-00'})
    assert saved.status_code == 200
    assert saved.json()['phone'] == '(34) 99999-0000'
    assert saved.json()['cpf'] == '12345678900'
    assert client.get('/auth/session').json()['user']['cpf'] == '12345678900'
    assert client.patch('/auth/profile', json={'name': 'Mariana Duarte', 'cpf': '123'}).status_code == 422
    assert client.patch('/auth/profile', json={'name': 'Mariana'}).json()['cpf'] == '12345678900'
