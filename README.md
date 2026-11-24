# Sistema Senso

**Tecnologia presente quando realmente importa.** O Sistema Senso é um MVP acadêmico de monitoramento residencial inteligente para apoiar a autonomia de pessoas idosas e dar contexto a familiares e cuidadores.

O sistema combina sinais residenciais simulados, regras determinísticas, histórico e alertas. Não usa câmeras, microfones ou dispositivos físicos, não faz diagnóstico e não se conecta a serviços de emergência.

## O que funciona

- Conta demonstrativa e cadastro simplificado, com sessão HttpOnly e senha protegida por Argon2.
- Painel com estado do monitoramento calculado no backend, última atividade, temperatura, umidade, conectividade e alertas ativos.
- Planta baixa interativa com cinco ambientes e dispositivos virtuais associados.
- Histórico filtrável por período, ambiente e tipo de evento, com gráficos Chart.js alimentados por registros persistidos.
- Central de alertas com classificação, reconhecimento, resolução e histórico preservado.
- Página de dispositivos, configurações de residência e limites demonstrativos, contatos editáveis.
- Agenda com horários de medicamentos, confirmação de doses e compromissos de saúde, como consultas e exames.
- Simulador de seis cenários, com progressão controlada pelo backend e restauração/reinicialização da conta demonstrativa.
- Dados iniciais fictícios para 31 dias, gerados de forma determinística.

## Arquitetura

- **Front-end:** React 19, Vite 7, JavaScript, CSS puro, Fustat local, Axios, Lucide React e Chart.js.
- **API:** Python 3.12, FastAPI, Pydantic, SQLAlchemy 2, Psycopg 3, JWT em cookie e Argon2.
- **Banco:** PostgreSQL independente, nome `senso`; migrações Alembic próprias, sem tabelas do domínio anterior.
- **Simulação:** worker único no backend. A geração de eventos, a análise das regras e a gravação no banco não dependem de quantos componentes consultam a API.

### Estrutura

```text
backend/app/models.py              modelos relacionais do Senso
backend/app/main.py                API, autenticação e worker da simulação
backend/app/services/analysis.py   regras contextuais e deduplicação
backend/app/services/simulation.py cenários progressivos
backend/app/services/demo.py       histórico sintético reproduzível
backend/migrations/                migrações próprias do Senso
backend/scripts/load_demo.py       criação da conta demonstrativa
frontend/src/App.jsx               autenticação, navegação e atualização
frontend/src/components/           planta, gráficos e módulos da aplicação
frontend/src/styles.css            linguagem visual e responsividade
```

## Requisitos

- Windows 10/11, PowerShell e Python 3.12.
- Node.js 20 ou superior e npm.
- PostgreSQL local instalado e em execução. Não é necessário Docker.

Portas padrão: Vite `5174`, API `8001` e PostgreSQL `5432`.

## Preparar o PostgreSQL

Crie um usuário sem privilégios administrativos e um banco dedicado. A senha `senso_dev` mostrada abaixo é somente para desenvolvimento local; em produção, use uma senha exclusiva e aleatória. No pgAdmin, abra o Query Tool conectado ao banco `postgres` e execute:

```sql
CREATE ROLE senso WITH LOGIN PASSWORD 'senso_dev';
CREATE DATABASE senso OWNER senso;
```

Se o papel `senso` já existir, atualize sua senha com `ALTER ROLE senso WITH LOGIN PASSWORD 'senso_dev';`. Se o banco `senso` já existir, confira seu proprietário antes de prosseguir. **Não use os bancos `triton` ou `triton_demo`.**

Copie `backend/.env.example` para `backend/.env` e ajuste `DATABASE_URL` para a senha escolhida. Substitua também `SECRET_KEY` por um valor aleatório com pelo menos 32 caracteres. A API aceita somente PostgreSQL no banco independente `senso`; SQLite é permitido apenas nos testes isolados. Essa proteção também vale para Alembic.

## Instalar e iniciar

Abra um PowerShell na raiz deste projeto.

### 1. API e banco

```powershell
Copy-Item backend/.env.example backend/.env
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
alembic upgrade head
python scripts/load_demo.py
uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Na conta demonstrativa, o carregamento inclui duas programações fictícias (manhã e noite) e uma consulta de exemplo. São exemplos visuais, não orientações de uso de medicamentos ou compromissos reais.

A documentação interativa fica em `http://127.0.0.1:8001/docs`; a checagem de serviço está em `/health`.

Para atualizar uma instalação existente, confirme que `DATABASE_URL` aponta para o banco independente `senso`, execute `alembic upgrade head` na pasta `backend` e reinicie a API. A migração `0003_medications` cria as tabelas de programação e confirmação de medicamentos; `0004_user_contact` adiciona telefone e CPF opcionais ao perfil do responsável; `0005_resident_birth_date` adiciona a data de nascimento opcional; `0006_appointments` cria a agenda de consultas e exames. As idades antigas são preservadas sem criar datas de nascimento estimadas.

A agenda permite cadastrar um horário por medicamento, escolher dias da semana, definir início e fim e registrar a confirmação pelo responsável. Também permite registrar consultas, retornos e exames com data, hora, profissional e local. Para mais de um horário no dia, cadastre um item para cada horário. A confirmação é informada pelo usuário e não comprova a ingestão. Lembretes internos aparecem perto do horário enquanto o Senso está aberto; não são enviados por SMS, e-mail ou com o navegador fechado. Os horários são interpretados no horário de Brasília. Se a API da conta demonstrativa ainda não tiver as rotas da agenda, novos itens ficam apenas no armazenamento local do navegador até a migração ser aplicada e a API reiniciada.

