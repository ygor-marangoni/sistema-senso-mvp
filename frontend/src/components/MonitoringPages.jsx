import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, ArrowRight, Bell, CalendarDays, CheckCircle2, Clock3, Cpu, Droplet, House, MapPin, Minus, Plus, RefreshCw, ShieldAlert, ShieldCheck, Thermometer, UserRound, Wifi, WifiOff, X } from 'lucide-react'
import { errorMessage } from '../api/client'
import { ActivityChart, EnvironmentChart, RoomActivityChart } from './DataCharts'
import CustomSelect from './CustomSelect'
import ResidenceFlow from './ResidenceFlow'
import { authService, monitoringService } from '../services/senso'
import { activeAlertCount, elapsedSince as elapsed, formatNumber as number } from '../lib/monitoringFormat'

const level = {
  informativo: { label: 'Informativo', className: 'info', Icon: Bell },
  atencao: { label: 'Atenção', className: 'attention', Icon: AlertTriangle },
  critico: { label: 'Crítico', className: 'critical', Icon: ShieldAlert },
}

const formatDate = (value, options = { dateStyle: 'medium', timeStyle: 'short' }) => value ? new Date(value).toLocaleString('pt-BR', options) : 'Horário indisponível'
function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>
}

function PanelHeader({ title, description, action }) {
  return <div className="panel-heading"><div><h3>{title}</h3>{description && <p>{description}</p>}</div>{action}</div>
}

function StatusBadge({ value }) {
  const current = level[value] || { label: value || 'Verificando', className: 'muted', Icon: Activity }
  const Icon = current.Icon
  return <span className={`severity-badge ${current.className}`}><Icon size={14} />{current.label}</span>
}

function MonitorStatus({ dashboard }) {
  const state = dashboard?.status || 'parcial'
  const hasActiveWarning = state === 'atencao' || state === 'critico'
  const labels = {
    normal: ['Tudo tranquilo por aqui', 'Os sensores estão conectados e não há ocorrências em aberto. Continue acompanhando a rotina com tranquilidade.'],
    atencao: ['Sinais para conferir', 'Há uma ocorrência registrada para que você possa verificar o contexto.'],
    critico: ['Alerta importante para verificar', 'Um padrão nos sinais pede atenção. Consulte os detalhes da ocorrência.'],
    parcial: ['Monitoramento parcial', 'Um ou mais sinais recentes estão indisponíveis. A ausência de dados não é interpretada como segurança.'],
    indisponivel: ['Monitoramento indisponível', 'Não há dispositivos conectados no momento. O estado do morador não pode ser inferido.'],
  }
  return <section className={`monitor-status-card state-${state}`} aria-live="polite">
    <div className="status-card-copy"><span className="status-kicker"><i />ESTADO DO MONITORAMENTO</span><h2>{labels[state][0]}</h2><p>{labels[state][1]}</p><div className="status-facts"><span><MapPin size={16} /><small>Último sinal de movimento</small><b>{dashboard?.last_activity?.room_name || 'Sem localização recente'}</b><em>{dashboard?.last_activity ? elapsed(dashboard.last_activity.occurred_at) : 'Aguardando sinal'}</em></span><span><Bell size={16} /><small>Ocorrências em aberto</small><b>{dashboard?.metrics?.active_alerts || 0}</b><em>{state === 'critico' ? 'Verifique os alertas' : state === 'atencao' ? 'Há sinais para conferir' : state === 'parcial' || state === 'indisponivel' ? 'Cobertura incompleta' : 'Nenhuma no momento'}</em></span></div></div>
    <div className={`status-illustration${hasActiveWarning ? ` is-${state}` : ''}`} aria-hidden="true">{hasActiveWarning ? <span className={`status-alert-art state-${state}`}><AlertTriangle size={76} strokeWidth={1.65} /></span> : <img className="status-home-art" src="/images/senso-home-status.webp" alt="" />}<span className="status-orbit orbit-a" /><span className="status-orbit orbit-b" /><span className="status-orbit orbit-c" /></div>
  </section>
}

function MetricCard({ Icon, label, value, detail, tone = 'blue' }) {
  return <article className="metric-card"><div className="metric-card-head"><span className="metric-label">{label}</span><span className={`metric-icon ${tone}`} aria-hidden="true"><Icon size={17} strokeWidth={1.8} /></span></div><strong className="metric-value">{value}</strong><small className="metric-detail">{detail}</small></article>
}

