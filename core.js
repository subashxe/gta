'use strict';
/* KHYAA — shared story, documents, art, sound and rules.
   Loaded as a classic script before a renderer (game.js for 2D, game3d.js for 3D);
   top-level declarations here are visible to the renderer. */
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

/* ============================== AUDIO ============================== */
const AU = {
  c: null, m: null, on: true,
  init() {
    if (this.c) { if (this.c.state === 'suspended') this.c.resume(); return; }
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    try { this.c = new A(); } catch (e) { return; }
    const c = this.c;
    this.m = c.createGain(); this.m.gain.value = 0.9; this.m.connect(c.destination);
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    // rain: hiss + low drum on the roof
    const s1 = c.createBufferSource(); s1.buffer = b; s1.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    this.rainG = c.createGain(); this.rainG.gain.value = 0.06;
    s1.connect(hp); hp.connect(lp); lp.connect(this.rainG); this.rainG.connect(this.m); s1.start();
    const s2 = c.createBufferSource(); s2.buffer = b; s2.loop = true; s2.playbackRate.value = 0.5;
    const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 240;
    const g2 = c.createGain(); g2.gain.value = 0.17;
    s2.connect(lp2); lp2.connect(g2); g2.connect(this.m); s2.start();
    // drone that grows with the chapters
    this.droneG = c.createGain(); this.droneG.gain.value = 0; this.droneG.connect(this.m);
    [55, 55.6, 82.4, 110.9].forEach((f, i) => { const o = c.createOscillator(); o.type = i === 3 ? 'triangle' : 'sine'; o.frequency.value = f; const og = c.createGain(); og.gain.value = i === 3 ? 0.18 : 1; o.connect(og); og.connect(this.droneG); o.start(); });
  },
  now() { return this.c ? this.c.currentTime : 0; },
  env(node, peak, a, d, delay = 0) { const g = this.c.createGain(), t = this.now() + delay; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); node.connect(g); g.connect(this.m); return g; },
  nz(dur, rate = 1, delay = 0) { const s = this.c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate; s.start(this.now() + delay, Math.random() * 0.8, dur); return s; },
  thunder() { if (!this.c) return; const s = this.nz(5, 0.5); const f = this.c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 130 + Math.random() * 90; s.connect(f); this.env(f, 0.9, 0.18, 4); },
  step(dist = 0) { if (!this.c) return; const s = this.nz(0.09, 0.9 + Math.random() * 0.2, dist); const f = this.c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = dist ? 220 : 420; s.connect(f); this.env(f, dist ? 0.12 : 0.07, 0.006, 0.08, dist); },
  creak() { if (!this.c) return; const o = this.c.createOscillator(), t = this.now(); o.type = 'sawtooth'; const f0 = 60 + Math.random() * 45; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.7, t + 0.55); o.frequency.linearRampToValueAtTime(f0 * 1.25, t + 1.1); const bp = this.c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 7; o.connect(bp); this.env(bp, 0.08, 0.2, 0.9); o.start(t); o.stop(t + 1.3); },
  sting() { if (!this.c) return; const t = this.now(); [98, 103.8, 146.8, 207.6].forEach((f, i) => { const o = this.c.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; this.env(o, 0.045, 1.4, 3.4); o.start(t); o.stop(t + 5); }); },
  pick() { if (!this.c) return; const o = this.c.createOscillator(), t = this.now(); o.type = 'sine'; o.frequency.setValueAtTime(740, t); o.frequency.exponentialRampToValueAtTime(1480, t + 0.08); this.env(o, 0.035, 0.005, 0.6); o.start(t); o.stop(t + 0.7); },
  paper() { if (!this.c) return; const s = this.nz(0.35, 1.6); const f = this.c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.8; s.connect(f); this.env(f, 0.07, 0.03, 0.3); },
  whoosh() { if (!this.c) return; const s = this.nz(1.2, 1); const f = this.c.createBiquadFilter(), t = this.now(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(160, t + 0.9); s.connect(f); this.env(f, 0.25, 0.05, 0.9); },
  lock() { if (!this.c) return; [0, 0.12].forEach((d) => { const s = this.nz(0.05, 2, d); const f = this.c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800; s.connect(f); this.env(f, 0.18, 0.003, 0.05, d); }); },
  stepsAbove() { for (let i = 0; i < 4; i++) this.step(0.55 * i + 0.2); },
  drone(level) { if (this.c) this.droneG.gain.setTargetAtTime(level, this.now(), 3); },
  toggle() { this.on = !this.on; if (this.m) this.m.gain.setTargetAtTime(this.on ? 0.9 : 0, this.now(), 0.1); return this.on; },
};

/* ============================== MAP ============================== */
const MAPS = {
  ground: [
    '##########################',
    '#......#..........#......#',
    '#......#..........#......#',
    '#........................#',
    '#......#..........#......#',
    '#......#..........#......#',
    '#......#..........#......#',
    '############..############',
    '#......#..........#......#',
    '#......#..........#......#',
    '#......#..........#......#',
    '#......#..........#......#',
    '#........................#',
    '#......#..........#......#',
    '#......#..........#......#',
    '#......#..........#......#',
    '############FF############',
  ],
  upper: [
    '##########################',
    '#........#.......#.......#',
    '#........#.......#.......#',
    '#........#.......#.......#',
    '#........#.......#.......#',
    '#####.#######.#######L####',
    '#........................#',
    '#........................#',
    '##########################',
  ],
};
const ROOMS = {
  ground: [
    { n: "Grandfather's room", x: 1, y: 1, w: 6, h: 6, c: '#3a2a1c' },
    { n: 'Dining room', x: 8, y: 1, w: 10, h: 6, c: '#43301f' },
    { n: 'Kitchen', x: 19, y: 1, w: 6, h: 6, c: '#3b3328', tile: true },
    { n: 'Living room', x: 1, y: 8, w: 6, h: 8, c: '#3f2c1d' },
    { n: 'Entrance hall', x: 8, y: 8, w: 10, h: 8, c: '#3a2b1f' },
    { n: "Parents' room", x: 19, y: 8, w: 6, h: 8, c: '#3d2a1e' },
  ],
  upper: [
    { n: "Nisha's room", x: 1, y: 1, w: 8, h: 4, c: '#40301f' },
    { n: 'Storeroom', x: 10, y: 1, w: 7, h: 4, c: '#352819' },
    { n: 'The upstairs room', x: 18, y: 1, w: 7, h: 4, c: '#2f2318' },
    { n: 'Upstairs corridor', x: 1, y: 6, w: 24, h: 2, c: '#3a2a1c' },
  ],
};
const WINDOWS = {
  ground: [[3, 0], [11, 0], [14, 0], [21, 0], [0, 4], [25, 4], [0, 11], [25, 11], [4, 16], [22, 16]],
  upper: [[4, 0], [13, 0], [0, 2], [25, 2], [21, 0, 'bricked']],
};
function tileAt(f, x, y) { const r = MAPS[f][y]; return r ? (r[x] || '#') : '#'; }
function solidTile(f, x, y) { const t = tileAt(f, x, y); if (t === '#' || t === 'F') return true; if (t === 'L') return !S.upDoorOpen; return false; }
function roomAt(f, x, y) { return ROOMS[f].find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) || null; }

