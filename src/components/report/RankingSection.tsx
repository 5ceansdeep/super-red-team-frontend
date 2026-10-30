import type { Combination } from '../../api/types.ts'
import { count, score } from '../../format.ts'
import { Tag } from '../StatusBadge.tsx'

export default function RankingSection({ combinations }: { combinations: Combination[] }) {
  // 점수는 백엔드 값 그대로 쓰고 정렬만 한다. 점수가 없는 조합은 맨 뒤로 보낸다.
  const ranked = [...combinations].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const top = ranked[0]?.score
  // 0점이나 측정 불가 조합은 최고의 레드팀이 될 수 없다. 동점이면 함께 강조한다.
  const winners = top ? ranked.filter((c) => c.score === top) : []

  return (
    <section>
      <div className="sectionhead">
        <h2>어떤 AI 조합이 가장 잘 찾았나요?</h2>
        <span className="tiny muted">점수가 높을수록 심각한 취약점을 안정적으로 찾았습니다</span>
      </div>
      {winners.length > 0 ? (
        <div className="recommend">
          <div>
            <div className="eyebrow">{winners.length > 1 ? `공동 1위 ${winners.length}개 조합` : '1위'} · 가장 심각한 취약점을 찾은 최고의 레드팀</div>
            {winners.map((c) => <h3 key={c.combination_id}>{c.models.join(' + ')}</h3>)}
          </div>
          <div className="recscore"><strong>{score(top)}</strong><span>조합 점수</span></div>
        </div>
      ) : (
        <p className="notice">재현된 취약점 점수가 없어 1위를 선정하지 않았습니다.</p>
      )}
      {ranked.length === 0 ? <p className="notice">보고서에 조합 점수가 없습니다.</p> : (
        <div className="card tablewrap gap">
          <table>
            <thead>
              <tr><th>순위</th><th>조합</th><th className="num">집계 발견</th><th className="num">조합 점수</th></tr>
            </thead>
            <tbody>
              {ranked.map((c) => (
                <tr key={c.combination_id} className={winners.includes(c) ? 'winner' : undefined}>
                  <td><span className="rank">{c.score === null ? '–' : ranked.findIndex((x) => x.score === c.score) + 1}</span></td>
                  <td className="tablemodel">
                    {c.models.join(' + ')} {c.is_current && <Tag label="이번 실행" tone="orange" />}
                  </td>
                  <td className="num">{count(c.finding_count)}</td>
                  <td className="num"><b>{score(c.score)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
