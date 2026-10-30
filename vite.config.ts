import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: { proxy: { '/api': {
      target: env.BACKEND_PROXY_URL || 'http://127.0.0.1:8000', changeOrigin: true,
      headers: env.BACKEND_PROXY_TOKEN ? { Authorization: `Bearer ${env.BACKEND_PROXY_TOKEN}` } : {},
      rewrite: (path: string) => path.replace(/^\/api/, ''),
    } } },
  }
})
