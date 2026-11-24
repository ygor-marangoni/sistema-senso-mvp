# Sistema Senso

**Tecnologia presente quando realmente importa.** O Sistema Senso Ã© um MVP acadÃªmico de monitoramento residencial inteligente para apoiar a autonomia de pessoas idosas e dar contexto a familiares e cuidadores.

O sistema combina sinais residenciais simulados, regras determinÃ­sticas, histÃ³rico e alertas. NÃ£o usa cÃ¢meras, microfones ou dispositivos fÃ­sicos, nÃ£o faz diagnÃ³stico e nÃ£o se conecta a serviÃ§os de emergÃªncia.

## O que funciona

- Conta demonstrativa e cadastro simplificado, com sessÃ£o HttpOnly e senha protegida por Argon2.
- Painel com estado do monitoramento calculado no backend, Ãºltima atividade, temperatura, umidade, conectividade e alertas ativos.
- Planta baixa interativa com cinco ambientes e dispositivos virtuais associados.
- HistÃ³rico filtrÃ¡vel por perÃ­odo, ambiente e tipo de evento, com grÃ¡ficos Chart.js alimentados por registros persistidos.
- Central de alertas com classificaÃ§Ã£o, reconhecimento, resoluÃ§Ã£o e histÃ³rico preservado.
- PÃ¡gina de dispositivos, configuraÃ§Ãµes de residÃªncia e limites demonstrativos, contatos editÃ¡veis.
- Agenda com horÃ¡rios de medicamentos, confirmaÃ§Ã£o de doses e compromissos de saÃºde, como consultas e exames.
- Simulador de seis cenÃ¡rios, com progressÃ£o controlada pelo backend e restauraÃ§Ã£o/reinicializaÃ§Ã£o da conta demonstrativa.
- Dados iniciais fictÃ­cios para 31 dias, gerados de forma determinÃ­stica.

## Arquitetura

- **Front-end:** React 19, Vite 7, JavaScript, CSS puro, Fustat local, Axios, Lucide React e Chart.js.
- **API:** Python 3.12, FastAPI, Pydantic, SQLAlchemy 2, Psycopg 3, JWT em cookie e Argon2.
- **Banco:** PostgreSQL independente, nome `senso`; migraÃ§Ãµes Alembic prÃ³prias, sem tabelas do domÃ­nio anterior.
- **SimulaÃ§Ã£o:** worker Ãºnico no backend. A geraÃ§Ã£o de eventos, a anÃ¡lise das regras e a gravaÃ§Ã£o no banco nÃ£o dependem de quantos componentes consultam a API.

### Estrutura

```text
backend/app/models.py              modelos relacionais do Senso
backend/app/main.py                API, autenticaÃ§Ã£o e worker da simulaÃ§Ã£o
backend/app/services/analysis.py   regras contextuais e deduplicaÃ§Ã£o
backend/app/services/simulation.py cenÃ¡rios progressivos
backend/app/services/demo.py       histÃ³rico sintÃ©tico reproduzÃ­vel
backend/migrations/                migraÃ§Ãµes prÃ³prias do Senso
backend/scripts/load_demo.py       criaÃ§Ã£o da conta demonstrativa
frontend/src/App.jsx               autenticaÃ§Ã£o, navegaÃ§Ã£o e atualizaÃ§Ã£o
frontend/src/components/           planta, grÃ¡ficos e mÃ³dulos da aplicaÃ§Ã£o
frontend/src/styles.css            linguagem visual e responsividade
```

## Requisitos

- Windows 10/11, PowerShell e Python 3.12.
- Node.js 20 ou superior e npm.
- PostgreSQL local instalado e em execuÃ§Ã£o. NÃ£o Ã© necessÃ¡rio Docker.

Portas padrÃ£o: Vite `5174`, API `8001` e PostgreSQL `5432`.

## Preparar o PostgreSQL

Crie um usuÃ¡rio sem privilÃ©gios administrativos e um banco dedicado. A senha `senso_dev` mostrada abaixo Ã© somente para desenvolvimento local; em produÃ§Ã£o, use uma senha exclusiva e aleatÃ³ria. No pgAdmin, abra o Query Tool conectado ao banco `postgres` e execute:

```sql
CREATE ROLE senso WITH LOGIN PASSWORD 'senso_dev';
CREATE DATABASE senso OWNER senso;
```

Se o papel `senso` jÃ¡ existir, atualize sua senha com `ALTER ROLE senso WITH LOGIN PASSWORD 'senso_dev';`. Se o banco `senso` jÃ¡ existir, confira seu proprietÃ¡rio antes de prosseguir. **NÃ£o use os bancos `triton` ou `triton_demo`.**

Copie `backend/.env.example` para `backend/.env` e ajuste `DATABASE_URL` para a senha escolhida. Substitua tambÃ©m `SECRET_KEY` por um valor aleatÃ³rio com pelo menos 32 caracteres. A API aceita somente PostgreSQL no banco independente `senso`; SQLite Ã© permitido apenas nos testes isolados. Essa proteÃ§Ã£o tambÃ©m vale para Alembic.

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