function AlertRow({ alert, onAcknowledge, onResolve, compact = false }) {
  const TypeIcon = (level[alert.severity] || level.informativo).Icon
  const evidenceLabels = { duration_minutes: 'Duração da inatividade', inactive_seconds: 'Inatividade após movimento', value: 'Leitura registrada', faixa: 'Faixa configurada', rule: 'Regra aplicada', usual_rest_period: 'Horário habitual de descanso', sensors_online: 'Sensores conectados', preceded_by_abrupt_motion: 'Movimento brusco anterior', historical_demo: 'Registro demonstrativo' }
  const evidenceValue = (key, value) => key === 'duration_minutes' ? `${value} min` : key === 'inactive_seconds' ? `${value} s` : key === 'value' ? `${value}${alert.type === 'temperatura_anormal' ? ' °C' : ''}` : key === 'faixa' ? Array.isArray(value) ? value.join('–') : value : typeof value === 'boolean' ? value ? 'Sim' : 'Não' : value
  return <article className={`alert-row alert-${alert.severity}${compact ? ' compact' : ''}`}>
    <span className="alert-row-icon"><TypeIcon size={18} /></span>
    <div className="alert-row-main"><div className="alert-row-title"><b>{alert.title}</b><StatusBadge value={alert.severity} /></div><p>{alert.message}</p><div className="alert-row-meta"><span><Clock3 size={13} />{formatDate(alert.created_at)}</span>{alert.room_name && <span><MapPin size={13} />{alert.room_name}</span>}{alert.device_name && <span><Cpu size={13} />{alert.device_name}</span>}<span className="alert-status-label">{alert.status === 'novo' ? 'Novo' : alert.status === 'reconhecido' ? `Reconhecido${alert.acknowledged_by ? ` por ${alert.acknowledged_by}` : ''}` : `Resolvido${alert.resolved_by ? ` por ${alert.resolved_by}` : ''}`}</span></div>
      {!compact && Object.keys(alert.evidence || {}).length > 0 && <details className="alert-evidence"><summary>Ver contexto e regra aplicada</summary><dl>{Object.entries(alert.evidence).map(([key, value]) => <div key={key}><dt>{evidenceLabels[key] || key.replaceAll('_', ' ')}</dt><dd>{String(evidenceValue(key, value))}</dd></div>)}</dl></details>}
      {alert.resolution_note && <p className="resolution-note"><CheckCircle2 size={13} />{alert.resolution_note}</p>}
    </div>
    {!compact && alert.status !== 'resolvido' && <div className="alert-row-actions">{alert.status === 'novo' && <button className="button secondary small" onClick={() => onAcknowledge(alert.id)}>Reconhecer</button>}<button className="button primary small" onClick={() => onResolve(alert.id)}>Resolver</button></div>}
  </article>
}

function EventLine({ event }) {
  const icon = event.type === 'temperature' || event.type === 'humidity' ? <Thermometer size={15} /> : event.type.includes('device') ? <Wifi size={15} /> : event.type.includes('fall') || event.type === 'motion_burst' ? <AlertTriangle size={15} /> : <Activity size={15} />
  return <div className="event-line"><span className={`event-line-icon event-${event.type}`} aria-hidden="true">{icon}</span><div className="event-line-copy"><b>{event.summary}</b><span>{event.room_name || event.device_name || 'Residência'} · {formatDate(event.occurred_at)}</span></div></div>
}

