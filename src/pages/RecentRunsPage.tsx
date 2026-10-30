import { api, demoExecutionIds, isMock } from '../api/index.ts'
import { ApiError } from '../api/types.ts'
import type { Execution, Report } from '../api/types.ts'
import Icon from '../components/Icon.tsx'
import ScoreBars from '../components/ScoreBars.tsx'
import { RunBadge, SourceBadge } from '../components/StatusBadge.tsx'
import { dateTime, isActive } from '../format.ts'
import { forgetRun, loadRecentRuns } from '../recentRuns.ts'
import { usePoll } from '../usePoll.ts'

const cleanRun = (e: Execution | null) => e?.status === 'completed' && e.agents.every((a) => a.status === 'completed')
const troubled = (e: Execution | null) => e?.status === 'failed' || e?.agents.some((a) => a.status === 'failed')

// 수정 환경처럼 전부 0점인 실행은 건너뛰고, 점수가 있는 가장 최근 보고서를 고른다.
async function latestScoredReport(ids: string[]) {
  let fallback: Report | null = null
  for (const id of ids) {
    const report = await api.fetchReport(id).catch(() => null)
    if (report?.combinations.some((c) => c.score)) return report
    fallback ??= report
  }
  return fallback
}

async function loadDashboard() {
  const ids = [...new Set([...loadRecentRuns(), ...demoExecutionIds])]
  const results = await Promise.allSettled(ids.map((id) => api.fetchStatus(id)))
  const runs = results.flatMap((result, i): { id: string; execution: Execution | null }[] => {
    if (result.status === 'fulfilled') return [{ id: ids[i], execution: result.value }]
    // 서버에 없는 ID는 지우고, 그 외 오류는 조회 실패로 남긴다.
    if (result.reason instanceof ApiError && result.reason.status === 404) {
      forgetRun(ids[i])
      return []
    }
    return [{ id: ids[i], execution: null }]
  })
  return { runs, report: await latestScoredReport(runs.filter((r) => cleanRun(r.execution)).map((r) => r.id)) }
}

export default function RecentRunsPage() {
  const { data, error } = usePoll(loadDashboard, [])
  const runs = data?.runs ?? []
  const executions = runs.map((r) => r.execution)
  const kpis = [
    { icon: 'layers', label: '전체 실행', value: runs.length, hint: '이 브라우저 기준' },
    { icon: 'pulse', label: '실행 중', value: executions.filter((e) => e && isActive(e.status)).length, hint: '실시간 갱신' },
    { icon: 'check', label: '정상 완료', value: executions.filter(cleanRun).length, hint: '모든 AI 완주' },
    { icon: 'alert', label: '확인 필요', value: executions.filter(troubled).length, hint: '실패 또는 일부 실패' },
  ] as const

  return (
    <>
      <div className="heading">
        <div>
          <h1>대시보드</h1>
          <p className="subtitle">AI 보안 점검 현황을 한눈에 확인하세요.</p>
        </div>
      </div>
      {error && <p className="notice error" role="alert">{error}</p>}
      {!data && !error && <p className="notice">불러오는 중…</p>}

      {data && (
        <>
          <div className="kpis">
            {kpis.map((kpi) => (
              <article className="card kpi" key={kpi.label}>
                <span className="kpi-icon"><Icon name={kpi.icon} /></span>
                <div>
                  <small>{kpi.label}</small>
                  <strong>{kpi.value}</strong>
                  <span>{kpi.hint}</span>
                </div>
              </article>
            ))}
          </div>

          <div className="home-grid">
            <section className="card pad">
              <div className="sectionhead">
                <div>
                  <h2>최신 조합 점수</h2>
                  {data.report && <p className="subtitle">{data.report.settings.scenario_name} · {data.report.settings.environment}</p>}
                </div>
                {data.report && <a className="link" href={`#/executions/${data.report.execution_id}/report`}>보고서 보기</a>}
              </div>
              {data.report
                ? <ScoreBars combinations={data.report.combinations} />
                : <p className="notice">완료된 실행이 있으면 점수가 표시됩니다.</p>}
            </section>

            <section className="promo">
              <span className="tag">독립 실행</span>
              <h2>새 보안 점검을 시작하세요</h2>
              <p>AI 3개가 서로의 답을 보지 않고 같은 환경을 점검합니다.</p>
              <a className="button" href="#/new">점검 시작</a>
            </section>
          </div>

          <section className="card">
            <div className="panelhead"><h2>최근 실행</h2></div>
            {runs.length === 0 ? <p className="notice">아직 실행이 없습니다.</p> : (
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr><th>실행</th><th>시나리오</th><th>환경</th><th>모델</th><th>상태</th>{!isMock && <th>출처</th>}<th>시작</th></tr>
                  </thead>
                  <tbody>
                    {runs.map(({ id, execution }) => (
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
                        ) : <td colSpan={5} className="muted">상태 조회 실패</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
