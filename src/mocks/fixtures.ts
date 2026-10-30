// Mock 전용 데이터. 모든 내용과 수치는 가상이며 실제 측정값이 아니다.
import type { CheckStatus, Model, Scenario, Severity, Verdict } from '../api/types.ts'

export type EnvKind = 'vulnerable' | 'fixed'

export const MODELS: (Model & { input_per_mtok: number; output_per_mtok: number })[] = [
  // 모델 ID와 단가는 Super_Red_Team_API_인계표.xlsx (2026-10-31 기준). DeepSeek은 시트 계산과 같은 혼잡·캐시 미스 단가.
  { id: 'deepseek-flash', name: 'DeepSeek', provider: 'DeepSeek', input_per_mtok: 0.3, output_per_mtok: 1.2 },
  { id: 'qwen3.8-flash', name: 'Qwen', provider: 'Alibaba Cloud Model Studio', input_per_mtok: 0.15, output_per_mtok: 0.47 },
  { id: 'glm-5.3-flash', name: 'GLM', provider: 'Z.ai', input_per_mtok: 0.15, output_per_mtok: 0.5 },
]

const BASE_SCENARIO = {
  name: '주문 API 객체 접근 제어',
  service: 'orders-api',
  description: '사용자 A/B의 주문을 교차 접근해 객체 소유자 검증을 확인한다.',
  actors: ['사용자 A', '사용자 B'],
  allowed_paths: ['GET /api/orders', 'GET /api/orders/*', 'GET /api/orders/*/receipt', 'POST /api/orders/*/cancel', 'GET /api/admin/stats'],
}

export const SCENARIOS: Scenario[] = [
  { ...BASE_SCENARIO, id: 'orders-bola-vulnerable', environment: '취약 환경', version: 'orders-api 1.3.0' },
  { ...BASE_SCENARIO, id: 'orders-bola-fixed', environment: '수정 환경', version: 'orders-api 1.3.1' },
]

export const SCENARIO_ENV: Record<string, EnvKind> = {
  'orders-bola-vulnerable': 'vulnerable',
  'orders-bola-fixed': 'fixed',
}

export const METHODS: Record<string, { name: string; target: string }> = {
  M01: { name: '객체 ID 변경 조회', target: 'GET /api/orders/{id}' },
  M02: { name: '타 사용자 주문 변경', target: 'POST /api/orders/{id}/cancel' },
  M03: { name: '목록 소유자 파라미터 변조', target: 'GET /api/orders?userId=' },
  M04: { name: '미인증 접근', target: 'GET /api/orders/{id}' },
  M05: { name: '관리자 API 접근', target: 'GET /api/admin/stats' },
  M06: { name: '주문 존재 여부 추측', target: 'GET /api/orders/{id}' },
  M07: { name: '영수증 객체 접근', target: 'GET /api/orders/{id}/receipt' },
}

export interface AttemptSpec {
  method: keyof typeof METHODS
  path: string
  actor: string
  results: (boolean | null)[] // 시도별 reproduced 값
  error?: string
  status_code: number | null
  finding?: string
  response: string
  ms: number
  tokens: number
}

export interface Step {
  at: number // 에이전트 진행률(0~1)에서 이 단계가 일어나는 지점
  slots: number[] // 이 단계를 수행하는 모델 순번
  phase: string
  message: string
  level?: 'info' | 'warn'
  attempt?: AttemptSpec
}

const ALL = [0, 1, 2]
const FORBIDDEN = 'HTTP/1.1 403 Forbidden\n\n{"error":"forbidden"}'

const unauth: Step = {
  at: 0.65, slots: ALL, phase: '실행·증거 수집', message: '미인증 요청 차단 확인',
  attempt: {
    method: 'M04', path: '/api/orders/1043', actor: '미인증', results: [false, false], status_code: 401,
    response: 'HTTP/1.1 401 Unauthorized\n\n{"error":"unauthorized"}', ms: 7000, tokens: 2100,
  },
}

const opening: Step[] = [
  { at: 0.05, slots: ALL, phase: '탐색·가설 생성', message: 'API 명세에서 주문 엔드포인트 4개 식별' },
  { at: 0.12, slots: ALL, phase: '탐색·가설 생성', message: '가설: 주문 ID 변경 시 소유자 검증 누락 가능성' },
  { at: 0.2, slots: ALL, phase: '검증 요청 생성', message: '사용자 B 토큰으로 사용자 A 주문 조회 요청 생성' },
]

