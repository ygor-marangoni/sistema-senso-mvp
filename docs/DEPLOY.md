# Deploy do Sistema Senso

Este documento registra a configuração de publicação do Sistema Senso. A conta e o projeto Northflank e as contas Cloudflare/GitHub são administrados pelo responsável.

## Arquitetura escolhida

- **Front-end:** Cloudflare Pages, com React/Vite estático.
- **API:** serviço Northflank com Python 3.12 e processo ASGI ativo.
- **Banco:** addon PostgreSQL no mesmo projeto/região Northflank, acessível somente pela API.

Essa opção preserva o FastAPI, SQLAlchemy, Psycopg e o worker de simulação atual. A simulação avança em uma tarefa iniciada no ciclo de vida da API e persiste cada etapa. Por isso, a API precisa permanecer ativa; o front-end estático não substitui esse processo.

Cloudflare documenta suporte a FastAPI em Python Workers, mas o exemplo atual requer Python 3.13 ou superior, enquanto este projeto usa Python 3.12. Embora Hyperdrive documente suporte ao Psycopg e ao SQLAlchemy síncrono, a execução do worker contínuo e o conjunto de dependências do Senso ainda não foram validados nesse runtime. Migrar agora acrescentaria risco sem necessidade. [FastAPI em Python Workers](https://developers.cloudflare.com/workers/languages/python/packages/fastapi/), [Hyperdrive com Python Workers](https://developers.cloudflare.com/hyperdrive/examples/python-workers/).

## Estado da publicação

- O repositório privado `ygor-marangoni/sistema-senso-mvp` é a origem da publicação.
- O diretório `backend` contém um Dockerfile para o serviço FastAPI no Northflank.
- Os recursos remotos ainda precisam ser criados no painel autenticado; esta execução não consegue acessar a sessão visual do navegador do responsável.
- URLs, domínio, PostgreSQL remoto e segredos de produção só poderão ser registrados depois que os recursos forem criados no painel. Não coloque seus valores neste arquivo.
- Use apenas o plano Sandbox gratuito e a região `US Central`; a região South America East exige upgrade. Não selecione Pay as you go nem habilite faturamento.

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

## Northflank Sandbox

O plano Sandbox documenta dois serviços, dois jobs e um addon com até US$ 20/mês em recursos gratuitos, sempre ativos e sem suspensão por inatividade. A documentação de preços diz que o Sandbox não exige cartão; se o fluxo de criação pedir método de pagamento ou upgrade para Pay as you go, pare sem preencher. Confira os limites e o saldo gratuito no painel antes de criar cada recurso. [Planos e quotas Northflank](https://northflank.com/pricing).

Crie o banco e a API na mesma região `US Central`, que está disponível no Sandbox. Não selecione `South America East` se o painel indicar upgrade. Crie um projeto e depois:

1. Crie um addon PostgreSQL com TLS habilitado, banco chamado `senso`, região `US Central` e o menor plano incluído no Sandbox. Não habilite acesso público.
2. Crie um grupo de secrets para a API. Use as credenciais privadas do addon e monte `DATABASE_URL` no formato `postgresql+psycopg://<usuario>:<senha>@<host>:<porta>/senso?sslmode=require`. Codifique caracteres especiais da senha como URL-encoding. O banco deve continuar privado; a API e o banco ficam no mesmo projeto.
3. Crie um serviço combinado ligado ao repositório e à branch `main`. Configure build Dockerfile, diretório `backend` como contexto e `backend/Dockerfile` como arquivo. Configure a porta pública `8001` em HTTP e readiness path `/health/ready`.
4. Configure `APP_ENV=production`, `DATABASE_URL`, `SECRET_KEY` aleatória (32 caracteres ou mais), `COOKIE_SECURE=true`, `DEMO_LOGIN_ENABLED=false`, `CORS_ORIGINS=https://<url-do-pages>` e `SIMULATION_INTERVAL_SECONDS=1`. Guarde segredos no painel Northflank; não os coloque no repositório.
5. Aguarde o addon ficar `running` antes de iniciar o serviço. O Dockerfile aplica `alembic upgrade head` e inicia Uvicorn; a primeira inicialização cria somente as tabelas do Senso nesse banco `senso` novo.

O orçamento de até US$ 20/mês é uma cota de uso, não garantia de que qualquer tamanho de recurso seja gratuito. Se o painel mostrar custo ou pedir faturamento, não confirme; reduza o compute para o limite gratuito disponível. PostgreSQL é um addon e a API é um serviço, dentro dos limites documentados do Sandbox. [Criar serviço pelo repositório](https://northflank.com/docs/v1/application/getting-started/build-and-deploy-your-code), [PostgreSQL Northflank](https://northflank.com/docs/v1/application/databases-and-persistence/deploy-databases-on-northflank/deploy-postgresql-on-northflank).

## API FastAPI

O serviço Northflank usa o Dockerfile em `backend/Dockerfile`, com contexto `backend`. O container instala `requirements.txt`, aplica migrações Alembic e inicia Uvicorn na porta `PORT` (8001 por padrão).

Confirme no painel que o recurso é novo, privado, na região gratuita e que `DATABASE_URL` referencia o banco Northflank recém-criado `senso` antes de deixar o primeiro deploy aplicar migrações. Não use o banco Triton nem o PostgreSQL local como banco de produção.

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

1. No Northflank, crie o addon e o serviço conforme a seção anterior, sem cartão, upgrade ou custos exibidos.
2. Teste `/health/live` e `/health/ready` no domínio gerado pelo serviço. Confirme que o banco é o addon privado `senso`.
3. Crie Pages conectado à branch `main`, raiz `frontend`, build `npm run build`, saída `dist`, Node 20+ e variável pública `VITE_API_URL=https://<url-da-api>`.
4. Quando Pages atribuir a URL, atualize `CORS_ORIGINS` para a origem exata, HTTPS, e deixe o serviço reconstruir.
5. Valide login/cadastro, persistência após atualizar, dashboard, residência, histórico, alertas, configurações, agenda e seis cenários. Confirme console/rede sem falhas.
6. Confirme cookies `Secure` e `HttpOnly`, CORS limitado ao Pages e que a produção não expõe atalho demonstrativo nem guarda respostas autenticadas em cache público.

O código e o repositório estão preparados, mas não declare a aplicação publicada até os dois recursos, o build e as verificações HTTP estarem operacionais. Não existe URL de produção confirmada neste documento.

## Diagnóstico

- **Build recusa `VITE_API_URL`:** defina uma origem HTTPS real nas variáveis de build do Pages; não use localhost nem URL fictícia.
- **Login funciona localmente, mas não no Pages:** confira HTTPS, `COOKIE_SECURE=true`, domínio do cookie e `CORS_ORIGINS` exata. Verifique `Set-Cookie` sem copiar o valor do cookie para logs.
- **`/health` retorna 503:** valide conectividade de rede, TLS, usuário, senha e nome `senso` no serviço da API; não imprima a URL completa em logs.
- **Migração falha:** pare antes de repetir, confirme banco/schema e usuário de migração, e revise a revisão Alembic atual. Não recrie o banco para contornar a falha.
- **Simulação para ao reiniciar ou dormir:** confirme que o host mantém o processo Python ativo; Pages hospeda apenas o front-end nesta arquitetura.
- **Ambiente rejeita startup:** confira `APP_ENV`, `SECRET_KEY`, `COOKIE_SECURE` e `DEMO_LOGIN_ENABLED=false`.
