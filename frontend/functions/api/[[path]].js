// Keep browser requests and the session cookie on the Pages origin.
export async function onRequest({ request, env }) {
  let backend
  try {
    backend = new URL(env.SENSO_API_ORIGIN)
    if (backend.protocol !== 'https:' || backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash) throw new Error('Invalid API origin')
  } catch {
    return new Response('Serviço temporariamente indisponível.', { status: 503 })
  }

  const incoming = new URL(request.url)
  if (backend.origin === incoming.origin) return new Response('Serviço temporariamente indisponível.', { status: 503 })
  backend.pathname = incoming.pathname.replace(/^\/api(?=\/|$)/, '') || '/'
  backend.search = incoming.search
  return fetch(new Request(backend, request), { redirect: 'manual' })
}
