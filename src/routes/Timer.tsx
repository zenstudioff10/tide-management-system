import { useState } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { useTimers } from '../store/useTimers'
import { useNow } from '../lib/useNow'
import { fmtClock, fmtDateLine, fmtDuration, meridiem } from '../lib/time'
import { IconPause, IconPlay, IconSkip, IconSurface } from '../design/icons'
import type { PomodoroConfig } from '../types'

const PRESETS = [5, 10, 15, 25, 45, 60]

type Mode = 'pomodoro' | 'countdown' | 'stopwatch'

const PHASE_NAME: Record<string, string> = {
  idle: 'siap',
  focus: 'fokus',
  break: 'istirahat',
  long: 'istirahat panjang',
}

function zoneTime(now: number, zone: string, h24: boolean): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: !h24,
      timeZone: zone,
    }).format(now)
  } catch {
    return '—'
  }
}

/** A small inline stepper — the durations are edited where they are used. */
function Stepper({
  label,
  value,
  min = 1,
  max = 180,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
}) {
  return (
    <span className="stepper">
      <span className="gauge-label">{label}</span>
      <button
        className="stepper-key"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label={`${label} kurang`}
      >
        −
      </button>
      <span className="stepper-value mono">{value}</span>
      <button
        className="stepper-key"
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label={`${label} tambah`}
      >
        +
      </button>
    </span>
  )
}

