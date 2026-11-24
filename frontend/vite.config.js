import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = process.env.VITE_API_URL || env.VITE_API_URL

  if (mode === 'production') {
    if (!apiUrl) throw new Error('Defina VITE_API_URL com a origem HTTPS da API antes do build de produção.')
    let parsedApiUrl
    try { parsedApiUrl = new URL(apiUrl) }
    catch { throw new Error('VITE_API_URL precisa ser uma URL HTTPS válida no build de produção.') }
    if (parsedApiUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsedApiUrl.hostname) || parsedApiUrl.username || parsedApiUrl.password) {
      throw new Error('VITE_API_URL de produção precisa usar HTTPS e não pode apontar para localhost.')
    }
  }

  return {
    plugins: [react()],
    server: { host: '0.0.0.0', port: 5174, strictPort: true },
  }
})
