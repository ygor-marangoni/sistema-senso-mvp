export function elapsedSince(value, reference = Date.now()) {
  if (!value) return 'sem registro recente'
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return 'horário indisponível'
  const minutes = Math.max(0, Math.floor((reference - time) / 60000))
  if (minutes < 1) return 'agora mesmo'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  return `há ${Math.floor(hours / 24)} dias`
}

export function formatNumber(value, maximumFractionDigits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits })
}

export function activeAlertCount(alerts = []) {
  return alerts.filter((alert) => alert.status !== 'resolvido').length
}