Na conta demonstrativa, o carregamento inclui duas programaÃ§Ãµes fictÃ­cias (manhÃ£ e noite) e uma consulta de exemplo. SÃ£o exemplos visuais, nÃ£o orientaÃ§Ãµes de uso de medicamentos ou compromissos reais.

A documentaÃ§Ã£o interativa fica em `http://127.0.0.1:8001/docs`; a checagem de serviÃ§o estÃ¡ em `/health`.

Para atualizar uma instalaÃ§Ã£o existente, confirme que `DATABASE_URL` aponta para o banco independente `senso`, execute `alembic upgrade head` na pasta `backend` e reinicie a API. A migraÃ§Ã£o `0003_medications` cria as tabelas de programaÃ§Ã£o e confirmaÃ§Ã£o de medicamentos; `0004_user_contact` adiciona telefone e CPF opcionais ao perfil do responsÃ¡vel; `0005_resident_birth_date` adiciona a data de nascimento opcional; `0006_appointments` cria a agenda de consultas e exames. As idades antigas sÃ£o preservadas sem criar datas de nascimento estimadas.

A agenda permite cadastrar um horÃ¡rio por medicamento, escolher dias da semana, definir inÃ­cio e fim e registrar a confirmaÃ§Ã£o pelo responsÃ¡vel. TambÃ©m permite registrar consultas, retornos e exames com data, hora, profissional e local. Para mais de um horÃ¡rio no dia, cadastre um item para cada horÃ¡rio. A confirmaÃ§Ã£o Ã© informada pelo usuÃ¡rio e nÃ£o comprova a ingestÃ£o. Lembretes internos aparecem perto do horÃ¡rio enquanto o Senso estÃ¡ aberto; nÃ£o sÃ£o enviados por SMS, e-mail ou com o navegador fechado. Os horÃ¡rios sÃ£o interpretados no horÃ¡rio de BrasÃ­lia. Se a API da conta demonstrativa ainda nÃ£o tiver as rotas da agenda, novos itens ficam apenas no armazenamento local do navegador atÃ© a migraÃ§Ã£o ser aplicada e a API reiniciada.

### 2. Front-end

Em outro PowerShell, na raiz do projeto:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Abra `http://localhost:5174`. Se necessÃ¡rio, copie `frontend/.env.example` para `frontend/.env` e ajuste `VITE_API_URL`.

### Conta demonstrativa local

No desenvolvimento, a tela de entrada tem um botÃ£o para acessar os dados fictÃ­cios. O botÃ£o e o preenchimento de credenciais aparecem somente no Vite em modo de desenvolvimento. Em ambientes compartilhados, configure `DEMO_LOGIN_ENABLED=false`; a API recusa o login e a reinicializaÃ§Ã£o da conta demonstrativa. NÃ£o publique as credenciais locais.

## Demonstrar os cenÃ¡rios

Abra **Modo demonstraÃ§Ã£o** no menu. Execute **PossÃ­vel queda** para acompanhar, em aproximadamente 34 segundos:

1. Movimento habitual.
2. Movimento brusco isolado, sem conclusÃ£o automÃ¡tica.
3. Inatividade posterior interpretada em contexto.
4. Alerta crÃ­tico enviado ao painel.
5. Reconhecimento e resoluÃ§Ã£o manual na central de alertas.

TambÃ©m estÃ£o disponÃ­veis rotina normal, inatividade prolongada, alteraÃ§Ã£o ambiental, desconexÃ£o/retorno de dispositivo e alteraÃ§Ã£o de rotina. **Restaurar condiÃ§Ãµes** recupera conectividade e parÃ¢metros ambientais, mantendo os registros no histÃ³rico. **Limpar demonstraÃ§Ã£o** restaura 31 dias da conta demonstrativa e preserva conta, residÃªncia e preferÃªncias.

## Testes

Na pasta `frontend`, execute `npm test` e `npm run build`. Na pasta `backend`, execute `pytest`. Os testes de API usam SQLite temporÃ¡rio; eles nÃ£o substituem uma validaÃ§Ã£o operacional no PostgreSQL `senso`.

## Dados, privacidade e limitaÃ§Ãµes

- Todos os moradores, contatos, leituras e ocorrÃªncias fornecidos sÃ£o fictÃ­cios.
- Regras, janelas temporais e limites ambientais sÃ£o parÃ¢metros acadÃªmicos de simulaÃ§Ã£o, nÃ£o critÃ©rios clÃ­nicos.
- PresenÃ§a Ã© inferida por eventos residenciais. AusÃªncia de movimento nÃ£o equivale a ausÃªncia de presenÃ§a.
- Uma falha de sensor reduz a cobertura; nÃ£o Ã© interpretada como falta de movimento.
- O MVP nÃ£o implementa hardware, captura real de sinais Wiâ€‘Fi, aplicativos mÃ³veis, convites, SMS, WhatsApp, e-mail ou serviÃ§o de emergÃªncia.
- A telemetria e as notificaÃ§Ãµes sÃ£o locais Ã  aplicaÃ§Ã£o e nÃ£o sÃ£o enviadas a contatos.

