/** Speech to text through the browser's own recogniser. No key, no library and
 *  nothing to download — but it is worth being straight about one thing: this
 *  is the only part of the assistant that is not purely local. Safari
 *  transcribes on the device; Chrome sends the audio to Google to do it. The
 *  schedule never goes anywhere either way — only the question does, and only
 *  while the mic is open. Settings has a switch that removes it entirely. */

interface SpeechAlternative {
  transcript: string
}
interface SpeechResult {
  isFinal: boolean
  0: SpeechAlternative
}
interface SpeechEvent {
  resultIndex: number
  results: { length: number; [i: number]: SpeechResult }
}
interface SpeechErrorEvent {
  error: string
}
interface Recogniser {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechEvent) => void) | null
  onerror: ((e: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
}
type RecogniserCtor = new () => Recogniser

const ctor = (): RecogniserCtor | undefined => {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: RecogniserCtor
    webkitSpeechRecognition?: RecogniserCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** False in the desktop window — WKWebView does not expose the recogniser —
 *  and false in any browser that never implemented it. The mic simply is not
 *  drawn there rather than being drawn and doing nothing. */
export const voiceSupported = (): boolean => !!ctor()

export interface Heard {
  /** what it has made out so far, updated as you speak */
  onPartial?: (text: string) => void
  /** what it settled on, once you stop */
  onFinal: (text: string) => void
  /** 'not-allowed' when the microphone was refused, 'no-speech' when it heard
   *  nothing at all; anything else is the recogniser's own word for it */
  onError?: (kind: string) => void
  onEnd?: () => void
}

/** Starts listening. Returns the way to stop. */
export function listen(h: Heard, lang = 'id-ID'): () => void {
  const Ctor = ctor()
  if (!Ctor) {
    h.onError?.('unsupported')
    h.onEnd?.()
    return () => {}
  }

  const rec = new Ctor()
  rec.lang = lang
  // one question at a time: it should stop on its own when you stop talking
  rec.continuous = false
  rec.interimResults = true
  rec.maxAlternatives = 1

  let settled = ''

  rec.onresult = (e) => {
    let partial = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i]
      const text = result[0].transcript
      if (result.isFinal) settled += text
      else partial += text
    }
    const shown = (settled + partial).trim()
    if (shown) h.onPartial?.(shown)
  }

  rec.onerror = (e) => h.onError?.(e.error)

  rec.onend = () => {
    const question = settled.trim()
    if (question) h.onFinal(question)
    h.onEnd?.()
  }

  try {
    rec.start()
  } catch {
    // start() throws if it is already running; treat it as a no-op
  }

  return () => {
    try {
      rec.stop()
    } catch {
      /* already stopped */
    }
  }
}
