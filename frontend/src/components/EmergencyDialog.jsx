import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, Pencil, PhoneCall, UserRound, X } from 'lucide-react'
import { monitoringService } from '../services/senso'

const reasons = ['Possível queda', 'Mal-estar', 'Dificuldade para respirar', 'Outra situação', 'Não sei informar']

export default function EmergencyDialog({ criticalAlert, residence, onClose }) {
  const [step, setStep] = useState('intro')
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [contacts, setContacts] = useState([])
  const [contactsStatus, setContactsStatus] = useState('loading')
  const [editing, setEditing] = useState(false)
  const [residentName, setResidentName] = useState(residence?.resident_name || '')
  const [location, setLocation] = useState([residence?.address, residence?.city, residence?.state].filter(Boolean).join(' · '))
  const [contactOverride, setContactOverride] = useState(null)
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const hasOpened = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    let active = true
    monitoringService.contacts().then(({ data }) => {
      if (active) { setContacts(data); setContactsStatus('ready') }
    }).catch(() => { if (active) setContactsStatus('error') })
    return () => { active = false }
  }, [])

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (hasOpened.current) dialog.querySelector('#emergency-title')?.focus({ preventScroll: true })
    dialog.scrollTo({ top: 0, behavior: 'instant' })
    hasOpened.current = true
  }, [step, editing])

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]') || [])]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKey)
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
      previousFocus?.focus?.()
    }
  }, [])

  const contactText = contactOverride === null ? (contactsStatus === 'loading' ? 'Carregando contatos…' : contactsStatus === 'error' ? 'Não foi possível carregar os contatos.' : contacts.length ? contacts.map((contact) => contact.name).join(', ') : 'Nenhum contato cadastrado') : (contactOverride || 'Nenhum contato informado')

  function saveEdits(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setReason(values.get('reason'))
    setDetails(values.get('details').trim())
    setResidentName(values.get('residentName').trim())
    setLocation(values.get('location').trim())
    setContactOverride(values.get('contacts').trim())
    setEditing(false)
  }

  return <div className="emergency-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="emergency-dialog emergency-flow" role="dialog" aria-modal="true" aria-labelledby="emergency-title">
      <button ref={closeRef} type="button" className="icon-button emergency-close" onClick={onClose} aria-label="Fechar"><X size={19} /></button>
      <span className={`emergency-dialog-icon${step === 'done' ? ' is-success' : ''}`}>{step === 'done' ? <CheckCircle2 size={23} /> : <PhoneCall size={21} />}</span>
      {step === 'intro' && <>
        <span className="eyebrow">ACESSO RÁPIDO</span>
        <h2 id="emergency-title" tabIndex={-1}>Precisa de ajuda?</h2>
        <p className="emergency-dialog-copy">Informe o que está acontecendo e confira os dados de {residence?.resident_name || 'quem você acompanha'}.</p>
        {criticalAlert && <div className="emergency-current-alert"><b>Ocorrência crítica em aberto</b><span>{criticalAlert.title}</span></div>}
        <div className="emergency-dialog-actions"><button type="button" className="button primary" onClick={() => setStep('reason')}>Acionar emergência <ArrowRight size={16} /></button><button type="button" className="button secondary" onClick={onClose}>Cancelar</button></div>
      </>}
      {step === 'reason' && <>
        <span className="eyebrow">EMERGÊNCIA · 1 DE 2</span>
        <h2 id="emergency-title" tabIndex={-1}>O que está acontecendo?</h2>
        <p className="emergency-dialog-copy">Selecione a situação que melhor descreve sua preocupação.</p>
        <form className="emergency-form" onSubmit={(event) => { event.preventDefault(); if (reason) setStep('review') }}>
          <fieldset className="emergency-reasons"><legend>Queixa ou suspeita</legend>{reasons.map((item) => <label className={`emergency-reason${reason === item ? ' is-selected' : ''}`} key={item}><input type="radio" name="emergency-reason" value={item} checked={reason === item} onChange={() => setReason(item)} required /><span>{item}</span></label>)}</fieldset>
          <label className="field"><span>Conte mais <small>(opcional)</small></span><textarea rows={3} maxLength={500} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Descreva o que você observou" /></label>
          <div className="emergency-dialog-actions"><button className="button primary" type="submit">Continuar <ArrowRight size={16} /></button><button type="button" className="button secondary" onClick={() => setStep('intro')}><ArrowLeft size={15} /> Voltar</button></div>
        </form>
      </>}
      {step === 'review' && <>
        <span className="eyebrow">EMERGÊNCIA · 2 DE 2</span>
        <h2 id="emergency-title" tabIndex={-1}>Confira as informações</h2>
        <p className="emergency-dialog-copy">Revise os dados antes de concluir.</p>
        {!editing ? <>
        <div className="emergency-summary-heading"><span>INFORMAÇÕES DO ATENDIMENTO</span><button type="button" className="emergency-edit-button" aria-label="Editar informações do atendimento" onClick={() => setEditing(true)}><Pencil size={16} /><span>Editar</span></button></div>
        <div className="emergency-summary">
          <div><span>QUEIXA OU SUSPEITA</span><b>{reason}</b>{details.trim() && <p>{details.trim()}</p>}</div>
          <div><span>PESSOA ACOMPANHADA</span><b><UserRound size={15} />{residentName || 'Não informada'}</b></div>
          <div><span>BAIRRO OU REFERÊNCIA</span><b><MapPin size={15} />{location || 'Não informado'}</b><small>O endereço completo deve ser informado ao serviço de emergência.</small></div>
          <div><span>CONTATOS DE CONFIANÇA</span><b>{contactText}</b></div>
        </div>
        <p className="emergency-service-note">Estas informações não são enviadas automaticamente. Para obter atendimento, entre em contato com o serviço de emergência.</p>
        <div className="emergency-dialog-actions"><button type="button" className="button primary" onClick={() => setStep('done')}>Preparar resumo <ArrowRight size={16} /></button><button type="button" className="button secondary" onClick={() => setStep('reason')}><ArrowLeft size={15} /> Voltar</button></div>
        </> : <form className="emergency-form" onSubmit={saveEdits}>
          <p className="emergency-edit-hint">As alterações valem apenas para este resumo.</p>
          <label className="field"><span>Queixa ou suspeita</span><select name="reason" defaultValue={reason}>{reasons.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="field"><span>Detalhes <small>(opcional)</small></span><textarea name="details" rows={2} maxLength={500} defaultValue={details} /></label>
          <label className="field"><span>Pessoa acompanhada</span><input name="residentName" maxLength={120} defaultValue={residentName} /></label>
          <label className="field"><span>Bairro ou referência</span><input name="location" maxLength={300} defaultValue={location} /></label>
          <label className="field"><span>Contatos de confiança</span><input name="contacts" maxLength={500} defaultValue={contactsStatus === 'ready' ? (contactOverride ?? contacts.map((contact) => contact.name).join(', ')) : (contactOverride ?? '')} /></label>
          <div className="emergency-dialog-actions"><button type="submit" className="button primary">Salvar alterações</button><button type="button" className="button secondary" onClick={() => setEditing(false)}>Cancelar</button></div>
        </form>}
      </>}
      {step === 'done' && <>
        <span className="eyebrow">RESUMO DE EMERGÊNCIA</span>
        <h2 id="emergency-title" tabIndex={-1}>Informações preparadas com sucesso</h2>
        <p className="emergency-dialog-copy">Confira abaixo os dados de {residentName || 'quem você acompanha'}.</p>
        <div className="emergency-confirmation" role="status"><CheckCircle2 size={17} /><span>Resumo pronto para consulta.</span></div>
        <div className="emergency-summary"><div><span>QUEIXA OU SUSPEITA</span><b><CheckCircle2 size={15} />{reason}</b>{details.trim() && <p>{details.trim()}</p>}</div><div><span>BAIRRO OU REFERÊNCIA</span><b><MapPin size={15} />{location || 'Não informado'}</b></div><div><span>CONTATOS DE CONFIANÇA</span><b>{contactText}</b></div></div>
        <p className="emergency-service-note">Nenhum serviço foi acionado. Em uma emergência real, entre em contato diretamente com o serviço local.</p>
        <div className="emergency-dialog-actions"><button type="button" className="button primary" onClick={onClose}>Concluir</button><button type="button" className="button secondary" onClick={() => setStep('review')}><ArrowLeft size={15} /> Voltar</button></div>
      </>}
    </section>
  </div>
}
