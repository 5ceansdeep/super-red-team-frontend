import { useState } from 'react'
import type { CheckResult, CheckStatus } from '../../api/types.ts'
import { CHECK } from '../../labels.ts'
import { Tag } from '../StatusBadge.tsx'

export default function ChecklistSection({ checklist }: { checklist: CheckResult[] }) {
  const [filter, setFilter] = useState<CheckStatus | 'all'>('all')
  const items = checklist.filter((c) => filter === 'all' || c.status === filter)

  return (
    <section>
      <div className="sectionhead">
        <h2>점검 항목별 결과</h2>
        <label className="noprint">
          <span className="sr">체크리스트 판정 필터</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as CheckStatus | 'all')}>
            <option value="all">전체 항목</option>
            {(Object.keys(CHECK) as CheckStatus[]).map((key) => <option key={key} value={key}>{CHECK[key].label}</option>)}
          </select>
        </label>
      </div>
      <p className="subtitle">‘통과’는 이번 테스트 범위 안에서의 결과입니다.</p>
      <div className="check-grid">
        {[...new Set(items.map((c) => c.group))].map((group) => (
          <article className="card checkgroup" key={group}>
            <h3>{group}</h3>
            {items.filter((c) => c.group === group).map((check) => (
              <div className="checkitem" key={check.id}>
                <div>
                  <b>{check.id} · {check.title}</b>
                  {check.reason && <p className="muted">{check.status === 'not_run' ? '미실시 사유: ' : ''}{check.reason}</p>}
                </div>
                <Tag {...CHECK[check.status]} />
              </div>
            ))}
          </article>
        ))}
      </div>
      <p className="tiny muted" role="status">{items.length} / {checklist.length} 항목 표시</p>
    </section>
  )
}
