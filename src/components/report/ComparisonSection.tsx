import type { Finding, Report } from '../../api/types.ts'
import { count, duration, percent, usd } from '../../format.ts'

export default function ComparisonSection({ report }: { report: Report }) {
  const { comparison, findings } = report
  const confirmed = findings.filter((f) => f.verdict === 'confirmed')
  const groups: [string, Finding[]][] = [
    ...comparison.agents.map((agent): [string, Finding[]] => [
      `${agent.model_name}만 발견`,
      confirmed.filter((f) => f.found_by.length === 1 && f.found_by[0] === agent.agent_id),
    ]),
    ['공통 발견', confirmed.filter((f) => f.found_by.length > 1)],
  ]

  return (
    <section>
      <div className="sectionhead">
        <h2>모델별로 무엇을 찾았나요?</h2>
        <span className="tiny muted">통합 {comparison.merged_count}건 · 공통 {comparison.common_count}건</span>
      </div>
      <div className="check-grid four">
        {groups.map(([label, items]) => (
          <article className="card checkgroup" key={label}>
            <h3>{label}</h3>
            {items.length === 0 && <p className="tiny muted">없음</p>}
            {items.map((f) => <div className="checkitem" key={f.id}><span><b className="mono">{f.id}</b> {f.title}</span></div>)}
          </article>
        ))}
      </div>
      <div className="card tablewrap gap">
        <table>
          <thead>
            <tr><th>모델</th><th className="num">단독 발견</th><th className="num">공통 발견</th><th className="num">오탐</th><th className="num">탐지율</th><th className="num">걸린 시간</th><th className="num">토큰</th><th className="num">예상 비용</th></tr>
          </thead>
          <tbody>
            {comparison.agents.map((agent) => (
              <tr key={agent.agent_id}>
                <td className="tablemodel">{agent.model_name}</td>
                <td className="num">{agent.only_count}</td>
                <td className="num">{agent.common_count}</td>
                <td className="num">{agent.false_positive_count}</td>
                <td className="num">{agent.detection_rate === null ? '정답지 없음' : percent(agent.detection_rate)}</td>
                <td className="num">{duration(agent.duration_ms)}</td>
                <td className="num">{count(agent.tokens)}</td>
                <td className="num">{usd(agent.cost_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
