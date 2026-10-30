import { useState } from 'react'
import { api } from '../api/index.ts'
import type { Execution } from '../api/types.ts'
import { clock, isActive } from '../format.ts'
import { usePoll } from '../usePoll.ts'

export default function LogPanel({ execution }: { execution: Execution }) {
  const id = execution.execution_id
  const active = isActive(execution.status)
  // active가 바뀌면 다시 호출되어 종료 직후의 마지막 로그까지 받는다.
  const { data: logs, error } = usePoll(() => api.fetchLogs(id), [id, active], () => !active)
  const [agentId, setAgentId] = useState('all')

  const nameOf = (agent: string | null) => execution.agents.find((a) => a.agent_id === agent)?.model_name ?? '시스템'
  const shown = logs?.filter((l) => agentId === 'all' || l.agent_id === agentId || l.agent_id === null)

  return (
    <section className="card logs">
      <div className="panelhead">
        <h3>실행 로그</h3>
        <label>
          <span className="sr">AI 필터</span>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="all">전체 AI</option>
            {execution.agents.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.model_name}</option>)}
          </select>
        </label>
      </div>
      <div className="logbody mono" role="log" aria-label="실행 로그">
        {error && <p className="notice error" role="alert">{error}</p>}
        {!logs && !error && <p className="muted">불러오는 중…</p>}
        {shown?.map((log) => (
          <div key={log.id} className={`logline ${log.level}`}>
            <time>{clock(log.timestamp)}</time>
            <span className="label">{nameOf(log.agent_id)}</span>
            <span>{log.message}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