export function Timer() {
  const now = useNow(250)
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)
  const pomo = useTimers((s) => s.pomo)
  const cycle = useTimers((s) => s.cycle)
  const cd = useTimers((s) => s.cd)
  const sw = useTimers((s) => s.sw)
  const [custom, setCustom] = useState('')

  // opening the tab shows whatever is already running
  const [mode, setMode] = useState<Mode>(() => {
    if (useTimers.getState().pomo.mode !== 'idle') return 'pomodoro'
    if (useTimers.getState().cd.totalMs) return 'countdown'
    if (useTimers.getState().sw.running) return 'stopwatch'
    return 'pomodoro'
  })

  const cfg = settings.pomodoro
  const setCfg = (patch: Partial<PomodoroConfig>) =>
    setSettings({ pomodoro: { ...cfg, ...patch } })

  const timers = useTimers.getState()
  const face =
    mode === 'pomodoro'
      ? fmtDuration(pomo.mode === 'idle' ? cfg.focus * 60_000 : timers.pomoRemaining())
      : mode === 'countdown'
        ? fmtDuration(cd.totalMs ? timers.cdRemaining() : 0)
        : fmtDuration(timers.swElapsed())

  const progress =
    mode === 'pomodoro'
      ? timers.pomoProgress()
      : mode === 'countdown'
        ? timers.cdProgress()
        : 0

  const running =
    mode === 'pomodoro' ? pomo.running : mode === 'countdown' ? cd.running : sw.running

  const startCustom = () => {
    const m = custom.trim().match(/^(\d{1,3})(?::(\d{2}))?$/)
    if (!m) return
    const ms = Number(m[1]) * 60_000 + Number(m[2] ?? 0) * 1000
    if (ms > 0) timers.startCountdown(ms, `${custom} menit`)
    setCustom('')
  }

  const toggle = () => {
    if (mode === 'pomodoro') timers.pomoToggle()
    else if (mode === 'countdown') timers.toggleCountdown()
    else timers.swToggle()
  }

  return (
    <div className="timer-route">
      <header className="depths-head">
        <button className="icon-button" onClick={() => useUi.getState().go('surface')} title="Surface">
          <IconSurface size={18} />
        </button>
        <nav className="mode-switch">
          {(
            [
              ['pomodoro', 'pomodoro'],
              ['countdown', 'hitung mundur'],
              ['stopwatch', 'stopwatch'],
            ] as [Mode, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className="mode-key"
              data-on={mode === key ? '' : undefined}
              onClick={() => setMode(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="timer-stage">
        <div className="timer-sheet">
          <p className="timer-face display" data-running={running ? '' : undefined}>
            {face}
          </p>

          <div className="timer-drain">
            <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>

          {mode === 'pomodoro' && (
            <div className="timer-phase">
              <span className="timer-pips" aria-hidden data-idle={pomo.mode === 'idle' ? '' : undefined}>
                {Array.from({ length: cfg.cyclesBeforeLong }).map((_, i) => (
                  <span
                    key={i}
                    className="timer-pip"
                    data-on={i < cycle % cfg.cyclesBeforeLong ? '' : undefined}
                  />
                ))}
              </span>
              <span className="gauge-label">
                {PHASE_NAME[pomo.mode]}
                {pomo.mode !== 'idle' &&
                  ` · sesi ${(cycle % cfg.cyclesBeforeLong) + 1} dari ${cfg.cyclesBeforeLong}`}
              </span>
            </div>
          )}

          {mode === 'countdown' && cd.label && (
            <span className="gauge-label">{cd.label}</span>
          )}

          <div className="timer-controls">
            <button className="icon-button big" onClick={toggle} disabled={mode === 'countdown' && !cd.totalMs}>
              {running ? <IconPause size={22} /> : <IconPlay size={22} />}
            </button>

            {mode === 'pomodoro' && (
              <>
                <button
                  className="icon-button"
                  onClick={() => timers.pomoSkip()}
                  disabled={pomo.mode === 'idle'}
                  title="Lewati"
                >
                  <IconSkip size={18} />
                </button>
                <button className="quiet-button subtle" onClick={() => timers.pomoReset()}>
                  reset
                </button>
              </>
            )}

            {mode === 'countdown' && (
              <button className="quiet-button subtle" onClick={() => timers.clearCountdown()}>
                bersihkan
              </button>
            )}

            {mode === 'stopwatch' && (
              <>
                <button className="quiet-button subtle" onClick={() => timers.swLap()}>
                  lap
                </button>
                <button className="quiet-button subtle" onClick={() => timers.swReset()}>
                  reset
                </button>
              </>
            )}
          </div>

          {mode === 'pomodoro' && (
            <div className="timer-settings">
              <Stepper label="fokus" value={cfg.focus} onChange={(v) => setCfg({ focus: v })} />
              <Stepper label="istirahat" value={cfg.short} onChange={(v) => setCfg({ short: v })} />
              <Stepper label="panjang" value={cfg.long} onChange={(v) => setCfg({ long: v })} />
              <Stepper
                label="siklus"
                value={cfg.cyclesBeforeLong}
                min={2}
                max={12}
                onChange={(v) => setCfg({ cyclesBeforeLong: v })}
              />
              <button
                className="quiet-button subtle"
                data-on={cfg.autoStartBreak ? '' : undefined}
                onClick={() => setCfg({ autoStartBreak: !cfg.autoStartBreak })}
              >
                istirahat otomatis
              </button>
              <button
                className="quiet-button subtle"
                data-on={cfg.autoStartNext ? '' : undefined}
                onClick={() => setCfg({ autoStartNext: !cfg.autoStartNext })}
              >
                lanjut otomatis
              </button>
            </div>
          )}

          {mode === 'countdown' && (
            <div className="timer-presets">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  className="quiet-button subtle"
                  onClick={() => timers.startCountdown(m * 60_000, `${m} menit`)}
                >
                  {m}
                </button>
              ))}
              <input
                className="field mono timer-custom"
                value={custom}
                placeholder="mm:ss"
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') startCustom()
                  e.stopPropagation()
                }}
              />
            </div>
          )}

          {mode === 'stopwatch' && sw.laps.length > 0 && (
            <ol className="lap-list mono">
              {sw.laps.map((lap, i) => (
                <li key={`${lap}-${i}`}>
                  <span className="gauge-label">{sw.laps.length - i}</span>
                  {fmtDuration(lap)}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <footer className="timer-foot">
        <span className="mono timer-wall">
          {fmtClock(now, settings.clock24h, settings.showSeconds)}
          {!settings.clock24h && <span className="clock-meridiem"> {meridiem(now)}</span>}
        </span>
        <span className="gauge-label">{fmtDateLine(now)}</span>
        {settings.secondClockZone && (
          <span className="gauge-label">
            {settings.secondClockZone.split('/').pop()?.replace('_', ' ')}{' '}
            <span className="mono">{zoneTime(now, settings.secondClockZone, settings.clock24h)}</span>
          </span>
        )}
        <span className="timer-foot-spacer" />
        <button
          className="quiet-button subtle"
          onClick={() => setSettings({ clock24h: !settings.clock24h })}
        >
          {settings.clock24h ? '24 jam' : '12 jam'}
        </button>
        <button
          className="quiet-button subtle"
          onClick={() => setSettings({ showSeconds: !settings.showSeconds })}
        >
          {settings.showSeconds ? 'detik on' : 'detik off'}
        </button>
      </footer>
    </div>
  )
}
