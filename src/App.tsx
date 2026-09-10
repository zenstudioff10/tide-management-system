import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@tauri-apps/api/core'
import { useApp } from './store/useApp'
import { useUi } from './store/useUi'
import { useTimers } from './store/useTimers'
import { Ocean } from './ocean/Ocean'
import { Surface } from './routes/Surface'
import { Depths } from './routes/Depths'
import { Focus } from './routes/Focus'
import { Timer } from './routes/Timer'
import { Reminders } from './routes/Reminders'
import { Settings } from './routes/Settings'
import { TaskDrawer } from './components/TaskDrawer'
import { TaskCompose } from './components/TaskCompose'
import { ConfirmHold } from './components/ConfirmHold'
import { Toast } from './components/Toast'
import { Burst } from './components/Burst'
import { CommandPalette } from './components/CommandPalette'
import { dueReminders } from './store/selectors'
import { INTRO_MS, introDepth, useIntro } from './intro/useIntro'
import { dismissBoot } from './lib/boot'
import { flushPending, watchSaves } from './lib/persist'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { useOcean } from './ocean/useOcean'
import { quickParse } from './lib/quickparse'
import { chime, wakeAudio } from './lib/chime'
import { installUiSounds } from './lib/uisound'
import { ensureNotifyPermission, notify } from './lib/notify'
import type { Route } from './types'

/** How deep each place sits, so a route change can travel rather than blink.
 *  The water already dives when you go down; the type should agree with it. */
const DEPTH: Record<Route, number> = {
  surface: 0,
  focus: 1,
  timer: 1,
  reminders: 1,
  settings: 1,
  depths: 2,
}

const ROUTES: Record<Route, () => React.ReactElement> = {
  surface: Surface,
  depths: Depths,
  focus: Focus,
  timer: Timer,
  reminders: Reminders,
  settings: Settings,
}

const JUMPS: Record<string, Route> = {
  s: 'surface',
  d: 'depths',
  f: 'focus',
  t: 'timer',
  r: 'reminders',
  ',': 'settings',
}