const closing: Step[] = [
  { at: 0.92, slots: ALL, phase: '결과 기반 재계획', message: '남은 가설 없음, 탐색 종료' },
  { at: 1, slots: ALL, phase: '완료', message: '에이전트 작업 완료' },
]

export const TIMELINES: Record<EnvKind, Step[]> = {
  vulnerable: [
    ...opening,
    {
      at: 0.3, slots: [0], phase: '실행·증거 수집', message: '타 사용자 주문 조회 재현 (3회 중 3회)',
      attempt: {
        method: 'M01', path: '/api/orders/1043', actor: '사용자 B', results: [true, true, true], status_code: 200,
        finding: 'F-001', response: 'HTTP/1.1 200 OK\n\n{"id":1043,"owner":"user-a","address":"<마스킹>"}', ms: 12000, tokens: 5200,
      },
    },
    {
      at: 0.32, slots: [1], phase: '실행·증거 수집', message: '타 사용자 주문 조회 재현 (3회 중 2회)',
      attempt: {
        method: 'M01', path: '/api/orders/1043', actor: '사용자 B', results: [true, true, false], status_code: 200,
        finding: 'F-001', response: 'HTTP/1.1 200 OK\n\n{"id":1043,"owner":"user-a","address":"<마스킹>"}', ms: 15000, tokens: 6100,
      },
    },
    {
      at: 0.34, slots: [2], phase: '실행·증거 수집', message: '타 사용자 주문 조회 재현 (3회 중 1회)',
      attempt: {
        method: 'M01', path: '/api/orders/1043', actor: '사용자 B', results: [true, false, false], status_code: 200,
        finding: 'F-001', response: 'HTTP/1.1 200 OK\n\n{"id":1043,"owner":"user-a","address":"<마스킹>"}', ms: 13000, tokens: 4300,
      },
    },
    { at: 0.4, slots: ALL, phase: '결과 기반 재계획', message: '조회 우회 확인, 변경·목록 경로로 가설 확장' },
    {
      at: 0.5, slots: [0], phase: '실행·증거 수집', message: '타 사용자 주문 취소 재현 (테스트 데이터, 3회 중 2회)',
      attempt: {
        method: 'M02', path: '/api/orders/1043/cancel', actor: '사용자 B', results: [true, true, false], status_code: 200,
        finding: 'F-002', response: 'HTTP/1.1 200 OK\n\n{"id":1043,"status":"cancelled"}', ms: 14000, tokens: 5600,
      },
    },
    {
      at: 0.55, slots: [1], phase: '실행·증거 수집', message: '목록 조회 userId 변조 재현 (2회 중 2회)',
      attempt: {
        method: 'M03', path: '/api/orders?userId=user-a', actor: '사용자 B', results: [true, true], status_code: 200,
        finding: 'F-003', response: 'HTTP/1.1 200 OK\n\n{"orders":[{"id":1043},{"id":1051}]}', ms: 9000, tokens: 3900,
      },
    },
    {
      at: 0.6, slots: [2], phase: '실행·증거 수집', message: '타 사용자 영수증 조회 재현 (2회 중 2회)',
      attempt: {
        method: 'M07', path: '/api/orders/1043/receipt', actor: '사용자 B', results: [true, true], status_code: 200,
        finding: 'F-006', response: 'HTTP/1.1 200 OK\n\n{"order":1043,"amount":"<마스킹>"}', ms: 8000, tokens: 3200,
      },
    },
    unauth,
    {
      at: 0.72, slots: [1], phase: '실행·증거 수집', message: '관리자 통계 API가 일반 사용자에게 200 응답, 평가 대기',
      attempt: {
        method: 'M05', path: '/api/admin/stats', actor: '사용자 B', results: [false], status_code: 200,
        finding: 'F-004', response: 'HTTP/1.1 200 OK\n\n{"public":true,"totalOrders":18230}', ms: 5000, tokens: 2400,
      },
    },
    {
      at: 0.8, slots: [0], phase: '실행·증거 수집', message: '관리자 API 요청 타임아웃, 판정 불가', level: 'warn',
      attempt: {
        method: 'M05', path: '/api/admin/stats', actor: '사용자 B', results: [null], status_code: null,
        error: '30초 타임아웃', response: '(응답 없음)', ms: 30000, tokens: 1200,
      },
    },
    ...closing,
  ],
  fixed: [
    ...opening,
    {
      at: 0.3, slots: ALL, phase: '실행·증거 수집', message: '타 사용자 주문 조회 미재현 (403)',
      attempt: {
        method: 'M01', path: '/api/orders/1043', actor: '사용자 B', results: [false, false, false], status_code: 403,
        response: FORBIDDEN, ms: 11000, tokens: 4800,
      },
    },
    { at: 0.4, slots: ALL, phase: '결과 기반 재계획', message: '조회 미재현, 변경·목록 경로로 가설 확장' },
    {
      at: 0.5, slots: [0], phase: '실행·증거 수집', message: '타 사용자 주문 취소 미재현 (403)',
      attempt: {
        method: 'M02', path: '/api/orders/1043/cancel', actor: '사용자 B', results: [false, false], status_code: 403,
        response: FORBIDDEN, ms: 9000, tokens: 3700,
      },
    },
    {
      at: 0.55, slots: [1], phase: '실행·증거 수집', message: '목록 조회 userId 변조 미재현 (403)',
      attempt: {
        method: 'M03', path: '/api/orders?userId=user-a', actor: '사용자 B', results: [false, false], status_code: 403,
        response: FORBIDDEN, ms: 8000, tokens: 3300,
      },
    },
    {
      at: 0.6, slots: [2], phase: '실행·증거 수집', message: '타 사용자 영수증 조회 미재현 (403)',
      attempt: {
        method: 'M07', path: '/api/orders/1043/receipt', actor: '사용자 B', results: [false, false], status_code: 403,
        response: FORBIDDEN, ms: 7000, tokens: 2800,
      },
    },
    unauth,
    {
      at: 0.75, slots: [0], phase: '실행·증거 수집', message: '존재/미존재 주문의 응답 코드 차이 관찰, 판정 보류', level: 'warn',
      attempt: {
        method: 'M06', path: '/api/orders/999999', actor: '사용자 B', results: [null], status_code: 404,
        finding: 'F-005', response: 'HTTP/1.1 404 Not Found\n\n{"error":"not_found"}', ms: 6000, tokens: 2500,
      },
    },
    ...closing,
  ],
}

