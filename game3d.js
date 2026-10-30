'use strict';
/* KHYAA — 3D renderer, written directly against WebGL (no library). Needs core.js.
   window.KHYAA_VIEW = 'iso' gives the cut-away dollhouse camera; otherwise first person. */
const VIEW = window.KHYAA_VIEW === 'iso' ? 'iso' : 'fp';
document.body.classList.add(VIEW);
const WALL_H = VIEW === 'iso' ? 1.15 : 2.5;
const EYE = 1.55;
const REACH = VIEW === 'iso' ? 1.25 : 1.6;
const wy = (y) => (VIEW === 'iso' ? (y * WALL_H) / 2.5 : y); // heights of things fixed to walls

/* ============================== WEBGL SETUP ============================== */
const cv = $('#game');
const gl = cv.getContext('webgl', { antialias: true }) || cv.getContext('experimental-webgl');
let W = 0, H = 0, DPR = 1;
const VS = `attribute vec3 aP; attribute vec3 aN; attribute vec2 aU;
uniform mat4 uPV; uniform mat4 uM; varying vec3 vW; varying vec3 vN; varying vec2 vU;
void main(){ vec4 w = uM * vec4(aP,1.0); vW = w.xyz; vN = mat3(uM) * aN; vU = aU; gl_Position = uPV * w; }`;
const FS = `precision mediump float;
varying vec3 vW; varying vec3 vN; varying vec2 vU;
uniform sampler2D uTex; uniform vec3 uTint; uniform float uEmit;
uniform vec3 uLp[3]; uniform vec3 uLc[3]; uniform float uLr[3];
uniform vec3 uAmb; uniform vec3 uFogC; uniform float uFog;
void main(){
  vec3 base = texture2D(uTex, vU).rgb * uTint;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 lit = uAmb;
  for (int i = 0; i < 3; i++) {
    vec3 d = uLp[i] - vW; float dist = length(d) + 0.0001;
    float a = clamp(1.0 - dist / uLr[i], 0.0, 1.0); a *= a;
    lit += uLc[i] * a * (max(dot(n, d / dist), 0.0) * 0.75 + 0.25);
  }
  vec3 col = base * lit + base * uEmit;
  float f = exp(-uFog * length(vW - uFogC));
  gl_FragColor = vec4(col * f, 1.0);
}`;
let prog, A = {}, U = {};
function initGL() {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  ['aP', 'aN', 'aU'].forEach((n) => (A[n] = gl.getAttribLocation(prog, n)));
  ['uPV', 'uM', 'uTex', 'uTint', 'uEmit', 'uLp', 'uLc', 'uLr', 'uAmb', 'uFogC', 'uFog'].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.clearColor(0.012, 0.008, 0.012, 1);
}

/* ---------- matrices (column-major) ---------- */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f); return m; }
function lookAt(e, c) {
  const z = norm(sub(e, c)), x = norm(cross([0, 1, 0], z)), y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]);
}
function mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function model(pos, ang, axis) {
  const c = Math.cos(ang || 0), s = Math.sin(ang || 0);
  if (axis === 'x') return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, pos[0], pos[1], pos[2], 1]);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, pos[0], pos[1], pos[2], 1]);
}

/* ---------- geometry ---------- */
class Geo {
  constructor() { this.v = []; this.r = null; }
  rot(cx, cz, a) { this.r = a ? { cx, cz, c: Math.cos(a), s: Math.sin(a) } : null; return this; }
  tp(p) { if (!this.r) return p; const { cx, cz, c, s } = this.r, x = p[0] - cx, z = p[2] - cz; return [cx + c * x + s * z, p[1], cz - s * x + c * z]; }
  tn(n) { if (!this.r) return n; const { c, s } = this.r; return [c * n[0] + s * n[2], n[1], -s * n[0] + c * n[2]]; }
  poly(p, n, uv) {
    p = p.map((q) => this.tp(q)); n = this.tn(n);
    if (dot(cross(sub(p[1], p[0]), sub(p[2], p[0])), n) < 0) { p = p.slice().reverse(); uv = uv.slice().reverse(); }
    const idx = p.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2];
    for (const i of idx) this.v.push(p[i][0], p[i][1], p[i][2], n[0], n[1], n[2], uv[i][0], uv[i][1]);
  }
  box(x0, y0, z0, x1, y1, z1, ts = 1) {
    const u = (a, b) => [a / ts, b / ts];
    this.poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], [u(z0, y0), u(z1, y0), u(z1, y1), u(z0, y1)]);
    this.poly([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [u(z0, y0), u(z1, y0), u(z1, y1), u(z0, y1)]);
    this.poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], [u(x0, z0), u(x1, z0), u(x1, z1), u(x0, z1)]);
    this.poly([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [u(x0, z0), u(x1, z0), u(x1, z1), u(x0, z1)]);
    this.poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [u(x0, y0), u(x1, y0), u(x1, y1), u(x0, y1)]);
    this.poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1], [u(x0, y0), u(x1, y0), u(x1, y1), u(x0, y1)]);
    return this;
  }
  cyl(cx, y0, cz, r, h, seg = 14) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * 6.2832, a1 = ((i + 1) / seg) * 6.2832;
      const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
      const am = (a0 + a1) / 2;
      this.poly([[p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y0 + h, p1[1]], [p0[0], y0 + h, p0[1]]], [Math.cos(am), 0, Math.sin(am)], [[i / seg, 0], [(i + 1) / seg, 0], [(i + 1) / seg, 1], [i / seg, 1]]);
      this.poly([[cx, y0 + h, cz], [p0[0], y0 + h, p0[1]], [p1[0], y0 + h, p1[1]]], [0, 1, 0], [[0.5, 0.5], [0.5 + Math.cos(a0) / 2, 0.5 + Math.sin(a0) / 2], [0.5 + Math.cos(a1) / 2, 0.5 + Math.sin(a1) / 2]]);
    }
    return this;
  }
  // a flat picture on a wall: (x0..x1, y0..y1) at depth z, facing +z (or -z / ±x with `face`)
  decal(x0, y0, x1, y1, z, face = 'z') {
    if (face === 'z') this.poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    else if (face === '-z') this.poly([[x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z]], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    else if (face === 'x') this.poly([[z, y0, x1], [z, y0, x0], [z, y1, x0], [z, y1, x1]], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    return this;
  }
}
function mesh(geo, tex, o = {}) {
  const data = new Float32Array(geo.v), b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return { b, n: data.length / 8, tex, tint: o.tint || [1, 1, 1], emit: o.emit || 0, pos: o.pos || [0, 0, 0], ang: o.ang || 0, axis: o.axis, vis: o.vis || null, dyn: o.dyn || null };
}

/* ---------- procedural textures ---------- */
function canvasTex(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size, rng(size + draw.length));
  return glTex(c, true);
}
function glTex(c, repeat) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  if (repeat) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); }
  else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}
