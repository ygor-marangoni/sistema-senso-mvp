import axios from 'axios'

const pageProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:'
const pageHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `${pageProtocol}//${pageHost}:8001`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

export function errorMessage(error) {
  const detail = error?.response?.data?.detail
  if (detail === 'Not Found' || detail === 'Internal Server Error') return 'Não foi possível concluir agora. Tente novamente em instantes.'
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((entry) => entry.msg).join('; ')
  return 'Não foi possível concluir. Verifique sua conexão e tente novamente.'
}