export interface FindingSpec {
  id: string
  title: string
  target: string
  cvss: number | null
  severity: Severity | null
  verdict: Verdict
  impact: string
  remediation: string
  reproduction: string[]
}

export const FINDINGS: Record<EnvKind, FindingSpec[]> = {
  vulnerable: [
    {
      id: 'F-001', title: '타 사용자 주문 상세 조회 가능', target: 'GET /api/orders/{id}', cvss: 7.1, severity: 'High', verdict: 'confirmed',
      impact: '주문 ID만 바꾸면 다른 사용자의 주문 내역과 배송 정보를 볼 수 있다.',
      remediation: '주문 조회 시 인증 사용자와 주문 소유자가 일치하는지 서버에서 검증한다.',
      reproduction: ['사용자 B로 로그인', '사용자 A의 주문 ID로 GET /api/orders/1043 요청', '403이 아닌 200과 주문 내용 확인'],
    },
    {
      id: 'F-002', title: '타 사용자 주문 취소 가능', target: 'POST /api/orders/{id}/cancel', cvss: 7.1, severity: 'High', verdict: 'confirmed',
      impact: '다른 사용자의 주문 상태를 임의로 변경할 수 있다.',
      remediation: '취소 핸들러에도 동일한 소유자 검증을 적용한다.',
      reproduction: ['사용자 A의 테스트 주문 생성', '사용자 B로 POST /api/orders/1043/cancel 요청', '주문 상태가 cancelled로 바뀐 것을 확인'],
    },
    {
      id: 'F-003', title: '목록 조회 userId 파라미터 변조', target: 'GET /api/orders?userId=', cvss: 4.3, severity: 'Medium', verdict: 'confirmed',
      impact: '다른 사용자의 주문 ID 목록이 노출되어 추가 접근의 발판이 된다.',
      remediation: 'userId 파라미터를 무시하고 인증 정보에서 사용자를 결정한다.',
      reproduction: ['사용자 B로 로그인', 'GET /api/orders?userId=user-a 요청', '사용자 A의 주문 목록 응답 확인'],
    },
    {
      id: 'F-004', title: '관리자 통계 API 일반 사용자 접근', target: 'GET /api/admin/stats', cvss: null, severity: null, verdict: 'false_positive',
      impact: '응답이 공개 집계값으로 확인되어 영향 없음.',
      remediation: '조치 불필요. 공개 API로 경로 분류를 정리하면 재탐지를 줄일 수 있다.',
      reproduction: ['사용자 B로 GET /api/admin/stats 요청', '200 응답이지만 public 집계값만 포함'],
    },
    {
      id: 'F-006', title: '타 사용자 주문 영수증 조회 가능', target: 'GET /api/orders/{id}/receipt', cvss: 4.3, severity: 'Medium', verdict: 'confirmed',
      impact: '다른 사용자의 결제 금액과 구매 내역이 노출된다.',
      remediation: '영수증 조회에도 주문 소유자 검증을 적용한다.',
      reproduction: ['사용자 B로 로그인', 'GET /api/orders/1043/receipt 요청', '사용자 A의 영수증 응답 확인'],
    },
  ],
  fixed: [
    {
      id: 'F-005', title: '응답 코드 차이로 주문 존재 여부 추측 가능', target: 'GET /api/orders/{id}', cvss: null, severity: null, verdict: 'needs_review',
      impact: '존재하는 주문은 403, 없는 주문은 404로 응답해 ID 유효성이 드러날 수 있다.',
      remediation: '타인 주문과 미존재 주문의 응답을 동일하게 맞출지 검토한다.',
      reproduction: ['사용자 B로 GET /api/orders/1043 요청 (403)', 'GET /api/orders/999999 요청 (404)'],
    },
  ],
}

