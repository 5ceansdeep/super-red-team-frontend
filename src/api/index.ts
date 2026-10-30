import * as mock from '../mocks/mockApi.ts'
import * as http from './http.ts'

// Mock/실제 분기는 여기 한 곳뿐이다. 화면은 이 파일의 api만 사용한다.
// ?demo=1 주소는 실제 연결 설정과 무관하게 시연 데이터를 쓴다.
const demo = new URLSearchParams(location.search).has('demo')
export const isMock = demo || import.meta.env.VITE_USE_MOCK !== 'false'
export const api: typeof http = isMock ? mock : http
export const demoExecutionIds = isMock ? mock.DEMO_EXECUTION_IDS : []
