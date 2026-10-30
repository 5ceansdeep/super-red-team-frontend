import type { Combination } from '../api/types.ts'
import { score } from '../format.ts'

// 조합 점수를 막대로 보여 준다. 점수는 백엔드 값이고, 값이 없으면 막대를 그리지 않는다.
export default function ScoreBars({ combinations }: { combinations: Combination[] }) {
  const ranked = [...combinations].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const max = Math.max(...ranked.map((c) => c.score ?? 0))

  return (
    <div className="bars" role="img" aria-label={ranked.map((c) => `${c.models.join(' + ')} ${score(c.score)}`).join(', ')}>
      {ranked.map((c) => (
        <div className="bar-col" key={c.combination_id}>
          <div className="bar-area">
            <span className="bar-value">{score(c.score)}</span>
            {c.score !== null && max > 0 && (
              <div className={c.score === max ? 'bar top' : 'bar'} style={{ height: `${(c.score / max) * 100}%` }} />
            )}
          </div>
          <span className="bar-label">{c.models.join(' + ')}</span>
        </div>
      ))}
    </div>
  )
}
