// The ambient scene behind every page: one fragment shader, eight themes.
// Everything is procedural (value noise, fbm, hashed particle grids), so the
// whole scene is a few kilobytes and needs no textures.

export const THEME_INDEX = {
  Void: 0,
  Cosmic: 1,
  Aurora: 2,
  Ocean: 3,
  Glacier: 4,
  Forest: 5,
  Ember: 6,
  Sakura: 7,
} as const;

export const VERT = `#version 300 es
precision highp float;
const vec2 verts[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0);
}`;

export const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uCursor;    // 0..1, y up
uniform float uEnergy;   // 0..1, typing activity
uniform int uTheme;
uniform vec3 uBase;
uniform vec3 uAccent;
uniform vec3 uAccent2;
uniform vec3 uText;

// ---------------------------------------------------------------- utilities

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = r * p * 2.02 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

vec2 rot(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c) * p;
}

// Distances to the nearest two drifting cell centres. Where they tie is a
// bright seam: the look of light through moving water, or cracks in ice.
vec2 voronoi(vec2 p, float t) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 h = hash22(n + g);
      vec2 o = g + 0.5 + 0.38 * sin(t * (0.25 + 0.4 * h) + 6.2831 * h);
      float d = length(o - f);
      if (d < f1) { f2 = f1; f1 = d; }
      else if (d < f2) { f2 = d; }
    }
  }
  return vec2(f1, f2);
}

// Sparse points of light. thresh: how many cells stay empty (0..1).
float stars(vec2 uv, float scale, float thresh, float t) {
  vec2 g = uv * scale;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float r = hash12(id + 7.3);
  if (r < thresh) return 0.0;
  vec2 pos = 0.15 + 0.7 * hash22(id);
  float d = length(f - pos);
  float size = mix(0.018, 0.05, hash12(id + 3.1));
  float tw = 0.6 + 0.4 * sin(t * (0.8 + 2.0 * hash12(id + 5.5)) + 6.2831 * hash12(id + 9.9));
  return smoothstep(size, 0.0, d) * tw * (0.45 + 0.55 * r);
}

// Bright stars with a four-point glint.
float glints(vec2 uv, float scale, float thresh, float t) {
  vec2 g = uv * scale;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float r = hash12(id + 11.7);
  if (r < thresh) return 0.0;
  vec2 pos = 0.2 + 0.6 * hash22(id + 4.0);
  vec2 d = f - pos;
  float dist = length(d);
  float tw = 0.7 + 0.3 * sin(t * (1.0 + hash12(id)) * 1.7 + 6.2831 * hash12(id + 2.0));
  float core = smoothstep(0.035, 0.0, dist);
  float cross = (smoothstep(0.004, 0.0, abs(d.x)) * smoothstep(0.16, 0.0, abs(d.y)) +
                 smoothstep(0.004, 0.0, abs(d.y)) * smoothstep(0.16, 0.0, abs(d.x))) * 0.5;
  return (core + cross * 0.6) * tw;
}

// A field of soft particles that drift across their cells with their own speed.
// dir: +1 up, -1 down. sway: horizontal wobble. fill: fraction of cells used.
float particles(vec2 uv, float scale, float t, float dir, float speed, float sway, float size, float fill) {
  vec2 g = uv * scale;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float acc = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 cid = id + o;
      if (hash12(cid + 2.2) > fill) continue;
      vec2 h = hash22(cid);
      float sp = speed * (0.6 + 0.8 * h.x);
      float py = fract(h.y + dir * t * sp);
      float px = h.x + sway * sin(t * (0.5 + h.y) * 1.3 + 6.2831 * h.x);
      vec2 p = o + vec2(px, py);
      float d = length(f - p);
      float sz = size * (0.6 + 0.8 * hash12(cid + 4.4));
      float tw = 0.7 + 0.3 * sin(t * (1.5 + 2.0 * h.x) + 6.2831 * h.y);
      acc += smoothstep(sz, sz * 0.15, d) * tw;
    }
  }
  return acc;
}

