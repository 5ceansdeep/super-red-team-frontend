import { useEffect, useState } from 'react'

// load를 주기적으로 호출한다. isDone이 true를 돌려주면 멈춘다. 실패해도 마지막 값은 유지한다.
export function usePoll<T>(load: () => Promise<T>, deps: unknown[], isDone: (value: T) => boolean = () => false, ms = 1500) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const value = await load()
        if (!alive) return
        setData(value)
        setError(undefined)
        if (isDone(value)) return
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : '요청에 실패했습니다')
      }
      timer = setTimeout(tick, ms)
    }
    tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, deps)

  return { data, error }
}