## Reaproveitamento e limpeza da cÃ³pia

Foram mantidos a estrutura React/Vite e FastAPI, a famÃ­lia Fustat, padrÃµes de sessÃ£o, autenticaÃ§Ã£o com Argon2, Axios, navegaÃ§Ã£o lateral, responsividade e padrÃµes de carregamento/feedback da base local. O domÃ­nio hÃ­drico, integraÃ§Ãµes, mapas rurais, uploads de imagens e suas dependÃªncias, testes, migraÃ§Ãµes, assets e documentaÃ§Ã£o foram removidos desta cÃ³pia. A aplicaÃ§Ã£o nÃ£o estÃ¡ vinculada a um remoto Git.

## Modo demonstraÃ§Ã£o residencial

A pÃ¡gina **Modo demonstraÃ§Ã£o** incorpora a experiÃªncia de `senso-demo.html` Ã  aplicaÃ§Ã£o React. A maquete procedural, os quatro ambientes, Dona Helena, os dois profissionais, os sensores e as trajetÃ³rias foram movidos para `frontend/src/demo/sensoScene.js`. Three.js Ã© carregado como dependÃªncia do Vite. Se WebGL nÃ£o iniciar ou perder o contexto, `frontend/src/demo/sensoFallback.js` usa a rasterizaÃ§Ã£o Canvas da referÃªncia e identifica esse modo na tela.

`frontend/src/components/LiveSimulator.jsx` mantÃ©m os controles, o contexto e o protocolo. O estado autoritativo vem de `/simulation/state`; o backend persiste o relÃ³gio lÃ³gico, velocidade, execuÃ§Ã£o e etapas em `simulation_runs`. O worker processa cada marco em ordem, grava leituras/eventos no banco existente e passa os eventos pelo motor de regras antes de criar alertas. A cena interpola somente atÃ© o tempo confirmado pela API. Os cenÃ¡rios disponÃ­veis sÃ£o rotina normal (`normal`, 22 s), inatividade (`idle`, 28 s), possÃ­vel queda (`fall`, 34 s), alteraÃ§Ã£o ambiental (`heat`, 28 s), dispositivo desconectado (`offline`, 26 s) e alteraÃ§Ã£o de rotina (`routine`, 26 s). A pausa, retomada, avanÃ§o e velocidade usam a mesma execuÃ§Ã£o persistida. Reiniciar um roteiro nÃ£o apaga histÃ³rico; limpeza demonstrativa Ã© uma aÃ§Ã£o separada.

No cenÃ¡rio de possÃ­vel queda, a API registra movimento brusco aos 7 s e aplica a regra contextual aos 11 s, desde que os sinais prÃ©vios estejam persistidos e o sensor esteja online. A interface apresenta os marcos de anÃ¡lise, alerta e roteiro fictÃ­cio de socorro aos tempos da referÃªncia, com chegada aos 21 s e inÃ­cio do acompanhamento aos 30 s. SolicitaÃ§Ã£o, deslocamento e chegada sÃ£o eventos narrativos simulados, sem contato externo ou confirmaÃ§Ã£o de emergÃªncia real. O alerta de possÃ­vel queda permanece aberto atÃ© verificaÃ§Ã£o explÃ­cita.

Os grÃ¡ficos reutilizam os componentes Chart.js e dados jÃ¡ persistidos no histÃ³rico. A sÃ©rie disponÃ­vel atualmente Ã© agregada por dia para atividade e contÃ©m leituras ambientais registradas; ela nÃ£o representa uma sÃ©rie granular por segundo da execuÃ§Ã£o. A telemetria fica recolhida no protocolo para manter a residÃªncia como foco. A visualizaÃ§Ã£o alternativa Canvas preserva a cena em ambientes sem WebGL, mas nÃ£o tem as mesmas capacidades de aceleraÃ§Ã£o da renderizaÃ§Ã£o Three.js.

O botÃ£o de apresentaÃ§Ã£o usa tela cheia sobre a mesma pÃ¡gina e mantÃ©m a execuÃ§Ã£o atual. Os controles da maquete permitem vista superior e restauraÃ§Ã£o da cÃ¢mera; arraste e zoom operam diretamente no canvas. Para ambientes com banco jÃ¡ migrado atÃ© `0006_appointments`, aplique `alembic upgrade head` antes de iniciar a API para adicionar os campos da migraÃ§Ã£o `0007_simulation_clock`. A execuÃ§Ã£o local segue as instruÃ§Ãµes acima; os testes de fluxo do backend cobrem a pausa, velocidade, avanÃ§o, deduplicaÃ§Ã£o e os seis roteiros.

