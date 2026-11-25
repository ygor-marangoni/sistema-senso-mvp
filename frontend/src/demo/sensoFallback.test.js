import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSensoFallback } from './sensoFallback.js'

test('a visualização alternativa informa falha antes de anexar um canvas indisponível', () => {
  const originalDocument = globalThis.document
  let appended = false
  globalThis.document = {
    createElement: () => ({ style: {}, setAttribute() {}, getContext: () => null }),
  }
  try {
    assert.throws(() => createSensoFallback({ appendChild() { appended = true } }), /Canvas 2D indisponível/)
    assert.equal(appended, false)
  } finally {
    if (originalDocument === undefined) delete globalThis.document
    else globalThis.document = originalDocument
  }
})
