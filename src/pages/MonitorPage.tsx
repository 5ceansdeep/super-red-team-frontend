import { useState } from 'react'
import { api } from '../api/index.ts'
import type { AgentRun, Execution } from '../api/types.ts'
import LogPanel from '../components/LogPanel.tsx'
import { RunBadge, SourceBadge, Tag } from '../components/StatusBadge.tsx'
import { count, dateTime, duration, isActive, percent, usd } from '../format.ts'
import { RUN_STATUS } from '../labels.ts'
import { usePoll } from '../usePoll.ts'

function AgentNode({ agent, index }: { agent: AgentRun; index: number }) {
  const { label, tone } = RUN_STATUS[agent.status]
  return (
    <article className={`node ${agent.status}`}>
      <div className="nodeindex">AI {index + 1} <Tag label={label} tone={tone} /></div>
      <h3>{agent.model_name}</h3>
      <p className="model">{agent.model_id} · {agent.role}</p>
      <p className="nodestate">{agent.phase ?? '시작 전'}</p>
      <div className="progress" role="progressbar" aria-valuenow={agent.progress === null ? undefined : Math.round(agent.progress * 100)} aria-label={`${agent.model_name} 진행률`}>
        <span style={{ width: `${(agent.progress ?? 0) * 100}%` }} />
      </div>
      <dl className="nodestats">
        <div><dt>진행률</dt><dd>{percent(agent.progress)}</dd></div>
        <div><dt>시간</dt><dd>{duration(agent.duration_ms)}</dd></div>
        <div><dt>토큰</dt><dd>{count(agent.tokens)}</dd></div>
        <div><dt>비용</dt><dd>{usd(agent.cost_usd)}</dd></div>
      </dl>
      {agent.error && <p className="notice error" role="alert">{agent.error}</p>}
    </article>
  )
}

function mergeState(execution: Execution) {
  switch (execution.status) {
    case 'completed': return '결과 통합 완료'
    case 'failed': return '통합할 결과 없음'
    case 'cancelled': return '취소로 중단'
    default: return '모든 AI의 점검이 끝나기를 기다리는 중'
  }
}

export default function MonitorPage({ id }: { id: string }) {
  const { data: execution, error } = usePoll(() => api.fetchStatus(id), [id], (e) => !isActive(e.status))
  const [cancelling, setCancelling] = useState(false)
  const [actionError, setActionError] = useState<string>()

  if (!execution) {
    return error
      ? <p className="notice error" role="alert">{error} <a className="link" href="#/">대시보드로</a></p>
      : <p className="notice">불러오는 중…</p>
  }

  const active = isActive(execution.status)
  const failed = execution.agents.filter((a) => a.status === 'failed')
  const cancel = async () => {
    setCancelling(true)
    setActionError(undefined)
    try {
      await api.cancelRun(id)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '취소하지 못했습니다')
      setCancelling(false)
    }
  }

  return (
    <>
      <div className="heading">
        <div>
          <h1>실행 모니터</h1>
          <p className="subtitle">{execution.scenario_name} · {execution.environment} · {dateTime(execution.created_at)} 시작</p>
        </div>
        <div className="actions">
          {active
            ? <button onClick={cancel} disabled={cancelling}>{cancelling ? '취소 요청 중…' : '실행 취소'}</button>
            : <a className="button primary" href={`#/executions/${id}/report`}>결과 보고서 보기</a>}
        </div>
      </div>

      {error && <p className="notice error" role="alert">상태 갱신 실패, 마지막으로 받은 상태입니다. {error}</p>}
      {actionError && <p className="notice error" role="alert">{actionError}</p>}
      {execution.error && <p className="notice error" role="alert">{execution.error}</p>}
      {execution.status === 'completed' && failed.length > 0 && (
        <p className="notice warn" role="alert">
          {failed.map((a) => a.model_name).join(', ')} 실패. 나머지 AI의 결과만으로 완료된 부분 결과입니다.
        </p>
      )}
      {execution.status === 'cancelled' && <p className="notice warn">사용자가 취소했습니다. 수집된 로그와 부분 결과는 보존됩니다.</p>}

      <section className="card">
        <div className="panelhead">
          <div className="runmeta">
            <h3 className="mono">{execution.execution_id}</h3>
            <RunBadge status={execution.status} agents={execution.agents} />
            <SourceBadge isMock={execution.is_mock} />
          </div>
          <span className="tiny muted">AI끼리 정보를 공유하지 않고 각자 점검합니다</span>
        </div>
        <div className="flow">
          <div className="parallel">
            {execution.agents.map((agent, index) => <AgentNode key={agent.agent_id} agent={agent} index={index} />)}
          </div>
          <article className="node merge">
            <div className="nodeindex">마지막 단계</div>
            <h3>결과 통합</h3>
            <p className="nodestate">{mergeState(execution)}</p>
          </article>
        </div>
      </section>

      <LogPanel execution={execution} />
    </>
  )
}
