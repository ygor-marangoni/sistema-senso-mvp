// The server owns the timeline; this clock only smooths the displayed pose.
export function createVisualClock() {
  let runId = null, scenario = null, elapsed = 0, target = 0, lastFrame = 0, running = false, speed = 1
  return {
    update(state) {
      const nextRun = state.runId ?? null
      const nextScenario = state.scenario
      const nextTarget = Math.max(0, Number(state.elapsed) || 0)
      if (nextRun !== runId || nextScenario !== scenario || nextTarget < target - 1) {
        elapsed = nextTarget
        lastFrame = 0
      }
      runId = nextRun
      scenario = nextScenario
      target = nextTarget
      running = !!state.running
      speed = Math.max(.5, Math.min(2, Number(state.speed) || 1))
    },
    tick(now) {
      const delta = lastFrame ? Math.min(.05, Math.max(0, (now - lastFrame) / 1000)) : 1 / 60
      lastFrame = now
      if (running) elapsed += Math.min(Math.max(0, target - elapsed), delta * speed * 1.65)
      else elapsed = target
      return elapsed
    },
  }
}
