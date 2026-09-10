/** WebGL2. One fullscreen triangle, one fragment shader, no libraries.
 *  Everything the sea does is in here. */

export const VERT = /* glsl */ `#version 300 es
void main() {
  // fullscreen triangle from gl_VertexID — no buffers, no attributes
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

export const FRAG = /* glsl */ `#version 300 es
precision highp float;

out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uDepth;      // 0 at the surface, 1 in the abyss
uniform float uElevation;  // sun height, 0 night → 1 noon
uniform float uCalm;       // 1 = motion off (reduced-motion / battery)
uniform float uFocus;      // 0 → 1 through a focus session
uniform float uReveal;     // launch fade, water rising into the frame
uniform float uIntro;      // 1 on the floor at launch, 0 once risen
uniform vec2  uSun;        // sun/moon position in screen space
uniform vec3  uSky;
uniform vec3  uHorizon;
uniform vec3  uLight;
uniform vec3  uGlow;

// ── noise ──────────────────────────────────────────────────────────────
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return v;
}

// ── caustics ───────────────────────────────────────────────────────────
// iterated coordinate feedback: the filament web that light draws on the
// floor of shallow water. four passes is enough to read as caustic.
float caustic(vec2 p, float t) {
  vec2 i = p;
  float c = 1.0;
  const float inten = 0.0055;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - 3.5 / float(n + 1));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  // unbounded by construction — a filament crossing a near-zero length blows
  // up to thousands, which reads as a white scar along the meniscus
  return clamp(pow(abs(c), 8.0), 0.0, 1.4);
}

// ── fish ───────────────────────────────────────────────────────────────
// Drawn as absence of light rather than as objects: an ellipse body with a
// wedge tail, undulating along its own length so it swims instead of sliding.
float fishMask(vec2 p, float t, float phase, float size) {
  // the body wave travels tail-to-head
  p.y += sin(p.x * 16.0 + t * 3.4 + phase) * 0.009;

  // body: an ellipse, longer than it is tall
  float body = length(p * vec2(1.0, 3.0)) - 0.048 * size;

  // tail: a wedge trailing behind, opening as it goes back
  vec2 q = vec2(p.x + 0.055 * size, p.y);
  float tail = max(-q.x, abs(q.y) * 2.4 + q.x * 0.5 - 0.026 * size);

  return 1.0 - smoothstep(0.0, 0.006, min(body, tail));
}

// One fish crossing the frame: lane picks its depth, speed and direction.
float fishAt(vec2 sp, float t, float aspect, float lane) {
  float speed = 0.012 + fract(lane * 0.37) * 0.011;
  float dir = mod(lane, 2.0) < 1.0 ? 1.0 : -1.0;
  float size = 0.8 + fract(lane * 0.61) * 0.6;

  // wrap across a span a little wider than the screen so they enter off-frame
  float span = aspect + 0.5;
  float x = fract(t * speed + fract(lane * 0.83)) * span - 0.25;
  if (dir < 0.0) x = span - 0.25 - x;

  float y = 0.16 + fract(lane * 0.29) * 0.42 + sin(t * 0.18 + lane * 2.1) * 0.035;

  vec2 p = (sp - vec2(x, y)) * vec2(dir, 1.0);
  return fishMask(p, t, lane * 1.7, size);
}