// 평가 엔진 정답지에 등록된 취약점 수
export const GROUND_TRUTH: Record<EnvKind, number> = { vulnerable: 4, fixed: 0 }

export interface CheckSpec {
  id: string
  group: string
  title: string
  status: CheckStatus
  reason: string | null
  coverAt: number // 어떤 에이전트든 이 진행률을 넘어야 판정됨
}

const ACCESS = '객체 접근 제어'
const AUTH = '인증·권한'
const commonChecks: CheckSpec[] = [
  { id: 'AU-02', group: AUTH, title: '만료 토큰 재사용 차단', status: 'not_run', reason: '허용 시나리오에 없음', coverAt: 0 },
  { id: 'AC-04', group: ACCESS, title: '테넌트 간 데이터 격리', status: 'not_applicable', reason: '단일 테넌트 서비스', coverAt: 0 },
]

export const CHECKS: Record<EnvKind, CheckSpec[]> = {
  vulnerable: [
    { id: 'AC-01', group: ACCESS, title: '타 사용자 주문 조회 차단', status: 'vulnerable', reason: 'F-001', coverAt: 0.3 },
    { id: 'AC-02', group: ACCESS, title: '타 사용자 주문 변경 차단', status: 'vulnerable', reason: 'F-002', coverAt: 0.5 },
    { id: 'AC-03', group: ACCESS, title: '목록 조회 소유자 필터', status: 'vulnerable', reason: 'F-003', coverAt: 0.55 },
    { id: 'AC-05', group: ACCESS, title: '영수증 소유자 검증', status: 'vulnerable', reason: 'F-006', coverAt: 0.6 },
    { id: 'AU-01', group: AUTH, title: '미인증 요청 차단', status: 'passed', reason: '401 응답 확인', coverAt: 0.65 },
    { id: 'AU-03', group: AUTH, title: '관리자 API 권한 검증', status: 'needs_review', reason: 'F-004는 오탐이나 타임아웃 시도 1건이 판정 불가', coverAt: 0.72 },
    ...commonChecks,
  ],
  fixed: [
    { id: 'AC-01', group: ACCESS, title: '타 사용자 주문 조회 차단', status: 'passed', reason: '403 응답 확인', coverAt: 0.3 },
    { id: 'AC-02', group: ACCESS, title: '타 사용자 주문 변경 차단', status: 'passed', reason: '403 응답 확인', coverAt: 0.5 },
    { id: 'AC-03', group: ACCESS, title: '목록 조회 소유자 필터', status: 'passed', reason: '403 응답 확인', coverAt: 0.55 },
    { id: 'AC-05', group: ACCESS, title: '영수증 소유자 검증', status: 'passed', reason: '403 응답 확인', coverAt: 0.6 },
    { id: 'AU-01', group: AUTH, title: '미인증 요청 차단', status: 'passed', reason: '401 응답 확인', coverAt: 0.65 },
    { id: 'AU-03', group: AUTH, title: '관리자 API 권한 검증', status: 'needs_review', reason: 'F-005 응답 코드 차이 검토', coverAt: 0.75 },
    ...commonChecks,
  ],
}

// 모델 순번별 완주 시 사용량
export const TOTALS: Record<EnvKind, { input: number; output: number }[]> = {
  vulnerable: [{ input: 84200, output: 12600 }, { input: 102500, output: 15400 }, { input: 61300, output: 9800 }],
  fixed: [{ input: 62100, output: 9300 }, { input: 71800, output: 10700 }, { input: 48200, output: 7100 }],
}
