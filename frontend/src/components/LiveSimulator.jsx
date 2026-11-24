import { useEffect, useRef, useState } from 'react'
import { Maximize2, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { api } from '../api/client'
import { simulationService } from '../services/senso'
import { ActivityChart, EnvironmentChart } from './DataCharts'
import CustomSelect from './CustomSelect'
import { createSensoScene } from '../demo/sensoScene'
import { createSensoFallback } from '../demo/sensoFallback'
import './LiveSimulator.css'

const scenarios = [
  ['fall', 'Possível queda'], ['normal', 'Rotina normal'], ['idle', 'Inatividade prolongada'],
  ['heat', 'Alteração ambiental'], ['offline', 'Dispositivo desconectado'], ['routine', 'Alteração de rotina'],
]
const fallPhases = [
  [0, 'Rotina', 'Tudo dentro da rotina', 'Dona Helena circula pela casa enquanto os sensores acompanham os sinais.'],
  [7, 'Anomalia', 'Movimento brusco', 'Um movimento brusco foi identificado na cozinha.'],
  [9, 'Contexto', 'Verificando os sinais', 'O sistema cruza a imobilidade com o estado dos sensores.'],
  [11, 'Interpretação', 'Análise contextual', 'Os sinais estão sendo avaliados pelo motor de regras.'],
  [12, 'Alerta', 'Possível queda', 'A ocorrência está disponível para acompanhamento pelo familiar.'],
  [15, 'Acionamento', 'Socorro a caminho', 'No roteiro fictício, o familiar solicita ajuda.'],
  [21, 'Chegada', 'Equipe no local', 'Os profissionais entram na residência e se aproximam.'],
  [30, 'Atendimento', 'Atendimento iniciado', 'A equipe acompanha Dona Helena. A ocorrência permanece em acompanhamento.'],
]
const protocolLabels = ['Movimento brusco identificado', 'Cruzamento dos sinais', 'Análise contextual', 'Alerta ao familiar', 'Solicitação simulada de socorro', 'Chegada da equipe', 'Atendimento iniciado']
const otherCopy = {
  normal: ['Rotina normal', 'Acompanhe a movimentação habitual e os sinais da residência.'],
  idle: ['Inatividade prolongada', 'O sistema avalia o intervalo desde a última atividade disponível.'],
  heat: ['Alteração ambiental', 'Acompanhe a leitura ambiental e a interpretação do limite configurado.'],
  offline: ['Dispositivo desconectado', 'A ausência de comunicação reduz a cobertura e não confirma ausência de movimento.'],
  routine: ['Alteração de rotina', 'O sistema compara a atividade registrada com a referência demonstrativa.'],
}
const clock = (seconds) => `00:${String(Math.floor(Math.max(0, seconds || 0))).padStart(2, '0')}`

function ResidenceScene({ snapshot }) {
  const host = useRef(null)
  const scene = useRef(null)
  const shown = useRef({ elapsed: 0, scenario: null })
  const latest = useRef(snapshot)
  const timing = useRef({ performanceAt: performance.now(), wallAt: Date.now() })
  const drawFrame = useRef(null)
  latest.current = snapshot
  const [error, setError] = useState('')
  const [fallback, setFallback] = useState(false)
  useEffect(() => {
    const element = host.current
    const useFallback = () => {
      try {
        scene.current?.dispose()
        scene.current = createSensoFallback(element)
        scene.current.update({ scenario: shown.current.scenario || 'fall', elapsed: shown.current.elapsed, roomIndex: 0, severity: 'normal', offline: false })
        setFallback(true)
      } catch { setError('Não foi possível iniciar a visualização neste dispositivo.') }
    }
    const lost = () => useFallback()
    element.addEventListener('senso-webgl-lost', lost)
    try { scene.current = createSensoScene(host.current) }
    catch { useFallback() }
    return () => { element.removeEventListener('senso-webgl-lost', lost); scene.current?.dispose(); scene.current = null }
  }, [])
  useEffect(() => {
    timing.current = { performanceAt: performance.now(), wallAt: Date.now() }
    if (latest.current?.status !== 'rodando') drawFrame.current?.(performance.now())
  }, [snapshot])
  useEffect(() => {
    let frame
    function renderAt(now) {
      const state = latest.current || {}
      const scenario = state.scenario_id || 'fall'
      const base = Math.max(0, state.elapsed || 0)
      const speed = state.speed || 1
      let elapsed = base
      if (state.status === 'rodando' && state.next_step_at) {
        const delta = Math.max(0, (now - timing.current.performanceAt) / 1000)
        const untilConfirmedStep = Math.max(0, (Date.parse(state.next_step_at) - timing.current.wallAt) / 1000)
        elapsed += Math.min(delta, untilConfirmedStep) * speed
      }
      elapsed = Math.min(elapsed, state.duration || 34)
      shown.current = { scenario, elapsed }
      if (!document.hidden) scene.current?.update({ scenario, elapsed, roomIndex: state.room_index || 0, severity: state.severity || 'normal', offline: !!state.offline, running: state.status === 'rodando', visualClock: state.status === 'rodando' ? elapsed : base })
      if (state.status === 'rodando' && !document.hidden && !frame) frame = requestAnimationFrame(tick)
    }
    function tick(now) { frame = 0; renderAt(now) }
    function onVisibilityChange() {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0 }
      else renderAt(performance.now())
    }
    drawFrame.current = renderAt
    document.addEventListener('visibilitychange', onVisibilityChange)
    renderAt(performance.now())
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibilityChange); drawFrame.current = null }
  }, [])
  return <div className="live-stage">
    <div className="live-scene" ref={host} role="img" aria-label="Maquete ilustrativa da residência com Dona Helena, sensores e a equipe de atendimento no roteiro simulado." />
    {error && <div className="live-scene-error" role="status">{error}</div>}
    <div className="live-scene-label"><i /> {fallback ? 'Visualização alternativa · simulação' : 'Ambiente simulado'}</div>
    <div className="live-camera" aria-label="Controles da visualização"><button type="button" onClick={() => scene.current?.topView()}>Planta</button><button type="button" onClick={() => scene.current?.resetCamera()}>Restaurar câmera</button></div>
    <span className="live-scene-hint">Arraste para girar · role para aproximar</span>
  </div>
}

