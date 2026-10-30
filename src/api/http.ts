import { ApiError } from './types.ts'
import type { Execution, Health, LogEntry, Model, Report, Scenario, StartRunRequest, StartRunResponse } from './types.ts'

const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, init)
  } catch {
    throw new ApiError(0, `백엔드에 연결할 수 없습니다: ${path}`)
  }
  if (!res.ok) throw new ApiError(res.status, `API 오류 ${res.status}: ${path}`)
  return res.json()
}

// TODO: 백엔드 완성 후 실제 서버로 응답 필드를 검증한다. 아직 호출해 본 적이 없다.
export const fetchHealth = () => request<Health>('/health')
export const fetchModels = () => request<Model[]>('/models')
export const fetchScenarios = () => request<Scenario[]>('/scenarios')
export const fetchStatus = (id: string) => request<Execution>(`/executions/${id}`)
export const fetchLogs = (id: string) => request<LogEntry[]>(`/executions/${id}/logs`)
export const fetchReport = (id: string) => request<Report>(`/executions/${id}/report`)
export const cancelRun = (id: string) => request<Execution>(`/executions/${id}/cancel`, { method: 'POST' })
export const startRun = (body: StartRunRequest) =>
  request<StartRunResponse>('/executions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
