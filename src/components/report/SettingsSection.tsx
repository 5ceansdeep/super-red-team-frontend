import type { ReportSettings } from '../../api/types.ts'

export default function SettingsSection({ settings }: { settings: ReportSettings }) {
  return (
    <section className="card report-intro">
      <div className="eyebrow">테스트 환경 · 범위 · 설정</div>
      <h3>{settings.scenario_name}</h3>
      <dl className="facts">
        {settings.target_url && <><dt>대상 사이트</dt><dd className="mono">{settings.target_url}</dd></>}
        <dt>환경</dt><dd>{settings.environment} · {settings.version}</dd>
        <dt>테스트 계정</dt><dd>{settings.actors.join(' / ')}</dd>
        <dt>범위</dt><dd className="mono">{settings.allowed_paths.join(', ')}</dd>
        <dt>설정</dt><dd>{settings.info_level} · {settings.category} · {settings.tools.join(', ')} · 독립 실행</dd>
        <dt>AI 구성</dt>
        <dd>{settings.agents.map((a) => `${a.model_name} (${a.role}, ${a.prompt_version})`).join(', ')}</dd>
      </dl>
    </section>
  )
}
