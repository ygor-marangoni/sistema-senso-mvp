import test from 'node:test'
import assert from 'node:assert/strict'
import { activeAlertCount, elapsedSince, formatNumber } from './monitoringFormat.js'

test('apresenta tempo recente em português e não inventa leitura ausente', () => {
  const now = Date.parse('2026-11-24T15:00:00Z')
  assert.equal(elapsedSince('2026-11-24T14:59:00Z', now), 'há 1 min')
  assert.equal(elapsedSince(null, now), 'sem registro recente')
  assert.equal(elapsedSince('not-a-date', now), 'horário indisponível')
})

test('formata valores com convenções brasileiras sem converter ausência em zero', () => {
  assert.equal(formatNumber(24.15), '24,2')
  assert.equal(formatNumber(52, 0), '52')
  assert.equal(formatNumber(null), '—')
})

test('conta somente ocorrências ainda não resolvidas', () => {
  assert.equal(activeAlertCount([{ status: 'novo' }, { status: 'reconhecido' }, { status: 'resolvido' }]), 2)
})
