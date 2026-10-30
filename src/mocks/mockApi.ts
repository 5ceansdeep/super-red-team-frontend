// http.ts와 같은 함수 시그니처를 가진 메모리 내 가짜 백엔드.
// 실행 상태는 저장하지 않고 경과 시간에서 계산한다. 집계도 백엔드 역할이므로 여기서 한다.
import { ApiError } from '../api/types.ts'
import type {
  AgentRun, CheckResult, Combination, Evidence, Execution, Finding, LogEntry, MethodResult, Report, RunStatus,
  StartRunRequest, TestAttempt,
} from '../api/types.ts'
import {
  CHECKS, FINDINGS, GROUND_TRUTH, METHODS, MODELS, OTHER_COMBINATIONS, SCENARIO_ENV, SCENARIOS, TIMELINES, TOTALS,
} from './fixtures.ts'
import type { Step } from './fixtures.ts'

const SETUP_SEC = 3
const MIN = 60_000
const ALL_MODELS = ['deepseek-flash', 'qwen3.8-flash', 'glm-5.3-flash']

interface Run {
  id: string
  request: StartRunRequest
  createdAt: number
  cancelledAt?: number
  durations: number[] // 모델 순번별 소요 시간(초)
  failAt: (number | null)[] // 해당 진행률에서 모델 호출 실패
  unpriced?: number[] // 단가를 몰라 비용이 측정 불가인 모델 순번
}

const request = (scenario_id: string, modelIds: string[]): StartRunRequest => ({
  scenario_id,
  collaboration_mode: 'independent',
  agents: modelIds.map((model_id) => ({ model_id, role: '범용 탐색·검증', prompt_version: 'independent-v1' })),
})

const VULN = 'orders-bola-vulnerable'
const FIXED = 'orders-bola-fixed'

const seed = (now: number): Run[] => [
  { id: 'exec-1046', request: request(VULN, ALL_MODELS), createdAt: now - 20 * MIN, durations: [400, 500, 450], failAt: [0.1, 0.15, 0.12] },
  { id: 'exec-1045', request: request(VULN, ALL_MODELS), createdAt: now - 50_000, durations: [150, 210, 180], failAt: [null, null, null] },
  { id: 'exec-1044', request: request(VULN, ALL_MODELS), createdAt: now - 40 * MIN, durations: [380, 500, 430], failAt: [null, 0.45, null] },
  { id: 'exec-1043', request: request(FIXED, ALL_MODELS), createdAt: now - 120 * MIN, durations: [296, 341, 310], failAt: [null, null, null], unpriced: [2] },
  { id: 'exec-1042', request: request(VULN, ALL_MODELS), createdAt: now - 180 * MIN, durations: [412, 538, 460], failAt: [null, null, null] },
  { id: 'exec-1041', request: request(VULN, ALL_MODELS), createdAt: now - 300 * MIN, cancelledAt: now - 298 * MIN, durations: [400, 520, 470], failAt: [null, null, null] },
]

const runs = seed(Date.now())
let nextId = 1047

export const DEMO_EXECUTION_IDS = runs.map((r) => r.id)

const iso = (ms: number) => new Date(ms).toISOString()
const delay = () => new Promise((resolve) => setTimeout(resolve, 120))
const round2 = (value: number) => Math.round(value * 100) / 100

function findRun(id: string): Run {
  const run = runs.find((r) => r.id === id)
  if (!run) throw new ApiError(404, `실행을 찾을 수 없습니다: ${id}`)
  return run
}

const envOf = (run: Run) => SCENARIO_ENV[run.request.scenario_id]
const elapsedSec = (run: Run, now: number) => ((run.cancelledAt ?? now) - run.createdAt) / 1000 - SETUP_SEC

function progress(run: Run, slot: number, now: number): number {
  const p = Math.min(1, Math.max(0, elapsedSec(run, now) / run.durations[slot]))
  return Math.min(p, run.failAt[slot] ?? 1)
}

const stepsFor = (run: Run, slot: number, now: number): Step[] => {
  const p = progress(run, slot, now)
  return TIMELINES[envOf(run)].filter((s) => s.slots.includes(slot) && s.at <= p)
}

const agentId = (run: Run, slot: number) => `${run.id}-a${slot}`
const stepTime = (run: Run, slot: number, at: number) => run.createdAt + (SETUP_SEC + at * run.durations[slot]) * 1000

function agentStatus(run: Run, slot: number, now: number): RunStatus {
  const p = progress(run, slot, now)
  const failAt = run.failAt[slot]
  if (failAt != null && p >= failAt) return 'failed'
  if (p >= 1) return 'completed'
  if (run.cancelledAt) return 'cancelled'
  return elapsedSec(run, now) < 0 ? 'pending' : 'running'
}