function noise(g, s, R, n, a, light) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${light ? '255,240,215' : '0,0,0'},${R() * a})`; g.fillRect(R() * s, R() * s, 1 + R() * 2, 1 + R() * 2); } }
let TX = {};
function makeTextures() {
  TX.wood = canvasTex((g, s, R) => {
    for (let i = 0; i < 4; i++) { const v = 0.85 + R() * 0.3; g.fillStyle = `rgb(${74 * v | 0},${50 * v | 0},${32 * v | 0})`; g.fillRect(0, i * s / 4, s, s / 4); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, i * s / 4, s, 2); const x = R() * s; g.fillRect(x, i * s / 4, 2, s / 4); }
    g.strokeStyle = 'rgba(20,10,4,.25)'; for (let i = 0; i < 70; i++) { const y = R() * s; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s / 3, y + R() * 6 - 3, s * 2 / 3, y + R() * 6 - 3, s, y); g.stroke(); }
    noise(g, s, R, 1400, 0.12, false);
  });
  TX.tile = canvasTex((g, s, R) => { g.fillStyle = '#2a1a12'; g.fillRect(0, 0, s, s); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const v = 0.85 + R() * 0.25; g.fillStyle = `rgb(${120 * v | 0},${68 * v | 0},${44 * v | 0})`; g.fillRect(i * s / 2 + 3, j * s / 2 + 3, s / 2 - 6, s / 2 - 6); } noise(g, s, R, 2000, 0.15, false); noise(g, s, R, 400, 0.1, true); });
  TX.wall = canvasTex((g, s, R) => {
    const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#9a8466'); gr.addColorStop(1, '#a48d6c'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) { const x = R() * s; const st = g.createLinearGradient(0, 0, 0, s * 0.6); st.addColorStop(0, 'rgba(60,40,20,.25)'); st.addColorStop(1, 'rgba(60,40,20,0)'); g.fillStyle = st; g.fillRect(x, 0, 8 + R() * 22, s * (0.2 + R() * 0.4)); }
    noise(g, s, R, 3000, 0.1, false);
    const band = s * 0.66; g.fillStyle = '#6a2c1a'; g.beginPath(); g.moveTo(0, band); for (let x = 0; x <= s; x += 8) g.lineTo(x, band + (R() - 0.5) * 4); g.lineTo(s, s); g.lineTo(0, s); g.fill();
    noise(g, s, R, 900, 0.18, false);
    g.fillStyle = '#25170d'; g.fillRect(0, s * 0.955, s, s * 0.045);
  });
  TX.ceil = canvasTex((g, s, R) => { g.fillStyle = '#1d130b'; g.fillRect(0, 0, s, s); for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + R() * 0.3})`; g.fillRect(0, i * s / 8, s, 3); } noise(g, s, R, 1500, 0.15, true); });
  TX.dark = canvasTex((g, s, R) => { g.fillStyle = '#3e2716'; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(15,8,3,.3)'; for (let i = 0; i < 60; i++) { const y = R() * s; g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + R() * 10 - 5); g.stroke(); } noise(g, s, R, 1500, 0.15, true); });
  TX.plain = canvasTex((g, s, R) => { g.fillStyle = '#e6ded0'; g.fillRect(0, 0, s, s); noise(g, s, R, 2500, 0.08, false); }, 64);
  TX.cloth = canvasTex((g, s, R) => { g.fillStyle = '#d0c8bc'; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < s; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); } noise(g, s, R, 3000, 0.1, false); });
  TX.brick = canvasTex((g, s, R) => { g.fillStyle = '#2b140c'; g.fillRect(0, 0, s, s); const bh = s / 8; for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) { const v = 0.8 + R() * 0.35; g.fillStyle = `rgb(${122 * v | 0},${52 * v | 0},${34 * v | 0})`; g.fillRect(c * s / 4 + (r % 2 ? s / 8 : 0) + 2, r * bh + 2, s / 4 - 4, bh - 4); } noise(g, s, R, 1500, 0.15, false); });
  TX.door = canvasTex((g, s, R) => {
    g.fillStyle = '#a48d6c'; g.fillRect(0, 0, s, s); g.fillStyle = '#3a2414'; g.fillRect(s * 0.04, s * 0.12, s * 0.92, s * 0.88);
    g.strokeStyle = '#1e1209'; g.lineWidth = 5; g.strokeRect(s * 0.1, s * 0.2, s * 0.36, s * 0.7); g.strokeRect(s * 0.54, s * 0.2, s * 0.36, s * 0.7);
    g.fillStyle = '#5a3a1e'; g.fillRect(0, s * 0.08, s, s * 0.05); noise(g, s, R, 1500, 0.15, true);
  });
  TX.window = canvasTex((g, s, R) => {
    const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#1d2a40'); gr.addColorStop(1, '#0b111c'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(150,170,210,.35)'; g.lineWidth = 1; for (let i = 0; i < 50; i++) { const x = R() * s, y = R() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1, y + 10 + R() * 14); g.stroke(); }
    g.strokeStyle = '#2a1a0e'; g.lineWidth = 7; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo((i * s) / 5, 0); g.lineTo((i * s) / 5, s); g.stroke(); g.beginPath(); g.moveTo(0, (i * s) / 5); g.lineTo(s, (i * s) / 5); g.stroke(); }
    g.lineWidth = 16; g.strokeRect(0, 0, s, s);
  });
  TX.metal = canvasTex((g, s, R) => { g.fillStyle = '#3a3633'; g.fillRect(0, 0, s, s); noise(g, s, R, 800, 0.25, true); }, 64);
  TX.black = canvasTex((g, s) => { g.fillStyle = '#050304'; g.fillRect(0, 0, s, s); }, 16);
  const pt = (spec) => { const c = photoCanvas(spec, 480, 330); return glTex(c, false); };
  TX.parcel = pt(PH.parcel); TX.frame7 = pt(PH.frame7); TX.courtyard = pt(PH.courtyard); TX.dinner = pt(PH.dinner);
  const cr = (type, seed) => glTex(crayonCanvas(type, seed, 420, 300), false);
  TX.d1 = cr('house5', 43); TX.d2 = cr('house6', 50); TX.d3 = cr('house5s6', 57);
}