// ── surface ────────────────────────────────────────────────────────────
// three travelling sines, prime-ish periods so the horizon never visibly loops
float waveHeight(float x, float t) {
  return sin(x * 7.3 + t * 0.55) * 0.0042
       + sin(x * 13.7 - t * 0.37) * 0.0026
       + sin(x * 23.1 + t * 0.81) * 0.0013;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;              // y = 0 bottom, 1 top
  float aspect = uRes.x / uRes.y;
  vec2 sp = vec2(uv.x * aspect, uv.y); // square-ish space for noise

  float t = uTime * (1.0 - uCalm * 0.97);
  float slow = t * (1.0 - uFocus * 0.45); // the sea settles while you focus

  // waterline climbs out of frame as the camera descends
  float wl = mix(0.735, 1.5, uDepth) - (1.0 - uReveal) * 0.25;
  float wave = waveHeight(sp.x, slow);
  float surface = wl + wave;

  // distance below the waterline, 0 at the meniscus
  float below = clamp((surface - uv.y) / 1.55, 0.0, 1.0);
  float above = clamp((uv.y - surface) / max(0.001, 1.0 - wl), 0.0, 1.0);

  vec3 col;

  // ── air ──────────────────────────────────────────────────────────────
  vec3 skyTop = mix(uSky, uLight, 0.08 + 0.18 * uElevation);
  vec3 skyLow = mix(uHorizon, uGlow, 0.42);
  vec3 air = mix(skyLow, skyTop, pow(above, 0.75));

  // sun or moon: a soft body, no hard disc — it is always seen through haze
  vec2 sunv = (uv - uSun) * vec2(aspect, 1.0);
  float sunD = length(sunv);
  float body = smoothstep(0.052, 0.006, sunD);
  float halo = exp(-sunD * 7.0) * 0.55 + exp(-sunD * 2.2) * 0.22;
  air += uGlow * halo * (0.35 + 0.65 * uElevation);
  air += uLight * body * (0.25 + 0.5 * uElevation);

  // stars, only once the sun is properly down, and never near the horizon haze
  float night = smoothstep(0.34, 0.02, uElevation);
  if (night > 0.01) {
    vec2 g = sp * 96.0;
    vec2 gi = floor(g);
    vec2 gf = fract(g) - 0.5;
    float r = hash(gi + 3.7);
    float twinkle = 0.62 + 0.38 * sin(slow * 0.7 + r * 40.0);
    float star = smoothstep(0.085, 0.0, length(gf)) * step(0.9835, r) * twinkle;
    air += uLight * star * night * smoothstep(0.04, 0.42, above) * 0.85;
  }

  // ── water ────────────────────────────────────────────────────────────
  vec3 shallow = mix(uHorizon, uSky, smoothstep(0.0, 0.28, below));
  vec3 abyssal = vec3(0.019, 0.035, 0.055);
  vec3 water = mix(shallow, abyssal, smoothstep(0.16, 0.95, below + uDepth * 0.55));

  // caustics: only where light still reaches
  float causticFade = exp(-below * 7.5) * (1.0 - uDepth) * smoothstep(0.04, 0.45, uElevation);
  if (causticFade > 0.002) {
    float c = caustic(sp * 5.5 + vec2(0.0, slow * 0.05), slow * 0.35);
    water += uLight * c * causticFade * 0.38;
  }

  // light shafts leaning away from the sun, breathing slowly
  float shaftAxis = (sp.x - uSun.x * aspect) * 0.9 + (surface - uv.y) * 0.55;
  float shafts = fbm(vec2(shaftAxis * 6.0, slow * 0.06)) - 0.45;
  shafts = max(shafts, 0.0) * exp(-below * 3.2) * uElevation * (1.0 - uDepth) * 0.5;
  water += uGlow * shafts;

  // the path: sun or moonlight scattered on the underside of the surface,
  // wobbling with the same waves that shape the horizon
  float pathX = abs(sp.x - uSun.x * aspect) - abs(wave) * 12.0;
  float path = exp(-pathX * pathX * 26.0) * exp(-below * 5.0);
  water += mix(uGlow, uLight, 0.6) * path * (0.09 + 0.14 * uElevation);

  // marine snow — sparse, drifting up as you sink past it
  float snowZone = smoothstep(0.10, 0.45, below + uDepth * 0.4);
  if (snowZone > 0.01) {
    vec2 g = sp * 42.0 + vec2(0.0, -slow * 0.9 * (1.0 + uIntro * 2.4));
    vec2 gi = floor(g);
    vec2 gf = fract(g) - 0.5;
    float rnd = hash(gi);
    float mote = smoothstep(0.16, 0.0, length(gf + 0.32 * vec2(cos(rnd * 12.0 + slow * 0.3), 0.0)));
    water += uLight * mote * step(0.972, rnd) * snowZone * (0.30 + uIntro * 0.34);
  }

  // ── fish ─────────────────────────────────────────────────────────────
  // only where the water is properly deep, so the bright homescreen keeps its
  // stillness and the column below has company
  float deep = smoothstep(0.12, 0.5, below + uDepth * 0.5);
  if (deep > 0.01) {
    float school = 0.0;
    float rim = 0.0;
    for (int f = 0; f < 4; f++) {
      float lane = float(f) + 1.0;
      float m = fishAt(sp, slow, aspect, lane);
      school = max(school, m);
      // a thin catch of light along the back
      rim = max(rim, m - fishAt(sp + vec2(0.0, 0.005), slow, aspect, lane));
    }
    // in near-black water a shadow is invisible; a fish is what catches light
    water = mix(water, mix(water, uLight, 0.13), school * deep);
    water += uLight * max(rim, 0.0) * deep * 0.5;
  }

  // ── meniscus ─────────────────────────────────────────────────────────
  float band = smoothstep(0.006, 0.0, abs(uv.y - surface));
  float foam = band * (0.30 + 0.40 * fbm(vec2(sp.x * 28.0, slow * 0.5)));

  col = mix(air, water, step(uv.y, surface));
  // the line where light meets water, never allowed to clip to white
  float arrival = smoothstep(0.34, 0.06, uIntro) * smoothstep(0.0, 0.22, uIntro);
  col += uLight * foam * (0.16 + 0.18 * uElevation + arrival * 0.9) * uReveal;

  // ── grade ────────────────────────────────────────────────────────────
  // depth fog, then a vignette that tightens while you are down in a session
  col *= 1.0 - 0.28 * uDepth;
  // noon is held back so the interface always has room above it
  col *= mix(1.0, 0.93, uElevation);
  float vig = length((uv - 0.5) * vec2(aspect, 1.0));
  col *= 1.0 - smoothstep(0.42, 1.15, vig) * (0.42 + 0.30 * uFocus);
  col *= mix(0.18, 1.0, uReveal);

  // ordered-ish dither: dark water bands hard without it
  col += (hash(frag + fract(uTime) * 37.0) - 0.5) / 255.0;

  // a soft shoulder instead of a hard clip, so nothing ever burns out
  col = col / (1.0 + max(col - vec3(0.85), vec3(0.0)));

  outColor = vec4(col, 1.0);
}`