function costOf(run: Run, slot: number, input: number, output: number): number | null {
  if (run.unpriced?.includes(slot)) return null
  const model = MODELS.find((m) => m.id === run.request.agents[slot].model_id)!
  return (input * model.input_per_mtok + output * model.output_per_mtok) / 1_000_000
}

function toAgent(run: Run, slot: number, now: number): AgentRun {
  const agent = run.request.agents[slot]
  const model = MODELS.find((m) => m.id === agent.model_id)!
  const totals = TOTALS[envOf(run)][slot]
  const p = progress(run, slot, now)
  const input = Math.round(totals.input * p)
  const output = Math.round(totals.output * p)
  const status = agentStatus(run, slot, now)
  return {
    agent_id: agentId(run, slot),
    model_id: model.id,
    model_name: model.name,
    role: agent.role,
    prompt_version: agent.prompt_version,
    status,
    phase: stepsFor(run, slot, now).at(-1)?.phase ?? null,
    progress: p,
    tokens: input + output,
    cost_usd: costOf(run, slot, input, output),
    duration_ms: Math.round(p * run.durations[slot] * 1000),
    error: status === 'failed' ? '모델 호출 제한 초과 (429), 재시도 3회 실패' : null,
  }
}

function executionStatus(agents: AgentRun[], run: Run, now: number): RunStatus {
  if (run.cancelledAt) return 'cancelled'
  if (elapsedSec(run, now) < 0) return 'pending'
  if (agents.some((a) => a.status === 'running')) return 'running'
  // 한 모델이라도 끝까지 갔으면 실행은 completed. 부분 실패는 에이전트 상태로 드러난다.
  return agents.every((a) => a.status === 'failed') ? 'failed' : 'completed'
}

export function snapshot(run: Run, now: number): Execution {
  const scenario = SCENARIOS.find((s) => s.id === run.request.scenario_id)!
  const agents = run.request.agents.map((_, slot) => toAgent(run, slot, now))
  const status = executionStatus(agents, run, now)
  const active = status === 'pending' || status === 'running'
  const finishedAt = run.cancelledAt ?? run.createdAt + SETUP_SEC * 1000 + Math.max(...agents.map((a) => a.duration_ms ?? 0))
  return {
    execution_id: run.id,
    status,
    is_mock: true,
    scenario_id: scenario.id,
    scenario_name: scenario.name,
    environment: `${scenario.environment} · ${scenario.version}`,
    collaboration_mode: 'independent',
    created_at: iso(run.createdAt),
    finished_at: active ? null : iso(finishedAt),
    error: status === 'failed' ? '모든 에이전트가 실패해 결과를 통합하지 못했습니다' : null,
    agents,
  }
}

const visibleAttempts = (run: Run, now: number) =>
  run.request.agents.flatMap((_, slot) =>
    stepsFor(run, slot, now).flatMap((step) => (step.attempt ? [{ slot, step, spec: step.attempt }] : [])),
  )