/* ============================== BUILDING THE HOUSE ============================== */
const WORLD = { ground: [], upper: [] }; // static meshes per floor
const isOpen = (f, x, y) => { const t = tileAt(f, x, y); return y >= 0 && x >= 0 && y < MAPS[f].length && x < MAPS[f][0].length && t !== '#' && t !== 'F'; };
const ROOM_TINT = (r) => { if (!r) return [0.9, 0.85, 0.8]; const c = parseInt(r.c.slice(1), 16); const k = 1 / 0x3a; return [((c >> 16) & 255) * k * 0.95, ((c >> 8) & 255) * k * 1.05, (c & 255) * k * 1.1]; };
function buildFloor(f) {
  const map = MAPS[f], rows = map.length, cols = map[0].length;
  const woodG = new Geo(), tileG = new Geo(), wallG = new Geo(), doorG = new Geo(), capG = new Geo(), lintG = new Geo();
  const floorByTint = new Map();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const t = map[y][x];
    if (t === '#' || t === 'F') {
      capG.poly([[x, WALL_H, y], [x + 1, WALL_H, y], [x + 1, WALL_H, y + 1], [x, WALL_H, y + 1]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      const g = t === 'F' ? doorG : wallG, vt = (yy) => yy / 2.5;
      if (isOpen(f, x, y + 1)) g.poly([[x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, WALL_H, y + 1], [x, WALL_H, y + 1]], [0, 0, 1], [[0, 0], [1, 0], [1, vt(WALL_H)], [0, vt(WALL_H)]]);
      if (isOpen(f, x, y - 1)) g.poly([[x + 1, 0, y], [x, 0, y], [x, WALL_H, y], [x + 1, WALL_H, y]], [0, 0, -1], [[0, 0], [1, 0], [1, vt(WALL_H)], [0, vt(WALL_H)]]);
      if (isOpen(f, x + 1, y)) g.poly([[x + 1, 0, y + 1], [x + 1, 0, y], [x + 1, WALL_H, y], [x + 1, WALL_H, y + 1]], [1, 0, 0], [[0, 0], [1, 0], [1, vt(WALL_H)], [0, vt(WALL_H)]]);
      if (isOpen(f, x - 1, y)) g.poly([[x, 0, y], [x, 0, y + 1], [x, WALL_H, y + 1], [x, WALL_H, y]], [-1, 0, 0], [[0, 0], [1, 0], [1, vt(WALL_H)], [0, vt(WALL_H)]]);
      continue;
    }
    const room = roomAt(f, x, y);
    const quad = [[x, 0, y], [x + 1, 0, y], [x + 1, 0, y + 1], [x, 0, y + 1]], uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    if (room && room.tile) tileG.poly(quad, [0, 1, 0], uv);
    else { const k = room ? room.n : '_'; if (!floorByTint.has(k)) floorByTint.set(k, { g: new Geo(), tint: ROOM_TINT(room) }); floorByTint.get(k).g.poly(quad, [0, 1, 0], uv); }
    if (!room && WALL_H > 2.2) lintG.box(x, 2.15, y, x + 1, WALL_H, y + 1);
  }
  const out = WORLD[f];
  for (const { g, tint } of floorByTint.values()) out.push(mesh(g, TX.wood, { tint }));
  if (tileG.v.length) out.push(mesh(tileG, TX.tile));
  out.push(mesh(wallG, TX.wall));
  if (doorG.v.length) out.push(mesh(doorG, TX.door));
  if (lintG.v.length) out.push(mesh(lintG, TX.dark));
  out.push(mesh(capG, TX.black, { tint: [3, 2.4, 2] }));
  if (VIEW === 'fp') {
    const c = new Geo(); c.poly([[0, WALL_H, 0], [cols, WALL_H, 0], [cols, WALL_H, rows], [0, WALL_H, rows]], [0, -1, 0], [[0, 0], [cols, 0], [cols, rows], [0, rows]]);
    for (let z = 2; z < rows; z += 2) c.box(0, WALL_H - 0.16, z - 0.08, cols, WALL_H, z + 0.08, 0.5);
    out.push(mesh(c, TX.ceil));
  }
  // windows set into the walls
  for (const [wx, wyy, kind] of WINDOWS[f]) {
    const g = new Geo(), y0 = wy(1.05), y1 = wy(2.05), e = 0.012;
    if (isOpen(f, wx, wyy + 1)) g.decal(wx + 0.15, y0, wx + 0.85, y1, wyy + 1 + e);
    else if (isOpen(f, wx, wyy - 1)) g.decal(wx + 0.15, y0, wx + 0.85, y1, wyy - e, '-z');
    else if (isOpen(f, wx + 1, wyy)) g.decal(wyy + 0.15, y0, wyy + 0.85, y1, wx + 1 + e, 'x');
    else g.poly([[wx - e, y0, wyy + 0.15], [wx - e, y0, wyy + 0.85], [wx - e, y1, wyy + 0.85], [wx - e, y1, wyy + 0.15]], [-1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    const m = mesh(g, kind === 'bricked' ? TX.brick : TX.window, { emit: kind === 'bricked' ? 0 : 0.35 });
    if (kind !== 'bricked') m.dyn = (mm) => { mm.emit = 0.35 + S.lightning * 14; };
    out.push(m);
  }
}

/* ---------- furniture and props ---------- */
function frontOf(o) { return solidTile(o.f, Math.floor(o.x + o.w / 2), Math.floor(o.y) - 1) ? 1 : -1; } // +1: faces south (+z)
function chair(g, x, z, s, a) {
  g.rot(x + s / 2, z + s / 2, a);
  g.box(x, 0.42, z, x + s, 0.47, z + s);
  for (const [lx, lz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.box(x + lx * (s - 0.05), 0, z + lz * (s - 0.05), x + lx * (s - 0.05) + 0.05, 0.42, z + lz * (s - 0.05) + 0.05);
  g.box(x, 0.47, z, x + s, 0.98, z + 0.05);
  g.rot(0, 0, 0);
}
function table(g, x0, z0, x1, z1, h) {
  g.box(x0, h - 0.05, z0, x1, h, z1);
  const l = 0.07; for (const [x, z] of [[x0 + 0.05, z0 + 0.05], [x1 - 0.05 - l, z0 + 0.05], [x0 + 0.05, z1 - 0.05 - l], [x1 - 0.05 - l, z1 - 0.05 - l]]) g.box(x, 0, z, x + l, h - 0.05, z + l);
}
function makeLantern() {
  const base = new Geo().box(-0.08, 0, -0.08, 0.08, 0.035, 0.08).box(-0.07, 0.22, -0.07, 0.07, 0.25, 0.07).box(-0.01, 0.25, -0.06, 0.01, 0.33, 0.06);
  const glass = new Geo().box(-0.055, 0.035, -0.055, 0.055, 0.22, 0.055);
  const flame = new Geo().box(-0.015, 0.08, -0.015, 0.015, 0.16, 0.015);
  return [mesh(base, TX.metal), mesh(glass, TX.plain, { tint: [1, 0.62, 0.3], emit: 0.9 }), mesh(flame, TX.plain, { tint: [1, 0.85, 0.5], emit: 3.5 })];
}
function setLantern(parts, x, y, z, t, ang = 0) { for (const p of parts) { p.pos = [x, y, z]; p.ang = ang; } parts[2].emit = 3 + Math.sin(t * 17) * 0.4 + Math.random() * 0.3; parts[1].emit = 0.8 + Math.sin(t * 11) * 0.08; }

const OBJM = { ground: [], upper: [] }; // object meshes per floor
function buildObject(o) {
  const out = [], P = [o.x, 0, o.y], w = o.w, d = o.h;
  const add = (g, tex, opt = {}) => { const m = mesh(g, tex, Object.assign({ pos: P }, opt)); out.push(m); return m; };
  let h3 = 0.6;
  switch (o.kind) {
    case 'frontdoor': add(new Geo().box(0.85, 1.0, -0.06, 0.9, 1.08, 0).box(1.1, 1.0, -0.06, 1.15, 1.08, 0), TX.metal, { tint: [2.2, 1.7, 0.9] }); h3 = 1.1; break;
    case 'slippers': { const g = new Geo(); for (let i = 0; i < 5; i++) { const x = 0.08 + i * 0.47; g.box(x, 0, 0.12, x + 0.1, 0.035, 0.42).box(x + 0.14, 0, 0.12, x + 0.24, 0.035, 0.42); } add(g, TX.cloth, { tint: [0.5, 0.36, 0.3] }); h3 = 0.1; break; }
    case 'entry': {
      const g = new Geo(); table(g, 0, 0, w, d, 0.8); add(g, TX.dark);
      add(new Geo().cyl(w * 0.2, 0.8, d / 2, 0.05, 0.08), TX.plain);
      add(new Geo().cyl(w * 0.2, 0.86, d / 2, 0.042, 0.015), TX.plain, { tint: [0.45, 0.28, 0.14] });
      add(new Geo().cyl(w * 0.46, 0.8, d / 2, 0.14, 0.015), TX.plain);
      add(new Geo().box(w * 0.4, 0.815, d / 2 - 0.06, w * 0.5, 0.85, d / 2 + 0.04), TX.cloth, { tint: [0.9, 0.7, 0.3] });
      h3 = 0.9; break;
    }
    case 'stairs':
      if (o.id === 'stairsG') {
        const g = new Geo(), n = 8, sd = d / n;
        for (let i = 0; i < n; i++) g.box(0, 0, d - (i + 1) * sd, w, (i + 1) * (WALL_H / (n + 0.6)), d - i * sd);
        add(g, TX.wood, { tint: [0.8, 0.75, 0.7] }); h3 = 0.6;
      } else {
        add(new Geo().box(0.02, -0.02, 0.02, w - 0.02, 0.006, d - 0.02), TX.black);
        add(new Geo().box(0, 0, 0, 0.05, 0.95, d).box(0, 0.9, 0, w, 0.95, 0.05).box(w - 0.05, 0, 0, w, 0.95, 0.4), TX.dark);
        h3 = 0.6;
      }
      break;
    case 'dining': {
      const g = new Geo(); table(g, 0, 0, w, d, 0.78); add(g, TX.dark, { tint: [1.15, 1.05, 1] });
      const pos = [[1.0, -0.62, 0], [3.6, -0.62, 0], [1.0, 2.1, Math.PI], [3.6, 2.1, Math.PI], [-0.68, 0.74, Math.PI / 2], [6.16, 0.74, -Math.PI / 2]];
      const cg = new Geo(), lone = new Geo();
      pos.forEach(([cx, cz, a], i) => chair(i === 2 ? lone : cg, cx, cz, 0.52, a));
      add(cg, TX.dark); add(lone, TX.dark, { vis: () => !S.changes });
      const plates = new Geo(), glasses = new Geo();
      [[1.25, 0.3], [3.85, 0.3], [1.25, 1.7], [3.85, 1.7], [0.3, 1], [5.7, 1]].forEach(([px, pz]) => { plates.cyl(px, 0.78, pz, 0.15, 0.015); glasses.cyl(px + 0.28, 0.78, pz, 0.035, 0.11, 8); });
      add(plates, TX.plain, { vis: () => S.dinnerSet }); add(glasses, TX.plain, { tint: [0.6, 0.7, 0.75], vis: () => S.dinnerSet });
      h3 = 0.8; break;
    }
    case 'pulledChair': {
      const g = new Geo(); chair(g, 0.1, 0.1, 0.52, Math.PI + 0.45); add(g, TX.dark);
      add(new Geo().rot(0.36, 0.36, 0.3).box(0.2, 0.475, 0.24, 0.52, 0.48, 0.47), TX.dinner, { vis: () => S.dinnerSet && !S.flags.dinner });
      h3 = 0.5; break;
    }
    case 'tea': add(new Geo().cyl(w / 2, 0.78, d / 2, 0.05, 0.08), TX.plain); add(new Geo().cyl(w / 2, 0.84, d / 2, 0.042, 0.015), TX.plain, { tint: [0.45, 0.28, 0.14] }); h3 = 0.9; break;
    case 'counter': {
      add(new Geo().box(0, 0, 0, w, 0.88, d), TX.dark, { tint: [0.75, 0.72, 0.7] });
      add(new Geo().box(0, 0.88, 0, w, 0.92, d), TX.metal, { tint: [1.4, 1.3, 1.2] });
      add(new Geo().cyl(0.55, 0.92, 0.5, 0.17, 0.03).cyl(1.2, 0.92, 0.5, 0.17, 0.03), TX.black);
      h3 = 0.95; break;
    }
    case 'plates': { const g = new Geo(); for (let i = 0; i < 6; i++) g.cyl(0.18 + i * 0.29, 0.92, d / 2, 0.13, 0.025); add(g, TX.plain); h3 = 0.95; break; }
    case 'cupboard': {
      const ch = { gcup: 1.9, kcup: 0.95, kcupb: 1.25 }[o.id] || 1.2, fr = frontOf(o), fz = fr > 0 ? d : 0;
      add(new Geo().box(0, 0, 0, w, ch, d), TX.dark);
      add(new Geo().decal(0.04, 0.04, w - 0.04, ch - 0.04, fz + fr * 0.004, fr > 0 ? 'z' : '-z'), TX.black, { vis: () => o.open && o.open() });
      const open = () => (o.open && o.open() ? 1.25 : 0);
      const left = new Geo().box(0, 0.03, fr > 0 ? 0 : -0.03, w / 2 - 0.01, ch - 0.03, fr > 0 ? 0.03 : 0);
      const right = new Geo().box(-w / 2 + 0.01, 0.03, fr > 0 ? 0 : -0.03, 0, ch - 0.03, fr > 0 ? 0.03 : 0);
      const L = add(left, TX.dark, { pos: [o.x, 0, o.y + fz], tint: [1.15, 1.1, 1] }), Rr = add(right, TX.dark, { pos: [o.x + w, 0, o.y + fz], tint: [1.15, 1.1, 1] });
      L.dyn = (m) => { m.ang += (-fr * open() - m.ang) * 0.1; }; Rr.dyn = (m) => { m.ang += (fr * open() - m.ang) * 0.1; };
      add(new Geo().box(w / 2 - 0.06, ch * 0.5, fz + fr * 0.03, w / 2 - 0.03, ch * 0.5 + 0.05, fz + fr * 0.05).box(w / 2 + 0.03, ch * 0.5, fz + fr * 0.03, w / 2 + 0.06, ch * 0.5 + 0.05, fz + fr * 0.05), TX.metal, { tint: [2, 1.6, 0.8], vis: () => !(o.open && o.open()) });
      if (o.id === 'kcup') add(new Geo().box(w * 0.6, 0, fz - 0.25, w * 0.6 + 0.32, 0.02, fz - 0.02), TX.plain, { vis: () => !S.flags.news1 });
      h3 = ch; break;
    }
    case 'bed': case 'bed2': case 'bedSmall': {
      const tint = o.kind === 'bed2' ? [0.6, 0.58, 0.55] : o.kind === 'bedSmall' ? [0.5, 0.42, 0.36] : [0.55, 0.3, 0.27];
      add(new Geo().box(0, 0, 0, w, 0.3, d).box(0, 0, 0, w, 0.85, 0.07), TX.dark);
      add(new Geo().box(0.05, 0.3, 0.07, w - 0.05, 0.44, d - 0.03), TX.cloth, { tint: [0.75, 0.72, 0.66] });
      add(new Geo().box(w * 0.15, 0.44, 0.12, w * 0.85, 0.53, 0.45), TX.cloth, { tint: [0.9, 0.87, 0.8] });
      if (o.kind !== 'bed2') add(new Geo().box(0.03, 0.44, d * 0.4, w - 0.03, 0.49, d - 0.02), TX.cloth, { tint });
      h3 = 0.6; break;
    }
    case 'frame': {
      const hh = w * 0.69, y0 = wy(2.3) - hh;
      add(new Geo().box(-0.05, y0 - 0.05, 0, w + 0.05, y0 + hh + 0.05, 0.04), TX.metal, { tint: [1.6, 1.2, 0.6] });
      const pm = add(new Geo().decal(0, y0, w, y0 + hh, 0.045), TX.parcel, { emit: 0.15 });
      pm.dyn = (m) => { m.tex = S.flags.keyfits ? TX.frame7 : TX.parcel; };
      h3 = y0 + hh / 2; break;
    }
    case 'shelf': {
      add(new Geo().box(0, 0, 0, 0.45, 1.3, d), TX.dark);
      add(new Geo().rot(0.25, d / 2, 0).box(0.2, 1.3, 0.55, 0.24, 1.82, 1.45), TX.metal, { tint: [1.5, 1.1, 0.6] });
      add(new Geo().decal(0.6, 1.33, 1.4, 1.8, 0.245, 'x'), TX.courtyard, { emit: 0.15 });
      h3 = 1.5; break;
    }
    case 'sofa': add(new Geo().box(0, 0, 0, w, 0.42, d).box(0, 0.42, d - 0.25, w, 0.9, d).box(0, 0.42, 0, 0.18, 0.65, d).box(w - 0.18, 0.42, 0, w, 0.65, d), TX.cloth, { tint: [0.42, 0.2, 0.18] }); h3 = 0.6; break;
    case 'chest': {
      add(new Geo().box(0, 0, 0, w, 0.5, d), TX.dark);
      add(new Geo().box(w * 0.2, 0, -0.01, w * 0.2 + 0.05, 0.51, d + 0.01).box(w * 0.8, 0, -0.01, w * 0.8 + 0.05, 0.51, d + 0.01), TX.metal);
      const lid = add(new Geo().box(0, 0, -d, w, 0.07, 0), TX.dark, { pos: [o.x, 0.5, o.y + d], axis: 'x', tint: [1.1, 1, 0.95] });
      lid.dyn = (m) => { m.ang += ((S.ch >= 5 ? 0.9 : 0) - m.ang) * 0.08; };
      h3 = 0.6; break;
    }
    case 'notebook': add(new Geo().box(0.05, 0.45, 0.05, 0.75, 0.47, 0.55), TX.plain); add(new Geo().box(0.38, 0.47, 0.05, 0.42, 0.475, 0.55), TX.plain, { tint: [0.5, 0.2, 0.15] }); h3 = 0.5; break;
    case 'desk': { const g = new Geo(); table(g, 0, 0, w, d, 0.75); add(g, TX.dark); add(new Geo().rot(0.8, 0.45, 0.2).box(0.6, 0.75, 0.3, 1.0, 0.76, 0.6), TX.plain); add(new Geo().box(1.7, 0.75, 0.4, 2.0, 0.77, 0.42), TX.plain, { tint: [0.8, 0.25, 0.2] }); h3 = 0.8; break; }
    case 'clothes': {
      const zz = 5 - o.y - 0.12;
      add(new Geo().box(0, wy(1.85), zz - 0.02, w, wy(1.88), zz + 0.02), TX.metal);
      [[0.76, 0.36, 0.45], [0.35, 0.5, 0.66], [0.8, 0.72, 0.55]].forEach((t, i) => add(new Geo().box(0.1 + i * 0.5, wy(0.85), zz - 0.12, 0.5 + i * 0.5, wy(1.82), zz), TX.cloth, { tint: t }));
      h3 = wy(1.3); break;
    }
    case 'mirror': {
      const y0 = wy(0.9), y1 = wy(2.0);
      add(new Geo().box(0, y0, 0, w, y1, 0.05), TX.dark);
      add(new Geo().decal(0.06, y0 + 0.06, w - 0.06, y1 - 0.06, 0.055), TX.cloth, { vis: () => S.ch < 6 });
      add(new Geo().decal(0.06, y0 + 0.06, w * 0.55, y1 - 0.06, 0.055), TX.window, { vis: () => S.ch >= 6, tint: [0.4, 0.45, 0.5] });
      add(new Geo().decal(w * 0.55, y0 + 0.06, w - 0.06, y1 - 0.06, 0.056), TX.cloth, { vis: () => S.ch >= 6 });
      h3 = (y0 + y1) / 2; break;
    }
    case 'boxes': add(new Geo().box(0, 0, 0, w * 0.6, 0.5, d * 0.55).box(w * 0.3, 0, d * 0.45, w, 0.4, d).box(0.1, 0.5, 0.1, w * 0.5, 0.8, d * 0.45), TX.cloth, { tint: [0.6, 0.45, 0.3] }); h3 = 0.85; break;
    case 'door': {
      const dh = Math.min(2.1, WALL_H - 0.02);
      const panel = add(new Geo().box(-0.98, 0, -0.03, -0.02, dh, 0.03).box(-0.85, dh * 0.47, 0.03, -0.75, dh * 0.47 + 0.08, 0.06), TX.dark, { pos: [o.x + 1, 0, o.y + 0.5], tint: [1.2, 1.05, 0.95] });
      panel.dyn = (m) => { m.ang += ((S.upDoorOpen ? 1.5 : 0) - m.ang) * 0.06; };
      h3 = 1.1; break;
    }
    case 'papers': {
      const y0 = wy(1.15), y1 = y0 + 0.44 * (VIEW === 'iso' ? 0.6 : 1);
      [TX.d1, TX.d2, TX.d3].forEach((tx, i) => add(new Geo().decal(0.02 + i * 0.8, y0 + (i % 2) * 0.04, 0.62 + i * 0.8, y1 + (i % 2) * 0.04, 0.015 + i * 0.002), tx, { emit: 0.15 }));
      h3 = (y0 + y1) / 2; break;
    }
    case 'bag': add(new Geo().box(0.1, 0, 0.1, 0.75, 0.32, 0.5), TX.cloth, { tint: [0.24, 0.36, 0.28] }); add(new Geo().box(0.1, 0.25, 0.08, 0.75, 0.33, 0.3), TX.cloth, { tint: [0.18, 0.28, 0.21] }); h3 = 0.4; break;
    case 'toy': add(new Geo().box(0.1, 0.12, 0.15, 0.45, 0.25, 0.32).box(0.4, 0.22, 0.18, 0.55, 0.36, 0.3).box(0.12, 0, 0.16, 0.16, 0.12, 0.2).box(0.12, 0, 0.27, 0.16, 0.12, 0.31).box(0.38, 0, 0.27, 0.42, 0.12, 0.31), TX.dark, { tint: [1.6, 1.1, 0.7] }); h3 = 0.4; break;
  }
  o.h3 = h3;
  if (o.act) { // a glint above things worth examining
    const gx = w / 2, gz = d / 2;
    const wall = ['frame', 'papers', 'mirror'].includes(o.kind);
    const gm = add(new Geo().box(-0.025, -0.025, -0.025, 0.025, 0.025, 0.025), TX.plain, { tint: [1, 0.8, 0.55], emit: 3 });
    gm.glint = true;
    gm.dyn = (m, t) => { m.pos = [o.x + gx, (wall ? h3 + 0.05 : h3 + 0.18) + Math.sin(t * 2 + o.x) * 0.03, o.y + (wall ? 0.18 : gz)]; m.ang = t; m.emit = 1.5 + Math.sin(t * 2.4 + o.x) * 1.2; };
    gm.vis = () => !S.busy && !S.ended && (!S.seen[o.id] || wanted(o)) && isVis(o);
  }
  return out;
}
let LANT_WORLD, LANT_ENTRY, LANT_HAND, FIGURE, BODY;
function buildAll() {
  makeTextures();
  for (const f of ['ground', 'upper']) buildFloor(f);
  for (const o of OBJ) { if (o.kind === 'lal') continue; const ms = buildObject(o); for (const m of ms) { m.obj = o; OBJM[o.f].push(m); } }
  LANT_WORLD = makeLantern(); LANT_ENTRY = makeLantern(); LANT_HAND = makeLantern();
  LAL.h3 = 0.3;
  FIGURE = [mesh(new Geo().box(-0.17, 0.05, -0.11, 0.17, 0.75, 0.11).box(-0.13, 0, -0.07, -0.02, 0.4, 0.05).box(0.02, 0, -0.07, 0.13, 0.4, 0.05).box(-0.12, 0.78, -0.11, 0.12, 1.02, 0.11), TX.cloth, { tint: [0.07, 0.06, 0.06] })];
  BODY = [mesh(new Geo().box(-0.12, 0, -0.2, 0.12, 0.85, 0.2), TX.cloth, { tint: [0.17, 0.2, 0.25] }), mesh(new Geo().box(-0.1, 0.88, -0.1, 0.1, 1.1, 0.1), TX.cloth, { tint: [0.12, 0.08, 0.06] }), mesh(new Geo().box(0.1, 0.92, -0.06, 0.13, 1.02, 0.06), TX.cloth, { tint: [0.55, 0.42, 0.3] })];
}

/* ============================== CAMERA, LIGHTS, DRAW ============================== */
let PV = null, EYEP = [0, 0, 0], FWD = [1, 0, 0], RIGHT = [0, 0, 1], UPV = [0, 1, 0], FOV = 1.25;
const cam = { pitch: 0 };
function setCamera(t) {
  const asp = W / H;
  if (VIEW === 'fp') {
    FOV = asp < 1 ? 1.45 : 1.25;
    const bob = Math.sin(S.walkT * 9) * 0.025;
    EYEP = [S.p.x, EYE + bob, S.p.y];
    FWD = [Math.cos(S.p.dir) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.sin(S.p.dir) * Math.cos(cam.pitch)];
  } else {
    FOV = asp < 1 ? 0.95 : 0.75;
    const back = asp < 1 ? 9 : 7;
    EYEP = [S.p.x, back * 1.25, S.p.y + back * 0.85];
    FWD = norm(sub([S.p.x, 0.3, S.p.y - 0.2], EYEP));
  }
  RIGHT = norm(cross(FWD, [0, 1, 0])); UPV = cross(RIGHT, FWD);
  PV = mul(persp(FOV, asp, 0.05, 80), lookAt(EYEP, [EYEP[0] + FWD[0], EYEP[1] + FWD[1], EYEP[2] + FWD[2]]));
}
function drawMesh(m) {
  gl.bindBuffer(gl.ARRAY_BUFFER, m.b);
  gl.vertexAttribPointer(A.aP, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(A.aN, 3, gl.FLOAT, false, 32, 12); gl.vertexAttribPointer(A.aU, 2, gl.FLOAT, false, 32, 24);
  gl.uniformMatrix4fv(U.uM, false, model(m.pos, m.ang, m.axis));
  gl.uniform3fv(U.uTint, m.tint); gl.uniform1f(U.uEmit, m.emit);
  gl.bindTexture(gl.TEXTURE_2D, m.tex);
  gl.drawArrays(gl.TRIANGLES, 0, m.n);
}
function lightsFor(t) {
  const fl = 1 + Math.sin(t * 13) * 0.03 + Math.sin(t * 7.3) * 0.03 + (Math.random() - 0.5) * 0.03;
  const L = [];
  const hand = VIEW === 'fp' ? [S.p.x + Math.cos(S.p.dir) * 0.3, 1.25, S.p.y + Math.sin(S.p.dir) * 0.3] : [S.p.x, 1.0, S.p.y];
  if (S.hasLalteen) L.push([hand, [1.5 * fl, 0.92 * fl, 0.45 * fl], 7.5 * fl]);
  else L.push([[S.p.x, 1.4, S.p.y], [0.3, 0.33, 0.42], VIEW === 'iso' ? 3.2 : 2.8]);
  let wl = null;
  if (S.lalOnEntry && S.floor === 'ground') wl = [S.lalteenAt.x, 0.95, S.lalteenAt.y];
  else if (!S.lalOnEntry && S.lalteenAt && S.lalteenAt.f === S.floor) wl = [S.lalteenAt.x, S.lalteenAt.f === 'ground' && S.dinnerSet ? 0.95 : 0.25, S.lalteenAt.y];
  L.push(wl ? [wl, [1.5 * fl, 0.9 * fl, 0.42 * fl], 6.5 * fl] : [[0, -50, 0], [0, 0, 0], 1]);
  if (S.figure && S.floor === 'ground') L.push([[S.figure.x, 1.1, S.figure.y + 1.1], [0.9, 1.0, 1.45], 4.2]);
  else L.push([[0, -50, 0], [0, 0, 0], 1]);
  return L;
}
function render(t) {
  gl.viewport(0, 0, cv.width, cv.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (S.blackout > 0) return;
  setCamera(t);
  gl.useProgram(prog); gl.enableVertexAttribArray(A.aP); gl.enableVertexAttribArray(A.aN); gl.enableVertexAttribArray(A.aU);
  gl.activeTexture(gl.TEXTURE0); gl.uniform1i(U.uTex, 0);
  gl.uniformMatrix4fv(U.uPV, false, PV);
  const L = lightsFor(t);
  gl.uniform3fv(U.uLp, L.flatMap((l) => l[0])); gl.uniform3fv(U.uLc, L.flatMap((l) => l[1])); gl.uniform1fv(U.uLr, L.map((l) => l[2]));
  const fl = S.lightning > 0 ? 1 : 0;
  gl.uniform3fv(U.uAmb, [0.035 + fl * 0.3, 0.03 + fl * 0.33, 0.038 + fl * 0.45]);
  gl.uniform3fv(U.uFogC, VIEW === 'fp' ? EYEP : [S.p.x, 1, S.p.y]); gl.uniform1f(U.uFog, VIEW === 'fp' ? 0.17 : 0.2);
  for (const m of WORLD[S.floor]) { if (m.dyn) m.dyn(m, t); drawMesh(m); }
  for (const m of OBJM[S.floor]) { if (m.dyn) m.dyn(m, t); const o = m.obj; if (o.kind !== 'door' && !isVis(o)) continue; if (m.vis && !m.vis()) continue; drawMesh(m); }
  if (S.lalOnEntry && S.floor === 'ground') { setLantern(LANT_ENTRY, S.lalteenAt.x, 0.8, S.lalteenAt.y, t); LANT_ENTRY.forEach(drawMesh); }
  if (!S.lalOnEntry && S.lalteenAt && S.lalteenAt.f === S.floor) { setLantern(LANT_WORLD, S.lalteenAt.x, S.lalteenAt.f === 'ground' && S.dinnerSet ? 0.78 : 0, S.lalteenAt.y, t); LANT_WORLD.forEach(drawMesh); }
  if (S.figure && S.floor === 'ground') { FIGURE[0].pos = [S.figure.x, 0, S.figure.y]; FIGURE[0].ang = Math.PI / 2; drawMesh(FIGURE[0]); }
  if (VIEW === 'iso') { for (const b of BODY) { b.pos = [S.p.x, 0, S.p.y]; b.ang = -S.p.dir; drawMesh(b); } }
  if (S.hasLalteen) {
    if (VIEW === 'fp') {
      const sw = Math.sin(S.walkT * 4.5) * 0.015;
      const tall = W < H, fw = tall ? 1.05 : 0.75, rt = (tall ? 0.2 : 0.32) + sw, dn = tall ? 0.6 : 0.5;
      const p = [EYEP[0] + FWD[0] * fw + RIGHT[0] * rt - UPV[0] * dn, EYEP[1] + FWD[1] * fw - UPV[1] * dn - 0.1, EYEP[2] + FWD[2] * fw + RIGHT[2] * rt - UPV[2] * dn];
      gl.clear(gl.DEPTH_BUFFER_BIT); // the lantern in your hand never clips into walls
      setLantern(LANT_HAND, p[0], p[1], p[2], t, -S.p.dir); LANT_HAND[1].emit *= 0.45; LANT_HAND.forEach(drawMesh);
    } else { setLantern(LANT_HAND, S.p.x + Math.cos(S.p.dir + 1.2) * 0.26, 0.45, S.p.y + Math.sin(S.p.dir + 1.2) * 0.26, t); LANT_HAND.forEach(drawMesh); }
  }
}
function project(p) {
  const x = p[0], y = p[1], z = p[2], m = PV;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 0) return null; return [((cx / cw + 1) / 2) * W, ((1 - cy / cw) / 2) * H];
}

/* ============================== TARGETING & INTERACTION ============================== */
function inRect(x, z, o) { return x >= o.x && x <= o.x + o.w && z >= o.y && z <= o.y + o.h; }
function target() {
  let best = null, bs = 1e9;
  const fx = Math.cos(S.p.dir), fz = Math.sin(S.p.dir);
  for (const o of OBJ) {
    if (o.f !== S.floor || !o.act || !isVis(o)) continue;
    const d = rectDist(S.p.x, S.p.y, o); if (d > REACH) continue;
    if (VIEW === 'iso') { if (d < bs) { bs = d; best = o; } continue; }
    let ang;
    let hit = false; for (let s = 0.1; s <= REACH + 0.3; s += 0.1) if (inRect(S.p.x + fx * s, S.p.y + fz * s, o)) { hit = true; break; }
    if (hit) ang = 0;
    else { const tx = o.x + o.w / 2 - S.p.x, tz = o.y + o.h / 2 - S.p.y, tl = Math.hypot(tx, tz) || 1; ang = Math.acos(clamp((tx * fx + tz * fz) / tl, -1, 1)); }
    if (ang > 0.7) continue;
    const sc = ang + d * 0.3; if (sc < bs) { bs = sc; best = o; }
  }
  return best;
}
function interact(o) { S.seen[o.id] = true; S.path = null; S.pendingObj = null; o.act(o); updateHUD(); }
function rayAt(sx, sy) {
  const nx = (sx / W) * 2 - 1, ny = 1 - (sy / H) * 2, th = Math.tan(FOV / 2), asp = W / H;
  return norm([FWD[0] + RIGHT[0] * nx * th * asp + UPV[0] * ny * th, FWD[1] + RIGHT[1] * nx * th * asp + UPV[1] * ny * th, FWD[2] + RIGHT[2] * nx * th * asp + UPV[2] * ny * th]);
}
function rayBox(o, dir) {
  const mn = [o.x - 0.08, 0, o.y - 0.08], mx = [o.x + o.w + 0.08, (o.h3 || 0.6) + 0.25, o.y + o.h + 0.08];
  let t0 = 0, t1 = 1e9;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-6) { if (EYEP[i] < mn[i] || EYEP[i] > mx[i]) return null; continue; }
    let a = (mn[i] - EYEP[i]) / dir[i], b = (mx[i] - EYEP[i]) / dir[i]; if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return null;
  }
  return t0;
}
function tapAt(sx, sy) {
  if (!S.started || S.busy || S.ended || !PV) return;
  const dir = rayAt(sx, sy);
  let hit = null, ht = 1e9;
  for (const o of OBJ) { if (o.f !== S.floor || !o.act || !isVis(o)) continue; const t = rayBox(o, dir); if (t != null && t < ht) { ht = t; hit = o; } }
  if (VIEW === 'fp') { if (hit && rectDist(S.p.x, S.p.y, hit) < REACH + 0.4) interact(hit); return; }
  if (hit) {
    if (rectDist(S.p.x, S.p.y, hit) < REACH) { interact(hit); return; }
    S.path = findPath((x, y) => rectDist(x + 0.5, y + 0.5, hit) < 0.9); S.pendingObj = S.path ? hit : null; return;
  }
  if (dir[1] >= 0) return;
  const t = -EYEP[1] / dir[1], wx = EYEP[0] + dir[0] * t, wz = EYEP[2] + dir[2] * t, gx = Math.floor(wx), gy = Math.floor(wz);
  S.pendingObj = null;
  S.path = blockedTile(S.floor, gx, gy) ? null : findPath((x, y) => x === gx && y === gy);
  if (S.path) S.path.push({ x: clamp(wx, gx + 0.3, gx + 0.7), y: clamp(wz, gy + 0.3, gy + 0.7) });
}

/* ============================== INPUT ============================== */
const keys = {};
let touchMode = false;
function setTouch(on) { touchMode = on; document.body.classList.toggle('touch', on); }
try { if (matchMedia('(pointer: coarse)').matches) setTouch(true); } catch (e) {}
addEventListener('keydown', (e) => {
  if (!S.started) return;
  const k = e.key.toLowerCase();
  if (docEl.classList.contains('on')) { if (['e', ' ', 'enter', 'escape'].includes(k)) { e.preventDefault(); AU.paper(); showNextDoc(); } return; }
  if (choiceEl.classList.contains('on')) { if (k === 'escape') { choiceEl.classList.remove('on'); S.busy = false; } return; }
  if (S.ended) return;
  keys[k] = true; if (touchMode) setTouch(false);
  if (['e', ' ', 'enter'].includes(k)) { e.preventDefault(); if (!S.busy) { const n = target(); if (n) interact(n); } }
  if (k === 'm') $('#mute').textContent = AU.toggle() ? '♪' : '–';
  if (k.startsWith('arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
// mouse: first person looks with pointer lock (or by dragging); the diorama clicks to walk
let drag = null;
const locked = () => document.pointerLockElement === cv;
cv.addEventListener('pointerdown', (e) => {
  if (!S.started || S.busy || S.ended) return;
  AU.init();
  if (e.pointerType !== 'mouse') { if (!touchMode) setTouch(true); tapAt(e.clientX, e.clientY); return; }
  if (VIEW === 'iso') { tapAt(e.clientX, e.clientY); return; }
  if (locked()) { const n = target(); if (n) interact(n); return; }
  drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  try { const p = cv.requestPointerLock && cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {}
});
addEventListener('pointermove', (e) => {
  if (VIEW !== 'fp' || e.pointerType !== 'mouse') return;
  if (locked()) { look(e.movementX * 0.0024, e.movementY * 0.0024); return; }
  if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; look(dx * 0.005, dy * 0.005); drag.x = e.clientX; drag.y = e.clientY; }
});
addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) { if (!drag.moved && !locked()) tapAt(e.clientX, e.clientY); drag = null; } });
function look(dx, dy) { S.p.dir += dx; cam.pitch = clamp(cam.pitch - dy, -1.1, 1.0); S.lookAt = null; }
// phone: floating stick on the lower left, drag the right half to look (first person)
S.joy = { x: 0, y: 0 };
const zone = $('#zone'), padStick = $('#stick'), knob = $('#knob');
let joyId = null, joyO = null, joyT0 = 0, joyMoved = false;
const JOY_MAX = 48;
function placeStick(x, y) { padStick.style.left = (x - 64) + 'px'; padStick.style.top = (y - 64) + 'px'; padStick.style.bottom = 'auto'; }
function joyMove(e) {
  let dx = e.clientX - joyO.x, dy = e.clientY - joyO.y, d = Math.hypot(dx, dy);
  if (d > 8) joyMoved = true;
  if (d > JOY_MAX) { const over = d - JOY_MAX; joyO.x += (dx / d) * over; joyO.y += (dy / d) * over; placeStick(joyO.x, joyO.y); dx = e.clientX - joyO.x; dy = e.clientY - joyO.y; d = JOY_MAX; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  const mag = Math.min(1, d / (JOY_MAX * 0.7)); S.joy.x = d ? (dx / d) * mag : 0; S.joy.y = d ? (dy / d) * mag : 0;
}
function joyEnd(e) {
  if (e.pointerId !== joyId) return;
  joyId = null; S.joy.x = S.joy.y = 0; knob.style.transform = '';
  padStick.classList.remove('active'); padStick.style.left = padStick.style.top = padStick.style.bottom = '';
  if (!joyMoved && performance.now() - joyT0 < 300 && e.type === 'pointerup') tapAt(e.clientX, e.clientY);
}
zone.addEventListener('pointerdown', (e) => {
  e.preventDefault(); AU.init();
  if (!S.started || S.busy || S.ended || joyId !== null) return;
  joyId = e.pointerId; zone.setPointerCapture(e.pointerId);
  joyO = { x: e.clientX, y: e.clientY }; joyT0 = performance.now(); joyMoved = false;
  placeStick(joyO.x, joyO.y); padStick.classList.add('active'); S.path = null; S.pendingObj = null;
});
zone.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
zone.addEventListener('pointerup', joyEnd); zone.addEventListener('pointercancel', joyEnd);
const lookZone = $('#lookzone'); let lookP = null;
lookZone.addEventListener('pointerdown', (e) => { e.preventDefault(); AU.init(); if (!S.started || S.busy || S.ended || lookP) return; lookP = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false }; lookZone.setPointerCapture(e.pointerId); });
lookZone.addEventListener('pointermove', (e) => { if (!lookP || e.pointerId !== lookP.id) return; const dx = e.clientX - lookP.x, dy = e.clientY - lookP.y; if (Math.abs(dx) + Math.abs(dy) > 2) lookP.moved = true; look(dx * 0.0065, dy * 0.0065); lookP.x = e.clientX; lookP.y = e.clientY; });
const lookEnd = (e) => { if (!lookP || e.pointerId !== lookP.id) return; if (!lookP.moved && performance.now() - lookP.t < 300 && e.type === 'pointerup') tapAt(e.clientX, e.clientY); lookP = null; };
lookZone.addEventListener('pointerup', lookEnd); lookZone.addEventListener('pointercancel', lookEnd);
$('#act').addEventListener('pointerdown', (e) => { e.preventDefault(); AU.init(); if (S.busy) return; const n = target(); if (n) interact(n); });
$('#act').addEventListener('click', (e) => { if (e.pointerType) return; if (!S.busy) { const n = target(); if (n) interact(n); } });
$('#mute').addEventListener('click', () => { $('#mute').textContent = AU.toggle() ? '♪' : '–'; });

/* ============================== UPDATE ============================== */
let lastRoom = '', figureSeen = false;
const promptEl = $('#prompt'), crossEl = $('#crosshair'), hintEl = $('#lockhint'), flashEl = $('#flash');
function update(dt, t) {
  if (S.blackout > 0) S.blackout -= dt;
  if (S.lightning > 0) S.lightning -= dt;
  if (S.memory > 0) S.memory = Math.max(0, S.memory - dt * 0.35);
  flashEl.style.opacity = S.memory * 0.4;
  updateToast(dt);
  if (!S.started || S.ended) return;
  if (S.busy && locked()) document.exitPointerLock();
  S.nextThunder -= dt;
  if (S.nextThunder <= 0) { S.lightning = 0.14; setTimeout(() => AU.thunder(), 500 + Math.random() * 1600); S.nextThunder = 16 + Math.random() * 28; }
  if (S.ch >= 3) { S.nextCreak -= dt; if (S.nextCreak <= 0) { AU.creak(); S.nextCreak = 18 + Math.random() * 30; } }
  if (S.ch >= 4 && S.ch <= 6 && S.floor === 'ground') { S.nextSteps -= dt; if (S.nextSteps <= 0) { AU.stepsAbove(); S.nextSteps = 35 + Math.random() * 40; } }
  if (S.pendingAdvance && !S.busy && toastIdle()) { S.pendingAdvance = false; advance(); }
  // Dinner: in first person the figure stands in the hall doorway and your head turns towards it
  if (S.figure && !figureSeen) { figureSeen = true; if (VIEW === 'fp') { S.figure.y = 7.15; S.lookAt = { x: S.figure.x, y: S.figure.y }; } }
  if (S.lookAt) { const want = Math.atan2(S.lookAt.y - S.p.y, S.lookAt.x - S.p.x); let dd = want - S.p.dir; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); S.p.dir += dd * Math.min(1, dt * 3); const wantP = Math.atan2(0.75 - EYE, Math.hypot(S.lookAt.y - S.p.y, S.lookAt.x - S.p.x)); cam.pitch += (wantP - cam.pitch) * Math.min(1, dt * 3); if (Math.abs(dd) < 0.01) S.lookAt = null; }
  const n = S.busy ? null : target();
  $('#act').classList.toggle('ready', !!n);
  crossEl.classList.toggle('on', !!n);
  if (n) {
    promptEl.textContent = (touchMode ? '' : 'E · ') + n.name; promptEl.classList.add('on');
    if (VIEW === 'iso' && PV) { const p = project([n.x + n.w / 2, (n.h3 || 0.6) + 0.5, n.y + n.h / 2]); if (p) { promptEl.style.left = p[0] + 'px'; promptEl.style.top = (p[1] - 40) + 'px'; } }
  } else promptEl.classList.remove('on');
  hintEl.classList.toggle('on', VIEW === 'fp' && !touchMode && !locked() && !S.busy);
  if (S.busy) return;
  let f = 0, s = 0, turn = 0, mx = 0, mz = 0;
  if (VIEW === 'fp') {
    if (keys.w || keys.arrowup) f += 1; if (keys.s || keys.arrowdown) f -= 1;
    if (keys.a) s -= 1; if (keys.d) s += 1;
    if (keys.arrowleft || keys.q) turn -= 1; if (keys.arrowright) turn += 1;
    if (!f && !s && Math.hypot(S.joy.x, S.joy.y) > 0.12) { f = -S.joy.y; s = S.joy.x; }
    if (turn) { S.p.dir += turn * 2.2 * dt; S.lookAt = null; }
    const c = Math.cos(S.p.dir), sn = Math.sin(S.p.dir);
    mx = c * f - sn * s; mz = sn * f + c * s;
  } else {
    if (keys.a || keys.arrowleft) mx -= 1; if (keys.d || keys.arrowright) mx += 1;
    if (keys.w || keys.arrowup) mz -= 1; if (keys.s || keys.arrowdown) mz += 1;
    if (!mx && !mz && Math.hypot(S.joy.x, S.joy.y) > 0.12) { mx = S.joy.x; mz = S.joy.y; }
  }
  const speed = 2.5;
  let moving = false;
  if (mx || mz) {
    S.path = null; S.pendingObj = null;
    const l = Math.hypot(mx, mz), k = Math.min(1, l) / l;
    if (VIEW === 'iso') S.p.dir = Math.atan2(mz, mx);
    moving = move(mx * k * speed * dt, mz * k * speed * dt);
  } else if (S.path && S.path.length) {
    if (S.pendingObj && rectDist(S.p.x, S.p.y, S.pendingObj) < REACH - 0.1) { interact(S.pendingObj); return; }
    const wp = S.path[0], dx = wp.x - S.p.x, dz = wp.y - S.p.y, d = Math.hypot(dx, dz);
    if (d < 0.08) { S.path.shift(); if (!S.path.length && S.pendingObj) { const o = S.pendingObj; if (rectDist(S.p.x, S.p.y, o) < REACH) interact(o); S.pendingObj = null; } }
    else {
      S.p.dir = Math.atan2(dz, dx); const st = Math.min(d, speed * dt);
      moving = move((dx / d) * st, (dz / d) * st);
      if (!moving) { S.stuckT += dt; if (S.stuckT > 0.5) { S.path = null; S.stuckT = 0; } } else S.stuckT = 0;
    }
  }
  if (moving) { const before = Math.floor((S.walkT * 10) / Math.PI); S.walkT += dt; if (Math.floor((S.walkT * 10) / Math.PI) !== before) AU.step(); }
  const r = roomAt(S.floor, Math.floor(S.p.x), Math.floor(S.p.y)); const rn = r ? r.n : lastRoom;
  if (rn !== lastRoom) { lastRoom = rn; updateHUD(); }
}

/* ============================== LOOP & START ============================== */
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 1.75); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  for (const c of [$('#tcv'), ecv]) { c.width = W * DPR; c.height = H * DPR; }
}
let titleOn = true, titleFlash = 0, last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  update(dt, t);
  if (S.started && gl) render(t);
  if (titleOn) { const g = $('#tcv').getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0); drawHouseExt(g, W, H, t, { glow: true, flash: titleFlash > 0 ? 1 : 0 }); if (titleFlash > 0) titleFlash -= dt; else if (Math.random() < dt / 12) titleFlash = 0.12; }
  if (endEl.classList.contains('on') && endDraw) { eg.setTransform(DPR, 0, 0, DPR, 0, 0); endDraw(eg, W, H, (now - endT0) / 1000); }
  requestAnimationFrame(loop);
}
function intro() {
  openDocs([
    { t: 'card', text: ['You are Ankit. You are twenty-eight.', 'A parcel arrives from your younger sister, Nisha.'] },
    { t: 'photo', spec: PH.parcel, back: 'Do you remember who this is?', note: 'Grandfather. Your parents. Nisha and you, as children. And one more person, standing between you. You do not recognise them.' },
    { t: 'object', draw: drawKey, note: 'A small brass key.' },
    { ...D.news1, note: 'And a newspaper clipping.' },
    { t: 'card', text: ['You call Nisha. Her phone is switched off.', 'The family house has been mostly empty since Grandfather Bhim died.'] },
    { t: 'card', text: ['It is raining when you arrive.', 'The main door is unlocked.'] },
  ], () => {
    S.ch = 1; $('#hud').classList.add('on'); $('#mute').classList.add('on');
    AU.drone(0.012); showCard(1); updateHUD();
    setTimeout(() => say('Inside, a light is burning.'), 3600);
  });
}
function debugJump(n) {
  for (let c = 1; c < n; c++) (REQ[c] || []).forEach((f) => (S.flags[f] = true));
  S.flags.table = true; S.lalOnEntry = false; S.lalteenAt = null; S.hasLalteen = true;
  S.upDoorOpen = n >= 5; S.ch = n;
  if (n >= 6) { S.changes = true; S.hasLalteen = false; placeLalteen('upper', 21.5, 2.7); }
  if (n >= 7) { S.dinnerSet = true; placeLalteen('ground', 13, 3.5); }
  S.p.x = 12.95; S.p.y = 9; $('#hud').classList.add('on'); $('#mute').classList.add('on'); updateHUD();
}
$('#start').addEventListener('click', () => {
  AU.init();
  titleOn = false; $('#title').classList.add('off');
  setTimeout(() => { $('#title').style.display = 'none'; }, 1700);
  if (!gl || !prog) { say('This browser could not start the 3D view. Try the 2D version of the game instead.'); return; }
  S.started = true; document.body.classList.add('playing');
  const q = new URLSearchParams(location.search), jump = parseInt(q.get('chapter'), 10);
  if (jump >= 1 && jump <= 7) { debugJump(jump); showCard(jump); return; }
  intro();
});
addEventListener('resize', resize);
resize();
if (gl) { try { initGL(); buildAll(); } catch (err) { console.error(err); prog = null; } }
requestAnimationFrame(loop);
window.KHYAA = { S, OBJ, skipToasts: () => { toastQ.length = 0; toastT = 0; toastGap = 0; }, interact: (id) => { const o = OBJ.find((x) => x.id === id); if (o) interact(o); }, goto: (f, x, y, dir) => { S.floor = f; S.p.x = x; S.p.y = y; if (dir != null) S.p.dir = dir; }, cam, target: () => { const n = target(); return n && n.id; }, tapAt };