// Thin rings rising: bubbles.
float bubbles(vec2 uv, float scale, float t, float speed, float fill) {
  vec2 g = uv * scale;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float acc = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 cid = id + o;
      if (hash12(cid + 8.8) > fill) continue;
      vec2 h = hash22(cid + 1.5);
      float sp = speed * (0.5 + h.x);
      float py = fract(h.y + t * sp);
      float px = 0.5 + 0.3 * sin(t * (0.6 + h.y) + 6.2831 * h.x) + (h.x - 0.5) * 0.4;
      vec2 p = o + vec2(px, py);
      float d = length(f - p);
      float r = 0.05 + 0.08 * hash12(cid + 3.3);
      float ring = smoothstep(0.012, 0.0, abs(d - r));
      float fade = smoothstep(0.0, 0.1, py) * smoothstep(1.0, 0.85, py);
      acc += ring * fade * 0.8 + smoothstep(r, 0.0, d) * 0.08;
    }
  }
  return acc;
}

// Rotating petals falling with a sway. Returns coverage and a hue mix in .y.
vec2 petals(vec2 uv, float scale, float t, float speed, float fill) {
  vec2 g = uv * scale;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float acc = 0.0;
  float hue = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 cid = id + o;
      if (hash12(cid + 5.5) > fill) continue;
      vec2 h = hash22(cid + 2.7);
      float sp = speed * (0.6 + 0.8 * h.x);
      float py = 1.0 - fract(h.y + t * sp);
      float px = h.x + 0.22 * sin(t * (0.7 + h.y) + 6.2831 * h.x);
      vec2 p = o + vec2(px, py);
      vec2 local = rot(f - p, t * (0.8 + h.y) + 6.2831 * h.x);
      float d = length(local * vec2(1.0, 1.6));
      float sz = 0.062 * (0.7 + 0.6 * hash12(cid + 9.1));
      float c = smoothstep(sz, sz * 0.3, d);
      acc += c;
      hue += c * h.x;
    }
  }
  return vec2(acc, hue);
}

// Wandering, pulsing points: fireflies.
float fireflies(vec2 uv, float scale, float t, float fill) {
  vec2 g = uv * scale;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float acc = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 cid = id + o;
      if (hash12(cid + 6.6) > fill) continue;
      vec2 h = hash22(cid + 3.9);
      vec2 p = o + 0.5 + 0.34 * vec2(sin(t * (0.25 + 0.3 * h.x) + 6.2831 * h.y), sin(t * (0.2 + 0.3 * h.y) + 6.2831 * h.x));
      float d = length(f - p);
      float pulse = pow(0.5 + 0.5 * sin(t * (1.2 + 1.5 * h.x) + 6.2831 * h.y), 3.0);
      acc += smoothstep(0.06, 0.0, d) * pulse + smoothstep(0.16, 0.0, d) * pulse * 0.15;
    }
  }
  return acc;
}

// ------------------------------------------------------------------ scenes
// p: aspect-corrected, centred, y up (|y| <= 0.5). uv: 0..1.

vec3 sceneVoid(vec2 p, vec2 uv, float t, vec2 par) {
  vec3 col = mix(uBase * 0.72, uBase * 1.18, uv.y);
  vec2 q = p * vec2(1.0, 1.7) + vec2(t * 0.018, 0.0);
  float band = fbm(q * 1.6 + vec2(0.0, t * 0.04));
  float centre = 0.14 + 0.16 * sin(p.x * 1.3 + t * 0.09);
  float ribbon = smoothstep(0.38, 0.8, band) * smoothstep(0.34, 0.08, abs(p.y - centre));
  vec3 rc = mix(uAccent, uAccent2, smoothstep(-0.6, 0.6, p.x + 0.3 * sin(t * 0.06)));
  rc = mix(rc, vec3(0.95, 0.55, 0.62), 0.35 * smoothstep(0.55, 0.85, band));
  col += rc * rc * ribbon * (0.5 + 0.2 * uEnergy);
  col += uAccent * 0.035 * fbm(q * 0.8 + 3.0);
  col += uText * stars(p + par * 0.4, 9.0, 0.84, t) * 0.85;
  col += uText * stars(p * 1.3 + par * 0.9 + 3.0, 19.0, 0.9, t * 1.3) * 0.45;
  col += uAccent * particles(p + par * 0.2, 6.0, t, 1.0, 0.025, 0.12, 0.06, 0.3) * 0.28;
  return col;
}

