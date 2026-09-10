import { useEffect, useRef, useState } from 'react'
import { FRAG, VERT } from './shaders'
import { paletteAt, toCss, type Palette } from './palette'
import { useOcean } from './useOcean'
import { timeOfDay } from '../lib/time'

/** Publishes the hour's palette to CSS so the interface matches the water. */
function applyCssPalette(p: Palette) {
  const root = document.documentElement.style
  root.setProperty('--tod-sky', toCss(p.sky))
  root.setProperty('--tod-horizon', toCss(p.horizon))
  root.setProperty('--tod-light', toCss(p.light))
  root.setProperty('--tod-glow', toCss(p.glow))
  // midday water is bright enough to swallow light type — the ground under the
  // interface thickens with the sun so contrast never depends on the hour
  root.setProperty('--tod-scrim', (0.1 + p.elevation * 0.12).toFixed(3))
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

/** Sun/moon travel: east at dawn, west at dusk, low arc overnight. */
function sunPosition(day: number): [number, number] {
  const angle = (day - 0.25) * Math.PI * 2
  return [0.5 + Math.cos(angle) * -0.42, 0.62 + Math.sin(angle) * 0.34]
}

interface Props {
  /** 'still' skips WebGL entirely and paints the same palette as a gradient */
  mode?: 'shader' | 'still'
}

export function Ocean({ mode = 'shader' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const [palette, setPalette] = useState<Palette>(() => paletteAt(timeOfDay(Date.now())))

  // the hour moves slowly; a minute's resolution is more than the eye needs
  useEffect(() => {
    const tick = () => {
      const p = paletteAt(timeOfDay(Date.now()))
      setPalette(p)
      applyCssPalette(p)
    }
    tick()
    const iv = window.setInterval(tick, 30_000)
    return () => window.clearInterval(iv)
  }, [])

  useEffect(() => {
    if (mode === 'still' || failed) return
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    })
    if (!gl) {
      setFailed(true)
      return
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) {
      setFailed(true)
      return
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog))
      setFailed(true)
      return
    }
    gl.useProgram(prog)

    const u = (name: string) => gl.getUniformLocation(prog, name)
    const uRes = u('uRes')
    const uTime = u('uTime')
    const uDepth = u('uDepth')
    const uElevation = u('uElevation')
    const uCalm = u('uCalm')
    const uFocus = u('uFocus')
    const uReveal = u('uReveal')
    const uIntro = u('uIntro')
    const uSun = u('uSun')
    const uSky = u('uSky')
    const uHorizon = u('uHorizon')
    const uLight = u('uLight')
    const uGlow = u('uGlow')

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    let raf = 0
    let disposed = false
    const started = performance.now()
    let last = started
    // eased followers — routes jump, the sea never does
    let depth = Math.max(useOcean.getState().depth, useOcean.getState().intro)
    let focus = useOcean.getState().focus
    let reveal = 0

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.floor(canvas.clientWidth * dpr)
      const h = Math.floor(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }

    const frame = (now: number) => {
      if (disposed) return
      raf = requestAnimationFrame(frame)

      // a window nobody is looking at renders nothing
      if (document.hidden) {
        last = now
        return
      }

      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      resize()

      const target = useOcean.getState()
      const k = 1 - Math.exp(-dt * 2.6)
      // during the launch the ascent owns the camera; afterwards the route does
      const wanted = Math.max(target.depth, target.intro, target.drain)
      depth += (wanted - depth) * (target.intro > 0 ? 1 - Math.exp(-dt * 7) : k)
      focus += (target.focus - focus) * k
      reveal += (1 - reveal) * (1 - Math.exp(-dt * 1.6))

      const day = timeOfDay(Date.now())
      const p = paletteAt(day)
      const [sx, sy] = sunPosition(day)

      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, (now - started) / 1000)
      gl.uniform1f(uDepth, depth)
      gl.uniform1f(uElevation, p.elevation)
      gl.uniform1f(uCalm, reducedMotion.matches ? 1 : 0)
      gl.uniform1f(uFocus, focus)
      gl.uniform1f(uReveal, reveal)
      gl.uniform1f(uIntro, target.intro)
      gl.uniform2f(uSun, sx, sy)
      gl.uniform3fv(uSky, p.sky)
      gl.uniform3fv(uHorizon, p.horizon)
      gl.uniform3fv(uLight, p.light)
      gl.uniform3fv(uGlow, p.glow)

      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    raf = requestAnimationFrame(frame)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteVertexArray(vao)
    }
  }, [mode, failed])

  const still = mode === 'still' || failed

  return (
    <div className="ocean-layer" aria-hidden>
      {still ? (
        <div
          className="ocean-still"
          style={{
            background: `linear-gradient(180deg,
              ${toCss(palette.sky)} 0%,
              ${toCss(palette.horizon, 0.85)} 26%,
              ${toCss(palette.sky)} 52%,
              #05090e 100%)`,
          }}
        />
      ) : (
        <canvas ref={canvasRef} className="ocean-canvas" />
      )}
    </div>
  )
}
