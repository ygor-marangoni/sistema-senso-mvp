import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, ArrowRight, Bell, CalendarClock, CalendarDays, Cpu, Eye, EyeOff, House, LayoutDashboard, LogOut, Menu, PhoneCall, PlayCircle, Settings, X } from 'lucide-react'
import { errorMessage } from './api/client'
import AuthHero from './components/AuthHero'
import BrandMark from './components/BrandMark'
import Toast from './components/Toast'
import { appointmentService, authService, medicationService, monitoringService, simulationService } from './services/senso'
import MedicationPage, { isScheduled } from './components/MedicationPage'
import { AlertsPage, DevicesPage, OverviewPage, ResidencePage, RoutinePage, SettingsPage, SimulatorPage } from './components/MonitoringPages'

const navItems = [
  { id: 'overview', label: 'Visão geral', Icon: LayoutDashboard },
  { id: 'residence', label: 'Residência', Icon: House },
  { id: 'routine', label: 'Rotina e histórico', Icon: CalendarDays },
  { id: 'medications', label: 'Agenda', Icon: CalendarClock },
  { id: 'devices', label: 'Dispositivos', Icon: Cpu },
  { id: 'settings', label: 'Configurações', Icon: Settings },
]
const demoLoginEnabled = import.meta.env.DEV

function AuthPage({ onLogin, busy, authError, clearError }) {
  const [mode, setMode] = useState('login')
  const [demoBusy, setDemoBusy] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmationVisible, setConfirmationVisible] = useState(false)
  async function submit(event) {
    event.preventDefault()
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    if (mode === 'register' && fields.password !== fields.password_confirmation) {
      clearError('As senhas não coincidem.')
      return
    }
    delete fields.password_confirmation
    await onLogin(mode, fields)
  }
  async function enterDemo() {
    if (!demoLoginEnabled) return
    setDemoBusy(true)
    try { await onLogin('demo') }
    finally { setDemoBusy(false) }
  }
  return <main className="auth-page">
    <section className="auth-panel">
      <BrandMark className="auth-brand" />
      <div className="auth-copy">
        <h1>{mode === 'login' ? 'Acompanhe a casa com tranquilidade' : 'Crie seu acesso ao Senso'}</h1>
        <p>{mode === 'login' ? 'Informações simples sobre a rotina e os sensores da residência' : 'Configure o acompanhamento de uma residência'}</p>
      </div>
      <form className="auth-form" key={mode} onSubmit={submit}>
        {mode === 'register' && <label className="field"><span>Seu nome</span><input name="name" autoComplete="name" required minLength={2} placeholder="Como podemos chamar você?" /></label>}
        <label className="field"><span>E-mail</span><input name="email" type="email" autoComplete="email" required placeholder="voce@exemplo.com" /></label>
        <div className="field"><label htmlFor="password">Senha</label><div className="password-input-wrap"><input id="password" name="password" type={passwordVisible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 12 : 1} placeholder={mode === 'register' ? 'Mínimo de 12 caracteres' : 'Sua senha'} /><button type="button" className="password-toggle" onClick={() => setPasswordVisible((value) => !value)} aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={passwordVisible}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
        {mode === 'register' && <div className="field"><label htmlFor="password_confirmation">Confirmar senha</label><div className="password-input-wrap"><input id="password_confirmation" name="password_confirmation" type={confirmationVisible ? 'text' : 'password'} autoComplete="new-password" required minLength={12} placeholder="Digite a senha novamente" /><button type="button" className="password-toggle" onClick={() => setConfirmationVisible((value) => !value)} aria-label={confirmationVisible ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'} aria-pressed={confirmationVisible}>{confirmationVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>}
        {authError && <p className="form-message error" role="alert">{authError}</p>}
        <button className="button primary full" type="submit" disabled={busy || demoBusy}>{busy ? 'Conectando…' : mode === 'login' ? 'Entrar na minha conta' : 'Criar conta'}</button>
      </form>
      {mode === 'login' && demoLoginEnabled && <button className="demo-login-button" type="button" onClick={enterDemo} disabled={busy || demoBusy}><PlayCircle size={17} />{demoBusy ? 'Abrindo demonstração…' : 'Entrar na demonstração'}</button>}
      <p className="auth-switch">{mode === 'login' ? 'Primeiro acesso?' : 'Já possui uma conta?'} <button className="text-button" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setPasswordVisible(false); setConfirmationVisible(false); clearError('') }}>{mode === 'login' ? 'Criar conta' : 'Entrar'}</button></p>
    </section>
    <AuthHero />
  </main>
}