vec3 sceneCosmic(vec2 p, vec2 uv, float t, vec2 par) {
  vec3 col = uBase * 0.55;
  vec2 q = (p + par * 0.15) * 1.15;
  vec2 w = vec2(fbm(q + t * 0.02), fbm(q + vec2(5.2, 1.3) - t * 0.015));
  float n = fbm(q + 1.8 * w + vec2(t * 0.01, 0.0));
  vec3 neb = mix(uAccent, uAccent2, smoothstep(0.3, 0.85, fbm(q * 0.7 + w + 2.0)));
  float shape = smoothstep(0.34, 0.86, n);
  col += neb * shape * (0.5 + 0.28 * uEnergy) * (0.65 + 0.35 * (1.0 - length(p)));
  col += uAccent * 0.08 * fbm(q * 0.5 - w);
  col += uText * stars(p + par * 0.3, 14.0, 0.8, t) * 0.7;
  col += uText * stars(p * 1.6 + par * 0.8 + 5.0, 26.0, 0.86, t * 1.2) * 0.4;
  col += uText * glints(p + par * 0.5 + 1.0, 5.0, 0.9, t) * 0.9;
  // A shooting star every fourteen seconds, along a different line each time.
  float cycle = 14.0;
  float idx = floor(t / cycle);
  float ct = t - idx * cycle;
  vec2 hs = hash22(vec2(idx, 3.0));
  vec2 a = vec2(-0.9, 0.25 + 0.3 * hs.x);
  vec2 b = vec2(0.5 + 0.4 * hs.y, -0.15 + 0.2 * hs.x);
  float k = clamp((ct - 2.0) / 1.1, 0.0, 1.0);
  vec2 head = mix(a, b, k);
  vec2 dv = normalize(b - a);
  vec2 rel = p - head;
  float along = dot(rel, dv);
  float perp = abs(dot(rel, vec2(-dv.y, dv.x)));
  float alive = step(2.0, ct) * step(ct, 3.1);
  float streak = smoothstep(-0.28, 0.0, along) * step(along, 0.0) * smoothstep(0.005, 0.0, perp) * alive * (1.0 - k * 0.6);
  col += uText * streak * 1.1;
  return col;
}

vec3 sceneAurora(vec2 p, vec2 uv, float t, vec2 par) {
  vec3 col = mix(uBase * 0.65, uBase * 1.15, uv.y);
  float x = p.x * 1.4 + par.x * 0.2 + 0.15 * sin(t * 0.05);
  float ray = fbm(vec2(x * 3.0 + t * 0.03, t * 0.02));
  float ray2 = vnoise(vec2(x * 14.0 - t * 0.09, 3.0));
  float centre = 0.16 + 0.1 * sin(p.x * 1.5 + t * 0.07);
  float band = exp(-pow((p.y - centre) * 3.2, 2.0));
  float curtain = band * (0.55 * ray + 0.6 * ray * ray2);
  float hang = smoothstep(0.35, -0.3, p.y - centre) * ray2 * ray * 0.55 * smoothstep(-0.55, 0.1, p.y);
  vec3 ac = mix(uAccent, uAccent2, smoothstep(-0.05, 0.42, p.y));
  col += ac * (curtain * 1.15 + hang) * (0.7 + 0.35 * uEnergy);
  col += uText * stars(p + par * 0.4, 12.0, 0.87, t) * 0.5;
  col += uText * particles(p + par * 0.15, 8.0, t, -1.0, 0.03, 0.15, 0.05, 0.3) * 0.35;
  return col;
}

