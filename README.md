# Adaptive Red Team Dashboard

Super Red Team의 프론트엔드. 허가된 테스트 환경에서 AI 모델 3종을 독립 실행하고 결과를 비교한다.
협업 방식은 Independent만 지원한다.

## 실행

```bash
npm install
npm run dev
npm test
npm run build
```

기본값은 Mock 모드라 백엔드 없이 전체 흐름이 동작한다.

## Mock / 실제 전환

분기는 `src/api/index.ts` 한 곳뿐이다. 환경 변수만 바꾸면 화면 코드는 그대로다.

```bash
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://api.example.com
```

값은 빌드 시점에 들어간다. Vercel에서는 환경 변수를 설정한 뒤 재배포한다.
API 서버는 대시보드 도메인의 CORS를 허용해야 한다.

## 구조

```
src/api/types.ts      데이터 계약
src/api/http.ts       실제 API 호출 (fetchStatus, fetchReport, startRun, cancelRun 등)
src/api/index.ts      Mock/실제 분기
src/mocks/            Mock 데이터(fixtures.ts)와 가짜 백엔드(mockApi.ts)
src/pages/            실행 설정, 최근 실행, 모니터, 보고서
src/components/       로그, 상태 배지, report/ 보고서 섹션
src/recentRuns.ts     이 브라우저에서 시작한 실행 ID 저장
```

## 연동 API

| API | 용도 |
| --- | --- |
| `GET /health` | 사이드바 연결 상태 (10초 주기) |
| `GET /models` | 모델 목록 3종과 공급자, 100만 토큰당 단가 |
| `GET /scenarios` | 시나리오 목록 |
| `POST /executions` | 실행 시작, 202 + `{ execution_id }` |
| `GET /executions/{id}` | 상태, 1.5초 주기 polling |
| `GET /executions/{id}/logs` | 로그, 1.5초 주기 polling |
| `POST /executions/{id}/cancel` | 취소 |
| `GET /executions/{id}/report` | 최종 보고서 |

경로는 확정이지만 응답 필드 상세는 `src/api/types.ts`의 프론트 제안안이며 백엔드와 합의가 필요하다.

### 백엔드에 요청할 필드

- Finding: `cvss`, `severity`, `reproduce_rate`. 값이 없으면 `null`.
- 보고서: `combinations[]` (`models`, `collaboration_mode`, `score`, `finding_count`, `is_current`).
- 시도: `reproduced`는 `true/false/null`, 실행 오류는 `error`에 사유.
- 비용·토큰을 산출할 수 없으면 0이 아닌 `null`.
- 실행·보고서: 결과 출처 `is_mock`. `false`면 `실측 결과`, 없으면 `출처 미확인`으로 표시한다.
- 보고서 집계: `summary`, `method_results`, `comparison`. `comparison.agents`에 모델별 시간·토큰·비용을 포함한다.

## 표시 규칙

- 숫자는 백엔드 값을 그대로 쓴다. 프론트는 조합을 점수순으로 정렬하고 순위만 매긴다.
- 조합 점수가 0이거나 `null`이면 1위를 선정하지 않는다. 동점은 공동 1위로 표시한다.
- `reproduced: null`은 `실행 오류` 또는 `판정 불가`로 표시하며 통과로 세지 않는다.
- `null` 비용·토큰·CVSS는 `측정 불가`로 표시한다.
- 시연 데이터 모드에서는 상단 `시연 데이터` 표시로 실제 측정이 아님을 알린다. 이 표시는 제거하지 않는다.
- `status: completed`여도 실패한 에이전트가 있으면 `완료 · 일부 실패`로 표시한다.

## 사용 모델

`Super_Red_Team_API_인계표.xlsx` 기준이며 실제 호출은 아직 검증하지 않았다.

| 모델 | Model ID | 입력 $/1M | 출력 $/1M |
| --- | --- | --- | --- |
| DeepSeek | `deepseek-flash` | 0.30 (혼잡·캐시 미스) | 1.20 |
| Qwen | `qwen3.8-flash` | 0.15 | 0.47 |
| GLM | `glm-5.3-flash` | 0.15 | 0.50 |

시연 데이터의 성능·발견 결과는 가상이며 실제 모델의 성능이 아니다. API 키는 프론트에 넣지 않는다.

## 알려진 한계

- 실제 백엔드와 연결해 본 적이 없다. `http.ts`는 미검증이다.
- 계약에 실행 목록 API가 없어 최근 실행은 이 브라우저의 localStorage 기준이다.
- 역할·프롬프트 버전 목록을 주는 API가 없어 프론트에 임시 상수로 둔다.
- Mock 실행은 메모리에만 있어 새로고침하면 새로 만든 실행이 사라진다.
- Mock의 모든 수치, CVSS, 증거는 가상이다.
- 수정 환경은 별도 시나리오 항목으로 표현했다.
- 조합별 비교 데이터가 어느 실행에서 집계되는지는 백엔드 정의가 필요하다.

## Vercel 배포

Vite로 자동 감지된다(빌드 `npm run build`, 출력 `dist`). 해시 라우팅이라 rewrite 설정이 필요 없다.
