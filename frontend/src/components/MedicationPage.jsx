import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock3, MapPin, Pencil, Pill, Plus, Stethoscope, Trash2, X } from 'lucide-react'
import { errorMessage } from '../api/client'
import { appointmentService, medicationService } from '../services/senso'

const weekLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const appointmentTypes = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'exame', label: 'Exame' },
  { value: 'retorno', label: 'Retorno' },
  { value: 'outro', label: 'Outro' },
]
const appointmentTypeLabel = Object.fromEntries(appointmentTypes.map(({ value, label }) => [value, label]))
const demoMedicationStorage = 'senso-demo-agenda-medicamentos'
const demoAppointmentStorage = 'senso-demo-agenda-consultas'
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const todayKey = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const fromKey = (key) => { const [year, month, day] = key.split('-').map(Number); return new Date(year, month - 1, day) }

function readLocalList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch { return [] }
}

function saveLocalList(key, items) {
  try { localStorage.setItem(key, JSON.stringify(items)); return true }
  catch { return false }
}

export function isScheduled(item, key) {
  const day = fromKey(key)
  return key >= item.start_date && (!item.end_date || key <= item.end_date) && item.weekdays.includes((day.getDay() + 6) % 7)
}

function previewSchedule(startDate) {
  return ['manhã', 'noite'].map((period, index) => ({
    id: `preview-${period}`,
    name: `Exemplo · ${period}`,
    dosage: 'Dose demonstrativa',
    instructions: '',
    time_of_day: index === 0 ? '08:00' : '20:00',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    start_date: startDate,
    end_date: null,
    confirmations: [],
    is_example: true,
  }))
}

function previewAppointment(startDate) {
  const date = fromKey(startDate)
  date.setDate(date.getDate() + 3)
  return {
    id: 'preview-consultation',
    title: 'Exemplo · consulta geriátrica',
    appointment_type: 'consulta',
    scheduled_date: dateKey(date),
    time_of_day: '10:30',
    professional: 'Profissional de saúde (exemplo)',
    location: 'Unidade de saúde (exemplo)',
    notes: 'Compromisso fictício para demonstração.',
    is_example: true,
  }
}

function ModalShell({ titleId, eyebrow, title, description, onClose, children, className = '' }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', closeOnEscape) }
  }, [onClose])
  return <div className="med-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className={`med-modal agenda-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="med-modal-header"><div><span className="eyebrow">{eyebrow}</span><h2 id={titleId}>{title}</h2><p>{description}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></header>
      {children}
    </section>
  </div>
}

function MedicationForm({ item, selected, onClose, onSave, demoLocal }) {
  const [weekdays, setWeekdays] = useState(item?.weekdays || [0, 1, 2, 3, 4, 5, 6])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(event) {
    event.preventDefault()
    if (!weekdays.length) { setError('Selecione ao menos um dia da semana.'); return }
    const data = Object.fromEntries(new FormData(event.currentTarget))
    data.weekdays = weekdays
    data.end_date = data.end_date || null
    setBusy(true); setError('')
    try { await onSave(item, data); onClose() }
    catch (requestError) { setError(requestError?.message || errorMessage(requestError)) }
    finally { setBusy(false) }
  }
  return <ModalShell titleId="agenda-med-form-title" eyebrow="AGENDA · MEDICAMENTO" title={item ? 'Editar medicamento' : 'Adicionar medicamento'} description="Organize os horários recebidos pela família ou pelo cuidador." onClose={onClose}>
    <form onSubmit={save} className="med-form">
      <label className="field med-form-full"><span>Nome do medicamento</span><input name="name" required maxLength={120} defaultValue={item?.name || ''} placeholder="Ex.: medicamento de uso diário" autoFocus /></label>
      <label className="field"><span>Dose ou quantidade</span><input name="dosage" maxLength={120} defaultValue={item?.dosage || ''} placeholder="Ex.: 1 comprimido" /></label>
      <label className="field"><span>Horário</span><input name="time_of_day" type="time" required defaultValue={item?.time_of_day || '08:00'} /></label>
      <fieldset className="med-weekdays med-form-full"><legend>Dias da semana</legend><div>{weekLabels.map((label, index) => <button type="button" key={label} className={weekdays.includes(index) ? 'is-selected' : ''} aria-pressed={weekdays.includes(index)} onClick={() => setWeekdays((days) => days.includes(index) ? days.filter((day) => day !== index) : [...days, index].sort())}>{label}</button>)}</div></fieldset>
      <label className="field"><span>Data de início</span><input name="start_date" type="date" required defaultValue={item?.start_date || selected} /></label>
      <label className="field"><span>Data final <small>(opcional)</small></span><input name="end_date" type="date" defaultValue={item?.end_date || ''} /></label>
      <label className="field med-form-full"><span>Observações <small>(opcional)</small></span><input name="instructions" maxLength={300} defaultValue={item?.instructions || ''} placeholder="Informação útil para quem acompanha" /></label>
      {demoLocal && <p className="form-hint med-form-full">Modo de demonstração: este item ficará salvo neste navegador.</p>}
      {error && <p className="form-message error med-form-full" role="alert">{error}</p>}
      <div className="med-form-actions med-form-full"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar medicamento'}</button></div>
    </form>
  </ModalShell>
}

