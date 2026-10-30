import { ApiError } from './types.ts'
import type { Evidence, Execution, Finding, Health, LogEntry, Model, Report, Scenario, StartRunRequest, StartRunResponse, RunStatus } from './types.ts'
import { connection } from './connection.ts'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { base, token } = connection()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try { response = await fetch(base.replace(/\/$/, '') + path, { ...init, headers }) }
  catch { throw new ApiError(0, '백엔드에 연결할 수 없습니다. 연결 주소를 확인하세요.') }
  if (!response.ok) {
    const message = response.status === 401 ? '접근 토큰을 입력하거나 확인하세요.' : `API 오류 ${response.status}: ${path}`
    throw new ApiError(response.status, message)
  }
  return response.json()
}

interface BackendModel extends Model { mode: 'mock' | 'live'; configured: boolean }
interface BackendScenario {
  id: string; name: string; service: string; description: string; accounts: string[]
  environments: string[]; environment_versions: Record<string, string>; allowed_paths: string[]
  targets?: { id: string; allowed_paths: string[] }[]
}
interface BackendAgent {
  id: string; model: string; model_name: string; role: string; prompt_version: string; status: RunStatus
  phase: string; progress: number; token_usage: number | null; estimated_cost: number | null
  duration: number | null; error: string | null
}
interface BackendExecution {
  id: string; status: RunStatus; is_mock: boolean; scenario_name: string; created_at: string
  ended_at: string | null; error: string | null; agents: BackendAgent[]
  config: { scenario: string; environment: string; collaboration: 'independent' }
}
interface BackendEvent {
  sequence: number; timestamp: string; agent_run_id: string | null
  level: LogEntry['level']; message: string; type: string
}

type BackendFinding = Finding & { agent_run_ids: string[] }
type BackendEvidence = Partial<Evidence> & {
  id: string; created_at?: string
  observation?: { request?: unknown; status_code?: number; body?: unknown }
}
type BackendReport = Omit<Report, 'findings' | 'evidence'> & { findings: BackendFinding[]; evidence: BackendEvidence[] }

const ENVIRONMENTS: Record<string, string> = { vulnerable: '취약 환경', fixed: '수정 환경' }
const environmentLabel = (value: string) => ENVIRONMENTS[value] ?? value
const asText = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2))

// 숫자는 그대로 두고, 화면이 기대하는 모양으로만 바꾼다.
function report(value: BackendReport): Report {
  return {
    ...value,
    settings: { ...value.settings, environment: environmentLabel(value.settings.environment) },
    // 백엔드의 found_by는 모델 이름이므로 에이전트 ID 목록을 쓴다.
    findings: value.findings.map((finding) => ({ ...finding, found_by: finding.agent_run_ids })),
    evidence: value.evidence.map((item) => ({
      id: item.id,
      attempt_id: item.attempt_id ?? '',
      captured_at: item.captured_at ?? item.created_at ?? '',
      request: item.request ?? asText(item.observation?.request),
      response: item.response ?? `HTTP ${item.observation?.status_code ?? '응답 없음'}\n\n${asText(item.observation?.body)}`,
    })),
  }
}

function execution(value: BackendExecution): Execution {
  return {
    execution_id: value.id, status: value.status, is_mock: value.is_mock,
    scenario_id: value.config.scenario, scenario_name: value.scenario_name,
    environment: environmentLabel(value.config.environment), collaboration_mode: value.config.collaboration,
    created_at: value.created_at, finished_at: value.ended_at, error: value.error,
    agents: value.agents.map((agent) => ({
      agent_id: agent.id, model_id: agent.model, model_name: agent.model_name || agent.model,
      role: agent.role, prompt_version: agent.prompt_version, status: agent.status,
      phase: agent.phase, progress: agent.progress, tokens: agent.token_usage,
      cost_usd: agent.estimated_cost, duration_ms: agent.duration === null ? null : agent.duration * 1000,
      error: agent.error,
    })),
  }
}

const selectedScenarios = new Map<string, { scenario: string; environment: string; target_id?: string }>()
const logs = new Map<string, { cursor: number; entries: LogEntry[] }>()

export const fetchHealth = () => request<Health>('/health')
export const fetchModels = async (): Promise<Model[]> => (await request<BackendModel[]>('/models')).filter((m) => m.mode === connection().mode)
export const fetchScenarios = async (): Promise<Scenario[]> => {
  const result: Scenario[] = []
  selectedScenarios.clear()
  for (const scenario of await request<BackendScenario[]>('/scenarios')) {
    const targets = scenario.id === 'web-access-v1' ? scenario.targets ?? [] : [undefined]
    for (const target of targets) for (const environment of scenario.environments) {
      const id = `${scenario.id}:${environment}${target ? ':' + target.id : ''}`
      selectedScenarios.set(id, { scenario: scenario.id, environment, ...(target ? { target_id: target.id } : {}) })
      result.push({ id, name: scenario.name + (target ? ' · ' + target.id : ''), service: scenario.service,
        environment: environmentLabel(environment), version: scenario.environment_versions[environment], description: scenario.description,
        actors: scenario.accounts, allowed_paths: target?.allowed_paths ?? scenario.allowed_paths })
    }
  }
  return result
}
export const fetchStatus = async (id: string) => execution(await request<BackendExecution>(`/executions/${encodeURIComponent(id)}`))
export const fetchExecutions = async (): Promise<Execution[]> =>
  (await request<{ executions: BackendExecution[] }>('/executions?limit=100')).executions.map(execution)
export const fetchLogs = async (id: string): Promise<LogEntry[]> => {
  const page = logs.get(id) ?? { cursor: 0, entries: [] }
  let count: number
  do {
    const result = await request<{ events: BackendEvent[]; next_after: number }>(`/executions/${encodeURIComponent(id)}/logs?after=${page.cursor}&limit=500`)
    count = result.events.length
    if (result.next_after <= page.cursor) break
    page.entries.push(...result.events.map((event) => ({ id: String(event.sequence), timestamp: event.timestamp,
      agent_id: event.agent_run_id, level: event.level ?? 'info', message: event.message ?? event.type })))
    page.cursor = result.next_after
  } while (count === 500)
  logs.set(id, page)
  return [...page.entries]
}
export const fetchReport = async (id: string) => report(await request<BackendReport>(`/executions/${encodeURIComponent(id)}/report`))
export const cancelRun = async (id: string) => execution(await request<BackendExecution>(`/executions/${encodeURIComponent(id)}/cancel`, { method: 'POST' }))
export const startRun = async (body: StartRunRequest) => {
  if (!selectedScenarios.has(body.scenario_id)) await fetchScenarios()
  const scope = selectedScenarios.get(body.scenario_id)
  if (!scope) throw new ApiError(422, '등록된 시나리오를 선택하세요.')
  return request<StartRunResponse>('/executions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...scope, mode: connection().mode, collaboration: body.collaboration_mode,
      agents: body.agents.map((a) => ({ model: a.model_id, role: a.role, prompt_version: a.prompt_version })),
      budget: { seconds: 180, tokens: 300000, max_output_tokens: 4000 } }),
  })
}
