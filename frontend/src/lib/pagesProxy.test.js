import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequest } from '../../functions/api/[[path]].js'

test('encaminha a API preservando método, origem, cookie e resposta', async () => {
  const originalFetch = globalThis.fetch
  let forwarded
  globalThis.fetch = async (request) => {
    forwarded = request
    return new Response('ok', { headers: { 'set-cookie': 'senso_session=example; Path=/; HttpOnly; Secure; SameSite=Lax' } })
  }
  try {
    const request = new Request('https://senso.pages.dev/api/auth/login?from=home', {
      method: 'POST', headers: { origin: 'https://senso.pages.dev', cookie: 'senso_session=example' }, body: '{}',
    })
    const response = await onRequest({ request, env: { SENSO_API_ORIGIN: 'https://api.example.com' } })
    assert.equal(forwarded.url, 'https://api.example.com/auth/login?from=home')
    assert.equal(forwarded.method, 'POST')
    assert.equal(forwarded.headers.get('origin'), 'https://senso.pages.dev')
    assert.equal(forwarded.headers.get('cookie'), 'senso_session=example')
    assert.match(response.headers.get('set-cookie'), /SameSite=Lax/)
  } finally { globalThis.fetch = originalFetch }
})

test('rejeita origem ausente, insegura ou apontada para o próprio proxy', async () => {
  const request = new Request('https://senso.pages.dev/api/health')
  for (const value of [undefined, 'http://api.example.com', 'https://senso.pages.dev', 'https://user:pass@api.example.com', 'https://api.example.com/path']) {
    const response = await onRequest({ request, env: { SENSO_API_ORIGIN: value } })
    assert.equal(response.status, 503)
  }
})