export function OverviewPage({ dashboard, history, loading, onNavigate }) {
  const resident = dashboard?.residence?.resident_name || 'Pessoa acompanhada'
  const lastActivity = dashboard?.last_activity
  const metrics = dashboard?.metrics || {}
  const activeAlert = dashboard?.active_alerts?.find((alert) => alert.severity === 'critico')
  return <div className="page-content overview-page">
    <PageHeader eyebrow="VISÃO DO DIA" title={`Olá, ${dashboard?.user?.name?.split(' ')[0] || 'responsável'}`} description={`Acompanhe os sinais da residência de ${resident}.`} />
    {activeAlert && <button className="critical-spotlight" onClick={() => onNavigate('alerts')}><span className="critical-spotlight-icon"><ShieldAlert size={21} /></span><span><b>{activeAlert.title}</b><small>{activeAlert.message}</small></span><ArrowRight size={19} /></button>}
    <MonitorStatus dashboard={dashboard} />
    <div className="metric-grid">
      <MetricCard Icon={Activity} label="Última atividade" value={lastActivity ? elapsed(lastActivity.occurred_at) : 'Sem registro'} detail={lastActivity ? `detectada na ${lastActivity.room_name?.toLowerCase() || 'residência'}` : 'Nenhum evento recente recebido'} tone="green" />
      <MetricCard Icon={Wifi} label="Dispositivos conectados" value={`${metrics.devices_online || 0} de ${metrics.devices_total || 0}`} detail={metrics.devices_online === metrics.devices_total ? 'Cobertura disponível' : 'Cobertura reduzida'} tone="blue" />
      <MetricCard Icon={Thermometer} label="Temperatura ambiente" value={metrics.temperature ? `${number(metrics.temperature.value)} °C` : '—'} detail={metrics.temperature ? `Atualizada ${elapsed(metrics.temperature.observed_at)}` : 'Sem leitura disponível'} tone="mint" />
      <MetricCard Icon={Droplet} label="Umidade relativa" value={metrics.humidity ? `${number(metrics.humidity.value, 0)}%` : '—'} detail={metrics.humidity ? `Atualizada ${elapsed(metrics.humidity.observed_at)}` : 'Sem leitura disponível'} tone="sage" />
    </div>
    <div className="overview-grid">
      <section className="panel activity-panel"><PanelHeader title="Movimentação ao longo da semana" description="Eventos recebidos comparados à rotina simulada." action={<button className="text-link" onClick={() => onNavigate('routine')}>Ver histórico <ArrowRight size={15} /></button>} /><ActivityChart rows={history?.activity_by_day || []} compact /></section>
      <section className="panel room-activity-panel"><PanelHeader title="Atividade por ambiente" description="Últimos sete dias" /><RoomActivityChart rows={history?.activity_by_room || []} compact /></section>
    </div>
    <div className="overview-grid lower-grid">
      <section className="panel"><PanelHeader title="Atividade recente" description="O que os sensores registraram na residência." action={<button className="text-link" onClick={() => onNavigate('routine')}>Ver tudo <ArrowRight size={15} /></button>} />
        {dashboard?.recent_events?.length ? <div className="event-list">{dashboard.recent_events.slice(0, 5).map((event) => <EventLine event={event} key={event.id} />)}</div> : <div className="empty-inline"><Activity size={18} /><span>Ainda não há eventos registrados.</span></div>}
      </section>
      <section className="panel"><PanelHeader title="Ambientes monitorados" description={`${dashboard?.rooms?.length || 0} ambientes cadastrados`} action={<button className="text-link" onClick={() => onNavigate('residence')}>Abrir residência <ArrowRight size={15} /></button>} />
        <div className="room-mini-list">{dashboard?.rooms?.map((room) => <button className="room-mini" onClick={() => onNavigate('residence')} key={room.id}><span className={`room-mini-dot ${room.devices?.length ? (room.online_count === room.devices.length ? "" : "is-offline") : "is-empty"}`} /><span>{room.name}</span><small>{room.online_count ? `${room.online_count} ${room.online_count === 1 ? 'conectado' : 'conectados'}` : room.devices?.length ? 'Sem comunicação' : 'Sem sensor'}</small></button>)}</div>
      </section>
    </div>
    {loading && !dashboard && <div className="loading-inline"><span className="spinner" />Carregando sinais da residência…</div>}
  </div>
}

export function ResidencePage({ dashboard, selectedRoom, setSelectedRoom }) {
  const room = dashboard?.rooms?.find((item) => item.id === selectedRoom?.id) || dashboard?.rooms?.[0]
  const events = dashboard?.recent_events?.filter((item) => item.room_id === room?.id).slice(0, 4) || []
  const devices = room?.devices || []
  return <div className="page-content">
    <PageHeader eyebrow="CASA CONECTADA" title={dashboard?.residence?.name || 'Residência'} description={`Dispositivos, ambientes e sinais disponíveis para ${dashboard?.residence?.resident_name || 'o morador'}.`} action={<span className="data-tag"><Activity size={14} /> Fluxo do monitoramento</span>} />
    <div className="residence-layout">
      <section className="panel floor-panel"><PanelHeader title="Conexões da residência" description="Siga os sinais dos dispositivos até os ambientes e a leitura contextual do Senso." /><ResidenceFlow rooms={dashboard?.rooms || []} devices={dashboard?.devices || []} dashboard={dashboard} activeRoom={room} onSelect={setSelectedRoom} /></section>
      <aside className="panel room-inspector">
        <header className="room-inspector-header"><div><span className="eyebrow">AMBIENTE SELECIONADO</span><h3>{room?.name || 'Nenhum ambiente'}</h3><p>{devices.length ? `${devices.length} dispositivo${devices.length === 1 ? '' : 's'} neste ambiente` : 'Nenhum dispositivo neste ambiente'}</p></div><div className={`room-inspector-status${devices.length && room.online_count === devices.length ? ' available' : ''}`}><span />{devices.length ? `${room.online_count || 0} de ${devices.length} conectados` : 'Sem cobertura'}</div></header>
        <div className="room-inspector-content"><section><h4>Dispositivos</h4><div className="room-inspector-list">{devices.length ? devices.map((device) => <div className="room-inspector-device" key={device.id}><img src={device.type === 'ambiental' ? '/images/senso-environment-node.webp' : '/images/senso-presence-node.webp'} alt="" /><div><b>{device.name}</b><small>{device.status === 'online' ? `Comunicação ${elapsed(device.last_seen_at)}` : 'Sem comunicação'}</small></div></div>) : <p>Nenhum sensor associado.</p>}</div></section>
        <section><h4>Atividade recente</h4><div className="room-inspector-list">{events.length ? events.map((event) => <div className="room-inspector-event" key={event.id}><span>{event.summary}</span><time>{elapsed(event.occurred_at)}</time></div>) : <p>Nenhuma atividade recente neste ambiente.</p>}</div></section></div>
      </aside>
    </div>
    <section className="environment-strip"><div><Thermometer size={19} /><span>Temperatura na sala</span><b>{dashboard?.metrics?.temperature ? `${number(dashboard.metrics.temperature.value)} °C` : 'Sem leitura'}</b></div><div><Activity size={19} /><span>Umidade relativa</span><b>{dashboard?.metrics?.humidity ? `${number(dashboard.metrics.humidity.value, 0)}%` : 'Sem leitura'}</b></div><div><Cpu size={19} /><span>Última atualização</span><b>{dashboard?.updated_at ? formatDate(dashboard.updated_at, { hour: '2-digit', minute: '2-digit' }) : '—'}</b></div></section>
  </div>
}