function AppointmentForm({ item, selected, onClose, onSave, demoLocal }) {
  const [type, setType] = useState(item?.appointment_type || 'consulta')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    values.appointment_type = type
    values.scheduled_date = values.scheduled_date || selected
    setBusy(true); setError('')
    try { await onSave(item, values); onClose() }
    catch (requestError) { setError(requestError?.message || errorMessage(requestError)) }
    finally { setBusy(false) }
  }
  return <ModalShell titleId="agenda-appointment-form-title" eyebrow="AGENDA · COMPROMISSO" title={item ? 'Editar compromisso' : 'Adicionar consulta'} description="Registre o dia, o horário e o local para facilitar a lembrança." onClose={onClose} className="appointment-modal">
    <form onSubmit={save} className="med-form">
      <fieldset className="agenda-type-picker med-form-full"><legend>Tipo de compromisso</legend><div>{appointmentTypes.map((option) => <button type="button" key={option.value} className={type === option.value ? 'is-selected' : ''} aria-pressed={type === option.value} onClick={() => setType(option.value)}>{option.label}</button>)}</div></fieldset>
      <label className="field med-form-full"><span>Nome do compromisso</span><input name="title" required maxLength={120} defaultValue={item?.title?.replace(/^Exemplo · /, '') || ''} placeholder="Ex.: Consulta com geriatra" autoFocus /></label>
      <label className="field"><span>Data</span><input name="scheduled_date" type="date" required defaultValue={item?.scheduled_date || selected} /></label>
      <label className="field"><span>Horário</span><input name="time_of_day" type="time" required defaultValue={item?.time_of_day || '09:00'} /></label>
      <label className="field"><span>Profissional <small>(opcional)</small></span><input name="professional" maxLength={120} defaultValue={item?.professional || ''} placeholder="Nome do profissional" /></label>
      <label className="field"><span>Local <small>(opcional)</small></span><input name="location" maxLength={200} defaultValue={item?.location || ''} placeholder="Clínica, hospital ou endereço" /></label>
      <label className="field med-form-full"><span>Observações <small>(opcional)</small></span><input name="notes" maxLength={300} defaultValue={item?.notes || ''} placeholder="O que levar ou lembrar no dia" /></label>
      {demoLocal && <p className="form-hint med-form-full">Modo de demonstração: este compromisso ficará salvo neste navegador.</p>}
      {error && <p className="form-message error med-form-full" role="alert">{error}</p>}
      <div className="med-form-actions med-form-full"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar na agenda'}</button></div>
    </form>
  </ModalShell>
}

function DeleteDialog({ item, kind, onClose, onConfirm, busy }) {
  const appointment = kind === 'appointment'
  return <ModalShell titleId="agenda-delete-title" eyebrow="CONFIRMAR REMOÇÃO" title={`Remover ${appointment ? 'compromisso' : 'medicamento'}?`} description={appointment ? item.title : item.name} onClose={onClose} className="med-delete">
    <p>{appointment ? 'Este compromisso será removido da agenda.' : 'A programação e as confirmações deste medicamento serão removidas.'}</p>
    <div className="med-form-actions"><button className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button><button className="button danger" disabled={busy} onClick={onConfirm}>{busy ? 'Removendo…' : 'Remover'}</button></div>
  </ModalShell>
}