/* ============================== STATE ============================== */
const S = {
  started: false, ch: 0, floor: 'ground',
  p: { x: 12.95, y: 15.35, dir: -Math.PI / 2 }, walkT: 0,
  flags: {}, seen: {},
  hasLalteen: false, lalOnEntry: true, lalteenAt: { f: 'ground', x: 15.95, y: 14.45 },
  upDoorOpen: false, changes: false, dinnerSet: false, endingsOpen: false,
  figure: null, blackout: 0, lightning: 0, memory: 0,
  busy: false, path: null, pendingObj: null, pendingAdvance: false, ended: false,
  nextThunder: 9, nextCreak: 30, nextSteps: 40, stuckT: 0,
};
const REQ = {
  1: ['table', 'slippers', 'chairs', 'plates', 'news1', 'courtyard'],
  2: ['notebook', 'keyfits', 'photo7'],
  3: ['clippings', 'register'],
  4: ['walldraw', 'schoolbag'],
  5: ['diary', 'photo5'],
  6: ['statement', 'lalteenBack', 'hidden'],
};
const CHAPTERS = ['', 'The House', "Nisha's Room", 'The Newspaper', 'The Upstairs Room', 'The Family', 'The Sixth Member', 'Dinner'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function mark(f) { S.flags[f] = true; const r = REQ[S.ch]; if (r && r.every((k) => S.flags[k])) S.pendingAdvance = true; updateHUD(); }

function objective() {
  const f = S.flags;
  switch (S.ch) {
    case 1: return f.table ? 'Someone has been living here. Look around the ground floor.' : 'A light is burning on the table by the door.';
    case 2: if (!f.notebook) return "Nisha's room is upstairs."; if (!f.keyfits) return 'The brass key. The locked door upstairs.'; return 'The photograph in the living room.';
    case 3: return "Grandfather's cupboard has come open.";
    case 4: return S.upDoorOpen ? 'Look around the room.' : 'Open the upstairs room.';
    case 5: return "Something has come loose in your parents' room.";
    case 6: if (!f.lalteenBack) return 'The lalteen is burning somewhere upstairs.'; if (!f.statement) return "Grandfather's register."; return 'The cupboard in the upstairs room.';
    case 7: if (!f.dinner) return 'Downstairs, someone has set the table.'; if (S.endingsOpen) return 'Leave with the photograph. Return it to its frame. Or go upstairs.'; return '';
  }
  return '';
}

/* ============================== PHOTOGRAPHS ============================== */
const PH = {
  parcel: { scene: 'house', seed: 3, people: [{ k: 'old' }, { k: 'man' }, { k: 'woman' }, { k: 'boy', mark: 1 }, { k: 'boy', blur: 1 }, { k: 'girl' }] },
  frame7: { scene: 'house', seed: 3, people: [{ k: 'old' }, { k: 'man' }, { k: 'woman' }, { k: 'boy', mark: 1 }, { k: 'boy', blur: 1 }, { k: 'girl' }, { k: 'boy', dark: 1, x: 0.965 }] },
  courtyard: { scene: 'courtyard', seed: 5, shadows: 6 },
  street1: { scene: 'street', mono: 1, seed: 8 },
  street2: { scene: 'street', mono: 1, seed: 9, bricked: 1 },
  five: { scene: 'house', seed: 12, people: [{ k: 'man', x: 0.2 }, { k: 'woman', x: 0.38 }, { k: 'boy', mark: 1, x: 0.6, back: 1, sc: 0.92 }, { k: 'boy', mark: 1, x: 0.5 }, { k: 'girl', x: 0.72 }] },
  hidden: { scene: 'table', seed: 21, seats: [{ k: 'old' }, { k: 'man' }, { k: 'woman' }, { k: 'girl' }, { k: 'boy', blur: 0.6 }, { k: 'boy', mark: 1, look: 1 }, { empty: 1 }] },
  dinner: { scene: 'table', seed: 22, seats: [{ k: 'old' }, { k: 'man' }, { k: 'woman' }, { k: 'girl' }, { empty: 1 }, { empty: 1 }, { k: 'boy', mark: 1, behind: { k: 'adult' } }] },
  end1: { scene: 'table', seed: 23, seats: [{ k: 'old' }, { k: 'man' }, { k: 'woman' }, { k: 'girl' }, { empty: 1 }, { empty: 1 }, { k: 'boy', mark: 1 }] },
  end3: { scene: 'house', seed: 24, people: [{ k: 'old' }, { k: 'man' }, { k: 'woman' }, { k: 'boy', mark: 1 }, { k: 'boy' }, { k: 'girl' }, { k: 'adult' }] },
};

function palette(mono) {
  return mono
    ? { bg: '#d6d4cd', a: '#a19f99', b: '#6c6a66', ink: '#232220', skin: '#8e8b85', hi: '#c8c6bf', cloth: '#3b3a37' }
    : { bg: '#efe4cb', a: '#bba07a', b: '#7a5f41', ink: '#2c1f13', skin: '#a3845c', hi: '#d6bf96', cloth: '#4a3622' };
}

const SIZE = { old: 0.96, man: 1.04, woman: 0.95, adult: 1.02, boy: 0.6, girl: 0.56 };
function drawFace(g, x, hy, r, p, P) {
  if (p.dark) return;
  const lx = (p.look || 0) * r * 0.38;
  g.fillStyle = P.ink;
  g.beginPath(); g.arc(x - r * 0.34 + lx, hy + r * 0.05, r * 0.11, 0, 7); g.arc(x + r * 0.34 + lx, hy + r * 0.05, r * 0.11, 0, 7); g.fill();
  g.globalAlpha *= 0.6; g.fillRect(x - r * 0.22 + lx * 0.6, hy + r * 0.48, r * 0.44, r * 0.07); g.globalAlpha /= 0.6;
}
function drawHead(g, x, hy, r, p, P) {
  g.fillStyle = p.dark ? 'rgba(12,8,4,.94)' : P.skin;
  g.beginPath(); g.ellipse(x, hy, r * 0.9, r, 0, 0, 7); g.fill();
  if (p.dark) return;
  g.fillStyle = p.k === 'old' ? P.hi : P.ink;
  g.beginPath(); g.ellipse(x, hy - r * 0.35, r * 0.95, r * 0.7, 0, Math.PI, 0); g.fill();
  if (p.k === 'woman') { g.beginPath(); g.arc(x, hy - r * 1.05, r * 0.4, 0, 7); g.fill(); }
  if (p.k === 'girl') { g.beginPath(); g.arc(x - r * 0.95, hy + r * 0.1, r * 0.3, 0, 7); g.arc(x + r * 0.95, hy + r * 0.1, r * 0.3, 0, 7); g.fill(); }
  if (p.mark) { g.beginPath(); g.moveTo(x + r * 0.1, hy - r * 0.95); g.lineTo(x + r * 0.45, hy - r * 1.45); g.lineTo(x + r * 0.5, hy - r * 0.85); g.fill(); }
  drawFace(g, x, hy, r, p, P);
}
function personStyle(g, p) {
  g.save();
  if (p.faded) g.globalAlpha = 0.45;
  if (p.blur && 'filter' in g) g.filter = `blur(${2.6 * p.blur}px)`;
}
function drawStanding(g, x, base, s, p, P) {
  personStyle(g, p);
  const H = s * (SIZE[p.k] || 1) * (p.sc || 1), child = p.k === 'boy' || p.k === 'girl';
  const r = H * (child ? 0.12 : 0.085), tw = H * (child ? 0.3 : 0.25);
  const hx = x + (p.k === 'old' ? r * 0.25 : 0), hy = base - H + r;
  const sh = base - H + r * 2.1, hip = base - H * 0.44;
  const cloth = p.dark ? 'rgba(12,8,4,.94)' : (p.k === 'adult' ? '#1d1712' : P.cloth);
  g.fillStyle = cloth;
  if (p.k === 'woman' && !p.dark) {
    g.beginPath(); g.moveTo(x - tw * 0.45, sh); g.lineTo(x + tw * 0.45, sh); g.lineTo(x + tw * 0.75, base); g.lineTo(x - tw * 0.75, base); g.fill();
    g.fillStyle = P.a; g.beginPath(); g.moveTo(x + tw * 0.45, sh); g.lineTo(x - tw * 0.2, hip); g.lineTo(x - tw * 0.05, hip + 4); g.lineTo(x + tw * 0.5, sh + 5); g.fill();
  } else {
    rr(g, x - tw / 2, sh, tw, hip - sh + 2, tw * 0.25); g.fill();
    g.fillStyle = p.dark ? cloth : P.ink;
    g.fillRect(x - tw * 0.42, hip, tw * 0.34, base - hip); g.fillRect(x + tw * 0.08, hip, tw * 0.34, base - hip);
    if (p.k === 'old' && !p.dark) { g.fillStyle = P.hi; g.fillRect(x - tw / 2, sh, tw, tw * 0.25); g.strokeStyle = P.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(x + tw * 0.7, sh + tw); g.lineTo(x + tw * 0.75, base); g.stroke(); }
  }
  drawHead(g, hx, hy, r, p, P);
  g.restore();
}
function drawSeated(g, x, ty, s, p, P) {
  const cw = s * 0.32;
  g.fillStyle = 'rgba(30,20,10,.5)'; rr(g, x - cw / 2, ty - s * 0.4, cw, s * 0.4, 4); g.fill();
  g.fillStyle = 'rgba(30,20,10,.3)'; g.fillRect(x - cw / 2 + 4, ty - s * 0.36, cw - 8, 3);
  if (p.behind) drawStanding(g, x, ty + s * 0.42, s * 1.0, p.behind, P);
  if (p.empty) return;
  personStyle(g, p);
  const f = (SIZE[p.k] || 1), child = p.k === 'boy' || p.k === 'girl', sz = s * (child ? 0.78 : 1) * Math.min(1, f + 0.05);
  const r = sz * (child ? 0.12 : 0.1), tw = sz * 0.3, sh = ty - sz * 0.42;
  g.fillStyle = p.dark ? 'rgba(12,8,4,.94)' : (p.k === 'woman' ? P.a : P.cloth);
  rr(g, x - tw / 2, sh, tw, ty - sh + 4, tw * 0.3); g.fill();
  if (p.k === 'old' && !p.dark) { g.fillStyle = P.hi; g.fillRect(x - tw / 2, sh, tw, tw * 0.22); }
  drawHead(g, x + (p.look ? r * 0.15 : 0), sh - r * 0.95, r, p, P);
  g.restore();
}
function drawShadowOf(g, x, base, H, w, alpha) {
  g.save(); g.fillStyle = `rgba(25,14,4,${alpha})`;
  g.beginPath(); g.moveTo(x - w / 2, base); g.lineTo(x + w / 2, base);
  g.lineTo(x + w / 2 + H * 0.85, base + H * 0.2); g.lineTo(x - w / 2 + H * 0.8, base + H * 0.22); g.fill();
  g.beginPath(); g.ellipse(x + H * 0.93, base + H * 0.21, w * 0.35, w * 0.16, 0.25, 0, 7); g.fill();
  g.restore();
}
function carvedWindow(g, x, y, w, h, P, mode) {
  g.fillStyle = P.ink; g.fillRect(x - w * 0.12, y - h * 0.1, w * 1.24, h * 1.2);
  if (mode === 'bricked') {
    g.fillStyle = P.a; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(40,25,10,.55)'; g.lineWidth = 1;
    for (let r = 0, yy = y; yy < y + h; r++, yy += h / 6) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); for (let xx = x + (r % 2 ? w / 6 : 0); xx < x + w; xx += w / 3) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + h / 6); g.stroke(); } }
    return;
  }
  g.fillStyle = mode === 'open' ? '#050302' : P.b; g.fillRect(x, y, w, h);
  if (mode !== 'open') {
    g.strokeStyle = P.hi; g.globalAlpha = 0.45; g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + (w * i) / 4, y); g.lineTo(x + (w * i) / 4, y + h); g.stroke(); }
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x, y + (h * i) / 5); g.lineTo(x + w, y + (h * i) / 5); g.stroke(); }
    g.globalAlpha = 1;
  }
}
function drawPhoto(g, w, h, sp) {
  const R = rng(sp.seed || 11), P = palette(sp.mono);
  g.fillStyle = sp.mono ? '#e4e2db' : '#efe6d2'; g.fillRect(0, 0, w, h);
  const m = Math.round(Math.min(w, h) * 0.05), iw = w - 2 * m, ih = h - 2 * m;
  g.save(); g.translate(m, m); g.beginPath(); g.rect(0, 0, iw, ih); g.clip();
  const s = ih * 0.66;
  if (sp.scene === 'house') {
    const wall = g.createLinearGradient(0, 0, 0, ih); wall.addColorStop(0, P.b); wall.addColorStop(1, P.a); g.fillStyle = wall; g.fillRect(0, 0, iw, ih);
    g.strokeStyle = 'rgba(40,25,10,.12)'; g.lineWidth = 1;
    for (let y = 4; y < ih * 0.8; y += 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(iw, y); g.stroke(); }
    [0.17, 0.5, 0.83].forEach((fx) => carvedWindow(g, iw * fx - iw * 0.065, ih * 0.06, iw * 0.13, ih * 0.17, P, 'lattice'));
    g.fillStyle = P.ink; g.fillRect(iw * 0.43, ih * 0.36, iw * 0.14, ih * 0.5);
    g.fillStyle = P.hi; g.fillRect(0, ih * 0.82, iw, ih * 0.18);
    const ppl = sp.people, n = ppl.length, base = ih * 0.93;
    const pos = ppl.map((p, i) => (p.x != null ? p.x : (i + 1) / (n + 1)) * iw);
    ppl.forEach((p, i) => { if (!p.back) drawShadowOf(g, pos[i], base, s * (SIZE[p.k] || 1) * 0.5, s * 0.15, 0.18); });
    ppl.forEach((p, i) => { if (p.back) drawStanding(g, pos[i], base - ih * 0.07, s, p, P); });
    ppl.forEach((p, i) => { if (!p.back) drawStanding(g, pos[i], base, s, p, P); });
  } else if (sp.scene === 'courtyard') {
    g.fillStyle = P.b; g.fillRect(0, 0, iw, ih * 0.45);
    carvedWindow(g, iw * 0.15, ih * 0.06, iw * 0.12, ih * 0.22, P, 'lattice');
    g.fillStyle = P.ink; g.fillRect(iw * 0.7, ih * 0.08, iw * 0.13, ih * 0.37);
    const gr = g.createLinearGradient(0, ih * 0.45, 0, ih); gr.addColorStop(0, P.a); gr.addColorStop(1, P.hi); g.fillStyle = gr; g.fillRect(0, ih * 0.45, iw, ih * 0.55);
    g.strokeStyle = 'rgba(40,25,10,.18)';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(0, ih * 0.45 + i * i * 4); g.lineTo(iw, ih * 0.45 + i * i * 4); g.stroke(); }
    const cx = iw * 0.4, base = ih * 0.72;
    const sx = [0, 0.8, 1.6, 2.4, 3.2, 4.0];
    for (let i = 0; i < (sp.shadows || 1); i++) {
      const bx = cx - iw * 0.27 + sx[i] * iw * 0.11;
      drawShadowOf(g, bx, base + 4 + i * 2, s * 0.55, s * 0.12, 0.26);
    }
    g.fillStyle = P.ink; g.fillRect(cx - s * 0.16, base - s * 0.5, s * 0.32, s * 0.08); g.fillRect(cx - s * 0.16, base - s * 0.5, s * 0.04, s * 0.5); g.fillRect(cx + s * 0.12, base - s * 0.45, s * 0.04, s * 0.45);
    g.fillRect(cx - s * 0.18, base - s * 0.86, s * 0.05, s * 0.4);
    drawSeated(g, cx, base - s * 0.42, s * 0.82, { k: 'old' }, P);
    g.fillStyle = P.ink; g.fillRect(cx - s * 0.06, base - s * 0.42, s * 0.05, s * 0.42); g.fillRect(cx + s * 0.03, base - s * 0.42, s * 0.05, s * 0.42);
  } else if (sp.scene === 'table') {
    const wall = g.createLinearGradient(0, 0, 0, ih); wall.addColorStop(0, P.b); wall.addColorStop(1, P.ink); g.fillStyle = wall; g.fillRect(0, 0, iw, ih);
    g.fillStyle = P.ink; g.fillRect(iw * 0.4, ih * 0.06, iw * 0.2, ih * 0.15); g.fillStyle = P.a; g.fillRect(iw * 0.41, ih * 0.075, iw * 0.18, ih * 0.12);
    const ty = ih * 0.64, seats = sp.seats, n = seats.length;
    seats.forEach((p, i) => drawSeated(g, iw * (0.08 + (0.84 * (i + 0.5)) / n), ty, s * 0.78, p, P));
    g.fillStyle = P.a; g.fillRect(-4, ty, iw + 8, ih * 0.08);
    g.fillStyle = P.b; g.fillRect(-4, ty + ih * 0.08, iw + 8, ih * 0.06);
    g.fillStyle = P.ink; g.fillRect(iw * 0.05, ty + ih * 0.14, iw * 0.03, ih); g.fillRect(iw * 0.92, ty + ih * 0.14, iw * 0.03, ih);
    seats.forEach((p, i) => { const x = iw * (0.08 + (0.84 * (i + 0.5)) / n); g.fillStyle = P.hi; g.beginPath(); g.ellipse(x, ty + ih * 0.035, iw * 0.04, ih * 0.016, 0, 0, 7); g.fill(); });
  } else if (sp.scene === 'street') {
    g.fillStyle = P.hi; g.fillRect(0, 0, iw, ih);
    g.fillStyle = P.a; g.fillRect(0, ih * 0.3, iw * 0.2, ih); g.fillRect(iw * 0.8, ih * 0.22, iw * 0.2, ih);
    const hx = iw * 0.23, hw = iw * 0.54, top = ih * 0.2;
    g.fillStyle = P.b; g.fillRect(hx, top, hw, ih);
    g.fillStyle = P.ink; g.beginPath(); g.moveTo(hx - hw * 0.1, top + 4); g.lineTo(hx + hw * 0.08, top - ih * 0.1); g.lineTo(hx + hw * 0.92, top - ih * 0.1); g.lineTo(hx + hw * 1.1, top + 4); g.fill();
    for (let fl = 0; fl < 2; fl++) {
      [0.18, 0.5, 0.82].forEach((fx) => carvedWindow(g, hx + hw * fx - hw * 0.08, top + ih * (0.07 + fl * 0.24), hw * 0.16, ih * 0.15, P, fl === 0 && fx === 0.5 && sp.bricked ? 'bricked' : 'lattice'));
    }
    g.fillStyle = P.ink; g.fillRect(hx + hw * 0.4, top + ih * 0.53, hw * 0.2, ih);
    g.fillStyle = P.a; g.fillRect(0, ih * 0.88, iw, ih * 0.12);
    // halftone
    g.fillStyle = 'rgba(0,0,0,.09)';
    for (let y = 0; y < ih; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < iw; x += 4) { g.fillRect(x, y, 1.3, 1.3); }
  }
  // grain, scratches, vignette
  for (let i = 0; i < 2600; i++) { g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${R() * 0.18})` : `rgba(255,248,230,${R() * 0.18})`; g.fillRect(R() * iw, R() * ih, 1.2, 1.2); }
  g.strokeStyle = 'rgba(255,250,235,.35)'; g.lineWidth = 0.7;
  for (let i = 0; i < 5; i++) { const x = R() * iw; g.beginPath(); g.moveTo(x, R() * ih * 0.3); g.lineTo(x + (R() - 0.5) * 30, ih * (0.5 + R() * 0.5)); g.stroke(); }
  const v = g.createRadialGradient(iw / 2, ih / 2, Math.min(iw, ih) * 0.3, iw / 2, ih / 2, Math.max(iw, ih) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, sp.mono ? 'rgba(20,20,20,.45)' : 'rgba(45,25,8,.6)');
  g.fillStyle = v; g.fillRect(0, 0, iw, ih);
  g.restore();
  if (!sp.mono) { const y = g.createLinearGradient(0, 0, w, h); y.addColorStop(0, 'rgba(150,110,40,.0)'); y.addColorStop(1, 'rgba(150,110,40,.18)'); g.fillStyle = y; g.fillRect(0, 0, w, h); }
}

/* ---------- children's crayon drawings ---------- */
function wob(g, pts, R, col, lw, close) {
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    g.beginPath();
    pts.forEach((p, i) => { const x = p[0] + (R() - 0.5) * 2.4, y = p[1] + (R() - 0.5) * 2.4; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    if (close) g.closePath(); g.stroke();
  }
}
function circlePts(x, y, r, n = 14) { const a = []; for (let i = 0; i <= n; i++) a.push([x + Math.cos((i / n) * 6.283) * r, y + Math.sin((i / n) * 6.283) * r]); return a; }
function scribble(g, x, y, w, h, R, col, n = 60) { g.strokeStyle = col; g.lineWidth = 2.2; g.beginPath(); let px = x + R() * w, py = y + R() * h; g.moveTo(px, py); for (let i = 0; i < n; i++) { px = x + R() * w; py = y + R() * h; g.lineTo(px, py); } g.stroke(); }
function stick(g, x, base, hgt, R, col, dark) {
  const r = hgt * 0.17, hy = base - hgt + r;
  if (dark) { scribble(g, x - r * 1.2, base - hgt, r * 2.4, hgt, R, '#111', 90); return; }
  wob(g, circlePts(x, hy, r), R, col, 2.2);
  wob(g, [[x, hy + r], [x, base - hgt * 0.35]], R, col, 2.2);
  wob(g, [[x - r * 1.3, hy + r * 1.8], [x, hy + r * 1.3], [x + r * 1.3, hy + r * 1.8]], R, col, 2.2);
  wob(g, [[x - r * 0.9, base], [x, base - hgt * 0.35], [x + r * 0.9, base]], R, col, 2.2);
  g.fillStyle = col; g.fillRect(x - r * 0.4, hy - 1, 2, 2); g.fillRect(x + r * 0.3, hy - 1, 2, 2);
}
function crayonHouse(g, x, y, w, h, R) {
  wob(g, [[x, y + h * 0.35], [x + w, y + h * 0.35], [x + w, y + h], [x, y + h]], R, '#8a3b26', 2.6, true);
  wob(g, [[x - w * 0.08, y + h * 0.37], [x + w / 2, y], [x + w * 1.08, y + h * 0.37]], R, '#6b2d1d', 2.6);
  wob(g, [[x + w * 0.42, y + h], [x + w * 0.42, y + h * 0.7], [x + w * 0.58, y + h * 0.7], [x + w * 0.58, y + h]], R, '#3b2a1b', 2.2);
  wob(g, [[x + w * 0.4, y + h * 0.42], [x + w * 0.6, y + h * 0.42], [x + w * 0.6, y + h * 0.58], [x + w * 0.4, y + h * 0.58]], R, '#3b2a1b', 2.2, true);
}
const CRAYON = ['#c23b2b', '#2c58a8', '#3a8a46', '#d98a1f', '#7b3fa0', '#a3567a'];
function drawCrayon(g, w, h, type, seed) {
  const R = rng(seed);
  g.fillStyle = '#f2ead6'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(150,120,70,.08)'; for (let i = 0; i < 400; i++) g.fillRect(R() * w, R() * h, 2, 2);
  if (type === 'family6' || type === 'dinner6') {
    const ty = h * 0.58;
    const figs = type === 'family6' ? 6 : 5;
    for (let i = 0; i < figs; i++) { const x = w * (0.17 + (0.66 * i) / (figs - 1)); stick(g, x, ty + 6, h * (i < 2 ? 0.4 : 0.3), R, CRAYON[i], type === 'family6' && i === 4); }
    wob(g, [[w * 0.1, ty], [w * 0.9, ty], [w * 0.9, ty + h * 0.08], [w * 0.1, ty + h * 0.08]], R, '#7a4a22', 3, true);
    wob(g, [[w * 0.14, ty + h * 0.08], [w * 0.14, h * 0.88]], R, '#7a4a22', 3); wob(g, [[w * 0.86, ty + h * 0.08], [w * 0.86, h * 0.88]], R, '#7a4a22', 3);
    if (type === 'dinner6') {
      for (let i = 0; i < 5; i++) wob(g, circlePts(w * (0.2 + i * 0.15), ty - 2, w * 0.035, 10).map(([a, b]) => [a, ty - 2 + (b - ty + 2) * 0.35]), R, '#555', 2);
      wob(g, circlePts(w * 0.94, h * 0.9, w * 0.035, 10).map(([a, b]) => [a, h * 0.9 + (b - h * 0.9) * 0.35]), R, '#555', 2);
      wob(g, [[w * 0.03, h * 0.93], [w * 0.98, h * 0.93]], R, '#9a7a50', 1.6);
    }
  } else {
    crayonHouse(g, w * 0.25, h * 0.08, w * 0.5, h * 0.62, R);
    const people = type === 'house6' ? 6 : 5;
    const shadows = type === 'house5s6' ? 6 : 0;
    for (let i = 0; i < shadows; i++) { scribble(g, w * (0.28 + i * 0.075), h * 0.34, w * 0.04, h * 0.2, R, 'rgba(70,70,80,.55)', 26); }
    for (let i = 0; i < people; i++) stick(g, w * (0.12 + (0.76 * i) / (people - 1)), h * 0.95, h * (i < 2 ? 0.3 : 0.22), R, CRAYON[i % 6]);
    wob(g, [[w * 0.03, h * 0.95], [w * 0.97, h * 0.95]], R, '#3a8a46', 2);
  }
}

/* ---------- objects drawn for documents ---------- */
function drawKey(g, w, h) {
  const bg = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6); bg.addColorStop(0, '#2b2219'); bg.addColorStop(1, '#0d0a07'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.save(); g.translate(w / 2, h / 2); g.rotate(-0.25);
  const brass = g.createLinearGradient(0, -20, 0, 20); brass.addColorStop(0, '#f0c771'); brass.addColorStop(0.5, '#a67a2c'); brass.addColorStop(1, '#5e4116');
  g.fillStyle = brass; g.strokeStyle = '#3d2a0e'; g.lineWidth = 2;
  g.beginPath(); g.arc(-w * 0.22, 0, h * 0.2, 0, 7); g.arc(-w * 0.22, 0, h * 0.09, 0, 7, true); g.fill('evenodd'); g.stroke();
  g.fillRect(-w * 0.13, -h * 0.035, w * 0.42, h * 0.07); g.strokeRect(-w * 0.13, -h * 0.035, w * 0.42, h * 0.07);
  g.fillRect(w * 0.2, h * 0.035, w * 0.03, h * 0.1); g.fillRect(w * 0.25, h * 0.035, w * 0.03, h * 0.07);
  g.restore();
}
function drawTableTop(g, w, h, t, dim) {
  g.fillStyle = '#030202'; g.fillRect(0, 0, w, h);
  const tw = Math.min(w * 0.7, h * 0.95), th = tw * 0.55, x = (w - tw) / 2, y = (h - th) / 2 - h * 0.06;
  const seats = [[0.25, -1], [0.5, -1], [0.75, -1], [0.25, 1], [0.5, 1], [0.75, 1]];
  seats.forEach(([fx, side]) => { g.fillStyle = '#1e140c'; rr(g, x + tw * fx - tw * 0.06, side < 0 ? y - th * 0.24 : y + th + th * 0.04, tw * 0.12, th * 0.2, 6); g.fill(); });
  const wood = g.createLinearGradient(x, y, x + tw, y + th); wood.addColorStop(0, '#3b2414'); wood.addColorStop(0.5, '#5a3820'); wood.addColorStop(1, '#2c1a0e');
  g.fillStyle = wood; rr(g, x, y, tw, th, 10); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.25)'; for (let i = 1; i < 9; i++) { g.beginPath(); g.moveTo(x, y + (th * i) / 9); g.lineTo(x + tw, y + (th * i) / 9 + 2); g.stroke(); }
  seats.forEach(([fx, side], i) => {
    const px = x + tw * fx, py = side < 0 ? y + th * 0.2 : y + th * 0.8;
    g.save(); g.globalAlpha = 0.16 + 0.05 * Math.sin(t * 0.7 + i);
    g.fillStyle = '#000'; g.beginPath(); g.ellipse(px, py - side * th * 0.12, tw * 0.035, th * 0.07, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(px, py - side * th * 0.25, tw * 0.06, th * 0.07, 0, 0, 7); g.fill(); g.restore();
    g.fillStyle = '#d9d2c3'; g.beginPath(); g.ellipse(px, py, tw * 0.05, tw * 0.05, 0, 0, 7); g.fill();
    g.fillStyle = '#b8b0a0'; g.beginPath(); g.ellipse(px, py, tw * 0.03, tw * 0.03, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(200,220,230,.35)'; g.beginPath(); g.arc(px + tw * 0.07, py - side * th * 0.05, tw * 0.015, 0, 7); g.fill();
  });
  const lx = w / 2, ly = y + th / 2, fl = 1 + Math.sin(t * 9) * 0.04;
  const glow = g.createRadialGradient(lx, ly, 2, lx, ly, tw * 0.6 * fl); glow.addColorStop(0, 'rgba(255,170,80,.45)'); glow.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffcf80'; g.beginPath(); g.arc(lx, ly, tw * 0.018, 0, 7); g.fill();
  if (dim) { g.fillStyle = `rgba(0,0,0,${dim})`; g.fillRect(0, 0, w, h); }
}
const RAIN = Array.from({ length: 240 }, () => [Math.random(), Math.random(), 0.6 + Math.random() * 0.8]);
function drawHouseExt(g, w, h, t, o = {}) {
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#05070b'); sky.addColorStop(1, '#12151c'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const flash = o.flash || 0;
  if (flash) { g.fillStyle = `rgba(170,185,220,${flash * 0.35})`; g.fillRect(0, 0, w, h); }
  g.fillStyle = '#0a0b0e'; g.fillRect(0, h * 0.42, w * 0.2, h); g.fillRect(w * 0.82, h * 0.36, w * 0.18, h);
  g.fillRect(w * 0.12, h * 0.52, w * 0.2, h);
  const hw = Math.min(w * 0.5, h * 0.62), hx = (w - hw) / 2, top = h * 0.18, ground = h * 0.93;
  const brick = g.createLinearGradient(0, top, 0, ground); brick.addColorStop(0, '#2a140f'); brick.addColorStop(1, '#1a0c09'); g.fillStyle = brick; g.fillRect(hx, top, hw, ground - top);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
  for (let y = top; y < ground; y += 6) { g.beginPath(); g.moveTo(hx, y); g.lineTo(hx + hw, y); g.stroke(); }
  // tiered roof
  g.fillStyle = '#07060a';
  g.beginPath(); g.moveTo(hx - hw * 0.14, top + h * 0.03); g.lineTo(hx + hw * 0.1, top - h * 0.09); g.lineTo(hx + hw * 0.9, top - h * 0.09); g.lineTo(hx + hw * 1.14, top + h * 0.03); g.fill();
  [0.36, 0.6].forEach((fy) => { g.fillStyle = '#0d0907'; g.fillRect(hx - 6, h * fy, hw + 12, h * 0.012); });
  const winW = hw * 0.16, winH = h * 0.1;
  const W2 = (x, y, mode, open) => {
    g.fillStyle = '#120b07'; g.fillRect(x - winW * 0.14, y - winH * 0.14, winW * 1.28, winH * 1.28);
    g.fillStyle = '#2d1c11'; g.fillRect(x - winW * 0.2, y - winH * 0.3, winW * 1.4, winH * 0.14);
    if (mode === 'glow') { const gl = g.createRadialGradient(x + winW / 2, y + winH / 2, 2, x + winW / 2, y + winH / 2, winW); gl.addColorStop(0, '#f2a24a'); gl.addColorStop(1, '#5a2a0e'); g.fillStyle = gl; } else g.fillStyle = '#050304';
    g.fillRect(x, y, winW, winH);
    if (open != null) {
      const ow = winW / 2 * (1 - open * 0.85);
      g.fillStyle = '#21140c'; g.fillRect(x, y, ow, winH); g.fillRect(x + winW - winW / 2, y, winW / 2, winH);
      g.fillStyle = '#21140c'; g.fillRect(x + winW - winW / 2, y, winW / 2, winH);
    } else if (mode !== 'glow') { g.strokeStyle = '#3a2516'; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + (winW * i) / 4, y); g.lineTo(x + (winW * i) / 4, y + winH); g.stroke(); } }
    else { g.strokeStyle = 'rgba(40,20,10,.8)'; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + (winW * i) / 4, y); g.lineTo(x + (winW * i) / 4, y + winH); g.stroke(); } }
  };
  [0.14, 0.42, 0.7].forEach((fx, i) => W2(hx + hw * fx, top + h * 0.06, 'dark', i === 1 && o.winOpen != null ? o.winOpen : null));
  [0.14, 0.42, 0.7].forEach((fx) => W2(hx + hw * fx, h * 0.42, 'dark'));
  W2(hx + hw * 0.14, h * 0.67, o.glow ? 'glow' : 'dark');
  g.fillStyle = '#060404'; g.fillRect(hx + hw * 0.45, h * 0.66, hw * 0.13, ground - h * 0.66);
  g.fillStyle = '#2d1c11'; g.fillRect(hx + hw * 0.43, h * 0.65, hw * 0.17, h * 0.015);
  g.fillStyle = '#08080b'; g.fillRect(0, ground, w, h - ground);
  g.fillStyle = 'rgba(140,150,170,.06)'; g.fillRect(0, ground, w, 2);
  g.strokeStyle = 'rgba(170,180,200,.22)'; g.lineWidth = 1;
  g.beginPath();
  for (const [rx, ry, sp] of RAIN) { const x = ((rx * w) + t * 40 * sp) % w, y = ((ry * h) + t * 620 * sp) % h; g.moveTo(x, y); g.lineTo(x - 3, y + 14 * sp); }
  g.stroke();
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas'), r = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(w * r); c.height = Math.round(h * r);
  const g = c.getContext('2d'); g.scale(r, r); return [c, g];
}
function photoCanvas(spec, w = 480, h = 330) { const [c, g] = makeCanvas(w, h); drawPhoto(g, w, h, spec); return c; }
function crayonCanvas(type, seed, w = 420, h = 300) { const [c, g] = makeCanvas(w, h); drawCrayon(g, w, h, type, seed); c.style.boxShadow = '0 8px 30px rgba(0,0,0,.6)'; return c; }

/* ============================== DOCUMENT VIEWER ============================== */
const docEl = $('#doc'), sheet = docEl.querySelector('.sheet'), noteEl = docEl.querySelector('.note'), nextBtn = docEl.querySelector('.next');
let docQ = [], docDone = null;
function buildDoc(d) {
  const s = el('div', 'd ' + d.t);
  if (d.t === 'card') s.innerHTML = d.text.map((p) => `<p>${p}</p>`).join('');
  else if (d.t === 'photo') {
    s.appendChild(photoCanvas(d.spec));
    if (d.back) { const b = el('div', 'back'); b.innerHTML = `<span class="lbl">On the back</span><span class="hw">${d.back}</span>`; s.appendChild(b); }
  } else if (d.t === 'object') { const [c, g] = makeCanvas(480, 260); d.draw(g, 480, 260); s.appendChild(c); }
  else if (d.t === 'news') {
    s.innerHTML = `<div class="mast"><span>Kathmandu</span><span>${d.date || '■■ ■■■■■■ 19■■'}</span></div><h2>${d.head}</h2>`;
    if (d.photo) { const fig = el('figure'); fig.appendChild(photoCanvas(d.photo, 460, 300)); if (d.cap) fig.appendChild(el('figcaption', '', d.cap)); s.appendChild(fig); }
    s.appendChild(el('p', '', d.body));
  } else if (d.t === 'hand') {
    s.className += ' paper' + (d.child ? ' child' : '') + (d.plain ? ' plain' : '');
    s.innerHTML = (d.title ? `<div class="ttl">${d.title}</div>` : '') + `<div class="hw">${d.lines.map((l) => `<p>${l}</p>`).join('')}</div>`;
  } else if (d.t === 'draw') {
    const grid = el('div', 'grid');
    d.items.forEach(([type, cap], i) => { const box = el('div'); box.appendChild(crayonCanvas(type, 40 + i * 7 + (d.seed || 0))); if (cap) box.appendChild(el('div', 'cap', cap)); grid.appendChild(box); });
    s.appendChild(grid);
  } else if (d.t === 'register') {
    s.className += ' paper plain register';
    const names = [['Bhim', 'hw'], ['Hari', 'hw'], ['Sarita', 'hw'], ['Ankit', 'hw'], null, ['Nisha', 'hw']];
    s.innerHTML = `<div class="ttl">परिवार लगत · Family register</div>`;
    const ol = el('ol');
    names.forEach((n, i) => {
      const li = el('li'); li.appendChild(el('span', 'no', String(i + 1) + '.'));
      if (n) li.appendChild(el('span', 'hw', n[0]));
      else { const sc = el('span', 'scratch'); const [c, g] = makeCanvas(170, 42); const R = rng(77); g.strokeStyle = '#1b1712'; g.lineWidth = 2.4; g.beginPath(); for (let k = 0; k < 70; k++) { g.lineTo(6 + R() * 158, 6 + R() * 30); } g.stroke(); g.fillStyle = '#efe6cf'; g.beginPath(); g.moveTo(60, 20); g.lineTo(96, 16); g.lineTo(90, 26); g.fill(); sc.appendChild(c); li.appendChild(sc); li.appendChild(el('span', 'tear', '(torn)')); }
      ol.appendChild(li);
    });
    s.appendChild(ol);
    if (d.extra) s.appendChild(el('div', 'hw', `<p style="margin-top:16px;font-size:24px">${d.extra}</p>`));
  } else if (d.t === 'diary') {
    s.className += ' paper diary';
    s.innerHTML = `<div class="ttl">${d.title}</div>` + d.entries.map((e) => `<div class="entry${e.stain ? ' stain' : ''}"><div class="date">${e.d}</div><div class="hw">${e.x}</div></div>`).join('');
  }
  return s;
}
function openDocs(list, done) {
  docQ = list.slice(); docDone = done || null; S.busy = true; S.path = null;
  AU.paper(); showNextDoc();
}
function showNextDoc() {
  const d = docQ.shift();
  if (!d) { docEl.classList.remove('on'); S.busy = false; const f = docDone; docDone = null; if (f) f(); return; }
  sheet.innerHTML = ''; sheet.appendChild(buildDoc(d)); sheet.scrollTop = 0;
  noteEl.textContent = d.note || '';
  nextBtn.textContent = docQ.length ? 'Continue' : 'Close';
  docEl.classList.remove('on'); void docEl.offsetWidth; docEl.classList.add('on');
  if (d.sting) AU.sting();
  if (d.onShow) d.onShow();
  nextBtn.focus({ preventScroll: true });
}
nextBtn.addEventListener('click', () => { AU.paper(); showNextDoc(); });

const choiceEl = $('#choice');
function openChoice(q, opts) {
  S.busy = true; S.path = null;
  choiceEl.querySelector('.q').textContent = q;
  const box = choiceEl.querySelector('.opts'); box.innerHTML = '';
  opts.forEach(([label, fn]) => { const b = el('button', 'btn', label); b.onclick = () => { choiceEl.classList.remove('on'); S.busy = false; fn && fn(); }; box.appendChild(b); });
  choiceEl.classList.add('on');
  box.lastChild.focus({ preventScroll: true });
}

/* ============================== NARRATION ============================== */
const toastEl = $('#toast'); const toastQ = []; let toastT = 0, toastGap = 0;
function say(...lines) { toastQ.push(...lines); }
function updateToast(dt) {
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) { toastEl.classList.remove('on'); toastGap = 0.45; } return; }
  if (toastGap > 0) { toastGap -= dt; return; }
  if (toastQ.length && !S.busy) { const l = toastQ.shift(); toastEl.textContent = l; toastEl.classList.add('on'); toastT = 2.3 + l.length * 0.045; }
}
function toastIdle() { return !toastQ.length && toastT <= 0 && toastGap <= 0; }

const cardEl = $('#card');
function showCard(n) {
  cardEl.querySelector('.n').textContent = 'Chapter ' + ROMAN[n];
  cardEl.querySelector('.t').textContent = CHAPTERS[n];
  cardEl.classList.add('on'); AU.creak();
  setTimeout(() => cardEl.classList.remove('on'), 3400);
}
function updateHUD() {
  $('#chap').textContent = S.ch ? `${ROMAN[S.ch]} · ${CHAPTERS[S.ch]}` : '';
  $('#obj').textContent = objective();
  const r = roomAt(S.floor, Math.floor(S.p.x), Math.floor(S.p.y));
  $('#room').textContent = r ? r.n : '';
}
const fadeEl = $('#fade');
function fadeThrough(fn) { S.busy = true; fadeEl.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => { fadeEl.classList.remove('on'); S.busy = false; }, 120); }, 650); }

/* ============================== CHAPTER FLOW ============================== */
function advance() {
  S.ch++;
  AU.drone(0.012 * S.ch);
  if (S.ch === 3) { say('Downstairs, a door creaks open.'); AU.creak(); }
  if (S.ch === 5) { say('Somewhere below you, a latch drops.'); AU.lock(); }
  if (S.ch === 6) {
    S.blackout = 2.4; AU.whoosh();
    S.hasLalteen = false; placeLalteen('upper', 21.5, 2.7);
    S.changes = true;
    setTimeout(() => { say('The flame goes out.', 'When your eyes adjust, your hands are empty.', 'Upstairs, a light is burning.'); AU.stepsAbove(); }, 1600);
    setTimeout(() => showCard(6), 2600); updateHUD(); return;
  }
  if (S.ch === 7) {
    S.blackout = 2.4; AU.whoosh();
    S.hasLalteen = false; placeLalteen('ground', 13, 3.5);
    S.dinnerSet = true;
    setTimeout(() => { say('The lalteen gutters out in your hand.', 'Downstairs, a chair scrapes across the floor.'); AU.creak(); }, 1600);
    setTimeout(() => showCard(7), 2600); updateHUD(); return;
  }
  showCard(S.ch); updateHUD();
}
function placeLalteen(f, x, y) { S.lalOnEntry = false; S.lalteenAt = { f, x, y }; LAL.f = f; LAL.x = x - 0.3; LAL.y = y - 0.3; }

/* ============================== WORLD OBJECTS ============================== */
const D = {
  news1: { t: 'news', head: 'CHILD REPORTED MISSING FROM RESIDENTIAL AREA', body: 'A young child was reported missing from an old residential neighbourhood in Kathmandu. According to the report, the family refused to provide further details. Neighbours said the child had been seen playing near the family residence earlier that evening.' },
};
const LAL = { id: 'lal', f: 'upper', x: 0, y: 0, w: 0.6, h: 0.6, kind: 'lal', name: 'Lalteen',
  vis: () => !S.lalOnEntry && !!S.lalteenAt,
  act() {
    if (S.ch === 7) { say('The flame does not move. You leave it where it is.'); return; }
    S.hasLalteen = true; S.lalteenAt = null; AU.pick();
    say('The lalteen is warm.', 'Someone has been holding it.');
    mark('lalteenBack');
  } };

const OBJ = [
  // ---------------- ground floor ----------------
  { id: 'frontdoor', f: 'ground', x: 12, y: 16, w: 2, h: 1, kind: 'frontdoor', name: 'Front door', act() {
    if (S.endingsOpen) return openChoice('Leave the house, and take the photograph with you?', [['Stay', null], ['Leave', () => ending(1)]]);
    say(S.ch < 2 ? 'Rain hammers on the door. Nisha is somewhere. Not out there.' : 'Not yet. Not without knowing.');
  } },
  { id: 'slippers', f: 'ground', x: 9, y: 15.25, w: 2.4, h: 0.6, kind: 'slippers', name: 'Slippers', act() {
    say('Five pairs of slippers by the door.', 'Only four people were supposed to live here.'); mark('slippers');
  } },
  { id: 'entry', f: 'ground', x: 14.3, y: 14.1, w: 2.2, h: 1, solid: true, kind: 'entry', name: 'Table by the door', act() {
    if (S.lalOnEntry) {
      S.lalOnEntry = false; S.lalteenAt = null; S.hasLalteen = true; AU.pick();
      say('A lalteen, still burning. A cup of tea, half empty.', 'A plate of food that nobody has touched.', 'Someone has been living here. You take the lalteen.');
      mark('table'); return;
    }
    say(S.ch >= 6 ? 'The tea is gone. The cup has been washed.' : 'The tea has gone cold. The food is still untouched.');
  } },
  { id: 'stairsG', f: 'ground', x: 16, y: 8, w: 2, h: 2.2, solid: true, kind: 'stairs', name: 'Stairs up', act() {
    if (S.ch < 2) { say('The first step creaks under your weight. You stop.', 'Not yet. Something on this floor is wrong.'); AU.creak(); return; }
    fadeThrough(() => { S.floor = 'upper'; S.p.x = 3.7; S.p.y = 7; S.p.dir = 0; updateHUD(); });
  } },
  { id: 'dining', f: 'ground', x: 10, y: 2.5, w: 6, h: 2, solid: true, kind: 'dining', name: 'Dining table', act() {
    if (S.dinnerSet) { say('Six plates. Six glasses. Six chairs.', 'Only the rain, and the old wood settling.'); return; }
    say('Six chairs around the dining table.', 'Four of you lived here. Then three. Then only Nisha.'); mark('chairs');
  } },
  { id: 'dinnerChair', f: 'ground', x: 10.95, y: 5.05, w: 0.75, h: 0.75, kind: 'pulledChair', name: 'The pulled-out chair', vis: () => S.changes, act() {
    if (!S.dinnerSet) { say('One chair has been pulled out from the table.', 'You did not move it.'); return; }
    if (S.flags.dinner) { say('The chair is empty now.'); return; }
    openDocs([{ t: 'photo', spec: PH.dinner, sting: true, note: 'The final photograph. The unknown child is no longer standing behind the family. He is sitting in the empty chair. And you are standing behind him.' }], () => { mark('dinner'); figureEvent(); });
  } },
  { id: 'tea', f: 'ground', x: 14.4, y: 3.95, w: 0.5, h: 0.5, kind: 'tea', name: 'Cup of tea', vis: () => S.changes, act() { say('A cup of tea. Still warm.'); } },
  { id: 'counter', f: 'ground', x: 19, y: 1, w: 6, h: 1, solid: true, kind: 'counter' },
  { id: 'plates', f: 'ground', x: 21.2, y: 1.1, w: 1.8, h: 0.8, kind: 'plates', name: 'Plates', act() {
    say('Six plates, washed and turned upside down to dry.'); mark('plates');
  } },
  { id: 'kcup', f: 'ground', x: 19, y: 6, w: 2, h: 0.95, solid: true, kind: 'cupboard', open: () => S.changes, name: 'Kitchen cupboard', act() {
    if (S.changes) { say('The cupboard is open. You closed it.'); return; }
    if (!S.flags.news1) openDocs([{ ...D.news1, note: 'Folded beneath the cupboard. The newspaper is old. The date is from a year you barely remember. It is the same story as the clipping in the parcel.' }], () => mark('news1'));
    else say('Pots. Spices gone to dust. Nothing else.');
  } },
  { id: 'gbed', f: 'ground', x: 1, y: 1, w: 2, h: 3, solid: true, kind: 'bed', name: "Grandfather's bed", act() { say('Grandfather Bhim slept here until the end.', 'The mattress still holds the shape of him.'); } },
  { id: 'gcup', f: 'ground', x: 4, y: 1, w: 2.6, h: 1, solid: true, kind: 'cupboard', open: () => S.ch >= 3, name: "Grandfather's cupboard", act() {
    if (S.ch < 3) { say("Grandfather's cupboard. The doors are swollen shut with damp."); return; }
    if (S.ch === 6 && !S.flags.statement) {
      openDocs([{ t: 'register', extra: '', note: 'The register again. Another sheet is tucked inside it.' },
        { t: 'hand', plain: true, title: 'A loose sheet · signed: Bhim', lines: ['There were six of us in this house.', 'There have always been six.', "I don't know why we keep pretending otherwise."], sting: true, note: "Grandfather's handwriting." }],
      () => mark('statement'));
      return;
    }
    if (!S.flags.register) {
      openDocs([
        { t: 'news', head: 'SEARCH FOR MISSING CHILD CALLED OFF', photo: PH.street1, cap: 'The family residence, photographed last week.', body: 'Police have ended the search for a young child reported missing from an old residential neighbourhood last month. The family declined to comment. Neighbours described the household as private, and said the child was rarely seen outside.' },
        { t: 'news', head: 'SMALL FIRE AT OLD RESIDENTIAL HOUSE', date: '■■ ■■■■■■ 19■■', body: 'A small fire broke out on the upper floor of an old house in the residential quarter on Tuesday night. It was put out by neighbours before fire services arrived. No one was injured. A family member told reporters that the room "was not in use."' },
        { t: 'news', head: 'FAMILY DISPUTE OVER ANCESTRAL PROPERTY', date: '■■ ■■■■■■ 20■■', photo: PH.street2, cap: 'File photo.', body: 'A dispute over the sale of an ancestral house has been taken to the district office. An elderly family member is said to have refused to sign the papers, telling officials that "the house is not empty."', note: 'The same house, in two photographs. In the first, an upstairs window. Years later, the same window, covered with bricks.', onShow: () => mark('clippings') },
        { t: 'register', note: 'Behind the newspapers, the family register. Six names. One scratched out so hard the paper has almost torn. You recognise the handwriting. It belongs to your mother.', sting: true },
      ], () => mark('register'));
      return;
    }
    say('Old newspapers. Property papers. The register, with its torn line.');
  } },
  { id: 'frame', f: 'ground', x: 2.5, y: 8, w: 2, h: 0.35, kind: 'frame', name: 'Family photograph', act() {
    if (S.endingsOpen) return openChoice('Place the photograph back in its frame?', [['Not yet', null], ['Put it back', () => ending(2)]]);
    if (S.flags.keyfits) {
      if (!S.flags.photo7) openDocs([{ t: 'photo', spec: PH.frame7, sting: true, note: 'The drawing had six people. This photograph has seven now.' }], () => mark('photo7'));
      else openDocs([{ t: 'photo', spec: PH.frame7, note: 'Seven. The one at the edge has no face you can make out.' }]);
      return;
    }
    openDocs([{ t: 'photo', spec: PH.parcel, note: 'The same photograph Nisha sent you. Grandfather, your parents, Nisha and you. And the one standing between you.' }]);
  } },
  { id: 'shelf', f: 'ground', x: 1, y: 11, w: 0.7, h: 2, solid: true, kind: 'shelf', name: 'Photograph on the shelf', act() {
    openDocs([{ t: 'photo', spec: PH.courtyard, back: 'Everyone was there that day.', note: 'Grandfather, alone in the courtyard. There are six shadows on the ground.' }], () => mark('courtyard'));
  } },
  { id: 'sofa', f: 'ground', x: 2.2, y: 14.2, w: 3, h: 1, solid: true, kind: 'sofa' },
  { id: 'pbed', f: 'ground', x: 22, y: 8, w: 3, h: 3, solid: true, kind: 'bed2', name: "Parents' bed", act() { say("Your parents' bed, stripped to the mattress.", 'Dust has settled into the creases.'); } },
  { id: 'chest', f: 'ground', x: 19.2, y: 14.2, w: 2, h: 1, solid: true, kind: 'chest', name: 'Wooden chest', act() {
    if (S.ch < 5) { say('A wooden chest. The latch is rusted shut.'); return; }
    if (S.flags.photo5) { say("Mother's diary, and the photograph. Nothing else."); return; }
    openDocs([
      { t: 'diary', title: "Mother's diary", entries: [
        { d: '3 August', x: 'School fees again. Hari says the shop will pick up after Dashain.' },
        { d: '12 August', x: "Baba keeps asking us to leave the upstairs room alone. I don't know why he insists on keeping it exactly as it was." },
        { d: '19 August', x: 'The photograph has six people again. I removed it yesterday.' },
        { d: '2 September', x: 'Hari says we should sell the house. I told him we cannot sell it while Baba is still here.' },
        { d: '14 September', x: "I don't want the children going upstairs." },
        { d: '■ September', x: 'The plate was on the floor again this morning. I', stain: true },
      ], note: 'Not a diary about ghosts. Money, school fees, grandfather\'s illness, arguments about the house. The last entry is unfinished.' , onShow: () => mark('diary') },
      { t: 'photo', spec: PH.five, sting: true, note: 'Your parents, Nisha and you, outside the house. A fifth child stands behind you. This time you recognise the face. It looks like you. Only younger.' },
    ], () => mark('photo5'));
  } },
  // ---------------- upstairs ----------------
  { id: 'stairsU', f: 'upper', x: 1, y: 6, w: 2, h: 2, solid: true, kind: 'stairs', name: 'Stairs down', act() {
    fadeThrough(() => { S.floor = 'ground'; S.p.x = 16.9; S.p.y = 10.75; S.p.dir = Math.PI / 2; updateHUD(); });
  } },
  { id: 'nbed', f: 'upper', x: 1, y: 1, w: 2, h: 3, solid: true, kind: 'bed', name: "Nisha's bed" },
  { id: 'notebook', f: 'upper', x: 2.05, y: 2.0, w: 0.8, h: 0.6, kind: 'notebook', name: "Nisha's notebook", act() {
    if (S.flags.notebook) { openDocs([{ t: 'draw', items: [['family6', 'Six people at the table. One coloured completely black.']] }]); return; }
    say('Dust everywhere, except around the notebook.');
    openDocs([
      { t: 'hand', title: "Nisha's notebook", lines: ['rice, dal, matches, kerosene for lalteen', 'Grandpa\'s medicine — ask at the pharmacy', '', 'I asked Grandpa why we don\'t use the upstairs room. He said it is not empty. I asked him who lives there. He told me to stop asking stupid questions.'], note: 'Shopping lists. School memories. Unfinished drawings. And this.' },
      { t: 'draw', items: [['family6', 'Between the pages.']], note: 'Six people sitting around a dining table. One of them coloured completely black.' },
    ], () => mark('notebook'));
  } },
  { id: 'clothes', f: 'upper', x: 6.1, y: 4.35, w: 1.6, h: 0.55, kind: 'clothes', name: 'Clothes behind the door', act() { say('Her clothes are still hanging behind the door.', 'Her bag is gone. Her phone is gone.'); } },
  { id: 'desk', f: 'upper', x: 6, y: 1, w: 2.6, h: 0.9, solid: true, kind: 'desk', name: "Nisha's desk", act() { say('Pencils. A torn envelope. Your address, in her handwriting.'); } },
  { id: 'boxes', f: 'upper', x: 10.2, y: 1.2, w: 1.5, h: 1.4, solid: true, kind: 'boxes', name: 'Boxes', act() { say('Old school books. Two names on the covers. The second one has been cut out with scissors.'); } },
  { id: 'mirror', f: 'upper', x: 13.3, y: 1, w: 1.4, h: 0.35, kind: 'mirror', name: 'Covered mirror', act() {
    say(S.ch >= 6 ? 'The cloth has slipped. In the dark glass, only you. You look away before that changes.' : 'A mirror, covered with a cloth. You leave it covered.');
  } },
  { id: 'udoor', f: 'upper', x: 21, y: 5, w: 1, h: 1, kind: 'door', name: 'Upstairs room', vis: () => !S.upDoorOpen || S.endingsOpen, act() {
    if (S.endingsOpen) return openChoice('Enter the upstairs room, and close the door behind you?', [['Step back', null], ['Enter', () => ending(3)]]);
    if (S.ch < 2) { say('Locked. A small brass lock.'); return; }
    if (S.ch === 2) {
      if (S.flags.keyfits) { say('The photograph downstairs.'); return; }
      AU.lock();
      say('The brass key from the parcel fits the lock.', 'Before you turn it, you think of the drawing. Six people.', 'And the photograph in the living room.');
      mark('keyfits'); return;
    }
    if (S.ch === 3) { say('Your hand will not turn the key.', "Grandfather's cupboard is open downstairs."); return; }
    S.upDoorOpen = true; AU.lock(); AU.creak();
    say('The room is smaller than you expected.'); updateHUD();
  } },
  { id: 'kbed', f: 'upper', x: 18.1, y: 1, w: 1.5, h: 2.4, solid: true, kind: 'bedSmall', name: 'Small wooden bed', act() { say('A small wooden bed, made neatly.', 'The pillow is still dented.'); } },
  { id: 'papers', f: 'upper', x: 20.2, y: 1, w: 2.4, h: 0.35, kind: 'papers', name: 'Drawings on the wall', act() {
    openDocs([{ t: 'draw', seed: 3, items: [['house5', 'Five people outside.'], ['house6', 'Six.'], ['house5s6', 'Five people. Six shadows on the wall.']], note: 'The wall is covered in pencil drawings of the same house. Something is different in each one.' }], () => mark('walldraw'));
  } },
  { id: 'bag', f: 'upper', x: 18.35, y: 3.85, w: 0.85, h: 0.6, kind: 'bag', name: 'School bag', act() {
    openDocs([
      { t: 'hand', child: true, title: 'School notebook · first page', lines: ['Name: <span class="smudge">Ankit</span>', 'Class 2'], note: 'The name is the same one that was scratched out of the register.' },
      { t: 'hand', child: true, lines: ['Mum said I should not tell anyone about the room.', 'But I sleep here every night.'] },
      { t: 'draw', items: [['dinner6', 'Six plates. One on the floor, beside the table.']] },
    ], () => {
      S.memory = 1; AU.sting();
      say('A memory: a small hand holding yours, walking through the courtyard.', 'You cannot remember whose hand it was.');
      mark('schoolbag');
    });
  } },
  { id: 'toy', f: 'upper', x: 22.3, y: 3.6, w: 0.6, h: 0.5, kind: 'toy', name: 'Broken toy', act() { say('A wooden horse with one leg missing.', 'You had one exactly like it.'); } },
  { id: 'kcupb', f: 'upper', x: 23.2, y: 1, w: 1.7, h: 0.9, solid: true, kind: 'cupboard', open: () => !!S.flags.hidden, name: 'Small cupboard', act() {
    if (S.ch < 6 || !S.flags.statement) { say('A small cupboard. It sits a little away from the wall.'); return; }
    if (S.flags.hidden) { say('The hidden space behind the cupboard is empty now.'); return; }
    AU.creak();
    openDocs([{ t: 'photo', spec: PH.hidden, back: 'Do not leave the last place empty.', sting: true, note: 'Behind the cupboard, a hidden space. Inside, a photograph: the family at the dining table. Everyone looks at the camera, except you. You are looking at the empty chair beside you.' }], () => mark('hidden'));
  } },
  LAL,
];

/* ============================== FIGURE & ENDINGS ============================== */
function figureEvent() {
  S.figure = { x: 12.95, y: 6.35 }; AU.sting();
  setTimeout(() => { S.blackout = 1.7; AU.whoosh(); }, 2600);
  setTimeout(() => { S.figure = null; }, 3200);
  setTimeout(() => { S.endingsOpen = true; updateHUD(); say('When the flame lights again, the doorway is empty.', 'The house is quiet. It is waiting.'); }, 4400);
}

const endEl = $('#ending'), ecv = $('#ecv'), eg = ecv.getContext('2d'), etext = endEl.querySelector('.etext'), ebtns = endEl.querySelector('.ebtns');
let endDraw = null, endT0 = 0, endPhotoCache = {};
function photoImage(spec) { const k = JSON.stringify(spec); if (!endPhotoCache[k]) endPhotoCache[k] = photoCanvas(spec, 480, 330); return endPhotoCache[k]; }
function drawCentered(g, w, h, img, t) {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const iw = Math.min(w * 0.82, (h * 0.55) * (480 / 330), 560), ih = iw * (330 / 480);
  const gl = g.createRadialGradient(w / 2, h * 0.38, 10, w / 2, h * 0.38, iw); gl.addColorStop(0, `rgba(255,150,60,${0.14 + Math.sin(t * 8) * 0.01})`); gl.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gl; g.fillRect(0, 0, w, h);
  g.drawImage(img, (w - iw) / 2, h * 0.38 - ih / 2, iw, ih);
}
const ENDINGS = {
  1: { name: 'The Departure', panels: [
    { text: 'You take the photograph and walk out into the rain. You do not look back.', draw: (g, w, h, t) => drawHouseExt(g, w, h, t, {}) },
    { text: 'The next morning, you look at it again. The photograph now shows five people.', draw: (g, w, h, t) => drawCentered(g, w, h, photoImage(PH.end1), t) },
    { text: 'You put it away.', draw: (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); } },
    { text: 'The house, from outside. An upstairs window slowly opens.', draw: (g, w, h, t) => drawHouseExt(g, w, h, t, { winOpen: clamp(t / 7, 0, 1) }) },
  ] },
  2: { name: 'The Sixth Member', panels: [
    { text: 'You place the photograph back in its original frame.', draw: (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); } },
    { text: 'Six plates. Six chairs. Six people, reflected faintly in the polished wood.', draw: (g, w, h, t) => drawTableTop(g, w, h, t, 0) },
    { text: 'Nobody moves.', draw: (g, w, h, t) => drawTableTop(g, w, h, t, clamp(t / 10, 0, 0.6)) },
  ] },
  3: { name: 'The House Remembers', panels: [
    { text: 'You enter the upstairs room and close the door behind you.', draw: (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); } },
    { text: 'After a while, the door opens. The room is empty.', draw: (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,170,90,.05)'; g.fillRect(w * 0.44, h * 0.2, w * 0.12, h * 0.5); } },
    { text: 'Downstairs, the lalteen burns on the dining table, beside a new photograph.', draw: (g, w, h, t) => drawTableTop(g, w, h, t, 0.35) },
    { text: 'It shows the family again. This time, there are seven people.', draw: (g, w, h, t) => drawCentered(g, w, h, photoImage(PH.end3), t) },
  ] },
};
function ending(n) {
  S.ended = true; S.busy = true; document.body.classList.remove('playing');
  fadeEl.classList.add('on');
  setTimeout(() => {
    endEl.classList.add('on'); fadeEl.classList.remove('on');
    AU.drone(0.05);
    const E = ENDINGS[n]; let i = -1;
    const next = () => {
      i++;
      if (i >= E.panels.length) return theories(n);
      const p = E.panels[i];
      etext.style.opacity = 0;
      setTimeout(() => {
        endDraw = p.draw; endT0 = performance.now();
        etext.innerHTML = (i === 0 ? `<span class="small">Ending ${ROMAN[n]} · ${E.name}</span>` : '') + p.text;
        etext.style.opacity = 1;
        if (i === E.panels.length - 1) AU.sting();
      }, 500);
      ebtns.innerHTML = ''; const b = el('button', 'btn', 'Continue'); b.style.alignSelf = 'center'; b.style.fontStyle = 'normal'; b.style.textTransform = 'uppercase'; b.style.fontSize = '15px'; b.onclick = next; ebtns.appendChild(b);
    };
    next();
  }, 700);
}
function theories() {
  endDraw = (g, w, h, t) => drawHouseExt(g, w, h, t, {});
  endEl.classList.add('theory');
  etext.innerHTML = '<span class="big">KHYAA</span>The house never explains itself. What do you believe?';
  ebtns.innerHTML = '';
  ['The missing child was real, and everyone was made to forget.', "The Khyaa has been living in the missing child's place for generations.", 'I am the missing child. My memories are not mine.'].forEach((tx) => {
    const b = el('button', 'btn', tx);
    b.onclick = () => {
      etext.innerHTML = '<span class="big">KHYAA</span>The house does not answer.<br><span style="font-size:.75em;opacity:.7">You leave with a theory, not an answer.</span>';
      ebtns.innerHTML = ''; const r = el('button', 'btn', 'Return to the house'); r.style.fontStyle = 'normal'; r.onclick = () => location.reload(); ebtns.appendChild(r);
    };
    ebtns.appendChild(b);
  });
}


/* ============================== RULES SHARED BY RENDERERS ============================== */
function isVis(o) { return !o.vis || o.vis(); }
function rectDist(px, py, o) { const dx = Math.max(o.x - px, 0, px - (o.x + o.w)), dy = Math.max(o.y - py, 0, py - (o.y + o.h)); return Math.hypot(dx, dy); }
const PR = 0.27;
function collides(x, y) {
  const f = S.floor;
  for (let ty = Math.floor(y - PR); ty <= Math.floor(y + PR); ty++) for (let tx = Math.floor(x - PR); tx <= Math.floor(x + PR); tx++) if (solidTile(f, tx, ty)) return true;
  for (const o of OBJ) if (o.f === f && o.solid && x + PR > o.x && x - PR < o.x + o.w && y + PR > o.y && y - PR < o.y + o.h) return true;
  return false;
}
function move(dx, dy) {
  let m = false;
  if (dx) { if (!collides(S.p.x + dx, S.p.y)) { S.p.x += dx; m = true; } else if (Math.abs(dy) < Math.abs(dx) * 0.6) m = nudge('y', dx) || m; }
  if (dy) { if (!collides(S.p.x, S.p.y + dy)) { S.p.y += dy; m = true; } else if (Math.abs(dx) < Math.abs(dy) * 0.6) m = nudge('x', dy) || m; }
  return m;
}
// when walking into a wall beside a doorway, slide sideways into the opening instead of stopping dead
function nudge(axis, d) {
  const c = axis === 'y' ? S.p.y : S.p.x, step = Math.abs(d);
  const free = (v) => !(axis === 'y' ? collides(S.p.x + d, v) : collides(v, S.p.y + d));
  for (let k = 1; k <= 18; k++) for (const sgn of [1, -1]) {
    const off = sgn * k * 0.05;
    if (!free(c + off)) continue;
    const delta = clamp(off, -step, step);
    if (axis === 'y' ? collides(S.p.x, S.p.y + delta) : collides(S.p.x + delta, S.p.y)) continue;
    if (axis === 'y') S.p.y += delta; else S.p.x += delta;
    return true;
  }
  return false;
}

// which objects matter for the current chapter
const WANT = { 1: ['entry', 'slippers', 'dining', 'plates', 'kcup', 'shelf'], 2: ['stairsG', 'notebook', 'udoor', 'frame'], 3: ['gcup'], 4: ['udoor', 'papers', 'bag'], 5: ['chest'], 6: ['lal', 'gcup', 'kcupb'], 7: ['dinnerChair'] };
const FLAG_OF = { entry: 'table', slippers: 'slippers', dining: 'chairs', plates: 'plates', kcup: 'news1', shelf: 'courtyard', notebook: 'notebook', udoor: 'keyfits', frame: 'photo7', gcup: 'register', papers: 'walldraw', bag: 'schoolbag', chest: 'photo5', lal: 'lalteenBack', kcupb: 'hidden', dinnerChair: 'dinner' };
function wanted(o) {
  if (S.endingsOpen) return ['frontdoor', 'frame', 'udoor'].includes(o.id);
  const list = WANT[S.ch]; if (!list || !list.includes(o.id)) return false;
  if (S.ch === 6 && o.id === 'gcup') return !S.flags.statement;
  if (S.ch === 4 && o.id === 'udoor') return !S.upDoorOpen;
  if (o.id === 'stairsG') return S.floor === 'ground' && !S.flags.notebook;
  const f = FLAG_OF[o.id]; return f ? !S.flags[f] : false;
}

// pathfinding over the tile grid, used for tap-to-walk
function blockedTile(f, x, y) { if (solidTile(f, x, y)) return true; const cx = x + 0.5, cy = y + 0.5, r = 0.3; for (const o of OBJ) if (o.f === f && o.solid && cx + r > o.x && cx - r < o.x + o.w && cy + r > o.y && cy - r < o.y + o.h) return true; return false; }
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function findPath(goal) {
  const f = S.floor, map = MAPS[f], cols = map[0].length, rows = map.length;
  const sx = Math.floor(S.p.x), sy = Math.floor(S.p.y);
  const prev = new Int32Array(cols * rows).fill(-2), q = [sx + sy * cols]; prev[q[0]] = -1;
  let head = 0, found = -1;
  while (head < q.length) {
    const i = q[head++], x = i % cols, y = (i / cols) | 0;
    if (goal(x, y)) { found = i; break; }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = nx + ny * cols; if (prev[j] !== -2 || blockedTile(f, nx, ny)) continue;
      if (dx && dy && (blockedTile(f, x + dx, y) || blockedTile(f, x, y + dy))) continue;
      prev[j] = i; q.push(j);
    }
  }
  if (found < 0) return null;
  const path = []; for (let i = found; i !== -1; i = prev[i]) path.unshift({ x: (i % cols) + 0.5, y: ((i / cols) | 0) + 0.5 });
  path.shift(); return path;
}