export function RoutinePage({ history, historyFilters, setHistoryFilters, dashboard }) {
  function updateFilter(key, value) { setHistoryFilters((current) => ({ ...current, [key]: value })) }
  return <div className="page-content">
    <PageHeader eyebrow="ROTINA E HISTÓRICO" title="Entenda o ritmo da casa" description="Consulte eventos e condições ambientais registrados pelos sensores." />
    <section className="panel history-filter-panel"><div className="filter-group">
      <CustomSelect label="Período" value={historyFilters.days} onChange={(value) => updateFilter('days', Number(value))} options={[{ value: 1, label: 'Hoje' }, { value: 7, label: 'Últimos 7 dias' }, { value: 30, label: 'Últimos 30 dias' }]} />
      <CustomSelect label="Ambiente" value={historyFilters.room_id} onChange={(value) => updateFilter('room_id', value)} options={[{ value: '', label: 'Todos os ambientes' }, ...(dashboard?.rooms || []).map((room) => ({ value: room.id, label: room.name }))]} />
      <CustomSelect label="Tipo de evento" value={historyFilters.event_type} onChange={(value) => updateFilter('event_type', value)} options={[{ value: '', label: 'Todos os eventos' }, { value: 'movement', label: 'Movimentação' }, { value: 'motion_burst', label: 'Movimento brusco' }, { value: 'inactivity', label: 'Inatividade' }, { value: 'temperature', label: 'Temperatura' }, { value: 'humidity', label: 'Umidade' }, { value: 'routine_change', label: 'Alteração de rotina' }, { value: 'device_offline', label: 'Conectividade' }]} />
    </div><span className="filter-result-count">{history?.events?.length || 0} eventos no período</span></section>
    <div className="routine-chart-grid"><section className="panel"><PanelHeader title="Movimentação por dia" description="A referência habitual usa os registros anteriores." /><ActivityChart rows={history?.activity_by_day || []} /></section><section className="panel"><PanelHeader title="Atividade por ambiente" description="Comparação de movimentações no período selecionado." /><RoomActivityChart rows={history?.activity_by_room || []} /></section></div>
    <div className="routine-chart-grid environment-charts"><section className="panel"><PanelHeader title="Temperatura ambiente" description="Leituras recentes do sensor, em graus Celsius." /><EnvironmentChart readings={history?.readings || []} metric="temperatura" /></section><section className="panel"><PanelHeader title="Umidade relativa" description="Leituras recentes do sensor, em porcentagem." /><EnvironmentChart readings={history?.readings || []} metric="umidade" /></section></div>
    <section className="panel history-timeline"><PanelHeader title="Linha do tempo" description="Eventos registrados e ocorrências do período." />{history?.events?.length ? <div className="event-list">{history.events.map((event) => <EventLine key={event.id} event={event} />)}</div> : <div className="empty-inline"><Activity size={18} />Nenhum evento com os filtros atuais.</div>}</section>
    <p className="interpretation-note"><ShieldCheck size={15} /> Períodos sem atividade são apresentados como sinais residenciais. Não indicam, por si só, sono, queda ou condição clínica.</p>
  </div>
}

