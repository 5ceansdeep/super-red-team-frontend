import type { Report } from '../../api/types.ts'
import { count, duration, usd } from '../../format.ts'

export default function MethodsSection({ report }: { report: Report }) {
  return (
    <section>
      <div className="sectionhead"><h2>테스트 방법별 결과</h2></div>
      {report.method_results.length === 0 ? <p className="notice">완료된 테스트 시도가 없습니다.</p> : (
        <div className="card">
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>방법 / 대상</th><th>모델</th><th className="num">시도</th><th className="num">재현 성공</th>
                  <th className="num">미재현</th><th className="num">오류</th><th className="num">소요 시간</th>
                  <th className="num">토큰</th><th className="num">추정 비용</th>
                </tr>
              </thead>
              <tbody>
                {report.method_results.map((m) => (
                  <tr key={`${m.method_id}-${m.agent_id}`}>
                    <td className="tablemodel">{m.method_id} · {m.method_name}<small className="mono">{m.target}</small></td>
                    <td>{m.model_name}</td>
                    <td className="num">{m.attempts}</td>
                    <td className="num">{m.reproduced}</td>
                    <td className="num">{m.not_reproduced}</td>
                    <td className="num">{m.errors}</td>
                    <td className="num">{duration(m.duration_ms)}</td>
                    <td className="num">{count(m.tokens)}</td>
                    <td className="num">{usd(m.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="methodnote">미재현은 해당 시도에서 재현되지 않았다는 뜻이며 안전을 보장하지 않습니다. 오류는 판정이 나지 않은 시도입니다.</p>
        </div>
      )}
    </section>
  )
}
