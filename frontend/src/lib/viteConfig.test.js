import assert from 'node:assert/strict'
import test from 'node:test'
import viteConfig from '../../vite.config.js'

function withApiUrl(value, run) {
  const previous = process.env.VITE_API_URL
  if (value === undefined) delete process.env.VITE_API_URL
  else process.env.VITE_API_URL = value
  try { run() }
  finally {
    if (previous === undefined) delete process.env.VITE_API_URL
    else process.env.VITE_API_URL = previous
  }
}

test('production build requires an HTTPS API origin without embedded credentials', () => {
  withApiUrl(undefined, () => assert.throws(
    () => viteConfig({ mode: 'production' }),
    /Defina VITE_API_URL/,
  ))
  withApiUrl('http://api.example.com', () => assert.throws(
    () => viteConfig({ mode: 'production' }),
    /HTTPS/,
  ))
  withApiUrl('https://user:secret@api.example.com', () => assert.throws(
    () => viteConfig({ mode: 'production' }),
    /HTTPS/,
  ))
  withApiUrl('https://api.example.com', () => assert.doesNotThrow(
    () => viteConfig({ mode: 'production' }),
  ))
})

test('development keeps its local API fallback', () => {
  withApiUrl(undefined, () => assert.doesNotThrow(() => viteConfig({ mode: 'development' })))
})