export function AlertsPage({ alerts, perform }) {
  const [statusFilter, setStatusFilter] = useState('ativos')
  const [severityFilter, setSeverityFilter] = useState('')
  const visible = alerts.filter((alert) => (statusFilter === 'todos' || (statusFilter === 'ativos' ? alert.status !== 'resolvido' : alert.status === statusFilter)) && (!severityFilter || alert.severity === severityFilter))
  const activeCount = activeAlertCount(alerts)
  return <div className="page-content">
    <PageHeader eyebrow="CENTRAL DE ALERTAS" title="Ocorrências e acompanhamento" description="Veja o que aconteceu, reconheça o recebimento e registre uma verificação." action={<span className="alert-count-pill"><Bell size={15} />{activeCount} em aberto</span>} />
    <section className="alert-explainer"><span><ShieldAlert size={20} /></span><div><b>Alertas são sinais para verificação contextual.</b><p>O Senso não confirma acidentes ou condições de saúde. A gravidade, o estado da ocorrência e a cobertura dos dispositivos são informações distintas.</p></div></section>
    <section className="panel alerts-panel"><div className="alerts-filter-row"><div className="filter-group">
      <CustomSelect label="Situação" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'ativos', label: 'Em aberto' }, { value: 'novo', label: 'Novos' }, { value: 'reconhecido', label: 'Reconhecidos' }, { value: 'resolvido', label: 'Resolvidos' }, { value: 'todos', label: 'Todos' }]} />
      <CustomSelect label="Classificação" value={severityFilter} onChange={setSeverityFilter} options={[{ value: '', label: 'Todas' }, { value: 'critico', label: 'Crítico' }, { value: 'atencao', label: 'Atenção' }, { value: 'informativo', label: 'Informativo' }]} />
    </div><span className="filter-result-count">{visible.length} ocorrências</span></div>
      {visible.length ? <div className="alert-list">{visible.map((alert) => <AlertRow key={alert.id} alert={alert} onAcknowledge={(id) => perform(monitoringService.acknowledgeAlert, 'Ocorrência reconhecida.', id)} onResolve={(id) => perform(monitoringService.resolveAlert, 'Ocorrência resolvida e mantida no histórico.', id)} />)}</div> : <div className="alerts-empty"><span><CheckCircle2 size={27} /></span><h3>{statusFilter === 'ativos' ? 'Nenhuma ocorrência em aberto' : 'Nenhum alerta neste filtro'}</h3><p>{statusFilter === 'ativos' ? 'Seus alertas anteriores continuam disponíveis no histórico.' : 'Ajuste os filtros para consultar outras ocorrências.'}</p></div>}
    </section>
  </div>
}

export function DevicesPage({ devices, dashboard, perform }) {
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deviceError, setDeviceError] = useState('')
  const [deviceType, setDeviceType] = useState('presenca')
  const [deviceRoom, setDeviceRoom] = useState('')
  useEffect(() => { if (!deviceRoom && dashboard?.rooms?.length) setDeviceRoom(String(dashboard.rooms[0].id)) }, [dashboard?.rooms, deviceRoom])
  async function addDevice(event) {
    event.preventDefault(); setBusy(true); setDeviceError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try { await perform(monitoringService.addDevice, 'Dispositivo virtual conectado.', { room_id: Number(values.room_id), device_type: values.device_type }); setAdding(false) }
    catch (error) { setDeviceError(errorMessage(error)) } finally { setBusy(false) }
  }
  const connected = devices.filter((device) => device.status === 'online').length
  const coverageState = (device) => ['fault', 'error', 'critical', 'defeituoso'].includes(String(device.status).toLowerCase()) ? 'fault' : device.status === 'online' ? 'online' : 'offline'
  const faultCount = devices.filter((device) => coverageState(device) === 'fault').length
  return <div className="page-content">
    <PageHeader eyebrow="DISPOSITIVOS VIRTUAIS" title="Sensores da residência" description="Equipamentos conceituais alimentados exclusivamente pelo simulador de dados." action={<button className="button primary" onClick={() => setAdding(true)}><Plus size={17} /> Conectar dispositivo</button>} />
    {adding && <section className="panel add-device-panel"><PanelHeader title="Conectar dispositivo virtual" description="Escolha o tipo e o ambiente para adicionar um dispositivo à simulação." /><form onSubmit={addDevice} className="add-device-form"><CustomSelect label="Tipo de dispositivo" value={deviceType} onChange={setDeviceType} options={[{ value: 'presenca', label: 'Nó de presença' }, { value: 'ambiental', label: 'Sensor ambiental' }]} /><input type="hidden" name="device_type" value={deviceType} /><CustomSelect label="Ambiente" value={deviceRoom} onChange={setDeviceRoom} options={(dashboard?.rooms || []).map(room => ({ value: String(room.id), label: room.name }))} /><input type="hidden" name="room_id" value={deviceRoom} /><div className="form-actions"><button type="button" className="button secondary" onClick={() => setAdding(false)}>Cancelar</button><button className="button primary" disabled={busy || !deviceRoom}>{busy ? 'Conectando…' : 'Conectar'}</button></div>{deviceError && <p className="form-message error" role="alert">{deviceError}</p>}</form></section>}
    <div className="device-summary-card"><div><span className="device-summary-icon"><Wifi size={20} /></span><div><b>{connected === devices.length ? 'Cobertura disponível' : connected > 0 ? 'Cobertura parcial' : 'Sem conectividade'}</b><p>{connected} de {devices.length} dispositivos estão comunicando.{faultCount ? ` ${faultCount} com falha.` : ''}</p></div></div><span className="coverage-segments" role="img" aria-label={devices.length ? devices.map((device) => `${device.name}: ${coverageState(device) === 'online' ? 'conectado' : coverageState(device) === 'fault' ? 'com falha' : 'desconectado'}`).join('; ') : 'Nenhum dispositivo conectado'}>{devices.length ? devices.map((device) => <i key={device.id} className={coverageState(device)} title={`${device.name}: ${coverageState(device) === 'online' ? 'conectado' : coverageState(device) === 'fault' ? 'com falha' : 'desconectado'}`} />) : <i className="offline" />}</span></div>
    <div className="device-grid">{devices.map((device) => <article className={`device-card ${device.status}`} key={device.id}><div className="device-card-top"><span className={`device-type-icon ${device.type}`}><img src={device.type === 'gateway' ? '/images/senso-gateway-card.webp' : device.type === 'ambiental' ? '/images/senso-environment-node.webp' : '/images/senso-presence-node.webp'} alt="" /></span><span className={`device-status ${device.status}`}>{device.status === 'online' ? <><i />Conectado</> : <><WifiOff size={13} />Desconectado</>}</span></div><h3>{device.name}</h3><p>{device.type === 'gateway' ? 'Concentrador central' : device.type === 'ambiental' ? 'Temperatura e umidade' : 'Presença e movimentação inferida'}</p><div className="device-card-details"><span>Ambiente</span><b>{device.room_name}</b><span>Identificador</span><code>{device.serial}</code><span>Última comunicação</span><b>{elapsed(device.last_seen_at)}</b></div><div className="device-card-foot"><span className="simulated-mini">SIMULADO</span><span>{device.is_simulated ? 'Dados de demonstração' : 'Dispositivo'}</span></div></article>)}</div>
    <p className="interpretation-note"><WifiOff size={15} /> Um dispositivo desconectado reduz a cobertura de monitoramento. Isso não significa que não houve movimentação.</p>
    <section className="panel device-events"><PanelHeader title="Eventos técnicos recentes" description="Conectividade e disponibilidade dos sensores." />{dashboard?.recent_events?.filter((event) => event.type.includes('device')).length ? <div className="event-list">{dashboard.recent_events.filter((event) => event.type.includes('device')).map((event) => <EventLine event={event} key={event.id} />)}</div> : <div className="empty-inline">Nenhuma falha de comunicação recente.</div>}</section>
  </div>
}

