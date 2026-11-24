import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createVisualClock } from './visualClock.js'

test('reiniciar o mesmo cenário restaura a posição e permite novo avanço', () => {
  const clock = createVisualClock()
  clock.update({ runId: 'first', scenario: 'fall', elapsed: 34, running: false })
  assert.equal(clock.tick(1000), 34)
  clock.update({ runId: 'second', scenario: 'fall', elapsed: 0, running: true })
  assert.equal(clock.tick(1100), 0)
  clock.update({ runId: 'second', scenario: 'fall', elapsed: 1, running: true })
  const next = clock.tick(1116)
  assert.ok(next > 0 && next < 1)
})

test('pausa, retomada e salto manual mantêm o relógio coerente', () => {
  const clock = createVisualClock()
  clock.update({ runId: 'one', scenario: 'fall', elapsed: 2, running: false })
  assert.equal(clock.tick(1000), 2)
  clock.update({ runId: 'one', scenario: 'fall', elapsed: 2.1, running: true })
  assert.ok(clock.tick(1016) > 2)
  clock.update({ runId: 'one', scenario: 'fall', elapsed: 7, running: false })
  assert.equal(clock.tick(1032), 7)
})
