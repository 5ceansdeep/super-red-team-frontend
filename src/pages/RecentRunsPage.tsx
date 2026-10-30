import { api, demoExecutionIds, isMock } from '../api/index.ts'
import { ApiError } from '../api/types.ts'
import type { Execution } from '../api/types.ts'
import { RunBadge, SourceBadge } from '../components/StatusBadge.tsx'
import { dateTime } from '../format.ts'
import { forgetRun, loadRecentRuns } from '../recentRuns.ts'
import { usePoll } from '../usePoll.ts'

async function loadRuns() {
  const ids = [...new Set([...loadRecentRuns(), ...demoExecutionIds])]
  const results = await Promise.allSettled(ids.map((id) => api.fetchStatus(id)))
  return results.flatMap((result, i): { id: string; execution: Execution | null }[] => {
    if (result.status === 'fulfilled') return [{ id: ids[i], execution: result.value }]
    // 서버에 없는 ID는 지우고, 그 외 오류는 조회 실패로 남긴다.
    if (result.reason instanceof ApiError && result.reason.status === 404) {
      forgetRun(ids[i])
      return []
    }
    return [{ id: ids[i], execution: null }]
  })
}

export default function RecentRunsPage() {
  const { data, error } = usePoll(loadRuns, [])

  return (
    <>
      <div className="heading">
        <div>
          <h1>실행 기록</h1>
          <p className="subtitle">AI 보안 점검을 실행한 기록입니다. 처음이라면 <a className="link" href="#/guide">사용 안내</a>를 먼저 확인하세요.</p>
        </div>
        <a className="button primary" href="#/new">새 점검 시작</a>
      </div>
      {error && <p className="notice error" role="alert">{error}</p>}
      {!data && !error && <p className="notice">불러오는 중…</p>}
      {data?.length === 0 && <p className="notice">아직 실행이 없습니다.</p>}
      {data && data.length > 0 && (
        <div className="card tablewrap">
          <table>
            <thead>
              <tr><th>실행</th><th>시나리오</th><th>환경</th><th>모델</th><th>상태</th>{!isMock && <th>출처</th>}<th>시작</th></tr>
            </thead>
            <tbody>
              {data.map(({ id, execution }) => (
                <tr key={id}>
                  <td className="mono"><a className="link" href={`#/executions/${id}`}>{id}</a></td>
                  {execution ? (
                    <>
                      <td>{execution.scenario_name}</td>
                      <td>{execution.environment}</td>
                      <td>{execution.agents.map((a) => a.model_name).join(', ')}</td>
                      <td><RunBadge status={execution.status} agents={execution.agents} /></td>
                      {!isMock && <td><SourceBadge isMock={execution.is_mock} /></td>}
                      <td>{dateTime(execution.created_at)}</td>
                    </>
                  ) : <td colSpan={6} className="muted">상태 조회 실패</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