### 2. Front-end

Em outro PowerShell, na raiz do projeto:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Abra `http://localhost:5174`. Se necessário, copie `frontend/.env.example` para `frontend/.env` e ajuste `VITE_API_URL`.

### Conta demonstrativa local

No desenvolvimento, a tela de entrada tem um botão para acessar os dados fictícios. O botão e o preenchimento de credenciais aparecem somente no Vite em modo de desenvolvimento. Em ambientes compartilhados, configure `DEMO_LOGIN_ENABLED=false`; a API recusa o login e a reinicialização da conta demonstrativa. Não publique as credenciais locais.

## Demonstrar os cenários

Abra **Modo demonstração** no menu. Execute **Possível queda** para acompanhar, em aproximadamente 34 segundos:

1. Movimento habitual.
2. Movimento brusco isolado, sem conclusão automática.
3. Inatividade posterior interpretada em contexto.
4. Alerta crítico enviado ao painel.
5. Reconhecimento e resolução manual na central de alertas.

Também estão disponíveis rotina normal, inatividade prolongada, alteração ambiental, desconexão/retorno de dispositivo e alteração de rotina. **Restaurar condições** recupera conectividade e parâmetros ambientais, mantendo os registros no histórico. **Limpar demonstração** restaura 31 dias da conta demonstrativa e preserva conta, residência e preferências.

## Testes

Na pasta `frontend`, execute `npm test` e `npm run build`. Na pasta `backend`, execute `pytest`. Os testes de API usam SQLite temporário; eles não substituem uma validação operacional no PostgreSQL `senso`.

## Dados, privacidade e limitações

- Todos os moradores, contatos, leituras e ocorrências fornecidos são fictícios.
- Regras, janelas temporais e limites ambientais são parâmetros acadêmicos de simulação, não critérios clínicos.
- Presença é inferida por eventos residenciais. Ausência de movimento não equivale a ausência de presença.
- Uma falha de sensor reduz a cobertura; não é interpretada como falta de movimento.
- O MVP não implementa hardware, captura real de sinais Wi‑Fi, aplicativos móveis, convites, SMS, WhatsApp, e-mail ou serviço de emergência.
- A telemetria e as notificações são locais à aplicação e não são enviadas a contatos.

## Reaproveitamento e limpeza da cópia

Foram mantidos a estrutura React/Vite e FastAPI, a família Fustat, padrões de sessão, autenticação com Argon2, Axios, navegação lateral, responsividade e padrões de carregamento/feedback da base local. O domínio hídrico, integrações, mapas rurais, uploads de imagens e suas dependências, testes, migrações, assets e documentação foram removidos desta cópia. A aplicação não está vinculada a um remoto Git.

## Modo demonstração residencial

A página **Modo demonstração** incorpora a experiência de `senso-demo.html` à aplicação React. A maquete procedural, os quatro ambientes, Dona Helena, os dois profissionais, os sensores e as trajetórias foram movidos para `frontend/src/demo/sensoScene.js`. Three.js é carregado como dependência do Vite. Se WebGL não iniciar ou perder o contexto, `frontend/src/demo/sensoFallback.js` usa a rasterização Canvas da referência e identifica esse modo na tela.

`frontend/src/components/LiveSimulator.jsx` mantém os controles, o contexto e o protocolo. O estado autoritativo vem de `/simulation/state`; o backend persiste o relógio lógico, velocidade, execução e etapas em `simulation_runs`. O worker processa cada marco em ordem, grava leituras/eventos no banco existente e passa os eventos pelo motor de regras antes de criar alertas. A cena interpola somente até o tempo confirmado pela API. Os cenários disponíveis são rotina normal (`normal`, 22 s), inatividade (`idle`, 28 s), possível queda (`fall`, 34 s), alteração ambiental (`heat`, 28 s), dispositivo desconectado (`offline`, 26 s) e alteração de rotina (`routine`, 26 s). A pausa, retomada, avanço e velocidade usam a mesma execução persistida. Reiniciar um roteiro não apaga histórico; limpeza demonstrativa é uma ação separada.

No cenário de possível queda, a API registra movimento brusco aos 7 s e aplica a regra contextual aos 11 s, desde que os sinais prévios estejam persistidos e o sensor esteja online. A interface apresenta os marcos de análise, alerta e roteiro fictício de socorro aos tempos da referência, com chegada aos 21 s e início do acompanhamento aos 30 s. Solicitação, deslocamento e chegada são eventos narrativos simulados, sem contato externo ou confirmação de emergência real. O alerta de possível queda permanece aberto até verificação explícita.

Os gráficos reutilizam os componentes Chart.js e dados já persistidos no histórico. A série disponível atualmente é agregada por dia para atividade e contém leituras ambientais registradas; ela não representa uma série granular por segundo da execução. A telemetria fica recolhida no protocolo para manter a residência como foco. A visualização alternativa Canvas preserva a cena em ambientes sem WebGL, mas não tem as mesmas capacidades de aceleração da renderização Three.js.

O botão de apresentação usa tela cheia sobre a mesma página e mantém a execução atual. Os controles da maquete permitem vista superior e restauração da câmera; arraste e zoom operam diretamente no canvas. Para ambientes com banco já migrado até `0006_appointments`, aplique `alembic upgrade head` antes de iniciar a API para adicionar os campos da migração `0007_simulation_clock`. A execução local segue as instruções acima; os testes de fluxo do backend cobrem a pausa, velocidade, avanço, deduplicação e os seis roteiros.