function ScenarioTelemetry({ id, snapshot, inactivityEvent, routineEvent, connectionEvent, latestTemperature, latestHumidity, readings }) {
  const freshEvent = (event) => event && (!snapshot.started_at || new Date(event.occurred_at) >= new Date(snapshot.started_at)) ? event : null
  const inactivity = freshEvent(inactivityEvent)
  const routine = freshEvent(routineEvent)
  const connection = freshEvent(connectionEvent)
  const facts = id === 'idle' ? [
    ['Intervalo sem atividade', inactivity ? `${inactivity.details?.duration_minutes ?? '—'} min` : snapshot.step > 1 ? 'Registrado' : 'Aguardando sinal'],
    ['Sensores', inactivity ? (inactivity.details?.sensors_online ? 'Conectados' : 'Cobertura parcial') : 'Conectados'],
    ['Ambiente', inactivity?.room_name || 'Quarto · cenário demonstrativo'],
  ] : id === 'offline' ? [
    ['Comunicação', snapshot.offline || connection?.type === 'device_offline' ? 'Interrompida' : connection?.type === 'device_online' ? 'Restabelecida' : 'Aguardando cenário'],
    ['Cobertura', snapshot.offline ? 'Parcial' : 'Disponível'],
    ['Interpretação', 'Sem sinal não confirma ausência'],
  ] : id === 'routine' ? [
    ['Atividade observada', routine?.details?.observed_window || 'Aguardando registro'],
    ['Referência', routine?.details?.reference_window || 'Rotina habitual'],
    ['Ambiente', routine?.room_name || 'Aguardando evento'],
  ] : id === 'heat' ? [
    ['Temperatura', latestTemperature ? `${Number(latestTemperature.value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} °C` : 'Aguardando leitura'],
    ['Umidade', latestHumidity ? `${Number(latestHumidity.value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%` : 'Aguardando leitura'],
    ['Origem', 'Sensores ambientais simulados'],
  ] : [
    ['Sinais da residência', snapshot.step > 0 ? 'Atividade registrada' : 'Aguardando início'],
    ['Cenário', 'Rotina habitual'],
  ]
  const chartReadings = id === 'heat' ? readings.filter((reading) => reading.metric === 'temperatura') : []
  return <section className="live-telemetry live-scenario-readout" aria-label="Sinais do cenário">
    <h4>{id === 'heat' ? 'Condição ambiental' : 'Sinais do cenário'}</h4>
    <dl>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {id === 'heat' && chartReadings.length > 0 ? <details className="live-readout-chart"><summary>Variação registrada</summary><EnvironmentChart readings={readings} metric="temperatura" compact /></details> : null}
    {id === 'idle' && <small>A ausência de movimento reduz a informação disponível; não confirma ausência da pessoa.</small>}
  </section>
}

