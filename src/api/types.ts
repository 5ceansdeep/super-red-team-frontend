// 프론트와 백엔드의 데이터 계약.
// 경로는 확정이지만 응답 필드 상세는 프론트 제안안이다. TODO: 백엔드 담당과 필드명 확정.

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Health {
  status: string
}

export interface Model {
  id: string
  name: string
  provider: string
  // 단가를 모르면 null. 단위는 100만 토큰당 USD.
  input_per_mtok: number | null
  output_per_mtok: number | null
}

export interface Scenario {
  id: string
  name: string
  service: string
  environment: string
  version: string
  description: string
  actors: string[]
  allowed_paths: string[]
  target_url?: string
  target_urls?: string[]
}

export interface AgentInput {
  model_id: string
  role: string
  prompt_version: string
}

export interface StartRunRequest {
  scenario_id: string
  target_url?: string
  collaboration_mode: 'independent'
  agents: AgentInput[]
}

export interface StartRunResponse {
  execution_id: string
}

export interface AgentRun {
  agent_id: string
  model_id: string
  model_name: string
  role: string
  prompt_version: string
  is_mock?: boolean
  status: RunStatus
  phase: string | null
  progress: number | null
  tokens: number | null
  cost_usd: number | null
  duration_ms: number | null
  error: string | null
}

export interface Execution {
  execution_id: string
  status: RunStatus
  is_mock?: boolean
  scenario_id: string
  scenario_name: string
  environment: string
  collaboration_mode: 'independent'
  created_at: string
  finished_at: string | null
  error: string | null
  agents: AgentRun[]
}

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  timestamp: string
  agent_id: string | null
  level: LogLevel
  message: string
}

export interface TestAttempt {
  id: string
  agent_id: string
  method_id: string
  target: string
  actor: string
  reproduced: boolean | null
  error: string | null
  status_code: number | null
  evidence_id: string | null
}

export interface Evidence {
  id: string
  attempt_id: string
  captured_at: string
  request: string
  response: string
}

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
export type Verdict = 'confirmed' | 'needs_review' | 'false_positive'

export interface Finding {
  id: string
  title: string
  target: string
  cvss: number | null
  severity: Severity | null
  cvss_vector?: string | null
  reproduce_rate: number | null
  verdict: Verdict
  impact: string
  remediation: string
  reproduction: string[]
  found_by: string[]
  evidence_ids: string[]
}

export type CheckStatus = 'vulnerable' | 'passed' | 'needs_review' | 'not_applicable' | 'not_run'

export interface CheckResult {
  id: string
  group: string
  title: string
  status: CheckStatus
  reason: string | null
}

export interface MethodResult {
  method_id: string
  method_name: string
  target: string
  agent_id: string
  model_name: string
  attempts: number
  reproduced: number
  not_reproduced: number
  errors: number
  duration_ms: number | null
  tokens: number | null
  cost_usd: number | null
}

export interface ModelComparison {
  agent_id: string
  model_name: string
  only_count: number
  common_count: number
  false_positive_count: number
  duration_ms: number | null
  tokens: number | null
  cost_usd: number | null
  // 정답지가 없는 환경이면 null
  detection_rate: number | null
}

export interface Combination {
  combination_id: string
  models: string[]
  collaboration_mode: 'independent'
  score: number | null
  finding_count: number | null
  is_current: boolean
}

export interface ReportSummary {
  attempts: number
  reproduced: number
  not_reproduced: number
  errors: number
  confirmed_findings: number
  needs_review_findings: number
  duration_ms: number | null
  tokens: number | null
  cost_usd: number | null
}

export interface ReportSettings {
  scenario_name: string
  target_url?: string | null
  environment: string
  version: string
  actors: string[]
  allowed_paths: string[]
  info_level: string
  category: string
  tools: string[]
  collaboration_mode: 'independent'
  agents: { model_name: string; role: string; prompt_version: string }[]
}

export interface Report {
  execution_id: string
  generated_at: string
  is_mock?: boolean
  partial: boolean
  evaluator: string
  settings: ReportSettings
  summary: ReportSummary
  method_results: MethodResult[]
  comparison: { merged_count: number; common_count: number; agents: ModelComparison[] }
  combinations: Combination[]
  findings: Finding[]
  checklist: CheckResult[]
  attempts: TestAttempt[]
  evidence: Evidence[]
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
