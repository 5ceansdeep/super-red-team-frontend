import assert from 'node:assert/strict'
import { afterEach, beforeEach, mock, test } from 'node:test'
import { fetchScenarios, startRun } from './http.ts'

const target = (id: string, environment: string) => ({
  id, name: `VM ${id}`, environment, url: `https://lab.example/lab/${id}`,
  urls: [`https://lab.example/lab/${id}`], allowed_paths: ['/?page=invoice&id=1'],
})
const scenarios = [
  { id: 'orders-v1', name: 'Orders', service: 'orders', accounts: ['A', 'B'], description: '',
    environments: ['vulnerable', 'fixed'], environment_versions: { vulnerable: 'v1', fixed: 'v2' }, allowed_paths: ['/orders/1'] },
  { id: 'web-access-v1', name: 'Website', service: 'web', accounts: ['A', 'B'], description: '',
    environments: ['vulnerable', 'fixed'], environment_versions: { vulnerable: 'web', fixed: 'web' }, allowed_paths: [],
    targets: [target('a', 'vulnerable'), target('b', 'vulnerable'), target('patched', 'fixed')] },
]
const agents = ['a', 'b', 'c'].map((slot) => ({ model_id: `mock/explorer-${slot}`, role: 'tester', prompt_version: 'v1' }))
let sent: Record<string, unknown>[]
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')

beforeEach(() => {
  sent = []
  const values: Record<string, string> = { 'red-team:backend-url': 'https://backend.example', 'red-team:backend-token': 'test-token', 'red-team:execution-mode': 'mock' }
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => values[key] ?? null } })
  mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).endsWith('/scenarios')) return Response.json(scenarios)
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-token')
    sent.push(JSON.parse(String(init?.body)))
    return Response.json({ execution_id: 'run-1' }, { status: 202 })
  })
})

afterEach(() => {
  mock.restoreAll()
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'sessionStorage')
})

test('각 VM은 실제 환경으로 한 번씩만 표시된다', async () => {
  const result = await fetchScenarios()
  assert.equal(result.length, 5)
  const patched = result.filter((s) => s.id.includes(':patched'))
  assert.equal(patched.length, 1)
  assert.equal(patched[0].environment, '수정 환경')
  assert.equal(patched[0].target_url, 'https://lab.example/lab/patched')
})

test('입력 URL을 보내고 이전 선택의 target_id는 보내지 않는다', async () => {
  await fetchScenarios()
  const result = await startRun({ scenario_id: 'web-access-v1:vulnerable:a', target_url: ' https://lab.example/lab/patched/ ', collaboration_mode: 'independent', agents })
  assert.equal(result.execution_id, 'run-1')
  assert.equal(sent[0].target_url, 'https://lab.example/lab/patched/')
  assert.equal('target_id' in sent[0], false)
  assert.equal(sent[0].scenario, 'web-access-v1')
})

test('기존 ID 요청은 호환되고 내장 시나리오에는 URL을 보내지 않는다', async () => {
  await fetchScenarios()
  await startRun({ scenario_id: 'web-access-v1:vulnerable:b', collaboration_mode: 'independent', agents })
  assert.equal(sent[0].target_id, 'b')
  await startRun({ scenario_id: 'orders-v1:fixed', target_url: 'https://lab.example/lab/a', collaboration_mode: 'independent', agents })
  assert.equal('target_url' in sent[1], false)
  assert.equal('target_id' in sent[1], false)
})

test('서버의 대상 URL 거부 이유를 사용자에게 전달한다', async () => {
  await fetchScenarios()
  mock.restoreAll()
  mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Target URL is not registered by the backend operator' }, { status: 422 }))
  await assert.rejects(startRun({ scenario_id: 'web-access-v1:vulnerable:a', target_url: 'https://outside.invalid', collaboration_mode: 'independent', agents }), /Target URL is not registered/)
})
