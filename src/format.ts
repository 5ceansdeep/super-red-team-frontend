const NA = '측정 불가'

const orNA = <T,>(format: (value: T) => string) => (value: T | null | undefined) =>
  value === null || value === undefined ? NA : format(value)

export const usd = orNA((value: number) => `$${value.toFixed(3)}`)
export const price = orNA((value: number) => `$${value.toFixed(2)}`)
export const count = orNA((value: number) => value.toLocaleString('ko-KR'))
export const percent = orNA((value: number) => `${Math.round(value * 100)}%`)
export const score = orNA((value: number) => value.toFixed(2))
export const cvss = orNA((value: number) => value.toFixed(1))
export const duration = orNA((ms: number) => {
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  return minutes ? `${minutes}분 ${total % 60}초` : `${total}초`
})

export const dateTime = (value: string) =>
  new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export const clock = (value: string) => new Date(value).toTimeString().slice(0, 8)

export const isActive = (status: string) => status === 'pending' || status === 'running'
