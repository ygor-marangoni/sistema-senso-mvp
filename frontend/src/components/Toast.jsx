import { useEffect, useRef } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

export default function Toast({ message, kind = 'success', onDismiss }) {
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss
  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => dismissRef.current(''), 3500)
    return () => window.clearTimeout(timer)
  }, [message, kind])

  if (!message) return null
  const Icon = kind === 'error' ? AlertCircle : CheckCircle2
  return <div className={`app-toast${kind === 'error' ? ' app-toast--error' : ''}`} role={kind === 'error' ? 'alert' : 'status'}>
    <Icon size={18} aria-hidden="true" />
    <span>{message}</span>
    <button type="button" onClick={() => onDismiss('')} aria-label="Fechar notificação"><X size={16} aria-hidden="true" /></button>
  </div>
}
