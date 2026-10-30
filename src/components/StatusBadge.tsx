import type { AgentRun, RunStatus } from '../api/types.ts'
import type { Tone } from '../labels.ts'
import { RUN_STATUS } from '../labels.ts'

export const Tag = ({ label, tone = '' }: { label: string; tone?: Tone }) => <span className={`tag ${tone}`}>{label}</span>

// 완료라도 실패한 에이전트가 있으면 성공처럼 보이지 않게 한다.
export function RunBadge({ status, agents }: { status: RunStatus; agents?: AgentRun[] }) {
  const failed = agents?.filter((a) => a.status === 'failed').length ?? 0
  if (status === 'completed' && failed > 0) return <Tag label="완료 · 일부 실패" tone="orange" />
  return <Tag {...RUN_STATUS[status]} />
}

// 시연 데이터는 상단 표시가 모든 화면에서 알려 준다. 서버가 is_mock을 주지 않으면 실제로 단정하지 않는다.
export function SourceBadge({ isMock }: { isMock?: boolean }) {
  if (isMock === undefined) return <Tag label="출처 미확인" tone="orange" />
  return isMock ? null : <Tag label="실측 결과" tone="green" />
}
