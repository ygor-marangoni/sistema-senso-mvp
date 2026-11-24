import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimatePlaybackTime } from './playbackTime.js'
import { createVisualClock } from './visualClock.js'

test('a caminhada progride em quadros entre consultas da API', () => {
  const state = { run_id: 'a', scenario_id: 'fall', status: 'rodando', elapsed: 0, step: 1, speed: 1, duration: 34 }
  const clock = createVisualClock()
  const frames = []
  for (let i = 0; i <= 60; i++) {
    const target = estimatePlaybackTime(state, i / 60)
    clock.update({ runId: state.run_id, scenario: state.scenario_id, elapsed: target, running: true, speed: state.speed })
    frames.push(clock.tick(1000 + i * 1000 / 60))
  }
  assert.ok(frames[60] > .95 && frames[60] <= 1)
  for (let i = 1; i < frames.length; i++) {
    assert.ok(frames[i] >= frames[i - 1])
    assert.ok(frames[i] - frames[i - 1] < .05)
  }
})

test('a progressão respeita a velocidade, a pausa e o próximo evento', () => {
  const state = { scenario_id: 'fall', status: 'rodando', elapsed: 5, step: 1, speed: 2, duration: 34 }
  assert.equal(estimatePlaybackTime(state, .5), 6)
  assert.equal(estimatePlaybackTime(state, 5), 7)
  assert.equal(estimatePlaybackTime({ ...state, status: 'pausado' }, 5), 5)
})

test('todos os cenários param no próximo evento ainda não processado', () => {
  for (const [scenario_id, marker] of Object.entries({ normal: 22, idle: 20, heat: 20, offline: 5, routine: 17 })) {
    assert.equal(estimatePlaybackTime({ scenario_id, status: 'rodando', elapsed: 0, step: 1, speed: 1, duration: 34 }, 100), marker)
  }
})
