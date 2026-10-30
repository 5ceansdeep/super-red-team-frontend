const STEPS = [
  ['실행 설정', '점검할 대상과 AI 모델 3개를 고르고 실행합니다.'],
  ['실행 모니터', 'AI들이 서로 모르는 상태로 각자 점검하는 과정을 지켜봅니다.'],
  ['결과 보고서', '어떤 취약점을 찾았고 어떤 AI 조합이 가장 잘했는지 확인합니다.'],
]

const TERMS = [
  ['취약점', '다른 사람의 주문을 볼 수 있는 것처럼, 서비스가 막아야 하는데 막지 못한 보안 문제입니다.'],
  ['재현', 'AI가 찾은 문제를 실제 요청으로 다시 일으켜 증거를 남기는 것입니다. 재현되어야 취약점으로 인정합니다.'],
  ['재현율', '같은 시도를 여러 번 했을 때 문제가 실제로 일어난 비율입니다.'],
  ['미재현', '이번 시도에서 문제가 일어나지 않았다는 뜻입니다. 안전하다는 보장은 아닙니다.'],
  ['위험 점수 (CVSS)', '취약점의 심각도를 0~10으로 나타낸 국제 표준 점수입니다. 높을수록 위험합니다.'],
  ['조합 점수', '각 취약점의 위험 점수 × 재현율을 모두 더한 값입니다. 높을수록 심각한 문제를 안정적으로 찾았다는 뜻입니다.'],
  ['독립 실행', 'AI끼리 정보를 공유하지 않고 각자 점검하는 방식입니다. 그래서 공정하게 비교할 수 있습니다.'],
  ['일부 정보 제공 (Gray-box)', 'AI에게 서비스 정보를 일부만 알려 주고 점검하는 방식입니다.'],
  ['측정 불가', '값을 알 수 없다는 뜻입니다. 0으로 지어내지 않고 그대로 알려 줍니다.'],
  ['시연 데이터', '화면 흐름을 보여 주기 위한 가상 데이터입니다. 실제 측정 결과가 아닙니다.'],
]

export default function GuidePage() {
  return (
    <>
      <div className="heading">
        <div>
          <h1>이 사이트는 무엇인가요?</h1>
          <p className="subtitle">여러 AI로 허가된 서비스를 점검해 재현된 취약점을 보고하고, 가장 효율적인 AI 구성을 찾는 사이트입니다.</p>
        </div>
      </div>

      <section className="card pad">
        <h2>쉽게 말하면</h2>
        <p>
          AI 3개를 각각 보안 점검원으로 보내 같은 시험 환경을 점검하게 합니다.
          서로의 답을 볼 수 없게 한 뒤, 증거로 확인된 취약점과 시간·비용을 함께 보고합니다.
        </p>
      </section>

      <section>
        <h2 className="block-title">사용 순서</h2>
        <ol className="steps">
          {STEPS.map(([title, text], i) => (
            <li className="card" key={title}><span className="step-no">{i + 1}</span><b>{title}</b><p>{text}</p></li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="block-title">용어 설명</h2>
        <dl className="card glossary">
          {TERMS.map(([term, text]) => <div key={term}><dt>{term}</dt><dd>{text}</dd></div>)}
        </dl>
      </section>

      <div className="actions guide-actions">
        <a className="button primary" href="#/executions/exec-1042/report">예시 보고서 보기</a>
        <a className="button" href="#/new">직접 실행해 보기</a>
      </div>
    </>
  )
}