export default function LiveSimulator({ simulation, perform, history }) {
  const [selected, setSelected] = useState('fall')
  const [busy, setBusy] = useState(false)
  const root = useRef(null)
  const snapshot = simulation || {}
  const id = snapshot.run_id ? (snapshot.scenario_id || selected) : selected
  const elapsed = Math.max(0, snapshot.elapsed || 0)
  const running = snapshot.status === 'rodando'
  const paused = snapshot.status === 'pausado'
  const duration = snapshot.duration || (id === 'fall' ? 34 : 28)
  const phase = Math.max(0, fallPhases.findLastIndex(([at]) => elapsed >= at))
  const safePhase = id === 'fall' && (!snapshot.fall_confirmed || !snapshot.last_alert_id) ? Math.min(phase, 3) : phase
  const current = fallPhases[safePhase]
  const hasRun = !!snapshot.run_id
  const events = history?.events || []
  const allReadings = history?.readings || []
  const readings = snapshot.run_id && snapshot.started_at ? allReadings.filter((reading) => new Date(reading.observed_at) >= new Date(snapshot.started_at)) : allReadings
  const inactivityEvent = events.find((event) => event.type === 'inactivity')
  const routineEvent = events.find((event) => event.type === 'routine_change')
  const connectionEvent = events.find((event) => ['device_offline', 'device_online'].includes(event.type))
  const temperatures = readings.filter((reading) => reading.metric === 'temperatura')
  const humidities = readings.filter((reading) => reading.metric === 'umidade')
  const latestTemperature = temperatures.at(-1)
  const latestHumidity = humidities.at(-1)

  useEffect(() => { if (snapshot.run_id && snapshot.scenario_id) setSelected(snapshot.scenario_id) }, [snapshot.run_id, snapshot.scenario_id])

  async function action(fn, message, ...args) {
    setBusy(true)
    try { await perform(async (...values) => { await fn(...values); return simulationService.state() }, message, ...args) } catch { /* perform displays the failure */ } finally { setBusy(false) }
  }
  const startScenario = async (scenario) => {
    if (running) await simulationService.pause()
    return simulationService.run(scenario)
  }
  function play() {
    if (running) return action(simulationService.pause, 'Simulação pausada.')
    if (paused && hasRun) return action(simulationService.resume, 'Simulação retomada.')
    return action(startScenario, 'Cenário iniciado.', selected)
  }
  function choose(value) { setSelected(value); action(startScenario, 'Cenário iniciado.', value) }
  const title = id === 'fall' ? current[2] : (otherCopy[id] || otherCopy.normal)[0]
  const detail = id === 'fall' ? current[3] : (otherCopy[id] || otherCopy.normal)[1]
  const stateLabel = running ? 'Em andamento' : paused ? 'Pausado' : snapshot.status === 'concluido' ? 'Concluído' : 'Pronto para começar'
  return <div className="page-content live-page" ref={root}>
    <header className="live-heading"><div><span className="eyebrow">EXPERIÊNCIA RESIDENCIAL</span><h2>O cuidado acontece aqui.</h2><p>Acompanhe como a casa percebe e responde a situações incomuns.</p></div><div className="live-heading-actions"><CustomSelect label="Cenário" value={selected} options={scenarios.map(([value, label]) => ({ value, label }))} onChange={choose} disabled={busy} /><button type="button" className="button secondary" onClick={() => document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen()}><Maximize2 size={15} /> Tela cheia</button></div></header>
    <section className="live-experience">
      <ResidenceScene snapshot={{ ...snapshot, scenario_id: id, elapsed: id === 'fall' && !snapshot.fall_confirmed ? Math.min(elapsed, 11) : elapsed, severity: id === 'fall' && !snapshot.fall_confirmed && elapsed >= 7 ? 'analysis' : snapshot.severity }} />
      <aside className="live-context" aria-live="polite"><div><span className="live-overline">{stateLabel} · {scenarios.find(([key]) => key === id)?.[1]}</span><h3>{title}</h3><p>{detail}</p></div>
        {id === 'fall' ? <><div className="live-protocol"><h4>Protocolo de resposta</h4><ol>{fallPhases.slice(1).map(([at, label], index) => { const state = index + 1 < safePhase ? 'done' : index + 1 === safePhase ? 'current' : 'pending'; return <li key={label} className={state}><span className="live-step-icon">{state === 'done' ? '✓' : index + 1}</span><span>{protocolLabels[index]}</span><time>{clock(at)}</time></li> })}</ol><small>{snapshot.last_alert_status === 'reconhecido' ? 'Ocorrência reconhecida. ' : ''}Solicitação e chegada do socorro são fictícias.</small></div><details className="live-telemetry"><summary><span>Atividade registrada</span><small>eventos por dia</small></summary><div className="live-chart-body"><div className="live-chart-inner"><ActivityChart rows={history?.activity_by_day || []} compact /><small>Histórico persistido no período selecionado.</small></div></div></details></> : <ScenarioTelemetry id={id} snapshot={snapshot} inactivityEvent={inactivityEvent} routineEvent={routineEvent} connectionEvent={connectionEvent} latestTemperature={latestTemperature} latestHumidity={latestHumidity} readings={readings} />}
      </aside>
    </section>
    <section className="live-player" aria-label="Controles da demonstração"><div className="live-timeline" aria-label="Etapas do cenário">{(id === 'fall' ? fallPhases : [[0, 'Início'], [duration, 'Conclusão']]).map(([at, label], index) => <div key={label} className={elapsed >= at && (id !== 'fall' || index <= safePhase) ? 'done' : ''}><i /><span>{label}</span></div>)}</div><div className="live-controls"><button type="button" className="button primary" disabled={busy} onClick={play}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? 'Pausar' : paused && hasRun ? 'Continuar' : 'Iniciar'}</button><button type="button" className="live-control" disabled={busy || !hasRun || snapshot.status === 'concluido'} onClick={() => action(() => api.post('/simulation/next'), null)}><SkipForward size={16} /> Próxima etapa</button><button type="button" className="live-control" disabled={busy} onClick={() => action(startScenario, 'Cenário reiniciado.', selected)}><RotateCcw size={15} /> Reiniciar</button><button type="button" className="live-control" disabled={busy || !hasRun} onClick={() => action(() => api.post('/simulation/speed', { speed: snapshot.speed === 1 ? 2 : snapshot.speed === 2 ? 0.5 : 1 }), null)} aria-label="Alterar velocidade">{snapshot.speed || 1}×</button><span className="live-clock">{clock(elapsed)} / {clock(duration)}</span></div><div className="live-progress"><i style={{ width: `${Math.min(100, elapsed / duration * 100)}%` }} /></div></section>
  </div>
}
