/** One source of truth for what colour the hour is.
 *  The shader samples it for the water; the UI writes it to CSS variables.
 *  Because both read this file, the interface can never disagree with the sea. */

export type RGB = [number, number, number]

export interface Palette {
  /** deep body of the water */
  sky: RGB
  /** the band where light meets water */
  horizon: RGB
  /** foam, caustics, type highlights */
  light: RGB
  /** sun or moon glow */
  glow: RGB
  /** 0 at night, 1 at midday — drives caustic strength and specular power */
  elevation: number
}

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
]

interface Stop {
  at: number
  sky: RGB
  horizon: RGB
  light: RGB
  glow: RGB
}

// fractions of the 24h day. deep night → pre-dawn indigo → dawn rose-gold →
// morning → midday teal → afternoon → dusk amber → blue hour → night.
const STOPS: Stop[] = [
  { at: 0.0, sky: hex('#05090e'), horizon: hex('#0a1822'), light: hex('#9fb6c6'), glow: hex('#38506b') },
  { at: 0.16, sky: hex('#070c1a'), horizon: hex('#111c33'), light: hex('#93a4c9'), glow: hex('#3c4a78') },
  { at: 0.235, sky: hex('#0a1024'), horizon: hex('#1b2340'), light: hex('#a99ac4'), glow: hex('#5b4f86') },
  { at: 0.275, sky: hex('#1c2436'), horizon: hex('#8a5f63'), light: hex('#f4d9c8'), glow: hex('#e8a48c') },
  { at: 0.34, sky: hex('#0d2a33'), horizon: hex('#2e7a80'), light: hex('#cfe7e4'), glow: hex('#6fbfb4') },
  { at: 0.5, sky: hex('#103a46'), horizon: hex('#2e8a88'), light: hex('#dff2ee'), glow: hex('#8fd8cc') },
  { at: 0.68, sky: hex('#0f313d'), horizon: hex('#37827e'), light: hex('#d7e8e0'), glow: hex('#7cc3b4') },
  { at: 0.772, sky: hex('#14212e'), horizon: hex('#b87a4e'), light: hex('#f0d3b4'), glow: hex('#d89a62') },
  { at: 0.85, sky: hex('#091624'), horizon: hex('#2a3f5c'), light: hex('#a9c0d4'), glow: hex('#4e6c8f') },
  { at: 1.0, sky: hex('#05090e'), horizon: hex('#0a1822'), light: hex('#9fb6c6'), glow: hex('#38506b') },
]

// gamma-correct interpolation. lerping raw sRGB turns dawn into mud.
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

const mix = (a: RGB, b: RGB, t: number): RGB =>
  [0, 1, 2].map((i) => toSrgb(toLinear(a[i]) * (1 - t) + toLinear(b[i]) * t)) as RGB

// smootherstep — no visible seam as the hours cross a stop
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

export function paletteAt(dayFraction: number): Palette {
  const t = ((dayFraction % 1) + 1) % 1
  let i = 0
  while (i < STOPS.length - 2 && t > STOPS[i + 1].at) i++
  const a = STOPS[i]
  const b = STOPS[i + 1]
  const k = ease(Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at))))

  // elevation peaks at solar noon and floors overnight
  const elevation = Math.max(0, Math.sin((t - 0.25) * Math.PI * 2) * 0.5 + 0.5) ** 1.4

  return {
    sky: mix(a.sky, b.sky, k),
    horizon: mix(a.horizon, b.horizon, k),
    light: mix(a.light, b.light, k),
    glow: mix(a.glow, b.glow, k),
    elevation,
  }
}

export const toHex = (c: RGB): string =>
  '#' +
  c
    .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0'))
    .join('')

export const toCss = (c: RGB, alpha = 1): string =>
  `rgba(${c.map((v) => Math.round(v * 255)).join(', ')}, ${alpha})`

/** Colours offered when naming a new option. All belong to the same sea. */
export const OPTION_COLORS = [
  '#2e8a88', // shoal
  '#4fa3a0',
  '#6fbfb4',
  '#8fd8cc',
  '#bfdcd8', // foam
  '#7c9fc0',
  '#5b7fa8',
  '#8e9bc4',
  '#c9bfaa', // sand
  '#d8b78a',
  '#d89a62', // dusk
  '#cf7f92', // rose — attention
  '#a48fc4', // violet — timing
  '#dd6b4d', // coral — the loudest thing available
]