export function logsOf(run: Run, now: number): LogEntry[] {
  const logs: LogEntry[] = [
    { id: `${run.id}-setup-0`, timestamp: iso(run.createdAt), agent_id: null, level: 'info', message: '허용 범위 확인 완료' },
  ]
  if (elapsedSec(run, now) >= 0) {
    logs.push({ id: `${run.id}-setup-1`, timestamp: iso(run.createdAt + SETUP_SEC * 1000), agent_id: null, level: 'info', message: '환경 초기화 완료, 동일한 초기 정보를 독립 배분' })
  }
  run.request.agents.forEach((_, slot) => {
    stepsFor(run, slot, now).forEach((step, i) => {
      logs.push({
        id: `${agentId(run, slot)}-${i}`,
        timestamp: iso(stepTime(run, slot, step.at)),
        agent_id: agentId(run, slot),
        level: step.level ?? 'info',
        message: step.message,
      })
    })
    if (agentStatus(run, slot, now) === 'failed') {
      logs.push({
        id: `${agentId(run, slot)}-failed`,
        timestamp: iso(stepTime(run, slot, run.failAt[slot]!)),
        agent_id: agentId(run, slot),
        level: 'error',
        message: '모델 호출 제한 초과 (429), 재시도 3회 실패. 이 에이전트만 중단',
      })
    }
  })
  if (run.cancelledAt) {
    logs.push({ id: `${run.id}-cancel`, timestamp: iso(run.cancelledAt), agent_id: null, level: 'warn', message: '사용자가 실행을 취소함' })
  }
  return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

const score = (contributions: [number, number][]) => round2(contributions.reduce((sum, [cvss, rate]) => sum + cvss * rate, 0))
const modelName = (id: string) => MODELS.find((m) => m.id === id)!.name

function combinationsOf(run: Run, findings: Finding[], failedAll: boolean): Combination[] {
  const ids = run.request.agents.map((a) => a.model_id)
  const key = (models: string[]) => [...models].sort().join('+')
  const scored = findings.flatMap((f): [number, number][] =>
    f.verdict === 'confirmed' && f.cvss !== null && f.reproduce_rate !== null ? [[f.cvss, f.reproduce_rate]] : [],
  )
  const current: Combination = {
    combination_id: key(ids),
    models: ids.map(modelName),
    collaboration_mode: 'independent',
    score: failedAll ? null : score(scored),
    finding_count: failedAll ? null : scored.length,
    is_current: true,
  }
  const others = OTHER_COMBINATIONS[envOf(run)]
    .filter((c) => key(c.models) !== key(ids))
    .map((c): Combination => ({
      combination_id: key(c.models),
      models: c.models.map(modelName),
      collaboration_mode: 'independent',
      score: c.contributions && score(c.contributions),
      finding_count: c.contributions?.length ?? null,
      is_current: false,
    }))
  return [current, ...others]
}

export function reportOf(run: Run, now: number): Report {
  const execution = snapshot(run, now)
  if (execution.status === 'pending' || execution.status === 'running') {
    throw new ApiError(409, '실행이 끝난 뒤 보고서를 조회할 수 있습니다')
  }
  const env = envOf(run)
  const scenario = SCENARIOS.find((s) => s.id === run.request.scenario_id)!
  const visible = visibleAttempts(run, now)

  const attempts: TestAttempt[] = []
  const evidence: Evidence[] = []
  visible.forEach(({ slot, step, spec }) => {
    spec.results.forEach((reproduced, i) => {
      const id = `${agentId(run, slot)}-${spec.method}-${i}`
      attempts.push({
        id, agent_id: agentId(run, slot), method_id: spec.method, target: spec.path, actor: spec.actor,
        reproduced, error: spec.error ?? null, status_code: spec.status_code, evidence_id: `ev-${id}`,
      })
      evidence.push({
        id: `ev-${id}`, attempt_id: id, captured_at: iso(stepTime(run, slot, step.at)),
        request: `${spec.method === 'M02' ? 'POST' : 'GET'} ${spec.path} HTTP/1.1\nAuthorization: Bearer <${spec.actor} 토큰 마스킹>`,
        response: spec.response,
      })
    })
  })

  const findings: Finding[] = FINDINGS[env].flatMap((spec) => {
    const hits = visible.filter((v) => v.spec.finding === spec.id)
    if (!hits.length) return []
    const results = hits.flatMap((h) => h.spec.results)
    const decided = results.filter((r) => r !== null)
    const rate = spec.verdict === 'confirmed' && decided.length ? round2(decided.filter(Boolean).length / decided.length) : null
    return [{
      id: spec.id, title: spec.title, target: spec.target, cvss: spec.cvss, severity: spec.severity,
      reproduce_rate: rate, verdict: spec.verdict, impact: spec.impact, remediation: spec.remediation,
      reproduction: spec.reproduction,
      found_by: hits.map((h) => agentId(run, h.slot)),
      evidence_ids: hits.map((h) => `ev-${agentId(run, h.slot)}-${h.spec.method}-0`),
    }]
  })

  const furthest = Math.max(...run.request.agents.map((_, slot) => progress(run, slot, now)))
  const checklist: CheckResult[] = CHECKS[env].map(({ coverAt, ...check }) =>
    furthest >= coverAt ? check : { ...check, status: 'not_run', reason: '실행이 중단되어 도달하지 못함' },
  )

  const method_results: MethodResult[] = execution.agents.flatMap((agent, slot) => {
    const mine = visible.filter((v) => v.slot === slot)
    return [...new Set(mine.map((v) => v.spec.method))].map((method) => {
      const specs = mine.filter((v) => v.spec.method === method).map((v) => v.spec)
      const results = specs.flatMap((s) => s.results)
      const tokens = specs.reduce((sum, s) => sum + s.tokens, 0)
      return {
        method_id: String(method),
        method_name: METHODS[method].name,
        target: METHODS[method].target,
        agent_id: agent.agent_id,
        model_name: agent.model_name,
        attempts: results.length,
        reproduced: results.filter((r) => r === true).length,
        not_reproduced: results.filter((r) => r === false).length,
        errors: results.filter((r) => r === null).length,
        duration_ms: specs.reduce((sum, s) => sum + s.ms, 0),
        tokens,
        // 입력·출력 비율을 알 수 없는 방법별 비용은 입력 토큰 단가로 근사한다.
        cost_usd: costOf(run, slot, tokens, 0),
      }
    })
  })

  const confirmed = findings.filter((f) => f.verdict === 'confirmed')
  const costs = execution.agents.map((a) => a.cost_usd)

  return {
    execution_id: run.id,
    generated_at: iso(now),
    is_mock: true,
    partial: execution.status !== 'completed' || execution.agents.some((a) => a.status !== 'completed'),
    evaluator: '평가 엔진 시연본',
    settings: {
      scenario_name: scenario.name,
      environment: scenario.environment,
      version: scenario.version,
      actors: scenario.actors,
      allowed_paths: scenario.allowed_paths,
      info_level: 'Gray-box',
      category: '접근 제어',
      tools: ['HTTP 요청'],
      collaboration_mode: 'independent',
      agents: execution.agents.map((a) => ({ model_name: a.model_name, role: a.role, prompt_version: a.prompt_version })),
    },
    summary: {
      attempts: attempts.length,
      reproduced: attempts.filter((a) => a.reproduced === true).length,
      not_reproduced: attempts.filter((a) => a.reproduced === false).length,
      errors: attempts.filter((a) => a.reproduced === null).length,
      confirmed_findings: confirmed.length,
      needs_review_findings: findings.filter((f) => f.verdict === 'needs_review').length,
      duration_ms: Math.max(...execution.agents.map((a) => a.duration_ms ?? 0)),
      tokens: execution.agents.reduce((sum, a) => sum + (a.tokens ?? 0), 0),
      cost_usd: costs.some((c) => c === null) ? null : costs.reduce((sum: number, c) => sum + (c ?? 0), 0),
    },
    method_results,
    comparison: {
      merged_count: confirmed.length,
      common_count: confirmed.filter((f) => f.found_by.length > 1).length,
      agents: execution.agents.map((agent) => {
        const mine = confirmed.filter((f) => f.found_by.includes(agent.agent_id))
        return {
          agent_id: agent.agent_id,
          model_name: agent.model_name,
          only_count: mine.filter((f) => f.found_by.length === 1).length,
          common_count: mine.filter((f) => f.found_by.length > 1).length,
          false_positive_count: findings.filter((f) => f.verdict === 'false_positive' && f.found_by.includes(agent.agent_id)).length,
          duration_ms: agent.duration_ms,
          tokens: agent.tokens,
          cost_usd: agent.cost_usd,
          detection_rate: GROUND_TRUTH[env] ? round2(mine.length / GROUND_TRUTH[env]) : null,
        }
      }),
    },
    combinations: combinationsOf(run, findings, execution.status === 'failed'),
    findings,
    checklist,
    attempts,
    evidence,
  }
}

export function validateRequest(body: StartRunRequest) {
  if (!SCENARIOS.some((s) => s.id === body.scenario_id)) throw new ApiError(422, '등록되지 않은 시나리오입니다')
  if (body.collaboration_mode !== 'independent') throw new ApiError(422, 'Independent 방식만 지원합니다')
  const ids = body.agents.map((a) => a.model_id)
  if (ids.length < 2 || new Set(ids).size !== ids.length) throw new ApiError(422, '서로 다른 모델을 선택해야 합니다')
}

export async function fetchHealth() { await delay(); return { status: 'ok' } }
export async function fetchModels() { await delay(); return MODELS }
export async function fetchScenarios() { await delay(); return SCENARIOS }
export async function fetchStatus(id: string) { await delay(); return snapshot(findRun(id), Date.now()) }
export async function fetchExecutions() { await delay(); return runs.map((run) => snapshot(run, Date.now())) }
export async function fetchLogs(id: string) { await delay(); return logsOf(findRun(id), Date.now()) }
export async function fetchReport(id: string) { await delay(); return reportOf(findRun(id), Date.now()) }

export async function startRun(body: StartRunRequest) {
  await delay()
  validateRequest(body)
  const run: Run = {
    id: `exec-${nextId++}`,
    request: body,
    createdAt: Date.now(),
    durations: body.agents.map((_, slot) => 24 + slot * 6),
    failAt: body.agents.map(() => null),
  }
  runs.unshift(run)
  return { execution_id: run.id }
}

export async function cancelRun(id: string) {
  await delay()
  const run = findRun(id)
  const now = Date.now()
  const { status } = snapshot(run, now)
  if (status !== 'pending' && status !== 'running') throw new ApiError(409, '이미 끝난 실행입니다')
  run.cancelledAt = now
  return snapshot(run, now)
}
