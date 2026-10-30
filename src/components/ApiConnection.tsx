import { useState } from 'react'
import { connection, saveConnection } from '../api/connection.ts'

export default function ApiConnection() {
  const [values, setValues] = useState(connection)
  const [error, setError] = useState('')
  return <details className="card pad connection" open={!values.token && import.meta.env.VITE_API_BASE_URL !== '/api'}>
    <summary>백엔드 연결 설정</summary>
    <form onSubmit={(event) => {
      event.preventDefault()
      try { saveConnection(values.base, values.token, values.mode); location.reload() }
      catch (err) { setError(err instanceof Error ? err.message : '연결 설정을 저장할 수 없습니다.') }
    }}>
      <label className="field">백엔드 주소<input value={values.base} required onChange={(e) => setValues({ ...values, base: e.target.value })} /></label>
      <label className="field">접근 토큰<input type="password" autoComplete="off" value={values.token} onChange={(e) => setValues({ ...values, token: e.target.value })} /></label>
      <label className="field">실행 방식<select value={values.mode} onChange={(e) => setValues({ ...values, mode: e.target.value })}>
        <option value="mock">고정 순서 점검 · 모델 호출 없음</option><option value="live">실제 AI 점검 · API 사용량 발생</option>
      </select></label>
      <p className="muted tiny">접근 토큰은 이 탭의 세션에만 저장됩니다. 모델 API 키를 입력하지 마세요.</p>
      {error && <p role="alert" className="notice error">{error}</p>}
      <button className="primary">저장하고 연결</button>
    </form>
  </details>
}