function useFormChanges() {
  const ref = useRef(null)
  const baseline = useRef('')
  const [dirty, setDirty] = useState(false)
  const serialize = (form) => JSON.stringify(Array.from(new FormData(form).entries()))
  useEffect(() => { if (ref.current) baseline.current = serialize(ref.current) }, [])
  function changed() { if (ref.current) setDirty(serialize(ref.current) !== baseline.current) }
  function cancel() { ref.current?.reset(); setDirty(false) }
  function saved() {
    const form = ref.current
    if (!form) return
    for (const field of form.elements) {
      if (field.type === 'checkbox' || field.type === 'radio') field.defaultChecked = field.checked
      else if (field.tagName === 'SELECT') for (const option of field.options) option.defaultSelected = option.selected
      else if (field.name) field.defaultValue = field.value
    }
    baseline.current = serialize(form)
    setDirty(false)
  }
  return { ref, dirty, changed, cancel, saved }
}

function SettingsActions({ dirty, busy, onCancel, label }) {
  return <div className="settings-actions">{dirty && <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancelar</button>}<button className="button primary" disabled={busy || !dirty}>{busy ? 'Salvando…' : label}</button></div>
}

function ResidenceForm({ residence, onSave }) {
  const changes = useFormChanges()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [gender, setGender] = useState(residence?.resident_gender || 'nao_informado')
  const savedGender = useRef(residence?.resident_gender || 'nao_informado')
  useEffect(() => { changes.changed() }, [gender])
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    if (!Object.hasOwn(residence || {}, 'resident_birth_date')) {
      if (values.resident_birth_date) { setError('Não foi possível salvar a data de nascimento. Tente novamente mais tarde.'); setBusy(false); return }
      delete values.resident_birth_date
    } else values.resident_birth_date = values.resident_birth_date || null
    try { await onSave(values); savedGender.current = gender; changes.saved(); setError('') } catch (requestError) { setError(errorMessage(requestError)) } finally { setBusy(false) }
  }
  return <form className="settings-form" ref={changes.ref} onChange={changes.changed} onSubmit={submit}>
    <div className="form-grid">
      <label className="field"><span>Nome da residência</span><input name="name" required minLength={2} defaultValue={residence?.name || ''} /></label>
      <label className="field"><span>Nome do morador</span><input name="resident_name" required minLength={2} defaultValue={residence?.resident_name || ''} /></label>
      <CustomSelect label="Gênero do morador" value={gender} onChange={setGender} options={[{ value: 'feminino', label: 'Mulher' }, { value: 'masculino', label: 'Homem' }, { value: 'nao_informado', label: 'Não informado' }]} /><input type="hidden" name="resident_gender" value={gender} />
      <label className="field"><span>Data de nascimento <small>(opcional)</small></span><input name="resident_birth_date" type="date" max={new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())} defaultValue={residence?.resident_birth_date || ''} /></label>
      <label className="field"><span>Bairro ou referência</span><input name="address" defaultValue={residence?.address || ''} /></label>
      <label className="field"><span>Cidade</span><input name="city" defaultValue={residence?.city || ''} /></label>
      <label className="field"><span>Estado</span><input name="state" maxLength="2" defaultValue={residence?.state || ''} /></label>
    </div>
    {error && <p className="form-message error" role="alert">{error}</p>}<SettingsActions dirty={changes.dirty} busy={busy} onCancel={() => { setGender(savedGender.current); changes.cancel(); setError('') }} label="Salvar dados da residência" />
  </form>
}

