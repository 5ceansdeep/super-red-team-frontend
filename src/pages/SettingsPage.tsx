import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/index.ts'
import type { AgentInput } from '../api/types.ts'
import { Tag } from '../components/StatusBadge.tsx'
import { price } from '../format.ts'
import { rememberRun } from '../recentRuns.ts'
import { usePoll } from '../usePoll.ts'

const AGENT_COUNT = 3
// TODO: 역할·프롬프트 버전 목록을 제공할 API가 계약에 없다. 백엔드와 값 확정 필요.
const ROLES = ['범용 탐색·검증', '접근 제어 특화']
const PROMPT_VERSIONS = ['v1']

const PLANNED = ['Black-box', 'White-box', '브라우저 도구', '코드 읽기 도구', '예약 실행']

export default function SettingsPage() {
  const { data: models, error: modelsError } = usePoll(api.fetchModels, [], () => true)
  const { data: scenarios, error: scenariosError } = usePoll(api.fetchScenarios, [], () => true)
  const [scenarioId, setScenarioId] = useState('')
  const [agents, setAgents] = useState<AgentInput[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()

  useEffect(() => {
    if (!models || !scenarios) return
    setScenarioId(scenarios[0]?.id ?? '')
    setAgents(models.slice(0, AGENT_COUNT).map((m) => ({ model_id: m.id, role: ROLES[0], prompt_version: PROMPT_VERSIONS[0] })))
  }, [models, scenarios])

  const loadError = modelsError ?? scenariosError
  if (loadError) return <p className="notice error" role="alert">{loadError}</p>
  if (!models || !scenarios) return <p className="notice">불러오는 중…</p>
  if (!scenarios.length) return <p className="notice">사전 등록된 시나리오가 없습니다.</p>
  if (models.length < AGENT_COUNT) return <p className="notice">실행하려면 모델이 {AGENT_COUNT}종 필요합니다. 현재 {models.length}종입니다.</p>

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0]
  const patch = (index: number, value: Partial<AgentInput>) =>
    setAgents(agents.map((agent, i) => (i === index ? { ...agent, ...value } : agent)))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(undefined)
    try {
      const { execution_id } = await api.startRun({ scenario_id: scenario.id, collaboration_mode: 'independent', agents })
      rememberRun(execution_id)
      location.hash = `/executions/${execution_id}`
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '실행을 시작하지 못했습니다')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="heading">
        <div>
          <h1>실행 설정</h1>
          <p className="subtitle">사전 등록된 환경만 선택할 수 있습니다. 세 AI는 서로의 결과를 보지 않고 각자 점검합니다.</p>
        </div>
        <button className="primary" disabled={agents.length !== AGENT_COUNT || submitting}>{submitting ? '시작 중…' : '점검 시작'}</button>
      </div>
      {submitError && <p className="notice error" role="alert">{submitError}</p>}

      <div className="monitor-grid">
        <div className="stack">
          <section className="card pad">
            <h2>시나리오</h2>
            <label className="field">시나리오·환경
              <select value={scenario.id} onChange={(e) => setScenarioId(e.target.value)}>
                {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.environment}</option>)}
              </select>
            </label>
            <p className="subtitle">{scenario.description}</p>
          </section>

          <section className="card pad">
            <h2>AI 구성</h2>
            {agents.map((agent, index) => (
              <fieldset className="agent-row" key={index}>
                <legend>AI {index + 1} · {models[index].name}</legend>
                <p className="agent-model">
                  <span className="mono">{models[index].id}</span> · {models[index].provider}
                  <span className="agent-price">입력 {price(models[index].input_per_mtok)} / 출력 {price(models[index].output_per_mtok)} (100만 토큰당)</span>
                </p>
                <label className="field">역할
                  <select value={agent.role} onChange={(e) => patch(index, { role: e.target.value })}>
                    {ROLES.map((role) => <option key={role}>{role}</option>)}
                  </select>
                </label>
                <label className="field">프롬프트 버전
                  <select value={agent.prompt_version} onChange={(e) => patch(index, { prompt_version: e.target.value })}>
                    {PROMPT_VERSIONS.map((version) => <option key={version}>{version}</option>)}
                  </select>
                </label>
              </fieldset>
            ))}
          </section>
        </div>

        <aside className="card">
          <div className="panelhead"><h3>실행 구성</h3><Tag label="격리 환경" /></div>
          <div className="configlist">
            <div className="configrow"><span>실행 방식</span><b>독립 실행</b></div>
            <div className="configrow"><span>환경</span><b>{scenario.environment} · {scenario.version}</b></div>
            <div className="configrow"><span>테스트 계정</span><b>{scenario.actors.join(' / ')}</b></div>
            <div className="configrow"><span>제공 정보</span><b>일부 제공 (Gray-box)</b></div>
            <div className="configrow"><span>점검 분야</span><b>접근 제어</b></div>
            <div className="configrow"><span>도구</span><b>HTTP 요청</b></div>
          </div>
          <div className="safety">
            <b>허용 경로</b>
            <ul className="mono">{scenario.allowed_paths.map((path) => <li key={path}>{path}</li>)}</ul>
          </div>
          <div className="planned">
            <span>지원 예정</span>
            {PLANNED.map((item) => <Tag key={item} label={item} />)}
          </div>
        </aside>
      </div>
    </form>
  )
}
