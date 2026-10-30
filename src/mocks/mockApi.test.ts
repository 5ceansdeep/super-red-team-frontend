import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { StartRunRequest } from '../api/types.ts'
import { cancelRun, fetchReport, fetchStatus, logsOf, reportOf, snapshot, startRun, validateRequest } from './mockApi.ts'

const body = (modelIds: string[], scenario_id = 'orders-bola-vulnerable'): StartRunRequest => ({
  scenario_id,
  collaboration_mode: 'independent',
  agents: modelIds.map((model_id) => ({ model_id, role: 'r', prompt_version: 'v' })),
})

const ALL = ['deepseek-flash', 'qwen3.8-flash', 'glm-5.3-flash']
const HOUR = 3_600_000
const makeRun = (over = {}) => ({
  id: 'x', request: body(ALL), createdAt: 0, durations: [100, 100, 100], failAt: [null, null, null], ...over,
})

test('완주: 고유·공통·오탐이 나뉘고 조합 점수는 Σ(cvss × 재현율)이다', () => {
  const report = reportOf(makeRun(), HOUR)
  assert.equal(report.partial, false)
  assert.equal(report.comparison.merged_count, 4)
  assert.equal(report.comparison.common_count, 1)
  const [alpha, bravo, charlie] = report.comparison.agents
  assert.deepEqual([alpha.only_count, alpha.common_count, alpha.false_positive_count], [1, 1, 0])
  assert.deepEqual([bravo.only_count, bravo.common_count, bravo.false_positive_count], [1, 1, 1])
  assert.deepEqual([charlie.only_count, charlie.common_count, charlie.false_positive_count], [1, 1, 0])

  const confirmed = report.findings.filter((f) => f.verdict === 'confirmed')
  const expected = confirmed.reduce((sum, f) => sum + f.cvss! * f.reproduce_rate!, 0)
  const current = report.combinations.find((c) => c.is_current)!
  assert.equal(current.score, Math.round(expected * 100) / 100)
  assert.equal(current.finding_count, 4)
  assert.equal(current.models.length, 3)
  assert.equal(report.combinations.length, 4)
  assert.ok(report.combinations.some((c) => c.score === null))
})

test('reproduced null과 실행 오류는 미재현으로 세지 않는다', () => {
  const { summary, attempts, method_results } = reportOf(makeRun(), HOUR)
  const nulls = attempts.filter((a) => a.reproduced === null)
  assert.equal(summary.errors, nulls.length)
  assert.ok(nulls.length > 0)
  assert.equal(summary.not_reproduced, attempts.filter((a) => a.reproduced === false).length)
  assert.equal(method_results.reduce((sum, m) => sum + m.attempts, 0), attempts.length)
})

test('수정 환경: 확정 취약점 없음, 탐지율과 비용은 지어내지 않는다', () => {
  const run = makeRun({ request: body(ALL, 'orders-bola-fixed'), unpriced: [2] })
  const report = reportOf(run, HOUR)
  assert.equal(report.comparison.merged_count, 0)
  assert.equal(report.comparison.agents[0].detection_rate, null)
  assert.equal(report.summary.cost_usd, null)
  assert.equal(report.comparison.agents[2].cost_usd, null)
  assert.ok(report.comparison.agents[0].cost_usd! > 0)
  assert.equal(snapshot(run, HOUR).agents[2].cost_usd, null)
  assert.equal(report.findings[0].cvss, null)
  assert.equal(report.findings[0].verdict, 'needs_review')
})

test('한 모델 실패: 실행은 completed지만 에이전트와 보고서에 드러난다', () => {
  const run = makeRun({ failAt: [null, 0.45, null] })
  const execution = snapshot(run, HOUR)
  assert.equal(execution.status, 'completed')
  assert.deepEqual(execution.agents.map((a) => a.status), ['completed', 'failed', 'completed'])
  assert.ok(logsOf(run, HOUR).some((l) => l.level === 'error'))
  const report = reportOf(run, HOUR)
  assert.equal(report.partial, true)
  assert.deepEqual(report.findings.map((f) => f.id), ['F-001', 'F-002', 'F-006'])
})

test('전체 실패: failed이고 조합 점수는 0이 아니라 null이다', () => {
  const run = makeRun({ failAt: [0.1, 0.15, 0.12] })
  assert.equal(snapshot(run, HOUR).status, 'failed')
  const report = reportOf(run, HOUR)
  assert.equal(report.combinations.find((c) => c.is_current)?.score, null)
})

test('진행 중에는 보고서가 409, 취소 시 미도달 항목은 미실시다', () => {
  assert.throws(() => reportOf(makeRun(), 30_000), { status: 409 })
  const run = makeRun({ cancelledAt: 40_000 })
  const report = reportOf(run, HOUR)
  assert.equal(snapshot(run, HOUR).status, 'cancelled')
  const unreached = report.checklist.find((c) => c.id === 'AC-03')
  assert.equal(unreached?.status, 'not_run')
  assert.ok(unreached?.reason)
  assert.equal(report.checklist.find((c) => c.id === 'AC-01')?.status, 'vulnerable')
})

test('중복 모델, 1종 실행, 미등록 대상은 거부한다', () => {
  assert.throws(() => validateRequest(body(['deepseek-flash', 'deepseek-flash', 'qwen3.8-flash'])), { status: 422 })
  assert.throws(() => validateRequest(body(['deepseek-flash'])), { status: 422 })
  assert.throws(() => validateRequest(body(ALL, 'evil.example.com')), { status: 422 })
})

test('API 흐름: 시작은 ID만 돌려주고, 취소 후 재취소는 409', async () => {
  const started = await startRun(body(ALL))
  assert.deepEqual(Object.keys(started), ['execution_id'])
  assert.equal((await fetchStatus(started.execution_id)).status, 'pending')
  await cancelRun(started.execution_id)
  assert.equal((await fetchStatus(started.execution_id)).status, 'cancelled')
  await assert.rejects(cancelRun(started.execution_id), { status: 409 })
  await fetchReport(started.execution_id)
})
