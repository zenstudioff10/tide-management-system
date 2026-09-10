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

/** Called on first user gesture — browsers keep audio asleep until then. */
export function wakeAudio() {
  try {
    const context = audio()
    if (context.state === 'suspended') void context.resume()
  } catch {
    /* no audio device; the app is silent and that is fine */
  }
}