function ProfileForm({ user, onSave }) {
  const changes = useFormChanges()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (user?.phone === undefined || user?.cpf === undefined) {
      setError('Não foi possível salvar os dados do responsável. Tente novamente mais tarde.')
      return
    }
    setBusy(true); setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try { await onSave(values); changes.saved() } catch (requestError) { setError(errorMessage(requestError)) } finally { setBusy(false) }
  }
  return <form className="settings-form" ref={changes.ref} onChange={changes.changed} onSubmit={submit}><div className="form-grid"><label className="field"><span>Nome do responsável</span><input name="name" minLength={2} maxLength={120} required defaultValue={user?.name || ''} /></label><label className="field"><span>E-mail</span><input value={user?.email || ''} readOnly /></label><label className="field"><span>Telefone <small>(opcional)</small></span><input name="phone" type="tel" maxLength={40} autoComplete="tel" defaultValue={user?.phone || ''} placeholder="(00) 00000-0000" /></label><label className="field"><span>CPF <small>(opcional)</small></span><input name="cpf" inputMode="numeric" maxLength={14} pattern="[0-9.\- ]{11,14}" title="Informe 11 dígitos" defaultValue={user?.cpf || ''} placeholder="000.000.000-00" /></label></div>{error && <p className="form-message error" role="alert">{error}</p>}<SettingsActions dirty={changes.dirty} busy={busy} onCancel={() => { changes.cancel(); setError('') }} label="Salvar perfil" /></form>
}

function MonitoringSettingsForm({ settings, onSave }) {
  const changes = useFormChanges()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    const values = { inactivity_minutes: Number(data.get('inactivity_minutes')), temperature_min: Number(data.get('temperature_min')), temperature_max: Number(data.get('temperature_max')), humidity_min: Number(data.get('humidity_min')), humidity_max: Number(data.get('humidity_max')), notify_attention: data.get('notify_attention') === 'on', notify_critical: data.get('notify_critical') === 'on' }
    try { await onSave(values); changes.saved() } catch (requestError) { setError(errorMessage(requestError)) } finally { setBusy(false) }
  }
  return <form className="settings-form" ref={changes.ref} onChange={changes.changed} onSubmit={submit}><div className="form-grid"><label className="field"><span>Inatividade demonstrativa (minutos)</span><input name="inactivity_minutes" type="number" min="30" max="720" defaultValue={settings?.inactivity_minutes ?? 180} required /></label><label className="field"><span>Temperatura mínima (°C)</span><input name="temperature_min" type="number" min="5" max="35" step="0.5" defaultValue={settings?.temperature_min ?? 18} required /></label><label className="field"><span>Temperatura máxima (°C)</span><input name="temperature_max" type="number" min="10" max="45" step="0.5" defaultValue={settings?.temperature_max ?? 30} required /></label><label className="field"><span>Umidade mínima (%)</span><input name="humidity_min" type="number" min="10" max="80" step="1" defaultValue={settings?.humidity_min ?? 30} required /></label><label className="field"><span>Umidade máxima (%)</span><input name="humidity_max" type="number" min="20" max="95" step="1" defaultValue={settings?.humidity_max ?? 70} required /></label></div><div className="preference-row"><label><input type="checkbox" name="notify_attention" defaultChecked={settings?.notify_attention ?? true} /><span><b>Notificações de atenção</b><small>Mostrar alterações de rotina e condições ambientais.</small></span></label><label><input type="checkbox" name="notify_critical" defaultChecked={settings?.notify_critical ?? true} /><span><b>Notificações críticas</b><small>Mostrar ocorrências críticas no painel principal.</small></span></label></div>{error && <p className="form-message error" role="alert">{error}</p>}<p className="form-hint">Parâmetros acadêmicos de simulação; não são limites clínicos validados.</p><SettingsActions dirty={changes.dirty} busy={busy} onCancel={() => { changes.cancel(); setError('') }} label="Salvar preferências" /></form>
}

