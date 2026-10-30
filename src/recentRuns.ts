// 계약에 실행 목록 API가 없어 이 브라우저에서 시작한 실행 ID만 기억한다.
const KEY = 'adaptive-red-team:recent-runs'

export function loadRecentRuns(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function save(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, 20)))
  } catch {
    // 저장 불가 환경에서는 목록만 비어 보인다.
  }
}

export const rememberRun = (id: string) => save([id, ...loadRecentRuns().filter((x) => x !== id)])
export const forgetRun = (id: string) => save(loadRecentRuns().filter((x) => x !== id))
