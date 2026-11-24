# Deploy do Sistema Senso

Este documento prepara a publicação; não cria recursos nem publica o sistema.

## Arquitetura escolhida

- **Front-end:** Cloudflare Pages, com React/Vite estático.
- **API:** hospedagem externa que execute Python 3.12 e mantenha um processo ASGI ativo.
- **Banco:** PostgreSQL hospedado, acessível somente pela API.

Essa opção preserva o FastAPI, SQLAlchemy, Psycopg e o worker de simulação atual. A simulação avança em uma tarefa iniciada no ciclo de vida da API e persiste cada etapa. Por isso, a API precisa permanecer ativa; o front-end estático não substitui esse processo.

Cloudflare documenta suporte a FastAPI em Python Workers, mas o exemplo atual requer Python 3.13 ou superior, enquanto este projeto usa Python 3.12. Embora Hyperdrive documente suporte ao Psycopg e ao SQLAlchemy síncrono, a execução do worker contínuo e o conjunto de dependências do Senso ainda não foram validados nesse runtime. Migrar agora acrescentaria risco sem necessidade. [FastAPI em Python Workers](https://developers.cloudflare.com/workers/languages/python/packages/fastapi/), [Hyperdrive com Python Workers](https://developers.cloudflare.com/hyperdrive/examples/python-workers/).

## Estado desta cópia

- O build do front-end é preparado para Pages.
- A API e o PostgreSQL remoto ainda dependem de hospedagens escolhidas pelo responsável.
- Não há `.git` nesta pasta; a integração Git de Pages depende de um repositório criado e autorizado pelo responsável. Nenhum repositório foi criado ou publicado nesta auditoria.
- Não foi configurado domínio, conta Cloudflare, API remota, banco remoto ou segredo de produção.

## Cloudflare Pages

Crie o projeto Pages após vincular o repositório autorizado. Use estas configurações:

| Campo | Valor |
|---|---|
| Diretório raiz | `frontend` |
| Comando de build | `npm run build` |
| Diretório de saída | `dist` |
| Versão Node | 20 ou superior |
| Variável de build | `VITE_API_URL=https://<host-da-api>` |

Pages documenta `npm run build` e `dist` para React/Vite. O fallback SPA padrão atende rotas sem arquivo correspondente quando não há `404.html` na raiz, que é o caso deste projeto. [Build React/Vite no Pages](https://developers.cloudflare.com/pages/configuration/build-configuration/), [fallback SPA do Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).

Configure `VITE_API_URL` no ambiente de produção do Pages com a origem HTTPS real da API, sem credenciais. O Vite valida a variável no build e recusa origem HTTP ou localhost. Variáveis `VITE_` entram no JavaScript público; não coloque nelas segredo, senha, token privado ou `DATABASE_URL`.

Para reproduzir localmente o build de produção no PowerShell, use uma origem HTTPS de teste e saiba que a API desse endereço não será validada pelo comando:

```powershell
Set-Location frontend
npm ci
$env:VITE_API_URL = 'https://api.example.invalid'
npm run build
```

O endereço `.invalid` acima é apenas para validar a compilação. Não o use no Pages. O front-end usa carregamento SPA e `dist` deve conter o `index.html` e os assets versionados pelo Vite.

## API FastAPI

Use um serviço Python/ASGI com processo persistente. Configure a pasta `backend` como diretório de trabalho e instale `requirements.txt`. O comando de inicialização depende da variável de porta do provedor; em ambientes Linux que fornecem `PORT`, o formato usual é:

```bash
python -m pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
```

Confirme no painel do provedor qual comando e diretório de trabalho são aceitos antes de aplicar migrações. Execute `alembic upgrade head` somente depois de revisar `DATABASE_URL`, confirmar que aponta para o PostgreSQL remoto dedicado ao Senso e obter um backup do banco de destino. Não use o banco Triton nem o PostgreSQL local como banco de produção.

Configure as variáveis no serviço de API:

| Variável | Valor de produção |
|---|---|
| `APP_ENV` | `production` |
| `DATABASE_URL` | URL privada do PostgreSQL dedicado, nome do banco `senso`, TLS conforme o provedor |
| `SECRET_KEY` | segredo aleatório próprio, com pelo menos 32 caracteres; nunca versionar |
| `COOKIE_SECURE` | `true` |
| `COOKIE_NAME` | `senso_session` ou outro nome definido pelo responsável |
| `CORS_ORIGINS` | origem HTTPS exata do Pages, por exemplo `https://<app>.<dominio>` |
| `DEMO_LOGIN_ENABLED` | `false` |
| `SIMULATION_INTERVAL_SECONDS` | valor entre 1 e 60; o padrão do projeto é 1 |

Não habilite o login demonstrativo compartilhado em produção. O front-end remove o atalho e os valores preenchidos no build de produção; a API também recusa a conta fixa e a rota de reinicialização quando `DEMO_LOGIN_ENABLED=false`. O script `load_demo.py` igualmente se recusa a criar essa conta nesse ambiente.

O cookie usa autenticação `HttpOnly` e configuração `SameSite=Lax`; front-end e API em subdomínios do mesmo domínio registrável permanecem no mesmo site. Além do CORS, a API exige `Origin` igual à origem HTTPS configurada para todas as requisições que alteram dados em ambientes compartilhados. Mantenha `withCredentials` habilitado, permita somente a origem exata do front-end em CORS e sirva ambos por HTTPS. Clientes não navegador também precisam enviar essa origem. Não use wildcard com credenciais.

`/health/live` indica que o processo responde; `/health` e `/health/ready` executam `SELECT 1` e indicam se a API consegue usar o banco. Em produção, `/docs`, `/redoc` e `/openapi.json` ficam desativados. Configure o monitor do provedor com `/health/ready` para readiness e `/health/live` para liveness.

O worker de simulação é iniciado pela API. Mantenha uma instância da API enquanto o MVP não tiver coordenação distribuída do worker; escalar réplicas sem serialização de avanço pode fazer duas instâncias tentarem processar a mesma simulação. Não configure reinicializações periódicas frequentes.

## PostgreSQL remoto

Use um serviço PostgreSQL independente, com nome do banco `senso`, usuário dedicado, senha exclusiva e TLS conforme os parâmetros do provedor. Restrinja o acesso de rede à API sempre que o provedor permitir. O navegador não acessa o banco.

O papel usado para aplicar Alembic precisa conseguir criar e alterar o schema. Quando o provedor permitir, separe o papel de migração do usuário de runtime e conceda ao runtime apenas os privilégios exigidos pelas tabelas. Guarde `DATABASE_URL` somente como segredo no serviço de API. Não use um túnel que exponha o PostgreSQL local à Internet.

Antes da primeira migração, confirme manualmente a identidade do servidor, banco e usuário no painel do provedor. Faça backup e aplique as migrações a partir da API/ambiente controlado. Não execute carga demonstrativa remota sem decisão explícita sobre a conta e seus dados.

## Domínio, TLS e cabeçalhos

Use origens sob o domínio controlado pelo responsável, por exemplo `https://<app>.<dominio>` e `https://<api>.<dominio>`. Configure DNS e TLS nos provedores correspondentes antes de ativar `COOKIE_SECURE=true`. Os certificados e as URLs reais não estão definidos nesta cópia.

Não foi adicionado `_headers` ou CSP genérico. Pages já fornece cabeçalhos padrão para assets; uma CSP precisa ser ajustada ao conteúdo e aos recursos reais do app e validada no navegador antes de ser aplicada. Evite Cache Rules que armazenem respostas da API ou dados autenticados. Assets versionados pelo Vite podem usar cache imutável somente se a regra não servir arquivos antigos após publicação. [Cabeçalhos e cache padrão do Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).

## Publicação e verificação

1. No Pages, configure raiz `frontend`, build `npm run build`, saída `dist` e `VITE_API_URL` real.
2. No host Python, configure o backend, os segredos, `CORS_ORIGINS` e `DEMO_LOGIN_ENABLED=false`.
3. No PostgreSQL remoto, confirme identidade, TLS, credenciais e backup; depois revise e aplique as migrações.
4. Verifique `/health/live` e `/health/ready` no host da API.
5. Faça o build no Pages e confirme a URL final da aplicação e da API.
6. No navegador, valide login/cadastro, persistência após atualizar, dashboard, residência, histórico, alertas, configurações, agenda e todos os cenários de demonstração. Confirme console e rede sem falhas.
7. Confirme que a produção não exibe o login demonstrativo, que cookies são `Secure` e `HttpOnly`, que CORS aceita somente o Pages e que nenhuma resposta autenticada está em cache público.

Não existe comando de publicação executado ou URL de produção nesta entrega. A publicação depende de repositório, contas/provedores, domínio, segredos e PostgreSQL remoto configurados pelo responsável.

## Diagnóstico

- **Build recusa `VITE_API_URL`:** defina uma origem HTTPS real nas variáveis de build do Pages; não use localhost nem URL fictícia.
- **Login funciona localmente, mas não no Pages:** confira HTTPS, `COOKIE_SECURE=true`, domínio do cookie e `CORS_ORIGINS` exata. Verifique `Set-Cookie` sem copiar o valor do cookie para logs.
- **`/health` retorna 503:** valide conectividade de rede, TLS, usuário, senha e nome `senso` no serviço da API; não imprima a URL completa em logs.
- **Migração falha:** pare antes de repetir, confirme banco/schema e usuário de migração, e revise a revisão Alembic atual. Não recrie o banco para contornar a falha.
- **Simulação para ao reiniciar ou dormir:** confirme que o host mantém o processo Python ativo; Pages hospeda apenas o front-end nesta arquitetura.
- **Ambiente rejeita startup:** confira `APP_ENV`, `SECRET_KEY`, `COOKIE_SECURE` e `DEMO_LOGIN_ENABLED=false`.