function EmergencyDialog({ criticalAlert, onClose, onOpenAlerts, onOpenContacts }) {
  const closeButton = useRef(null)
  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    closeButton.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
      previousFocus?.focus?.()
    }
  }, [])

  return <div className="emergency-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="emergency-dialog" role="dialog" aria-modal="true" aria-labelledby="emergency-title">
      <button ref={closeButton} type="button" className="icon-button emergency-close" onClick={onClose} aria-label="Fechar"><X size={19} /></button>
      <span className="emergency-dialog-icon"><PhoneCall size={21} /></span>
      <span className="eyebrow">ACESSO RÁPIDO</span>
      <h2 id="emergency-title">Precisa de ajuda?</h2>
      {criticalAlert ? <div className="emergency-current-alert"><b>Ocorrência crítica aberta</b><span>{criticalAlert.title}</span></div> : <p className="emergency-dialog-copy">Consulte as ocorrências da residência ou os contatos de confiança cadastrados.</p>}
      <p className="emergency-disclaimer">O Senso não realiza chamadas nem envia mensagens. Em uma emergência real, contate diretamente os serviços locais.</p>
      <div className="emergency-dialog-actions">
        <button className="button primary" onClick={onOpenAlerts}>Abrir alertas <ArrowRight size={16} /></button>
        <button className="button secondary" onClick={onOpenContacts}>Ver contatos de confiança</button>
      </div>
    </section>
  </div>
}

