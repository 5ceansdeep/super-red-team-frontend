import { useState } from 'react'
import { api } from '../api/index.ts'
import type { ReportSummary } from '../api/types.ts'
import AttemptsSection from '../components/report/AttemptsSection.tsx'
import ChecklistSection from '../components/report/ChecklistSection.tsx'
import ComparisonSection from '../components/report/ComparisonSection.tsx'
import FindingsSection from '../components/report/FindingsSection.tsx'
import MethodsSection from '../components/report/MethodsSection.tsx'
import RankingSection from '../components/report/RankingSection.tsx'
import SettingsSection from '../components/report/SettingsSection.tsx'
import { SourceBadge } from '../components/StatusBadge.tsx'
import { count, dateTime, duration, usd } from '../format.ts'
import { usePoll } from '../usePoll.ts'

const TABS = [
  ['summary', '한눈에 보기'],
  ['findings', '발견한 취약점'],
  ['models', '모델 비교'],
  ['checklist', '점검 항목'],
  ['details', '상세 기록'],
] as const

type Tab = (typeof TABS)[number][0]

function conclusion({ attempts, confirmed_findings, needs_review_findings }: ReportSummary) {
  if (attempts === 0) return { tone: 'neutral', title: '판정할 결과가 없습니다', text: '테스트가 끝까지 진행되지 않았습니다.' }
  if (confirmed_findings > 0) return { tone: 'danger', title: `취약점 ${confirmed_findings}건이 확인되었습니다`, text: '요청으로 재현되어 증거가 남은 문제입니다. ‘발견한 취약점’ 탭에서 내용과 해결 방법을 확인하세요.' }
  if (needs_review_findings > 0) return { tone: 'warn', title: `사람의 검토가 필요한 항목이 ${needs_review_findings}건 있습니다`, text: '확정된 취약점은 없지만 판단이 끝나지 않은 항목이 있습니다.' }
  return { tone: 'neutral', title: '이번 범위에서 재현된 취약점이 없습니다', text: '재현되지 않았다는 뜻이며 안전을 보장하지는 않습니다.' }
}

export default function ReportPage({ id }: { id: string }) {
  const { data: report, error } = usePoll(() => api.fetchReport(id), [id], () => true)
  const [tab, setTab] = useState<Tab>('summary')

  if (!report) {
    return error
      ? <p className="notice" role="status">{error} <a className="link" href={`#/executions/${id}`}>실행 모니터로 돌아가기</a></p>
      : <p className="notice">불러오는 중…</p>
  }

  const { summary } = report
  const result = conclusion(summary)

  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `adaptive-red-team-${report.execution_id}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <div className="heading">
        <div>
          <h1>결과 보고서</h1>
          <p className="subtitle">{report.settings.scenario_name} · {report.settings.environment} · {dateTime(report.generated_at)} 생성</p>
        </div>
        <div className="actions noprint">
          <SourceBadge isMock={report.is_mock} />
          <button onClick={exportJson}>파일로 저장</button>
          <button onClick={() => print()}>인쇄</button>
        </div>
      </div>

      {report.partial && (
        <p className="notice warn" role="alert">
          일부 AI가 끝까지 실행되지 않아 결과가 일부만 포함되어 있습니다.
        </p>
      )}

      <div className="tabs noprint" role="tablist" aria-label="보고서 내용">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      <div className="tabpanel" role="tabpanel" hidden={tab !== 'summary'}>
        <div className={`conclusion ${result.tone}`}>
          <h2>{result.title}</h2>
          <p>{result.text}</p>
        </div>
        <div className="report-summary">
          <div className="card"><small>재현 성공 / 전체 시도</small><strong>{summary.reproduced} / {summary.attempts}</strong><span>미재현 {summary.not_reproduced} · 오류 {summary.errors}</span></div>
          <div className="card"><small>확정 취약점 / 검토 필요</small><strong>{summary.confirmed_findings} / {summary.needs_review_findings}</strong><span>중복 제거 후 건수</span></div>
          <div className="card"><small>걸린 시간</small><strong>{duration(summary.duration_ms)}</strong><span>토큰 {count(summary.tokens)}</span></div>
          <div className="card"><small>예상 비용</small><strong>{usd(summary.cost_usd)}</strong><span>실제 청구액 아님</span></div>
        </div>
        <RankingSection combinations={report.combinations} />
      </div>

      <div className="tabpanel" role="tabpanel" hidden={tab !== 'findings'}>
        <FindingsSection report={report} />
      </div>

      <div className="tabpanel" role="tabpanel" hidden={tab !== 'models'}>
        <ComparisonSection report={report} />
        <MethodsSection report={report} />
      </div>

      <div className="tabpanel" role="tabpanel" hidden={tab !== 'checklist'}>
        <ChecklistSection checklist={report.checklist} />
      </div>

      <div className="tabpanel" role="tabpanel" hidden={tab !== 'details'}>
        <SettingsSection settings={report.settings} />
        <AttemptsSection report={report} />
        <p className="subtitle evaluator">판정: {report.evaluator} · 실행 ID <span className="mono">{report.execution_id}</span></p>
      </div>
    </>
  )
}