vec3 sceneOcean(vec2 p, vec2 uv, float t, vec2 par) {
  vec3 deepBlue = mix(uBase, vec3(0.05, 0.22, 0.34), 0.5);
  vec3 col = mix(uBase * 0.35, deepBlue, pow(uv.y, 1.5));
  // Caustics: two drifting cell networks, seams lit, fading with depth.
  vec2 q = (p + par * 0.1) * vec2(1.0, 1.35);
  vec2 v1 = voronoi(q * 5.5 + vec2(0.0, -t * 0.05), t);
  vec2 v2 = voronoi(q * 9.5 + vec2(2.7, t * 0.04), t * 1.3);
  float caus = pow(smoothstep(0.3, 0.0, v1.y - v1.x), 2.0) * 0.45 + pow(smoothstep(0.22, 0.0, v2.y - v2.x), 2.0) * 0.25;
  // Patchy, like light through a moving surface, and fading with depth.
  caus *= smoothstep(-0.5, 0.45, p.y) * smoothstep(0.25, 0.75, fbm(q * 1.6 + t * 0.04));
  vec2 r = vec2(p.x + p.y * 0.35, p.y);
  float rays = pow(vnoise(vec2(r.x * 6.0 + t * 0.03, 1.0)), 2.2) * smoothstep(-0.2, 0.55, p.y);
  col += mix(uAccent, vec3(0.75, 0.95, 1.0), 0.3) * caus * (0.3 + 0.15 * uEnergy) + uAccent * rays * 0.16;
  col += uText * bubbles(p + par * 0.2, 5.0, t, 0.05, 0.35) * 0.32;
  col += uAccent2 * particles(p + par * 0.35, 10.0, t, 1.0, 0.02, 0.1, 0.04, 0.3) * 0.25;
  return col;
}

vec3 sceneGlacier(vec2 p, vec2 uv, float t, vec2 par) {
  vec3 col = mix(uBase * 0.85, mix(uBase, uAccent, 0.55), pow(uv.y, 1.3));
  col += uAccent * 0.07 * fbm((p + par * 0.1) * 4.0);
  float sweep = mod(t * 0.045, 2.8) - 1.4;
  float sheen = exp(-pow((p.x * 0.7 - p.y * 0.5 - sweep) * 3.2, 2.0)) * 0.22;
  col += mix(uAccent, vec3(1.0), 0.4) * sheen * (1.0 + 0.5 * uEnergy);
  float g = glints(p + par * 0.3, 7.0, 0.86, t);
  col += vec3(1.0) * pow(g, 1.6) * 0.7;
  // Cracks in the ice: faint, slow, only near the bottom.
  vec2 vc = voronoi((p + par * 0.05) * 3.0, t * 0.15);
  col += uAccent * smoothstep(0.05, 0.0, vc.y - vc.x) * 0.08 * smoothstep(0.3, -0.5, p.y);
  col += uText * particles(p + par * 0.2, 7.0, t, -1.0, 0.035, 0.18, 0.05, 0.4) * 0.45;
  col += uText * particles(p + par * 0.5 + 2.0, 13.0, t, -1.0, 0.06, 0.1, 0.03, 0.35) * 0.25;
  return col;
}

vec3 sceneForest(vec2 p, vec2 uv, float t, vec2 par) {
  vec3 canopy = mix(uBase, uAccent, 0.38);
  vec3 col = mix(uBase * 0.6, canopy, pow(uv.y, 1.3));
  col += uAccent * 0.1 * fbm((p + par * 0.05) * 2.5 + vec2(0.0, t * 0.01));
  vec2 r = rot(p + par * 0.1, 0.32);
  float shaft = pow(vnoise(vec2(r.x * 5.0 + t * 0.02, 0.0)), 2.2) * (0.45 + 0.55 * vnoise(vec2(r.x * 2.0 - t * 0.05, 1.0)));
  shaft *= smoothstep(-0.35, 0.55, p.y);
  vec3 amber = mix(uAccent2, vec3(0.95, 0.82, 0.55), 0.5);
  col += amber * shaft * (0.6 + 0.25 * uEnergy);
  col += uAccent * 0.14 * exp(-pow((p.y + 0.5) * 2.0, 2.0)) * (0.8 + 0.2 * fbm(p * 3.0 + t * 0.03));
  float ff = fireflies(p + par * 0.25, 5.0, t, 0.42);
  col += mix(vec3(0.96, 0.76, 0.46), uAccent, 0.3) * ff * 0.9;
  col += uAccent2 * particles(p + par * 0.4, 12.0, t, 1.0, 0.02, 0.12, 0.03, 0.3) * 0.22;
  return col;
}

