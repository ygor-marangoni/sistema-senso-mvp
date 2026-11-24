# Arquitetura do MVP

## Fluxo de sinais

```text
Simulador persistente → leituras e eventos → regras contextuais → alertas → API → dashboard e histórico
```

O worker do FastAPI processa apenas cenários marcados como em execução. O estado/etapa e o próximo instante são persistidos em `simulation_runs`, então reiniciar a API não cria execuções duplicadas. Uma leitura de dashboard não produz telemetria.

## Isolamento

Cada conta possui uma residência no MVP. Todas as rotas autenticadas obtêm a residência pelo usuário da sessão; IDs de outro contexto não são aceitos como fonte de dados. `DATABASE_URL` é validada ao carregar as configurações e a API/Alembic bloqueiam qualquer banco PostgreSQL que não se chame `senso`. Testes usam SQLite temporário e não configuram PostgreSQL automaticamente.

## Regras de demonstração

- Movimento brusco isolado: registra evento, sem classificar como queda.
- Movimento brusco seguido de inatividade: gera alerta crítico de **possível** queda.
- Inatividade fora do intervalo demonstrativo: gera atenção; descanso habitual é contexto diferente.
- Leitura ambiental fora dos limites configurados: gera atenção com valores usados na regra.
- Dispositivo offline: reduz cobertura e gera ocorrência técnica, sem inferência sobre presença.
- Conectividade restaurada: fecha a ocorrência técnica, registra o retorno e preserva histórico.

Alertas têm severidade (`informativo`, `atencao`, `critico`) e estado (`novo`, `reconhecido`, `resolvido`) independentes. Uma ocorrência ativa é deduplicada por fingerprint. Reconhecer registra usuário e horário, sem encerrar; resolver preserva a linha e libera a chave para uma ocorrência futura.

## Endpoints principais

| Área | Endpoints |
|---|---|
| Autenticação | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/session` |
| Monitoramento | `GET /dashboard`, `GET /residence`, `PATCH /residence`, `GET /rooms`, `GET /devices` |
| Histórico | `GET /history?days=7&room_id=&event_type=` |
| Alertas | `GET /alerts?status=ativos`, `POST /alerts/{id}/acknowledge`, `POST /alerts/{id}/resolve` |
| Preferências | `GET/PUT /settings`, `GET/POST /contacts`, `PATCH/DELETE /contacts/{id}` |
| Simulação | `GET /simulation/state`, `POST /simulation/run`, `/pause`, `/resume`, `/restore`, `/reset` |
| Diagnóstico | `GET /health`, `/docs` |

Horários são armazenados com timezone e enviados em ISO 8601. A apresentação localiza datas no navegador. A planta usa coordenadas normalizadas associadas a cada ambiente. Os gráficos consultam agregações e leituras persistidas, sem fabricar pontos ausentes.