export default function MedicationPage({ notify, demoAccount = false }) {
  const [selected, setSelected] = useState(todayKey)
  const [month, setMonth] = useState(() => { const day = fromKey(todayKey()); return new Date(day.getFullYear(), day.getMonth(), 1) })
  const [medications, setMedications] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [medicationError, setMedicationError] = useState('')
  const [appointmentError, setAppointmentError] = useState('')
  const [medicationLocalOnly, setMedicationLocalOnly] = useState(false)
  const [appointmentLocalOnly, setAppointmentLocalOnly] = useState(false)
  const [form, setForm] = useState(null)
  const [pending, setPending] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [medicationResult, appointmentResult] = await Promise.allSettled([medicationService.list(), appointmentService.list()])
    if (medicationResult.status === 'fulfilled') {
      setMedications(medicationResult.value.data)
      setMedicationError('')
      setMedicationLocalOnly(false)
    } else if (demoAccount && medicationResult.reason?.response?.status === 404) {
      setMedications([...previewSchedule(todayKey()), ...readLocalList(demoMedicationStorage)])
      setMedicationError('')
      setMedicationLocalOnly(true)
    } else {
      setMedicationError('Não foi possível carregar os medicamentos agora.')
      setMedicationLocalOnly(false)
    }

    if (appointmentResult.status === 'fulfilled') {
      setAppointments(appointmentResult.value.data)
      setAppointmentError('')
      setAppointmentLocalOnly(false)
    } else if (demoAccount && appointmentResult.reason?.response?.status === 404) {
      setAppointments([previewAppointment(todayKey()), ...readLocalList(demoAppointmentStorage)])
      setAppointmentError('')
      setAppointmentLocalOnly(true)
    } else {
      setAppointmentError('Não foi possível carregar os compromissos agora.')
      setAppointmentLocalOnly(false)
    }
    setLoading(false)
  }, [demoAccount])

  useEffect(() => { load() }, [load])

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    const total = Math.ceil((offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7
    return Array.from({ length: total }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1))
  }, [month])
  const selectedLabel = fromKey(selected).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const monthTitle = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (letter) => letter.toUpperCase())
  const selectedMedications = medications.filter((item) => isScheduled(item, selected))
  const selectedAppointments = appointments.filter((item) => item.scheduled_date === selected)
  const selectedItems = [
    ...selectedMedications.map((item) => ({ ...item, agenda_kind: 'medication' })),
    ...selectedAppointments.map((item) => ({ ...item, agenda_kind: 'appointment' })),
  ].sort((left, right) => left.time_of_day.localeCompare(right.time_of_day))
  const localMode = medicationLocalOnly || appointmentLocalOnly

  function changeMonth(amount) { setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1)) }
  function selectToday() { const key = todayKey(); setSelected(key); const day = fromKey(key); setMonth(new Date(day.getFullYear(), day.getMonth(), 1)) }
  function selectDay(day) { const key = dateKey(day); setSelected(key); if (day.getMonth() !== month.getMonth()) setMonth(new Date(day.getFullYear(), day.getMonth(), 1)) }

  async function saveMedication(item, values) {
    if (medicationLocalOnly) {
      const localItems = readLocalList(demoMedicationStorage)
      const next = item?.id ? localItems.map((entry) => entry.id === item.id ? { ...entry, ...values } : entry) : [...localItems, { ...values, id: `local-med-${Date.now()}`, confirmations: [], is_example: false }]
      if (!saveLocalList(demoMedicationStorage, next)) throw new Error('Não foi possível salvar neste navegador.')
      notify('Medicamento adicionado à agenda demonstrativa.')
    } else {
      if (item?.id) await medicationService.update(item.id, values)
      else await medicationService.create(values)
      notify('Medicamento salvo na agenda.')
    }
    await load()
  }

  async function saveAppointment(item, values) {
    if (appointmentLocalOnly) {
      const localItems = readLocalList(demoAppointmentStorage)
      const next = item?.id ? localItems.map((entry) => entry.id === item.id ? { ...entry, ...values } : entry) : [...localItems, { ...values, id: `local-appointment-${Date.now()}`, is_example: false }]
      if (!saveLocalList(demoAppointmentStorage, next)) throw new Error('Não foi possível salvar neste navegador.')
      notify('Compromisso adicionado à agenda demonstrativa.')
    } else {
      if (item?.id) await appointmentService.update(item.id, values)
      else await appointmentService.create(values)
      notify('Compromisso salvo na agenda.')
    }
    await load()
  }

  async function confirmMedication(item, confirmed) {
    setPending(item.id)
    try {
      if (medicationLocalOnly && String(item.id).startsWith('local-med-')) {
        const localItems = readLocalList(demoMedicationStorage).map((entry) => {
          if (entry.id !== item.id) return entry
          const records = (entry.confirmations || []).filter((record) => record.date !== selected)
          if (!confirmed) records.push({ date: selected })
          return { ...entry, confirmations: records }
        })
        if (!saveLocalList(demoMedicationStorage, localItems)) throw new Error('Não foi possível atualizar neste navegador.')
      } else await medicationService.confirm(item.id, selected, !confirmed)
      await load()
      notify(!confirmed ? 'Dose registrada como confirmada.' : 'Confirmação desfeita.')
    } catch (requestError) { notify(requestError?.message || errorMessage(requestError), 'error') }
    finally { setPending(null) }
  }

  async function removeItem() {
    if (!deleting) return
    const { kind, item } = deleting
    setPending(item.id)
    try {
      if (kind === 'appointment' && appointmentLocalOnly && String(item.id).startsWith('local-appointment-')) {
        if (!saveLocalList(demoAppointmentStorage, readLocalList(demoAppointmentStorage).filter((entry) => entry.id !== item.id))) throw new Error('Não foi possível atualizar neste navegador.')
      } else if (kind === 'medication' && medicationLocalOnly && String(item.id).startsWith('local-med-')) {
        if (!saveLocalList(demoMedicationStorage, readLocalList(demoMedicationStorage).filter((entry) => entry.id !== item.id))) throw new Error('Não foi possível atualizar neste navegador.')
      } else if (kind === 'appointment') await appointmentService.remove(item.id)
      else await medicationService.remove(item.id)
      setDeleting(null)
      await load()
      notify(kind === 'appointment' ? 'Compromisso removido da agenda.' : 'Medicamento removido da agenda.')
    } catch (requestError) { notify(requestError?.message || errorMessage(requestError), 'error') }
    finally { setPending(null) }
  }

  return <div className="page-content agenda-page">
    <div className="page-heading agenda-page-heading"><div><span className="eyebrow">CUIDADO NO DIA A DIA</span><h2>Agenda</h2><p>Medicamentos e consultas organizados em um só lugar.</p></div><div className="agenda-heading-actions"><button className="button primary agenda-add-button" onClick={() => setForm({ kind: 'medication' })}><Plus size={18} /><Pill size={17} /> Medicamento</button><button className="button primary agenda-add-button" onClick={() => setForm({ kind: 'appointment' })}><Plus size={18} /><CalendarPlus size={17} /> Consulta</button></div></div>
    {localMode && <p className="med-preview-note" role="status">Exemplos fictícios para demonstração. Novos itens ficam salvos neste navegador.</p>}

    {(medicationError || appointmentError) && <p className="form-message error agenda-error" role="alert">{medicationError || appointmentError}</p>}
    <div className="med-layout agenda-layout">
      <section className="panel med-calendar">
        <div className="med-calendar-header"><div><span className="eyebrow">CALENDÁRIO</span><h3>{monthTitle}</h3><p>Selecione um dia para ver os itens programados</p></div><div className="med-month-controls"><button className="button secondary small" onClick={selectToday}>Hoje</button><button className="med-arrow" onClick={() => changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={18} /></button><button className="med-arrow" onClick={() => changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={18} /></button></div></div>
        <div className="med-week-head">{weekLabels.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="med-calendar-grid">{days.map((day) => {
          const key = dateKey(day)
          const meds = medications.filter((item) => isScheduled(item, key)).length
          const visits = appointments.filter((item) => item.scheduled_date === key).length
          const completed = medications.filter((item) => isScheduled(item, key) && item.confirmations?.some((record) => record.date === key)).length
          const itemCount = meds + visits
          const spoken = `${day.toLocaleDateString('pt-BR')}, ${meds} ${meds === 1 ? 'medicamento' : 'medicamentos'}, ${visits} ${visits === 1 ? 'consulta' : 'consultas'}, ${completed} doses confirmadas`
          return <button key={key} type="button" onClick={() => selectDay(day)} className={`med-day${day.getMonth() !== month.getMonth() ? ' outside' : ''}${key === todayKey() ? ' today' : ''}${key === selected ? ' selected' : ''}`} aria-label={spoken} aria-pressed={key === selected}>
            <span className="med-day-number">{day.getDate()}</span>{itemCount > 0 && <span className="agenda-day-markers" aria-hidden="true">{meds > 0 && <i className="medication" title={`${meds} medicamento(s)`} />}{visits > 0 && <i className="appointment" title={`${visits} consulta(s)`} />}</span>}
          </button>
        })}</div>
        <div className="med-legend agenda-legend"><span><i className="med-legend-today" />Hoje</span><span><i className="agenda-legend-medication" />Medicamento</span><span><i className="agenda-legend-appointment" />Consulta</span><span><i className="med-legend-selected" />Selecionado</span></div>
      </section>

      <aside className="panel med-day-panel agenda-day-panel">
        <div className="med-day-heading"><span className="eyebrow">COMPROMISSOS DO DIA</span><h3>{selected === todayKey() ? 'Hoje' : selectedLabel}</h3><p>{selectedItems.length} {selectedItems.length === 1 ? 'item programado' : 'itens programados'}</p></div>
        {loading ? <div className="med-empty"><span className="spinner" />Carregando agenda…</div> : selectedItems.length ? <div className="med-schedule">{selectedItems.map((item) => {
          const example = item.is_example || item.name?.startsWith('Exemplo ·') || item.title?.startsWith('Exemplo ·')
          const local = String(item.id).startsWith('local-')
          if (item.agenda_kind === 'appointment') return <article className="agenda-item agenda-appointment" key={`appointment-${item.id}`}>
            <div className="agenda-item-time"><CalendarDays size={15} />{item.time_of_day}</div>
            <div className="agenda-item-body"><div className="agenda-item-title"><h4>{item.title}</h4>{example && <span className="agenda-example-tag">EXEMPLO</span>}</div><p><Stethoscope size={14} />{appointmentTypeLabel[item.appointment_type] || 'Compromisso'}{item.professional ? ` · ${item.professional}` : ''}</p>{item.location && <p><MapPin size={14} />{item.location}</p>}{item.notes && <small>{item.notes}</small>}
              {!example && <div className="agenda-item-actions"><button className="text-link" onClick={() => setForm({ kind: 'appointment', item })}>Editar</button><button className="text-link danger-link" onClick={() => setDeleting({ kind: 'appointment', item })}>Remover</button>{local && <span>neste navegador</span>}</div>}
            </div>
          </article>
          const confirmed = item.confirmations?.some((record) => record.date === selected)
          return <article className="med-dose" key={`medication-${item.id}`}><div className="med-dose-time"><Clock3 size={15} />{item.time_of_day}</div><div className="med-dose-body"><div className="med-dose-title"><h4>{item.name}</h4>{example && <span>EXEMPLO</span>}</div>{item.dosage && <p>{item.dosage}</p>}{item.instructions && <small>{item.instructions}</small>}
            {!example && <div className="med-dose-actions"><button className={`med-confirm${confirmed ? ' is-confirmed' : ''}`} disabled={pending === item.id || selected > todayKey()} onClick={() => confirmMedication(item, confirmed)}><Check size={14} />{confirmed ? 'Confirmado' : 'Confirmar dose'}</button><button className="med-icon-button" onClick={() => setForm({ kind: 'medication', item })} aria-label={`Editar ${item.name}`}><Pencil size={15} /></button><button className="med-icon-button" onClick={() => setDeleting({ kind: 'medication', item })} aria-label={`Remover ${item.name}`}><Trash2 size={15} /></button>{local && <span className="agenda-local-tag">neste navegador</span>}</div>}
          </div></article>
        })}</div> : medicationError || appointmentError ? <div className="med-empty" role="alert"><span>Não foi possível mostrar todos os itens da agenda.</span><button className="text-link" onClick={load}>Tentar novamente</button></div> : <div className="med-empty"><span><CalendarDays size={21} /></span><b>Nenhum compromisso neste dia</b><p>Adicione um medicamento ou uma consulta para lembrar depois.</p><div className="agenda-empty-actions"><button className="button primary" onClick={() => setForm({ kind: 'medication' })}><Plus size={15} />Medicamento</button><button className="button secondary" onClick={() => setForm({ kind: 'appointment' })}><Plus size={15} />Consulta</button></div></div>}
      </aside>
    </div>

    {form?.kind === 'medication' && <MedicationForm key={form.item?.id || 'new-medication'} item={form.item || null} selected={selected} onClose={() => setForm(null)} onSave={saveMedication} demoLocal={medicationLocalOnly} />}
    {form?.kind === 'appointment' && <AppointmentForm key={form.item?.id || 'new-appointment'} item={form.item || null} selected={selected} onClose={() => setForm(null)} onSave={saveAppointment} demoLocal={appointmentLocalOnly} />}
    {deleting && <DeleteDialog item={deleting.item} kind={deleting.kind} busy={pending === deleting.item.id} onClose={() => setDeleting(null)} onConfirm={removeItem} />}
  </div>
}
