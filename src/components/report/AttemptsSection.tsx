import type { Report } from '../../api/types.ts'
import { reproducedLabel } from '../../labels.ts'
import { Tag } from '../StatusBadge.tsx'

export default function AttemptsSection({ report }: { report: Report }) {
  const modelOf = (agentId: string) =>
    report.comparison.agents.find((a) => a.agent_id === agentId)?.model_name ?? agentId

  return (
    <section>
      <details className="card attempts">
        <summary>테스트 시도 전체 기록 ({report.attempts.length}건)</summary>
        {report.attempts.length === 0 ? <p className="notice">기록된 시도가 없습니다.</p> : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>방법</th><th>모델</th><th>요청 주체</th><th>대상</th><th className="num">응답</th><th>판정</th><th>오류</th></tr>
              </thead>
              <tbody>
                {report.attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td className="mono">{attempt.method_id}</td>
                    <td>{modelOf(attempt.agent_id)}</td>
                    <td>{attempt.actor}</td>
                    <td className="mono">{attempt.target}</td>
                    <td className="num">{attempt.status_code ?? '응답 없음'}</td>
                    <td><Tag {...reproducedLabel(attempt)} /></td>
                    <td className="muted">{attempt.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </section>
  )
}
