import * as mock from '../mocks/mockApi.ts'
import * as http from './http.ts'

// Mock/실제 분기는 여기 한 곳뿐이다. 화면은 이 파일의 api만 사용한다.
export const isMock = import.meta.env.VITE_USE_MOCK !== 'false'
export const api: typeof http = isMock ? mock : http
export const demoExecutionIds = isMock ? mock.DEMO_EXECUTION_IDS : []
