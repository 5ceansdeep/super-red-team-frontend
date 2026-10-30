import type { CheckStatus, RunStatus, TestAttempt, Verdict } from './api/types.ts'

export type Tone = '' | 'orange' | 'green' | 'red'

export const RUN_STATUS: Record<RunStatus, { label: string; tone: Tone }> = {
  pending: { label: '대기', tone: '' },
  running: { label: '실행 중', tone: 'orange' },
  completed: { label: '완료', tone: 'green' },
  failed: { label: '실패', tone: 'red' },
  cancelled: { label: '취소됨', tone: '' },
}

export const VERDICT: Record<Verdict, { label: string; tone: Tone }> = {
  confirmed: { label: '취약점 확정', tone: 'red' },
  needs_review: { label: '검토 필요', tone: 'orange' },
  false_positive: { label: '오탐', tone: '' },
}

export const CHECK: Record<CheckStatus, { label: string; tone: Tone }> = {
  vulnerable: { label: '취약', tone: 'red' },
  passed: { label: '통과', tone: 'green' },
  needs_review: { label: '검토 필요', tone: 'orange' },
  not_applicable: { label: '적용 대상 아님', tone: '' },
  not_run: { label: '미실시', tone: '' },
}

// null과 실행 오류는 통과나 안전이 아니다.
export function reproducedLabel(attempt: Pick<TestAttempt, 'reproduced' | 'error'>): { label: string; tone: Tone } {
  if (attempt.reproduced === true) return { label: '재현 성공', tone: 'red' }
  if (attempt.reproduced === false) return { label: '미재현', tone: '' }
  return attempt.error ? { label: '실행 오류', tone: 'orange' } : { label: '판정 불가', tone: 'orange' }
}