vec3 sceneEmber(vec2 p, vec2 uv, float t, vec2 par) {
  vec3 col = mix(vec3(0.03, 0.015, 0.01), mix(uBase, uAccent, 0.35), pow(1.0 - uv.y, 2.6));
  float glow = exp(-pow((p.y + 0.66) * 2.4, 2.0)) * (0.7 + 0.3 * fbm((p + par * 0.1) * 3.0 + vec2(0.0, -t * 0.25)));
  col += mix(uAccent, uAccent2, 0.3) * glow * (0.28 + 0.18 * uEnergy);
  float smoke = fbm(vec2(p.x * 2.0 + par.x * 0.2, p.y * 2.0 - t * 0.07)) * smoothstep(0.6, -0.3, p.y);
  col += vec3(0.5, 0.42, 0.4) * smoke * 0.06;
  vec2 turb = vec2(0.12 * (vnoise(vec2(p.y * 3.0 + t * 0.4, p.x * 2.0)) - 0.5), 0.0);
  float e1 = particles(p + turb + par * 0.2, 9.0, t, 1.0, 0.09, 0.2, 0.035, 0.4);
  float e2 = particles(p + turb * 0.5 + par * 0.4 + 3.0, 16.0, t, 1.0, 0.13, 0.15, 0.022, 0.35);
  col += mix(uAccent, uAccent2, 0.35) * e1 * 0.9 + uAccent * e2 * 0.5;
  return col;
}

vec3 sceneSakura(vec2 p, vec2 uv, float t, vec2 par) {
  vec3 col = mix(uBase * 0.85, mix(uBase, uAccent, 0.33), pow(uv.y, 1.2));
  col += uAccent * 0.16 * exp(-length((p - vec2(-0.42, 0.26) + par * 0.05) * vec2(1.0, 1.4)) * 2.2);
  col += uAccent2 * 0.12 * exp(-length(p - vec2(0.48, -0.12) + par * 0.05) * 2.0);
  vec2 pt = petals(p + par * 0.2, 5.0, t, 0.04, 0.35);
  vec2 pt2 = petals(p + par * 0.5 + 4.0, 9.0, t, 0.06, 0.3);
  vec3 pink = mix(uAccent, vec3(1.0, 0.82, 0.88), 0.35);
  col += mix(pink, uAccent2, clamp(pt.y / max(pt.x, 0.001), 0.0, 1.0) * 0.4) * pt.x * 0.55;
  col += pink * pt2.x * 0.3;
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;
  vec2 par = (uCursor - 0.5) * 0.06;

  vec3 col;
  if (uTheme == 0) col = sceneVoid(p, uv, t, par);
  else if (uTheme == 1) col = sceneCosmic(p, uv, t, par);
  else if (uTheme == 2) col = sceneAurora(p, uv, t, par);
  else if (uTheme == 3) col = sceneOcean(p, uv, t, par);
  else if (uTheme == 4) col = sceneGlacier(p, uv, t, par);
  else if (uTheme == 5) col = sceneForest(p, uv, t, par);
  else if (uTheme == 6) col = sceneEmber(p, uv, t, par);
  else col = sceneSakura(p, uv, t, par);

  // Cursor light, vignette, typing energy, and a dither against banding.
  vec2 cp = (uCursor - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  col += uAccent * 0.07 * exp(-5.0 * length(p - cp));
  col *= 1.0 - 0.42 * smoothstep(0.3, 1.0, length(uv - 0.5) * 1.25);
  col *= 1.0 + 0.07 * uEnergy;
  col += (hash12(gl_FragCoord.xy + fract(t)) - 0.5) * (1.6 / 255.0);
  fragColor = vec4(max(col, 0.0), 1.0);
}`;
