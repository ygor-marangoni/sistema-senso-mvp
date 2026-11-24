// The next marker is the first domain event not yet processed by the server.
const markers = {
  fall: [0, 7, 9, 11, 12, 15, 21, 30, 34],
  normal: [0, 22],
  idle: [0, 20, 28],
  heat: [0, 20, 28],
  offline: [0, 5, 22, 26],
  routine: [0, 17, 26],
}

export function estimatePlaybackTime(state, elapsedSinceSnapshot) {
  const base = Math.max(0, Number(state.elapsed) || 0)
  if (state.status !== 'rodando') return base
  const duration = Number(state.duration) || 34
  const steps = markers[state.scenario_id] || []
  const nextEvent = steps[Number(state.step)] ?? duration
  const limit = Math.max(base, Math.min(duration, nextEvent))
  const delta = Math.max(0, Number(elapsedSinceSnapshot) || 0)
  return Math.min(limit, base + delta * (Number(state.speed) || 1))
}