function ContactEditor({ contact, onSave, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', closeOnEscape) }
  }, [busy, onClose])
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    const data = Object.fromEntries(new FormData(event.currentTarget))
    try { await onSave(data); onClose() } catch (requestError) { setError(errorMessage(requestError)) } finally { setBusy(false) }
  }
  return <div className="med-modal-backdrop app-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section className="med-modal contact-modal" role="dialog" aria-modal="true" aria-labelledby="contact-form-title">
    <header className="med-modal-header"><div><span className="eyebrow">REDE DE CUIDADO</span><h2 id="contact-form-title">{contact ? 'Editar contato' : 'Adicionar contato'}</h2><p>Dados de alguém que acompanha a residência.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Fechar"><X size={19} /></button></header>
    <form className="med-form" onSubmit={submit}><label className="field"><span>Nome</span><input name="name" required maxLength={120} autoFocus defaultValue={contact?.name || ''} placeholder="Nome do familiar ou cuidador" /></label><label className="field"><span>Relação</span><input name="relationship_label" required maxLength={80} defaultValue={contact?.relationship_label || 'Familiar'} placeholder="Ex.: filha, cuidador" /></label><label className="field"><span>Telefone <small>(opcional)</small></span><input name="phone" type="tel" maxLength={40} autoComplete="tel" defaultValue={contact?.phone || ''} placeholder="(00) 00000-0000" /></label><label className="field"><span>E-mail <small>(opcional)</small></span><input name="email" type="email" maxLength={254} autoComplete="email" defaultValue={contact?.email || ''} placeholder="nome@exemplo.com" /></label>{error && <p className="form-message error med-form-full" role="alert">{error}</p>}<div className="med-form-actions med-form-full"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar contato'}</button></div></form>
  </section></div>
}

export function SettingsPage({ dashboard, residence, settings, contacts, perform }) {
  const [editing, setEditing] = useState(null)
  const [showContactForm, setShowContactForm] = useState(false)
  async function saveContact(values) {
    if (editing?.id) await perform(monitoringService.updateContact, 'Contato atualizado.', editing.id, values)
    else await perform(monitoringService.addContact, 'Contato de confiança adicionado.', values)
  }
  return <div className="page-content">
    <PageHeader eyebrow="PREFERÊNCIAS" title="Configurações" description="Gerencie os dados demonstrativos, contatos e parâmetros do monitoramento." />
    <div className="settings-layout">
        <section className="panel settings-panel"><PanelHeader title="Perfil do responsável" description="Informações da conta que acompanha a residência." /><ProfileForm key={dashboard?.user ? JSON.stringify(dashboard.user) : 'profile'} user={dashboard?.user} onSave={(values) => perform(authService.updateProfile, 'Perfil atualizado.', values)} /></section>
        <section className="panel settings-panel"><PanelHeader title="Residência e morador" description="Informações fictícias usadas nesta demonstração." /><ResidenceForm key={residence ? JSON.stringify(residence) : 'home'} residence={residence} onSave={(values) => perform(monitoringService.updateResidence, 'Dados da residência atualizados.', values)} /></section>
        <section className="panel settings-panel"><PanelHeader title="Parâmetros de monitoramento" description="Ajustes demonstrativos para regras do simulador." /><MonitoringSettingsForm key={settings ? JSON.stringify(settings) : 'settings'} settings={settings} onSave={(values) => perform(monitoringService.updateSettings, 'Preferências de monitoramento salvas.', values)} /></section>
        <section className="panel settings-panel contact-panel"><PanelHeader title="Contatos de confiança" description="Familiares e cuidadores associados à demonstração." />
        {contacts.length ? <div className="contacts-list">{contacts.map((contact) => <div className="contact-row" key={contact.id}><span className="contact-avatar"><UserRound size={17} /></span><span className="contact-info"><b>{contact.name}</b><small>{contact.relationship_label} · {[contact.phone, contact.email].filter(Boolean).join(' · ') || 'Sem telefone ou e-mail'}</small></span><div className="contact-actions"><button className="text-link" onClick={() => { setEditing(contact); setShowContactForm(false) }}>Editar</button><button className="text-link danger-link" onClick={() => perform(monitoringService.deleteContact, 'Contato removido.', contact.id)}>Remover</button></div></div>)}</div> : <div className="empty-inline">Cadastre um contato de confiança para a demonstração.</div>}
        {(showContactForm || editing) && <ContactEditor key={editing?.id || 'new-contact'} contact={editing} onSave={saveContact} onClose={() => { setEditing(null); setShowContactForm(false) }} />}
        {!showContactForm && !editing && <button className="button primary agenda-add-button contact-add-bottom" onClick={() => { setEditing(null); setShowContactForm(true) }}><Plus size={18} />Adicionar contato</button>}
        </section>
      <section className="privacy-card"><ShieldCheck size={20} /><div><b>Privacidade e escopo</b><p>O MVP usa eventos e leituras fictícios. Não há câmeras, microfones, captura de Wi‑Fi real ou serviço de emergência conectado.</p></div></section>
    </div>
  </div>
}

const LiveSimulator = lazy(() => import('./LiveSimulator'))
export function SimulatorPage(props) {
  return <Suspense fallback={<div className="loading-screen">Preparando a residência…</div>}><LiveSimulator {...props} /></Suspense>
}
