/** A water chime, synthesised. No audio file to ship, license or load.
 *  A struck partial cluster, a lowpass falling like a stone, a long tail. */

let ctx: AudioContext | null = null
let tail: ConvolverNode | null = null

function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    tail = ctx.createConvolver()
    tail.buffer = impulse(ctx, 2.4, 3.2)
    const wet = ctx.createGain()
    wet.gain.value = 0.32
    tail.connect(wet).connect(ctx.destination)
  }
  return ctx
}

/** Exponentially decaying noise — a cave of water, cheap and convincing. */
function impulse(context: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = context.sampleRate
  const length = Math.floor(rate * seconds)
  const buffer = context.createBuffer(2, length, rate)
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return buffer
}

/** One second of white noise, made once and re-used for every transient. */
let noiseBuffer: AudioBuffer | null = null
function noise(context: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = context.sampleRate
    noiseBuffer = context.createBuffer(1, length, context.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

const VOICES: Record<string, number[]> = {
  // a pentatonic cluster; nothing here can sound like an alarm
  focus: [440, 660, 880],
  break: [330, 495, 660],
  reminder: [523.25, 784, 1046.5],
  soft: [392, 588],
}

export function chime(kind: keyof typeof VOICES | string = 'focus', volume = 0.5) {
  if (volume <= 0) return
  try {
    const context = audio()
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    const partials = VOICES[kind] ?? VOICES.focus

    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(3600, now)
    filter.frequency.exponentialRampToValueAtTime(700, now + 1.6)
    filter.Q.value = 0.7

    const bus = context.createGain()
    bus.gain.value = Math.min(1, volume) * 0.5
    filter.connect(bus)
    bus.connect(context.destination)
    if (tail) bus.connect(tail)

    partials.forEach((f, i) => {
      const osc = context.createOscillator()
      osc.type = i === 0 ? 'sine' : 'triangle'
      // a struck body starts a touch sharp and settles
      osc.frequency.setValueAtTime(f * 1.008, now)
      osc.frequency.exponentialRampToValueAtTime(f, now + 0.18)

      const env = context.createGain()
      const peak = 0.5 / (i + 1.35)
      env.gain.setValueAtTime(0.0001, now)
      env.gain.exponentialRampToValueAtTime(peak, now + 0.012 + i * 0.008)
      env.gain.exponentialRampToValueAtTime(0.0001, now + 1.9 + i * 0.5)

      osc.connect(env).connect(filter)
      osc.start(now + i * 0.045)
      osc.stop(now + 3.2)
    })
  } catch (err) {
    console.warn('chime failed', err)
  }
}

/* ── the interface's own three sounds ────────────────────────────────── */
/* Quieter than the chime by a long way, and shaped like the rest of the app:
   a drop when you press, a breath when you pass over something, a bloom when
   a thing is finished. They should be felt more than heard. */

/** Shared setup: a live context, the moment to schedule against, and a bus. */
function voice(volume: number, wet: number): { context: AudioContext; now: number; bus: GainNode } | null {
  if (volume <= 0) return null
  const context = audio()
  if (context.state === 'suspended') void context.resume()
  const bus = context.createGain()
  bus.gain.value = Math.min(1, volume)
  bus.connect(context.destination)
  if (tail && wet > 0) {
    const send = context.createGain()
    send.gain.value = wet
    bus.connect(send).connect(tail)
  }
  return { context, now: context.currentTime, bus }
}

/** A press: one drop into still water. Pitch falls the way a drip does. */
export function tap(volume = 0.5) {
  try {
    const v = voice(volume * 0.22, 0.1)
    if (!v) return
    const { context, now, bus } = v

    const osc = context.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(760, now)
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.07)
    const env = context.createGain()
    env.gain.setValueAtTime(0.0001, now)
    env.gain.exponentialRampToValueAtTime(0.6, now + 0.006)
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
    osc.connect(env).connect(bus)
    osc.start(now)
    osc.stop(now + 0.2)

    // the surface breaking: a hair of noise, gone before you can name it
    const src = context.createBufferSource()
    src.buffer = noise(context)
    const band = context.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 2600
    band.Q.value = 1.1
    const hiss = context.createGain()
    hiss.gain.setValueAtTime(0.18, now)
    hiss.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
    src.connect(band).connect(hiss).connect(bus)
    src.start(now)
    src.stop(now + 0.06)
  } catch {
    /* no audio device; the app is silent and that is fine */
  }
}

/** Passing over something: a breath, not a beep. No tail — on a fast hand
 *  these overlap, and reverb would turn them into a smear. */
export function graze(volume = 0.5) {
  try {
    const v = voice(volume * 0.055, 0)
    if (!v) return
    const { context, now, bus } = v

    const osc = context.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1240, now)
    osc.frequency.exponentialRampToValueAtTime(1080, now + 0.05)
    const env = context.createGain()
    env.gain.setValueAtTime(0.0001, now)
    env.gain.exponentialRampToValueAtTime(0.5, now + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.055)
    osc.connect(env).connect(bus)
    osc.start(now)
    osc.stop(now + 0.08)
  } catch {
    /* silence is an acceptable outcome */
  }
}

/** Something finished: three notes rising out of the water and opening up.
 *  Related to the timer chime, half its length, and it never repeats. */
export function bloom(volume = 0.5) {
  try {
    const v = voice(volume * 0.34, 0.3)
    if (!v) return
    const { context, now, bus } = v

    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(4200, now)
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.9)
    filter.Q.value = 0.6
    filter.connect(bus)

    ;[523.25, 659.25, 987.77].forEach((f, i) => {
      const osc = context.createOscillator()
      osc.type = i === 0 ? 'sine' : 'triangle'
      osc.frequency.setValueAtTime(f, now)
      const env = context.createGain()
      const peak = 0.5 / (i + 1.5)
      const at = now + i * 0.055
      env.gain.setValueAtTime(0.0001, at)
      env.gain.exponentialRampToValueAtTime(peak, at + 0.014)
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.9 + i * 0.22)
      osc.connect(env).connect(filter)
      osc.start(at)
      osc.stop(at + 1.6)
    })
  } catch {
    /* silence is an acceptable outcome */
  }
}

/** Called on first user gesture — browsers keep audio asleep until then. */
export function wakeAudio() {
  try {
    const context = audio()
    if (context.state === 'suspended') void context.resume()
  } catch {
    /* no audio device; the app is silent and that is fine */
  }
}
