<p align="center"><img src="frontend/public/logotipo.svg" alt="Sistema Senso" width="180"></p>

# Sistema Senso

Tecnologia presente quando realmente importa. O Senso é um MVP acadêmico de monitoramento residencial para apoiar a autonomia de pessoas idosas e ajudar familiares e cuidadores a acompanhar sinais da rotina.

O projeto foi desenvolvido para a disciplina de Empreendedorismo em Informática. Os dispositivos, moradores e acontecimentos da demonstração são fictícios; não há câmeras, hardware de sensoriamento, diagnósticos ou acionamento real de emergência.

## Funcionalidades

- Cadastro, autenticação, sessão e isolamento dos dados por conta.
- Visão geral da residência, ambientes, dispositivos, histórico e ocorrências.
- Alertas gerados por regras contextuais, com reconhecimento e resolução.
- Agenda de medicamentos e compromissos com confirmações feitas pelo responsável.
- Demonstração residencial com seis cenários, maquete Three.js, telemetria e protocolo de resposta fictício.

## Tecnologias e organização

O frontend usa React, Vite, JavaScript, CSS, Three.js e Chart.js. O backend usa Python, FastAPI, SQLAlchemy, Alembic e PostgreSQL. A API registra os sinais simulados, aplica as regras e fornece os dados às telas. O relógio da execução fica no backend; o frontend interpola a animação entre atualizações.

```text
frontend/       aplicação React, recursos visuais e testes
backend/        API, modelos, regras, migrações, scripts e testes
docs/           arquitetura e orientações de deploy
postman/        coleção de requisições da API
senso-demo.html referência documental da cena aprovada
```

## Requisitos

- Python 3.12 e PostgreSQL em execução.
- Node.js compatível com Vite 7: 20.19+ ou 22.12+, e npm.
- Windows com PowerShell ou ambiente equivalente em Linux.

Portas locais padrão: frontend `5174`, API `8001` e PostgreSQL `5432`.

## Preparar o banco

Crie um banco PostgreSQL independente chamado `senso` e um usuário dedicado. No pgAdmin, conectado ao banco administrativo apropriado, substitua o marcador por uma senha local própria e execute:

```sql
CREATE ROLE senso_app LOGIN PASSWORD '<senha-local-propria>';
CREATE DATABASE senso OWNER senso_app;
```

Se o banco ou o usuário já existirem, confira sua identidade e permissões antes de fazer alterações. Preserve bancos e dados de outros projetos.

## Instalar e executar

Na raiz do projeto, crie o arquivo local de configuração sem sobrescrever um arquivo existente:

```powershell
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

Edite `backend/.env`: configure `DATABASE_URL` com o usuário e a senha do banco `senso` e defina `SECRET_KEY` com uma chave aleatória própria. A URL segue o formato `postgresql+psycopg://usuario:senha@127.0.0.1:5432/senso`; caracteres especiais na senha devem ser codificados para URL. Não compartilhe esse arquivo.

Em um PowerShell:

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
alembic upgrade head
python scripts/load_demo.py
uvicorn app.main:app --host 127.0.0.1 --port 8001
```

A carga cria dados fictícios apenas se ainda não existirem e não apaga a conta existente. Em desenvolvimento, use o botão **Entrar na demonstração**; novas contas demonstrativas recebem uma senha aleatória interna. A documentação da API está em `http://127.0.0.1:8001/docs` e a verificação de conexão está em `/health`.

Em outro PowerShell:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Abra `http://localhost:5174`. O exemplo `frontend/.env.example` permite configurar a URL da API quando necessário. No Linux, ative o ambiente Python com `source .venv/bin/activate` e use os mesmos comandos restantes.

## Demonstração

O menu **Modo demonstração** oferece rotina normal, inatividade prolongada, possível queda, alteração ambiental, dispositivo desconectado e alteração de rotina. O roteiro de possível queda dura cerca de 34 segundos e inclui análise, alerta, solicitação fictícia de socorro, chegada da equipe e início do acompanhamento. O usuário pode pausar, retomar, reiniciar, avançar, alterar a velocidade e controlar a câmera.

O alerta permanece sujeito à verificação do responsável. Solicitação, deslocamento e atendimento são representações fictícias, sem comunicação com serviços externos. Em dispositivos sem WebGL há uma visualização alternativa em Canvas identificada na tela.

Os gráficos usam dados disponíveis na API. A atividade por dia é agregada e não deve ser interpretada como telemetria por segundo. A agenda demonstrativa de versões antigas pode manter dados locais no navegador se a API não oferecer as rotas correspondentes.

## Testes e build

```powershell
# Em backend, com o ambiente virtual ativo
python -m pytest

# Em frontend
npm test
$env:VITE_API_URL = 'https://api.example.invalid'
npm run build
```

O endereço `.invalid` serve apenas para validar a compilação. O build final precisa da URL HTTPS real da API ou do proxy no mesmo domínio. Os testes automatizados do backend usam banco temporário e não substituem a verificação operacional do PostgreSQL. Consulte [docs/DEPLOY.md](docs/DEPLOY.md) antes de configurar uma hospedagem.

## Limitações

O Senso é uma prova de conceito acadêmica. Sinais ausentes não confirmam ausência de movimento; os limites e tempos são demonstrativos e não foram validados clinicamente. A confirmação de medicamento é registrada pelo responsável e não comprova ingestão. Lembretes só aparecem enquanto a aplicação está aberta. O sistema não envia SMS, mensagens ou chamadas de emergência.
