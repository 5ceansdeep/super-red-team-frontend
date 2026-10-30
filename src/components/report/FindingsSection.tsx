import type { Report } from '../../api/types.ts'
import { cvss, percent } from '../../format.ts'
import type { Tone } from '../../labels.ts'
import { VERDICT } from '../../labels.ts'
import { Tag } from '../StatusBadge.tsx'

const SEVERITY: Record<string, { label: string; tone: Tone }> = {
  Critical: { label: '위험도 매우 높음', tone: 'red' },
  High: { label: '위험도 높음', tone: 'red' },
  Medium: { label: '위험도 중간', tone: 'orange' },
  Low: { label: '위험도 낮음', tone: '' },
}

export default function FindingsSection({ report }: { report: Report }) {
  const modelOf = (agentId: string) =>
    report.comparison.agents.find((a) => a.agent_id === agentId)?.model_name ?? agentId

  return (
    <section>
      <div className="sectionhead"><h2>발견한 취약점</h2><span className="tiny muted">항목을 누르면 내용과 해결 방법을 볼 수 있습니다</span></div>
      {report.findings.length === 0 ? <p className="notice">판정 대상 발견이 없습니다.</p> : (
        <div className="card evidence">
          {report.findings.map((finding, index) => (
            <details key={finding.id} open={index === 0}>
              <summary>
                <Tag {...(finding.severity ? SEVERITY[finding.severity] : { label: '위험도 미정', tone: '' as Tone })} />
                <span className="mono">{finding.id}</span> {finding.title}
                <span className="finding-meta">
                  <span>위험 점수 <b>{cvss(finding.cvss)}</b></span>
                  <span>재현율 <b>{percent(finding.reproduce_rate)}</b></span>
                  <Tag {...VERDICT[finding.verdict]} />
                </span>
              </summary>
              <dl>
                <dt>대상</dt><dd className="mono">{finding.target}</dd>
                <dt>어떤 문제인가요</dt><dd>{finding.impact}</dd>
                <dt>해결 방법</dt><dd>{finding.remediation}</dd>
                <dt>발견 모델</dt><dd>{finding.found_by.map(modelOf).join(', ')}</dd>
                <dt>재현 순서</dt>
                <dd><ol>{finding.reproduction.map((step) => <li key={step}>{step}</li>)}</ol></dd>
                <dt>요청과 응답</dt>
                <dd>
                  {finding.evidence_ids.map((evidenceId) => {
                    const evidence = report.evidence.find((e) => e.id === evidenceId)
                    return evidence ? (
                      <div className="evidence-pair" key={evidenceId}>
                        <pre tabIndex={0}>{evidence.request}</pre>
                        <pre tabIndex={0}>{evidence.response}</pre>
                      </div>
                    ) : <p key={evidenceId} className="muted">증거 {evidenceId} 없음</p>
                  })}
                </dd>
              </dl>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
