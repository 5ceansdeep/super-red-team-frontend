const KEYS = { base: 'red-team:backend-url', token: 'red-team:backend-token', mode: 'red-team:execution-mode' }

function saved(key: string): string | null {
  try { return sessionStorage.getItem(key) } catch { return null }
}

export function connection() {
  return {
    base: saved(KEYS.base) ?? import.meta.env.VITE_API_BASE_URL ?? '/api',
    token: saved(KEYS.token) ?? '',
    mode: saved(KEYS.mode) ?? import.meta.env.VITE_EXECUTION_MODE ?? 'mock',
  }
}

export function saveConnection(base: string, token: string, mode: string) {
  if (base !== '/api') {
    const url = new URL(base)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw new Error('백엔드 URL을 확인하세요.')
  }
  sessionStorage.setItem(KEYS.base, base.replace(/\/$/, ''))
  sessionStorage.setItem(KEYS.token, token.trim())
  sessionStorage.setItem(KEYS.mode, mode)
}