function NotificationBell({ alerts = [], alertCount, onOpenAlerts }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const count = alertCount ?? alerts.length

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function openAlertCenter() {
    setOpen(false)
    onOpenAlerts()
  }

  return <div className="notification-wrap" ref={rootRef}>
    <button ref={triggerRef} type="button" className={`icon-button notification-trigger${count ? ' has-alerts' : ''}`} onClick={() => setOpen((value) => !value)} aria-label={count ? `Notificações, ${count} ocorrências em aberto` : 'Notificações'} aria-haspopup="dialog" aria-expanded={open}>
      <Bell size={19} strokeWidth={1.8} />{count > 0 && <span className="notification-count">{count > 9 ? '9+' : count}</span>}
    </button>
    {open && <section className="notification-popover" role="dialog" aria-label="Notificações da residência">
      <header><span><small>RESIDÊNCIA</small><b>Notificações</b></span><span className="notification-total">{count} em aberto</span></header>
      {count ? <div className="notification-list">{alerts.slice(0, 4).map((alert) => <button type="button" className={`notification-item notification-${alert.severity}`} key={alert.id} onClick={openAlertCenter}>
        <span className="notification-item-dot" /><span><b>{alert.title}</b><small>{alert.room_name || 'Residência'} · {alert.severity === 'critico' ? 'Crítico' : alert.severity === 'atencao' ? 'Atenção' : 'Informativo'}</small></span><ArrowRight size={15} />
      </button>)}</div> : <div className="notification-empty"><span className="notification-empty-mark"><Bell size={16} /></span><b>Nenhuma ocorrência em aberto</b><small>Novos sinais que precisem de atenção aparecem aqui.</small></div>}
      <button type="button" className="notification-all" onClick={openAlertCenter}>Abrir central de alertas <ArrowRight size={15} /></button>
    </section>}
  </div>
}

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [page, setPage] = useState(() => {
    try { const saved = sessionStorage.getItem('senso_current_page'); return [...navItems.map(item => item.id), 'alerts', 'demo'].includes(saved) ? saved : 'overview' } catch { return 'overview' }
  })
  const [dashboard, setDashboard] = useState(null)
  const [history, setHistory] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [devices, setDevices] = useState([])
  const [residence, setResidence] = useState(null)
  const [settings, setSettings] = useState(null)
  const [contacts, setContacts] = useState([])
  const [simulation, setSimulation] = useState(null)
  const [historyFilters, setHistoryFilters] = useState({ days: 7, room_id: '', event_type: '' })
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [toast, setToast] = useState({ message: '', kind: 'success' })
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const seenAlertsRef = useRef(new Set())
  const alertsPrimedRef = useRef(false)
  const pollingRef = useRef(false)

  const notify = useCallback((message, kind = 'success') => setToast({ message, kind }), [])

  useEffect(() => { try { sessionStorage.setItem('senso_current_page', page) } catch { /* storage may be disabled */ } }, [page])

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true
    async function checkAgendaTimes() {
      try {
        const [medicationResult, appointmentResult] = await Promise.allSettled([medicationService.list(), appointmentService.list()])
        if (!active) return
        let medications = medicationResult.status === 'fulfilled' ? medicationResult.value.data : []
        let appointments = appointmentResult.status === 'fulfilled' ? appointmentResult.value.data : []
        if (user.is_demo && medicationResult.status === 'rejected') {
          try { medications = JSON.parse(localStorage.getItem('senso-demo-agenda-medicamentos') || '[]') } catch { medications = [] }
        }
        if (user.is_demo && appointmentResult.status === 'rejected') {
          try { appointments = JSON.parse(localStorage.getItem('senso-demo-agenda-consultas') || '[]') } catch { appointments = [] }
        }
        const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
        const part = key => parts.find(value => value.type === key)?.value
        const day = `${part('year')}-${part('month')}-${part('day')}`
        const minute = Number(part('hour')) * 60 + Number(part('minute'))
        for (const item of medications) {
          const [hour, minutes] = item.time_of_day.split(':').map(Number)
          const elapsed = minute - (hour * 60 + minutes)
          const key = `senso_med_notice_${user.id}_${item.id}_${day}`
          let seen = false
          try { seen = sessionStorage.getItem(key) === '1' } catch { /* optional */ }
          if (elapsed >= 0 && elapsed < 5 && !seen && isScheduled(item, day) && !(item.confirmations || []).some(entry => entry.date === day)) {
            try { sessionStorage.setItem(key, '1') } catch { /* optional */ }
            notify(`Horário de ${item.name} às ${item.time_of_day}.`)
            return
          }
        }
        for (const item of appointments) {
          const [hour, minutes] = item.time_of_day.split(':').map(Number)
          const elapsed = minute - (hour * 60 + minutes)
          const key = `senso_appointment_notice_${user.id}_${item.id}_${day}`
          let seen = false
          try { seen = sessionStorage.getItem(key) === '1' } catch { /* optional */ }
          if (item.scheduled_date === day && elapsed >= 0 && elapsed < 5 && !seen) {
            try { sessionStorage.setItem(key, '1') } catch { /* optional */ }
            notify(`Lembrete: ${item.title} às ${item.time_of_day}.`)
            return
          }
        }
      } catch { /* schedule is unavailable until the API and migration are ready */ }
    }
    checkAgendaTimes()
    const timer = window.setInterval(checkAgendaTimes, 60000)
    return () => { active = false; window.clearInterval(timer) }
  }, [user?.id, user?.email, notify])

  const refresh = useCallback(async (quiet = false) => {
    if (!user?.id || pollingRef.current) return
    pollingRef.current = true
    if (!quiet) setLoading(true)
    try {
      const params = { days: page === 'overview' ? 7 : historyFilters.days }
      if (page === 'routine' && historyFilters.room_id) params.room_id = Number(historyFilters.room_id)
      if (page === 'routine' && historyFilters.event_type) params.event_type = historyFilters.event_type
      const wantsHistory = page === 'overview' || page === 'routine' || page === 'demo'
      const wantsAlerts = page === 'alerts'
      const wantsSettings = page === 'settings'
      const [dashboardResult, historyResult, alertResult, settingsResult, contactResult] = await Promise.all([
        monitoringService.dashboard(),
        wantsHistory ? monitoringService.history(params) : Promise.resolve(null),
        wantsAlerts ? monitoringService.alerts({ status: 'todos' }) : Promise.resolve(null),
        wantsSettings ? monitoringService.settings() : Promise.resolve(null),
        wantsSettings ? monitoringService.contacts() : Promise.resolve(null),
      ])
      setDashboard(dashboardResult.data)
      if (dashboardResult.data.user?.id === user.id && dashboardResult.data.user.name !== user.name) setUser(dashboardResult.data.user)
      setDevices(dashboardResult.data.devices || [])
      setResidence(dashboardResult.data.residence)
      if (historyResult) setHistory(historyResult.data)
      if (alertResult) setAlerts(alertResult.data)
      else setAlerts(dashboardResult.data.active_alerts || [])
      if (settingsResult) setSettings(settingsResult.data)
      if (contactResult) setContacts(contactResult.data)
      setLoadError('')
      const currentAlerts = dashboardResult.data.active_alerts || []
      if (!alertsPrimedRef.current) {
        currentAlerts.forEach((alert) => seenAlertsRef.current.add(alert.id))
        alertsPrimedRef.current = true
      } else {
        const unseen = currentAlerts.find((alert) => !seenAlertsRef.current.has(alert.id))
        currentAlerts.forEach((alert) => seenAlertsRef.current.add(alert.id))
        if (unseen) {
          const preferences = dashboardResult.data.settings || {}
          const notificationsEnabled = unseen.severity === 'critico' ? preferences.notify_critical !== false : unseen.severity === 'atencao' ? preferences.notify_attention !== false : true
          if (notificationsEnabled) notify(unseen.title, unseen.severity === 'critico' ? 'error' : 'success')
        }
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        setUser(null)
        setDashboard(null)
      } else setLoadError(errorMessage(error))
    } finally {
      pollingRef.current = false
      setLoading(false)
    }
  }, [user?.id, user?.name, page, historyFilters, notify])

  useEffect(() => {
    authService.session().then(({ data }) => { if (data.authenticated) setUser(data.user) })
      .catch(() => setAuthError('Não foi possível conectar ao Senso. Tente novamente em instantes.'))
      .finally(() => setAuthReady(true))
  }, [])

  useEffect(() => {
    if (!user?.id) return undefined
    refresh()
    const timer = window.setInterval(() => { if (!document.hidden) refresh(true) }, 5000)
    return () => window.clearInterval(timer)
  }, [user?.id, refresh])

  useEffect(() => {
    if (!user?.id) return undefined
    let live = true
    let timer
    let previous = ''
    let inFlight = false
    let running = false
    async function pollScenario() {
      if (!live || inFlight) return
      inFlight = true
      try {
        const { data } = await simulationService.state()
        if (!live) return
        running = data.status === 'rodando'
        const signature = `${data.scenario}:${data.status}:${data.step}`
        setSimulation(data)
        if (signature !== previous) {
          previous = signature
          if (data.step > 0 || data.status === 'concluido') refresh(true)
        }
      } catch { /* the next poll will retry without blocking the dashboard */ }
      finally {
        inFlight = false
        if (live) timer = window.setTimeout(pollScenario, document.hidden ? 15000 : page === 'demo' && running ? 400 : 1800)
      }
    }
    function resumeScenarioPolling() {
      if (!document.hidden) {
        window.clearTimeout(timer)
        pollScenario()
      }
    }
    document.addEventListener('visibilitychange', resumeScenarioPolling)
    pollScenario()
    return () => { live = false; window.clearTimeout(timer); document.removeEventListener('visibilitychange', resumeScenarioPolling) }
  }, [user?.id, refresh])

  useEffect(() => { setSelectedRoom(null) }, [page])

  async function authenticate(mode, data) {
    setAuthBusy(true)
    setAuthError('')
    try {
      const { data: account } = mode === 'demo' ? await authService.demo() : mode === 'login' ? await authService.login(data) : await authService.register(data)
      const { data: session } = await authService.session()
      if (!session.authenticated || session.user?.id !== account.id) {
        setAuthError('Não foi possível iniciar sua sessão. Tente novamente em instantes.')
        return
      }
      setUser(account)
      seenAlertsRef.current.clear()
      alertsPrimedRef.current = false
      setPage('overview')
      notify(mode === 'login' ? 'Sessão iniciada.' : 'Conta criada. A residência está pronta para configurar.')
    } catch (error) { setAuthError(errorMessage(error)) }
    finally { setAuthBusy(false) }
  }

  async function signOut() {
    try { await authService.logout() } catch { /* local session is cleared either way */ }
    setUser(null)
    setDashboard(null)
    setHistory(null)
    seenAlertsRef.current.clear()
    alertsPrimedRef.current = false
  }

  async function perform(action, successMessage, ...args) {
    try {
      const result = await action(...args)
      if (result?.data?.scenario) setSimulation(result.data)
      if (result?.data?.email && result?.data?.id) setUser(result.data)
      await refresh(true)
      if (successMessage) notify(successMessage)
      return result?.data
    } catch (error) {
      notify(errorMessage(error), 'error')
      throw error
    }
  }

  function navigate(next) {
    setPage(next)
    setMobileMenuOpen(false)
  }

  if (!authReady) return <div className="loading-screen"><span className="spinner" />Conectando ao Sistema Senso…</div>
  if (!user) return <><AuthPage onLogin={authenticate} busy={authBusy} authError={authError} clearError={setAuthError} /><div className="auth-toast-anchor"><Toast message={toast.message} kind={toast.kind} onDismiss={() => setToast({ message: '', kind: 'success' })} /></div></>

  const current = navItems.find((item) => item.id === page) || (page === 'alerts' ? { label: 'Alertas' } : page === 'demo' ? { label: 'Modo demonstração' } : navItems[0])
  const criticalAlert = dashboard?.active_alerts?.find((alert) => alert.severity === 'critico')
  const resident = dashboard?.residence
  const residentAvatar = resident?.resident_gender === 'masculino'
    ? '/images/senso-avatar-masculino.webp'
    : '/images/senso-avatar-feminino.webp'
  const pageProps = { dashboard, history, alerts, devices, residence, settings, contacts, simulation, loading, loadError, historyFilters, setHistoryFilters, selectedRoom, setSelectedRoom, notify, refresh: () => refresh(true), perform }
  const view = {
    overview: <OverviewPage {...pageProps} onNavigate={navigate} />,
    residence: <ResidencePage {...pageProps} />,
    routine: <RoutinePage {...pageProps} />,
    medications: <MedicationPage notify={notify} demoAccount={user?.is_demo === true} />,
    alerts: <AlertsPage {...pageProps} />,
    devices: <DevicesPage {...pageProps} />,
    settings: <SettingsPage {...pageProps} />,
    demo: <SimulatorPage {...pageProps} />,
  }[page]

  return <div className="app-shell">
    <aside className={`sidebar${mobileMenuOpen ? ' is-open' : ''}`}>
      <div className="sidebar-brand-row"><BrandMark /><button className="icon-button close-mobile" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar navegação"><X size={19} /></button></div>
      <div className="residence-switch-card"><img className="residence-avatar" src={residentAvatar} alt="" /><span className="residence-switch-copy"><small>ACOMPANHANDO</small><b>{resident?.name || 'Residência'}</b><span>{resident?.resident_name || 'Morador'}</span></span></div>
      <nav className="side-nav" aria-label="Navegação principal">
        <span className="nav-section-label">MONITORAMENTO</span>
        {navItems.map(({ id, label, Icon }) => <button key={id} className={`nav-item${page === id ? ' is-active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></button>)}
      </nav>
      <div className="sidebar-bottom">
        <button className={`nav-item simulator-nav${page === 'demo' ? ' is-active' : ''}`} onClick={() => navigate('demo')}><PlayCircle size={18} strokeWidth={1.8} /><span>Modo demonstração</span></button>
        <div className="sidebar-account"><span className="account-avatar">{user.name?.slice(0, 1).toUpperCase()}</span><span className="account-copy"><b>{user.name}</b><small>Responsável</small></span><button className="icon-button sign-out" onClick={signOut} aria-label="Sair da conta" title="Sair"><LogOut size={17} /></button></div>
      </div>
    </aside>
    {mobileMenuOpen && <button className="mobile-scrim" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu" />}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button menu-trigger" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir navegação"><Menu size={20} /></button>
        <div className="topbar-title"><span>{dashboard?.residence?.name?.toUpperCase() || 'RESIDÊNCIA'}</span><h1>{current.label}</h1></div>
        <div className="topbar-actions"><button type="button" className="emergency-button" onClick={() => setEmergencyOpen(true)} aria-haspopup="dialog" aria-expanded={emergencyOpen} aria-label="Abrir acesso de emergência"><PhoneCall size={15} /><span className="emergency-label">Emergência</span><span className="emergency-mobile-label">SOS</span></button><NotificationBell alerts={dashboard?.active_alerts || []} alertCount={dashboard?.metrics?.active_alerts || 0} onOpenAlerts={() => navigate('alerts')} /></div>
      </header>
      <div className="content-area" key={page}>
        <div className="toast-anchor"><Toast message={toast.message} kind={toast.kind} onDismiss={() => setToast({ message: '', kind: 'success' })} /></div>
        {loadError && <div className="api-alert" role="alert">{loadError}<button className="text-button" onClick={() => refresh()}>Tentar novamente</button></div>}
        {view}
      </div>
    </main>
    {emergencyOpen && <EmergencyDialog criticalAlert={criticalAlert} onClose={() => setEmergencyOpen(false)} onOpenAlerts={() => { setEmergencyOpen(false); navigate('alerts') }} onOpenContacts={() => { setEmergencyOpen(false); navigate('settings') }} />}
  </div>
}

export default App
