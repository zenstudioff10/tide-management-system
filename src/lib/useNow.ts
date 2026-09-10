import { useEffect, useState } from 'react'

/** A ticking clock scoped to one component, so a second's passing never
 *  re-renders the whole app. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(iv)
  }, [intervalMs])
  return now
}