export default function App() {
  const ready = useApp((s) => s.ready)
  const ambient = useApp((s) => s.settings.ambient)
  const route = useUi((s) => s.route)
  const introDone = useIntro((s) => s.done)
  const [booted, setBooted] = useState(false)
  const [chord, setChord] = useState(false)

  useEffect(() => {
    void useApp.getState().hydrate()
    void ensureNotifyPermission()
  }, [])

  // the loading screen goes when there is something real to show
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void dismissBoot().then(() => {
      if (!cancelled) setBooted(true)
    })
    return () => {
      cancelled = true
    }
  }, [ready])

  // the ascent: one rAF loop publishing the launch clock into the water.
  // It waits for the loading screen, so it always begins from the floor rather
  // than playing its first second out of sight behind it.
  useEffect(() => {
    if (!booted) return
    const intro = useIntro.getState()
    if (intro.done) {
      useOcean.getState().setIntro(0)
      return
    }

    const started = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - started) / INTRO_MS)
      useIntro.getState().setProgress(p)
      useOcean.getState().setIntro(introDepth(p))
      if (p < 1) raf = requestAnimationFrame(step)
      else useIntro.getState().finish()
    }
    useOcean.getState().setIntro(1)
    raf = requestAnimationFrame(step)

    // any input lands you at the surface at once
    const skip = () => {
      cancelAnimationFrame(raf)
      useOcean.getState().setIntro(0)
      useIntro.getState().finish()
    }
    window.addEventListener('pointerdown', skip, { once: true })
    window.addEventListener('keydown', skip, { once: true })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [booted])

  // every path out of the app writes first: hiding, blurring, closing, quitting
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void flushPending()
    }
    document.addEventListener('visibilitychange', onHidden)

    let stopFocus: (() => void) | undefined
    let stopFlush: (() => void) | undefined
    if (isTauri()) {
      void getCurrentWindow()
        .onFocusChanged(({ payload: focused }) => {
          if (!focused) void flushPending()
        })
        .then((off) => (stopFocus = off))

      // Rust holds the exit open until this lands
      void listen('tide://flush', async () => {
        await flushPending()
        await invoke('confirm_exit')
      }).then((off) => (stopFlush = off))
    }

    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      stopFocus?.()
      stopFlush?.()
    }
  }, [])

  // a write that fails must never fail quietly
  useEffect(
    () =>
      watchSaves(({ error }) => {
        if (error) useUi.getState().showToast('save-error', `Gagal menyimpan — ${error}`)
      }),
    [],
  )

  // deep links: changing the hash navigates, not just on first load
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1) as Route
      if (hash && hash in ROUTES) useUi.getState().go(hash)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // one heartbeat drives every clock in the app, and the water with them
  useEffect(() => {
    const beat = window.setInterval(() => {
      const timers = useTimers.getState()
      timers.poll()

      // a running session drains the tide; a break lets it rise again
      const focusing = timers.pomo.mode === 'focus' && timers.pomo.running
      const resting = timers.pomo.mode !== 'idle' && !focusing
      const drain = focusing
        ? 0.1 + timers.pomoProgress() * 0.5
        : timers.cd.running
          ? 0.1 + timers.cdProgress() * 0.5
          : resting
            ? 0.04
            : 0
      useOcean.getState().setDrain(drain)
    }, 250)
    return () => window.clearInterval(beat)
  }, [])

  // reminders ring from here, whichever screen you are on
  useEffect(() => {
    const check = () => {
      const app = useApp.getState()
      if (!app.ready) return
      for (const r of dueReminders(app)) {
        chime('reminder', app.settings.chimeVolume)
        void notify(r.title, 'moored for now')
        app.markFired(r.id)
      }
    }
    check()
    const iv = window.setInterval(check, 5000)
    // the week label has to survive midnight without an edit to trigger it
    const weekly = window.setInterval(() => useApp.getState().syncAutoWeek(), 60_000)
    return () => {
      window.clearInterval(iv)
      window.clearInterval(weekly)
    }
  }, [])

  // text captured by the hotkey bar arrives as an event: one window owns writes
  useEffect(() => {
    if (!isTauri()) return
    const unlisten = listen<string>('tide://capture', (event) => {
      const app = useApp.getState()
      const parsed = quickParse(event.payload, app.options)
      if (!parsed.title.trim()) return
      app.addTask({
        title: parsed.title,
        optionIds: parsed.optionIds,
        dueAt: parsed.dueAt,
      })
    })
    return () => {
      void unlisten.then((off) => off())
    }
  }, [])

  // menu bar commands
  useEffect(() => {
    if (!isTauri()) return
    const unlisten = listen<string>('tide://tray', (event) => {
      if (event.payload === 'focus') useUi.getState().go('focus')
    })
    return () => {
      void unlisten.then((off) => off())
    }
  }, [])

  // global keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        useUi.getState().startCompose('')
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useUi.getState().setPalette(!useUi.getState().paletteOpen)
        return
      }
      if (typing) return

      if (e.key === 'Escape') {
        // the confirmation is the topmost layer; it dismisses alone
        if (useUi.getState().confirm) return
        useUi.getState().openTask(null)
        useUi.getState().setPalette(false)
        useUi.getState().endCompose()
        return
      }
      if (chord) {
        const jump = JUMPS[e.key.toLowerCase()]
        if (jump) useUi.getState().go(jump)
        setChord(false)
        return
      }
      if (e.key === 'g') {
        setChord(true)
        window.setTimeout(() => setChord(false), 1200)
        return
      }
      if (e.key === 'n') useUi.getState().startCompose('')
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', wakeAudio, { once: true })
    const silence = installUiSounds()
    return () => {
      window.removeEventListener('keydown', onKey)
      silence()
    }
  }, [chord])

  const View = ROUTES[route]
  const came = useRef<Route>(route)
  const dir =
    DEPTH[route] > DEPTH[came.current] ? 'down' : DEPTH[route] < DEPTH[came.current] ? 'up' : 'across'
  useEffect(() => {
    came.current = route
  }, [route])

  return (
    <div className="app" data-route={route}>
      <Ocean mode={ambient} />
      <main
        className="app-content"
        data-ready={ready ? '' : undefined}
        data-intro={introDone ? 'done' : 'running'}
      >
        <div className="route" key={route} data-dir={dir}>
          <View />
        </div>
      </main>
      <TaskDrawer />
      <TaskCompose />
      <ConfirmHold />
      <Toast />
      <Burst />
      <CommandPalette />
    </div>
  )
}
