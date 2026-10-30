import { useEffect, useState } from 'react'
import { api, isMock } from './api/index.ts'
import { Tag } from './components/StatusBadge.tsx'
import GuidePage from './pages/GuidePage.tsx'
import MonitorPage from './pages/MonitorPage.tsx'
import RecentRunsPage from './pages/RecentRunsPage.tsx'
import ReportPage from './pages/ReportPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import { usePoll } from './usePoll.ts'

// 해시 라우팅: Vercel 정적 배포에서 rewrite 설정 없이 새로고침이 동작한다.
function useRoute() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const update = () => setHash(location.hash)
    addEventListener('hashchange', update)
    return () => removeEventListener('hashchange', update)
  }, [])
  return hash.replace(/^#/, '') || '/'
}

export default function App() {
  const route = useRoute()
  const match = route.match(/^\/executions\/([\w-]+)(\/report)?$/)
  const id = match?.[1]
  const { data: health, error: healthError } = usePoll(api.fetchHealth, [], () => false, 10_000)

  const nav = (href: string, label: string, active: boolean) => (
    <a className={active ? 'nav active' : 'nav'} href={href} aria-current={active ? 'page' : undefined}>{label}</a>
  )

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#/">
          <span className="brandmark">A</span>
          <span>Adaptive<small>RED TEAM LAB</small></span>
        </a>
        <div className="navlabel">메뉴</div>
        {nav('#/guide', '사용 안내', route === '/guide')}
        {nav('#/new', '실행 설정', route === '/new')}
        {nav('#/', '실행 기록', route === '/')}
        {id && nav(`#/executions/${id}`, '실행 모니터', !match?.[2])}
        {id && nav(`#/executions/${id}/report`, '결과 보고서', Boolean(match?.[2]))}
        <div className="sidebottom">
          <span className={healthError ? 'dot down' : 'dot'} />
          {isMock ? '시연 환경' : healthError ? '백엔드 연결 실패' : health ? '백엔드 연결됨' : '연결 확인 중'}
          <p>등록된 격리 환경만 사용합니다.</p>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="crumb">Super Red Team</span>
          <Tag label={isMock ? '시연 데이터' : 'LIVE API'} tone={isMock ? '' : 'green'} />
        </header>
        <main className="content">
          {route === '/guide' ? <GuidePage />
            : route === '/new' ? <SettingsPage />
            : id && match?.[2] ? <ReportPage key={id} id={id} />
            : id ? <MonitorPage key={id} id={id} />
            : route === '/' ? <RecentRunsPage />
            : <p className="notice">페이지를 찾을 수 없습니다. <a className="link" href="#/">실행 기록으로</a></p>}
        </main>
      </div>
    </div>
  )
}
