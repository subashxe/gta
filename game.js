'use strict';
/* KHYAA — top-down 2D renderer and controls. Needs core.js. */
/* ============================== RENDERING ============================== */
const cv = $('#game'), ctx = cv.getContext('2d');
const darkC = document.createElement('canvas'), dctx = darkC.getContext('2d');
let W = 0, H = 0, DPR = 1, TS = 44;
const cam = { x: 0, y: 0 };
const floorCache = {};
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  darkC.width = cv.width; darkC.height = cv.height;
  TS = Math.round(clamp(Math.min(W, H) / 9.5, 34, 62));
  for (const k in floorCache) delete floorCache[k];
  for (const c of [$('#tcv'), ecv]) { c.width = W * DPR; c.height = H * DPR; }
}
function buildFloor(f) {
  const map = MAPS[f], cols = map[0].length, rows = map.length;
  const c = document.createElement('canvas'); c.width = Math.ceil(cols * TS * DPR); c.height = Math.ceil(rows * TS * DPR);
  const g = c.getContext('2d'); g.scale(DPR, DPR);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const t = map[y][x], X = x * TS, Y = y * TS;
    if (t === '#' || t === 'F') {
      g.fillStyle = '#120d0a'; g.fillRect(X, Y, TS + 0.5, TS + 0.5);
      const below = tileAt(f, x, y + 1);
      if (below !== '#' && below !== 'F' && y + 1 < rows) {
        g.fillStyle = '#2a1c14'; g.fillRect(X, Y + TS * 0.55, TS + 0.5, TS * 0.45);
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
        for (let r = 0; r < 3; r++) { const yy = Y + TS * 0.55 + (r * TS * 0.45) / 3; g.beginPath(); g.moveTo(X, yy); g.lineTo(X + TS, yy); g.stroke(); for (let k = (r % 2) * 0.25; k < 1; k += 0.5) { g.beginPath(); g.moveTo(X + k * TS, yy); g.lineTo(X + k * TS, yy + TS * 0.15); g.stroke(); } }
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X, Y + TS - 3, TS, 3);
      } else { g.fillStyle = 'rgba(255,230,200,.03)'; g.fillRect(X + 2, Y + 2, TS - 4, TS - 4); }
      continue;
    }
    const room = roomAt(f, x, y);
    const base = room ? room.c : '#3a2a1c';
    g.fillStyle = base; g.fillRect(X, Y, TS + 0.5, TS + 0.5);
    if (room && room.tile) {
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.strokeRect(X + 0.5, Y + 0.5, TS / 2, TS / 2); g.strokeRect(X + TS / 2 + 0.5, Y + TS / 2 + 0.5, TS / 2 - 1, TS / 2 - 1);
      g.fillStyle = `rgba(255,240,220,${0.02 + hash(x, y) * 0.04})`; g.fillRect(X, Y, TS / 2, TS / 2);
    } else {
      const ph = TS / 3;
      for (let k = 0; k < 3; k++) {
        g.fillStyle = `rgba(${hash(x, y * 3 + k) > 0.5 ? '255,220,170' : '0,0,0'},${0.03 + hash(y * 3 + k, x) * 0.05})`; g.fillRect(X, Y + k * ph, TS, ph);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(X, Y + k * ph, TS, 1);
        const sx = Math.floor(hash(x * 7 + k, y) * 4) / 4; if ((x + k) % 2 === 0) g.fillRect(X + sx * TS, Y + k * ph, 1, ph);
      }
    }
    if (!room) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X, Y, TS, TS); }
  }
  const vg = g.createRadialGradient(cols * TS / 2, rows * TS / 2, 10, cols * TS / 2, rows * TS / 2, cols * TS * 0.6); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = vg; g.fillRect(0, 0, cols * TS, rows * TS);
  floorCache[f] = c;
}
function drawWindows(t) {
  for (const [wx, wy, kind] of WINDOWS[S.floor]) {
    const X = wx * TS - cam.x, Y = wy * TS - cam.y;
    const horiz = wy === 0 || wy === MAPS[S.floor].length - 1;
    const x = horiz ? X + TS * 0.15 : X + TS * 0.3, y = horiz ? Y + TS * 0.3 : Y + TS * 0.15, w = horiz ? TS * 0.7 : TS * 0.4, h = horiz ? TS * 0.4 : TS * 0.7;
    ctx.fillStyle = '#2c1c12'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    if (kind === 'bricked') {
      ctx.fillStyle = '#5a2b1d'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(0,0,0,.5)';
      for (let r = 0; r < 3; r++) { ctx.beginPath(); ctx.moveTo(x, y + (h * r) / 3); ctx.lineTo(x + w, y + (h * r) / 3); ctx.stroke(); }
      continue;
    }
    ctx.fillStyle = S.lightning > 0 ? '#9aa8c8' : '#0f1520'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(140,160,200,.35)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 4; i++) { const ry = ((t * 1.3 + i * 0.27 + wx * 0.13) % 1) * h; const rx = x + ((i * 0.31 + wx * 0.17) % 1) * w; ctx.moveTo(rx, y + ry); ctx.lineTo(rx, y + Math.min(h, ry + 5)); }
    ctx.stroke();
    ctx.strokeStyle = '#2c1c12'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  }
}
function lantern(x, y, s, t) {
  const fl = 1 + Math.sin(t * 11) * 0.08;
  ctx.fillStyle = '#1a120b'; ctx.fillRect(x - s * 0.22, y + s * 0.15, s * 0.44, s * 0.12);
  ctx.fillStyle = 'rgba(255,200,120,.35)'; rr(ctx, x - s * 0.17, y - s * 0.2, s * 0.34, s * 0.36, s * 0.1); ctx.fill();
  ctx.fillStyle = '#ffd78a'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.06 * fl, s * 0.11 * fl, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2a1d10'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y - s * 0.24, s * 0.12, Math.PI, 0); ctx.stroke();
}
function chair(x, y, s, rot) {
  ctx.save(); ctx.translate(x + s / 2, y + s / 2); ctx.rotate(rot || 0);
  ctx.fillStyle = '#3a2516'; rr(ctx, -s / 2, -s / 2, s, s, 3); ctx.fill();
  ctx.fillStyle = '#28180d'; ctx.fillRect(-s / 2, -s / 2, s, s * 0.18);
  ctx.restore();
}
function box(x, y, w, h, fill, edge) { ctx.fillStyle = fill; rr(ctx, x, y, w, h, 3); ctx.fill(); if (edge) { ctx.fillStyle = edge; ctx.fillRect(x + 2, y + 2, w - 4, 3); } ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 2, y + h - 2, w - 4, 3); }
function drawObj(o, t) {
  const x = o.x * TS - cam.x, y = o.y * TS - cam.y, w = o.w * TS, h = o.h * TS;
  switch (o.kind) {
    case 'frontdoor':
      ctx.fillStyle = '#3b2615'; ctx.fillRect(x, y, w, h * 0.55);
      ctx.strokeStyle = '#1b1009'; ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, w / 2 - 5, h * 0.55 - 6); ctx.strokeRect(x + w / 2 + 2, y + 3, w / 2 - 5, h * 0.55 - 6);
      ctx.fillStyle = '#b08a3e'; ctx.fillRect(x + w / 2 - 6, y + h * 0.25, 3, 4); ctx.fillRect(x + w / 2 + 3, y + h * 0.25, 3, 4); break;
    case 'slippers': {
      const cols = ['#5c3c2a', '#3d4a5a', '#6a2f2f', '#4b5a3a', '#2a2a2a'];
      for (let i = 0; i < 5; i++) { const px = x + (i * w) / 5 + 2; ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.ellipse(px + w * 0.04, y + h * 0.5, w * 0.03, h * 0.38, 0, 0, 7); ctx.ellipse(px + w * 0.12, y + h * 0.5, w * 0.03, h * 0.38, 0, 0, 7); ctx.fill(); }
      break; }
    case 'entry':
      box(x, y, w, h, '#4a301b', '#5e3e24');
      ctx.fillStyle = '#d8cfbd'; ctx.beginPath(); ctx.arc(x + w * 0.2, y + h * 0.5, TS * 0.13, 0, 7); ctx.fill(); ctx.fillStyle = '#7a4e26'; ctx.beginPath(); ctx.arc(x + w * 0.2, y + h * 0.5, TS * 0.08, 0, 7); ctx.fill();
      ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.arc(x + w * 0.46, y + h * 0.5, TS * 0.22, 0, 7); ctx.fill(); ctx.fillStyle = '#c9a457'; ctx.beginPath(); ctx.arc(x + w * 0.43, y + h * 0.46, TS * 0.08, 0, 7); ctx.fill(); ctx.fillStyle = '#7d8a3a'; ctx.beginPath(); ctx.arc(x + w * 0.51, y + h * 0.55, TS * 0.06, 0, 7); ctx.fill();
      if (S.lalOnEntry) lantern(S.lalteenAt.x * TS - cam.x, S.lalteenAt.y * TS - cam.y, TS, t);
      break;
    case 'stairs': {
      const n = 7; for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? '#3a2718' : '#2f1f13'; ctx.fillRect(x, y + (i * h) / n, w, h / n + 0.5); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x, y + ((i + 1) * h) / n - 2, w, 2); }
      const gr = ctx.createLinearGradient(0, y, 0, y + h); const up = o.id === 'stairsG';
      gr.addColorStop(up ? 0 : 1, 'rgba(0,0,0,.7)'); gr.addColorStop(up ? 1 : 0, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#21150c'; ctx.fillRect(x - 3, y, 4, h); break; }
    case 'dining': {
      const cs = TS * 0.52, pos = [[1.0, -0.62], [3.6, -0.62], [1.0, 2.1], [3.6, 2.1], [-0.68, 0.74], [6.16, 0.74]];
      pos.forEach(([cx, cy], i) => { if (i === 2 && S.changes) return; chair(x + cx * TS, y + cy * TS, cs, i < 2 ? 0 : i < 4 ? Math.PI : i === 4 ? -Math.PI / 2 : Math.PI / 2); });
      const wood = ctx.createLinearGradient(x, y, x + w, y + h); wood.addColorStop(0, '#4a2e19'); wood.addColorStop(0.5, '#613d22'); wood.addColorStop(1, '#3d2513');
      ctx.fillStyle = wood; rr(ctx, x, y, w, h, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.2)'; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + 4, y + (h * i) / 5); ctx.lineTo(x + w - 4, y + (h * i) / 5); ctx.stroke(); }
      if (S.dinnerSet) {
        const pl = [[1.25, 0.32], [3.85, 0.32], [1.25, 1.68], [3.85, 1.68], [0.35, 1], [5.65, 1]];
        pl.forEach(([px, py]) => { ctx.fillStyle = '#ddd5c4'; ctx.beginPath(); ctx.arc(x + px * TS, y + py * TS, TS * 0.2, 0, 7); ctx.fill(); ctx.fillStyle = '#c4bba8'; ctx.beginPath(); ctx.arc(x + px * TS, y + py * TS, TS * 0.12, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(190,215,230,.5)'; ctx.beginPath(); ctx.arc(x + px * TS + TS * 0.3, y + py * TS, TS * 0.07, 0, 7); ctx.fill(); });
      }
      break; }
    case 'pulledChair':
      chair(x, y, w * 0.95, Math.PI + 0.45);
      if (S.dinnerSet && !S.flags.dinner) { ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(0.3); ctx.fillStyle = '#e9dfc8'; ctx.fillRect(-w * 0.3, -w * 0.22, w * 0.6, w * 0.44); ctx.fillStyle = '#7a5f41'; ctx.fillRect(-w * 0.25, -w * 0.17, w * 0.5, w * 0.34); ctx.restore(); }
      break;
    case 'tea': ctx.fillStyle = '#d8cfbd'; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w * 0.32, 0, 7); ctx.fill(); ctx.fillStyle = '#7a4e26'; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w * 0.2, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(230,230,230,${0.15 + 0.1 * Math.sin(t * 2)})`; ctx.beginPath(); ctx.moveTo(x + w / 2, y + h * 0.3); ctx.quadraticCurveTo(x + w * 0.8, y - h * 0.2, x + w / 2, y - h * 0.6); ctx.stroke(); break;
    case 'counter':
      box(x, y, w, h, '#3b342d', '#4a423a');
      ctx.fillStyle = '#151210'; ctx.beginPath(); ctx.arc(x + TS * 0.55, y + h / 2, TS * 0.2, 0, 7); ctx.arc(x + TS * 1.2, y + h / 2, TS * 0.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b2a28'; ctx.fillRect(x + w - TS * 1.3, y + h * 0.2, TS * 0.9, h * 0.6); break;
    case 'plates': for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#cfc7b6' : '#ddd5c4'; ctx.beginPath(); ctx.arc(x + w * (0.12 + i * 0.152), y + h / 2, h * 0.36, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke(); } break;
    case 'cupboard': {
      box(x, y, w, h, '#3e2716', '#4f3420');
      if (o.open && o.open()) {
        ctx.fillStyle = '#0b0705'; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
        ctx.fillStyle = '#4f3420'; ctx.save(); ctx.translate(x, y + h); ctx.rotate(0.6); ctx.fillRect(0, 0, w / 2, 4); ctx.restore();
        ctx.save(); ctx.translate(x + w, y + h); ctx.rotate(-0.6); ctx.fillRect(-w / 2, 0, w / 2, 4); ctx.restore();
        if (o.id === 'gcup') { ctx.fillStyle = '#c9c0a8'; ctx.fillRect(x + w * 0.2, y + h * 0.3, w * 0.25, h * 0.4); ctx.fillRect(x + w * 0.55, y + h * 0.25, w * 0.2, h * 0.45); }
      } else { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x + w / 2 - 1, y + 3, 2, h - 6); ctx.fillStyle = '#9b7a3a'; ctx.fillRect(x + w / 2 - 5, y + h / 2, 3, 3); ctx.fillRect(x + w / 2 + 2, y + h / 2, 3, 3); }
      if (o.id === 'kcup' && !S.flags.news1) { ctx.fillStyle = '#cfc6ae'; ctx.save(); ctx.translate(x + w * 0.7, y - TS * 0.05); ctx.rotate(-0.2); ctx.fillRect(0, 0, TS * 0.35, TS * 0.12); ctx.restore(); }
      break; }
    case 'bed': case 'bed2': case 'bedSmall':
      box(x, y, w, h, '#3a2416');
      ctx.fillStyle = o.kind === 'bed2' ? '#6d665c' : o.kind === 'bedSmall' ? '#5b4a3c' : '#5f5144'; rr(ctx, x + 4, y + 4, w - 8, h - 8, 3); ctx.fill();
      ctx.fillStyle = '#b8ad98'; rr(ctx, x + w * 0.15, y + 6, w * 0.7, TS * 0.38, 4); ctx.fill();
      if (o.kind !== 'bed2') { ctx.fillStyle = o.kind === 'bedSmall' ? '#4a3a2e' : '#7a4038'; rr(ctx, x + 4, y + h * 0.4, w - 8, h * 0.56, 3); ctx.fill(); }
      break;
    case 'frame': ctx.fillStyle = '#8a6a33'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#2a2018'; ctx.fillRect(x + 3, y + 2, w - 6, h - 4); break;
    case 'shelf': box(x, y, w, h, '#3e2716', '#4f3420'); ctx.fillStyle = '#8a6a33'; ctx.fillRect(x + w * 0.2, y + h * 0.35, w * 0.6, h * 0.25); ctx.fillStyle = '#a58c62'; ctx.fillRect(x + w * 0.28, y + h * 0.38, w * 0.44, h * 0.19); break;
    case 'sofa': box(x, y, w, h, '#4a2a26', '#5a342e'); ctx.fillStyle = '#3d211e'; ctx.fillRect(x, y + h * 0.55, w, h * 0.45); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + w / 3, y + 4, 1, h * 0.5); ctx.fillRect(x + (2 * w) / 3, y + 4, 1, h * 0.5); break;
    case 'chest':
      box(x, y, w, h, '#4b2f17', '#5f3c1e');
      ctx.fillStyle = '#6b5a3a'; ctx.fillRect(x + w * 0.2, y, 3, h); ctx.fillRect(x + w * 0.8, y, 3, h);
      ctx.fillStyle = S.ch >= 5 ? '#a08040' : '#5b4630'; ctx.fillRect(x + w / 2 - 4, y + h * 0.4, 8, 6);
      if (S.ch >= 5) { ctx.fillStyle = '#0b0705'; ctx.fillRect(x + 3, y + 1, w - 6, 4); }
      break;
    case 'notebook': ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.15); ctx.fillStyle = '#e8e0cc'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#7b8db0'; for (let i = 1; i < 4; i++) ctx.fillRect(-w / 2 + 4, -h / 2 + (h * i) / 4, w - 8, 1); ctx.fillStyle = '#7a3a2a'; ctx.fillRect(-1, -h / 2, 2, h); ctx.restore(); break;
    case 'desk': box(x, y, w, h, '#4a301b', '#5e3e24'); ctx.fillStyle = '#d9cfb8'; ctx.save(); ctx.translate(x + w * 0.3, y + h * 0.5); ctx.rotate(0.2); ctx.fillRect(-TS * 0.2, -TS * 0.14, TS * 0.4, TS * 0.28); ctx.restore(); ctx.fillStyle = '#c23b2b'; ctx.fillRect(x + w * 0.65, y + h * 0.4, TS * 0.3, 3); ctx.fillStyle = '#2c58a8'; ctx.fillRect(x + w * 0.65, y + h * 0.55, TS * 0.28, 3); break;
    case 'clothes': { const c = ['#7a3a4a', '#3a5a7a', '#c8b48a']; ctx.fillStyle = '#2a1a10'; ctx.fillRect(x, y + h - 3, w, 3); c.forEach((col, i) => { ctx.fillStyle = col; rr(ctx, x + i * w / 3 + 3, y, w / 3 - 6, h - 4, 3); ctx.fill(); }); break; }
    case 'mirror': ctx.fillStyle = '#5d4a33'; ctx.fillRect(x, y, w, h); ctx.fillStyle = S.ch >= 6 ? '#202630' : '#cfc6b2'; ctx.fillRect(x + 3, y + 2, w - 6, h - 4); if (S.ch >= 6) { ctx.fillStyle = '#cfc6b2'; ctx.fillRect(x + w * 0.6, y + 2, w * 0.4 - 3, h - 4); } break;
    case 'boxes': box(x, y, w * 0.6, h * 0.55, '#6b5236', '#7d6242'); box(x + w * 0.3, y + h * 0.45, w * 0.7, h * 0.55, '#5e472e', '#6f5638'); break;
    case 'door':
      if (!S.upDoorOpen) { ctx.fillStyle = '#3f2717'; ctx.fillRect(x, y + h * 0.1, w, h * 0.8); ctx.fillStyle = '#c69a3e'; ctx.fillRect(x + w * 0.42, y + h * 0.45, w * 0.16, h * 0.14); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x, y + h * 0.1, w, 2); }
      else { ctx.fillStyle = '#3f2717'; ctx.fillRect(x + w - 5, y - h * 0.75, 5, h * 0.85); }
      break;
    case 'papers': for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(x + w * (0.17 + i * 0.33), y + h * 0.6); ctx.rotate((i - 1) * 0.12); ctx.fillStyle = '#e4dcc6'; ctx.fillRect(-TS * 0.3, -TS * 0.18, TS * 0.6, TS * 0.42); ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-TS * 0.18, TS * 0.12); ctx.lineTo(0, -TS * 0.06); ctx.lineTo(TS * 0.18, TS * 0.12); ctx.stroke(); ctx.fillStyle = '#c23b2b'; ctx.fillRect(-1.5, -TS * 0.18, 3, 3); ctx.restore(); } break;
    case 'bag': ctx.fillStyle = '#2f4a3a'; rr(ctx, x, y, w, h, 6); ctx.fill(); ctx.fillStyle = '#243a2d'; rr(ctx, x + 2, y + 2, w - 4, h * 0.45, 4); ctx.fill(); ctx.fillStyle = '#b09060'; ctx.fillRect(x + w / 2 - 2, y + h * 0.4, 4, 4); break;
    case 'toy': ctx.fillStyle = '#8a5a2a'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w * 0.4, h * 0.25, 0.3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x + w * 0.85, y + h * 0.25, w * 0.15, 0, 7); ctx.fill(); ctx.strokeStyle = '#6a4220'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w * 0.3, y + h * 0.6); ctx.lineTo(x + w * 0.25, y + h); ctx.moveTo(x + w * 0.6, y + h * 0.65); ctx.lineTo(x + w * 0.65, y + h); ctx.moveTo(x + w * 0.45, y + h * 0.65); ctx.lineTo(x + w * 0.45, y + h * 0.95); ctx.stroke(); break;
    case 'lal': if (o.vis()) lantern(x + w / 2, y + h / 2, TS, t); break;
  }
}
function drawPlayer(t) {
  const x = S.p.x * TS - cam.x, y = S.p.y * TS - cam.y, d = S.p.dir, s = TS;
  const bob = Math.sin(S.walkT * 10) * s * 0.02;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + s * 0.06, s * 0.28, s * 0.22, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y + bob); ctx.rotate(d + Math.PI / 2);
  ctx.fillStyle = '#2b333f'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.27, s * 0.16, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#232a34'; ctx.beginPath(); ctx.ellipse(-s * 0.22, s * 0.02, s * 0.07, s * 0.1, 0, 0, 7); ctx.ellipse(s * 0.22, s * 0.02, s * 0.07, s * 0.1, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#16100c'; ctx.beginPath(); ctx.arc(0, -s * 0.02, s * 0.13, 0, 7); ctx.fill();
  ctx.fillStyle = '#8a6a4c'; ctx.beginPath(); ctx.ellipse(0, -s * 0.13, s * 0.06, s * 0.03, 0, 0, 7); ctx.fill();
  ctx.restore();
  if (S.hasLalteen) { const lx = x + Math.cos(d + 0.9) * s * 0.33, ly = y + Math.sin(d + 0.9) * s * 0.33; lantern(lx, ly, s * 0.75, t); }
}
function drawFigure(t) {
  if (!S.figure || S.floor !== 'ground') return;
  const x = S.figure.x * TS - cam.x, y = S.figure.y * TS - cam.y, s = TS;
  ctx.save(); ctx.globalAlpha = 0.92;
  ctx.fillStyle = '#030202'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.2, s * 0.12, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y - s * 0.03 + Math.sin(t * 0.8) * 1, s * 0.1, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,120,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, s * 0.21, s * 0.13, 0, 0, 7); ctx.stroke();
  ctx.restore();
}
function lights(t) {
  const L = [], fl = 1 + Math.sin(t * 13) * 0.02 + Math.sin(t * 7.3) * 0.025 + (Math.random() - 0.5) * 0.02;
  if (S.hasLalteen) L.push({ x: S.p.x, y: S.p.y, r: 4.7 * fl, a: 1, warm: 1 });
  else L.push({ x: S.p.x, y: S.p.y, r: 1.8, a: 0.72 });
  if (S.lalteenAt && S.lalteenAt.f === S.floor) L.push({ x: S.lalteenAt.x, y: S.lalteenAt.y, r: 4.3 * fl, a: 1, warm: 1 });
  for (const [wx, wy, k] of WINDOWS[S.floor]) if (!k) L.push({ x: wx + 0.5, y: wy + 0.5, r: 1.5 + S.lightning * 6, a: 0.22 + S.lightning * 2 });
  return L;
}
function lightAt(px, py, L) { let m = 0; for (const l of L) { const d = Math.hypot(px - l.x, py - l.y); m = Math.max(m, (1 - d / l.r) * l.a); } return clamp(m, 0, 1); }

function render(t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const map = MAPS[S.floor], mw = map[0].length * TS, mh = map.length * TS;
  cam.x = mw <= W ? (mw - W) / 2 : clamp(S.p.x * TS - W / 2, -TS, mw - W + TS);
  cam.y = mh <= H ? (mh - H) / 2 : clamp(S.p.y * TS - H / 2, -TS * 1.5, mh - H + TS * 2);
  cam.x = Math.round(cam.x); cam.y = Math.round(cam.y);
  if (!floorCache[S.floor]) buildFloor(S.floor);
  ctx.drawImage(floorCache[S.floor], -cam.x, -cam.y, mw, mh);
  drawWindows(t);
  const zk = (o) => o.y + o.h + (o.kind === 'lal' ? 50 : 0);
  const objs = OBJ.filter((o) => o.f === S.floor).sort((a, b) => zk(a) - zk(b));
  for (const o of objs) if (o.kind === 'door' || isVis(o)) drawObj(o, t);
  drawPlayer(t);
  drawFigure(t);
  const L = lights(t);
  // warm glow
  ctx.globalCompositeOperation = 'lighter';
  for (const l of L) if (l.warm) { const X = l.x * TS - cam.x, Y = l.y * TS - cam.y, r = l.r * TS; const gr = ctx.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, 'rgba(255,150,60,.16)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = gr; ctx.fillRect(X - r, Y - r, r * 2, r * 2); }
  ctx.globalCompositeOperation = 'source-over';
  // darkness
  dctx.setTransform(DPR, 0, 0, DPR, 0, 0); dctx.globalCompositeOperation = 'source-over'; dctx.clearRect(0, 0, W, H);
  dctx.fillStyle = S.blackout > 0 ? '#000' : `rgba(3,2,4,${S.lightning > 0 ? 0.6 : 0.975})`; dctx.fillRect(0, 0, W, H);
  if (S.blackout <= 0) {
    dctx.globalCompositeOperation = 'destination-out';
    for (const l of L) { const X = l.x * TS - cam.x, Y = l.y * TS - cam.y, r = l.r * TS; const gr = dctx.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, `rgba(0,0,0,${l.a})`); gr.addColorStop(0.45, `rgba(0,0,0,${l.a * 0.78})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); dctx.fillStyle = gr; dctx.fillRect(X - r, Y - r, r * 2, r * 2); }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(darkC, 0, 0); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (S.blackout > 0 || S.ended) return;
  // glints on things worth examining
  for (const o of objs) {
    if (!o.act || !isVis(o)) continue;
    const want = !S.seen[o.id] || wanted(o);
    if (!want) continue;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2, lit = lightAt(cx, cy, L);
    if (lit < 0.08) continue;
    const X = cx * TS - cam.x, Y = cy * TS - cam.y, pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + cx);
    ctx.fillStyle = `rgba(255,214,150,${(wanted(o) ? 0.55 : 0.25) * pulse * Math.min(1, lit * 2)})`;
    ctx.beginPath(); ctx.arc(X, Y, 2.2 + pulse * 1.5, 0, 7); ctx.fill();
  }
  const n = S.busy ? null : nearest();
  if (n) {
    const X = (n.x + n.w / 2) * TS - cam.x, Y = n.y * TS - cam.y - 10;
    ctx.font = '600 15px "Cormorant Garamond", Georgia, serif'; ctx.textAlign = 'center';
    const label = (touchMode ? '' : 'E · ') + n.name, tw = ctx.measureText(label).width + 22;
    ctx.fillStyle = 'rgba(12,9,6,.78)'; rr(ctx, X - tw / 2, Y - 22, tw, 24, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(227,154,74,.45)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#e8dcc4'; ctx.fillText(label, X, Y - 5);
  }
  if (S.memory > 0) { ctx.fillStyle = `rgba(255,236,200,${S.memory * 0.4})`; ctx.fillRect(0, 0, W, H); }
}

/* ============================== MOVEMENT ============================== */
function nearest() {
  let best = null, bd = REACH;
  for (const o of OBJ) { if (o.f !== S.floor || !o.act || !isVis(o)) continue; const d = rectDist(S.p.x, S.p.y, o); if (d < bd) { bd = d; best = o; } }
  return best;
}
const REACH = 1.25; // how far away something can be and still be examined
function interact(o) { S.seen[o.id] = true; S.path = null; S.pendingObj = null; o.act(o); updateHUD(); }

const keys = {};
let touchMode = false;
function setTouch(on) { touchMode = on; document.body.classList.toggle('touch', on); }
try { if (matchMedia('(pointer: coarse)').matches) setTouch(true); } catch (e) {}
// phone controller: a floating stick. Touch anywhere in the lower-left of the screen and drag;
// the stick appears under the thumb and follows it. A quick tap there still works as tap-to-move.
S.joy = { x: 0, y: 0 };
const zone = $('#zone'), padStick = $('#stick'), knob = $('#knob');
let joyId = null, joyO = null, joyT0 = 0, joyMoved = false;
const JOY_MAX = 48;
function placeStick(x, y) { padStick.style.left = (x - 64) + 'px'; padStick.style.top = (y - 64) + 'px'; padStick.style.bottom = 'auto'; }
function joyMove(e) {
  let dx = e.clientX - joyO.x, dy = e.clientY - joyO.y, d = Math.hypot(dx, dy);
  if (d > 8) joyMoved = true;
  if (d > JOY_MAX) { // drag the base along so the thumb never runs off the stick
    const over = d - JOY_MAX; joyO.x += (dx / d) * over; joyO.y += (dy / d) * over; placeStick(joyO.x, joyO.y);
    dx = e.clientX - joyO.x; dy = e.clientY - joyO.y; d = JOY_MAX;
  }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  const mag = Math.min(1, d / (JOY_MAX * 0.7)); // full speed well before the edge
  S.joy.x = d ? (dx / d) * mag : 0; S.joy.y = d ? (dy / d) * mag : 0;
}
function joyEnd(e) {
  if (e.pointerId !== joyId) return;
  joyId = null; S.joy.x = S.joy.y = 0; knob.style.transform = '';
  padStick.classList.remove('active'); padStick.style.left = padStick.style.top = padStick.style.bottom = '';
  if (!joyMoved && performance.now() - joyT0 < 300 && e.type === 'pointerup') handleTap(e.clientX, e.clientY);
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
addEventListener('keydown', (e) => {
  if (!S.started) return;
  const k = e.key.toLowerCase();
  if (docEl.classList.contains('on')) { if (['e', ' ', 'enter', 'escape'].includes(k)) { e.preventDefault(); AU.paper(); showNextDoc(); } return; }
  if (choiceEl.classList.contains('on')) { if (k === 'escape') { choiceEl.classList.remove('on'); S.busy = false; } return; }
  if (S.ended) return;
  keys[k] = true; if (touchMode) setTouch(false);
  if (['e', ' ', 'enter'].includes(k)) { e.preventDefault(); if (!S.busy) { const n = nearest(); if (n) interact(n); } }
  if (k === 'm') $('#mute').textContent = AU.toggle() ? '♪' : '–';
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
cv.addEventListener('pointerdown', (e) => {
  if (!S.started || S.busy || S.ended) return;
  if (e.pointerType !== 'mouse' && !touchMode) setTouch(true);
  AU.init(); handleTap(e.clientX, e.clientY);
});
function handleTap(cx, cy) {
  if (!S.started || S.busy || S.ended) return;
  const wx = (cx + cam.x) / TS, wy = (cy + cam.y) / TS;
  let hit = null;
  for (const o of OBJ) { if (o.f !== S.floor || !o.act || !isVis(o)) continue; if (wx > o.x - 0.25 && wx < o.x + o.w + 0.25 && wy > o.y - 0.25 && wy < o.y + o.h + 0.25) { hit = o; break; } }
  if (hit) {
    if (rectDist(S.p.x, S.p.y, hit) < REACH) { interact(hit); return; }
    S.path = findPath((x, y) => rectDist(x + 0.5, y + 0.5, hit) < 0.9); S.pendingObj = S.path ? hit : null; return;
  }
  const gx = Math.floor(wx), gy = Math.floor(wy);
  S.pendingObj = null;
  S.path = blockedTile(S.floor, gx, gy) ? null : findPath((x, y) => x === gx && y === gy);
  if (S.path) S.path.push({ x: clamp(wx, gx + 0.3, gx + 0.7), y: clamp(wy, gy + 0.3, gy + 0.7) });
}
$('#act').addEventListener('pointerdown', (e) => { e.preventDefault(); AU.init(); if (S.busy) return; const n = nearest(); if (n) interact(n); });
$('#act').addEventListener('click', (e) => { if (e.pointerType) return; if (!S.busy) { const n = nearest(); if (n) interact(n); } });
$('#mute').addEventListener('click', () => { $('#mute').textContent = AU.toggle() ? '♪' : '–'; });

/* ============================== UPDATE LOOP ============================== */
let lastRoom = '';
function update(dt, t) {
  if (S.blackout > 0) S.blackout -= dt;
  if (S.lightning > 0) S.lightning -= dt;
  if (S.memory > 0) S.memory = Math.max(0, S.memory - dt * 0.35);
  updateToast(dt);
  if (!S.started || S.ended) return;
  // weather and the house
  S.nextThunder -= dt;
  if (S.nextThunder <= 0) { S.lightning = 0.14; setTimeout(() => AU.thunder(), 500 + Math.random() * 1600); S.nextThunder = 16 + Math.random() * 28; }
  if (S.ch >= 3) { S.nextCreak -= dt; if (S.nextCreak <= 0) { AU.creak(); S.nextCreak = 18 + Math.random() * 30; } }
  if (S.ch >= 4 && S.ch <= 6 && S.floor === 'ground') { S.nextSteps -= dt; if (S.nextSteps <= 0) { AU.stepsAbove(); S.nextSteps = 35 + Math.random() * 40; } }
  if (S.pendingAdvance && !S.busy && toastIdle()) { S.pendingAdvance = false; advance(); }
  if (S.busy) return;
  let mx = 0, my = 0;
  if (keys.a || keys.arrowleft) mx -= 1; if (keys.d || keys.arrowright) mx += 1;
  if (keys.w || keys.arrowup) my -= 1; if (keys.s || keys.arrowdown) my += 1;
  const jm = Math.hypot(S.joy.x, S.joy.y);
  if (!mx && !my && jm > 0.12) { mx = S.joy.x; my = S.joy.y; }
  const speed = 2.7;
  let moving = false;
  if (mx || my) {
    S.path = null; S.pendingObj = null;
    const l = Math.hypot(mx, my); S.p.dir = Math.atan2(my, mx);
    const k = Math.min(1, l) / l;
    moving = move(mx * k * speed * dt, my * k * speed * dt);
  } else if (S.path && S.path.length) {
    if (S.pendingObj && rectDist(S.p.x, S.p.y, S.pendingObj) < REACH - 0.1) { interact(S.pendingObj); return; }
    const wp = S.path[0], dx = wp.x - S.p.x, dy = wp.y - S.p.y, d = Math.hypot(dx, dy);
    if (d < 0.08) { S.path.shift(); if (!S.path.length && S.pendingObj) { const o = S.pendingObj; if (rectDist(S.p.x, S.p.y, o) < REACH) interact(o); S.pendingObj = null; } }
    else {
      S.p.dir = Math.atan2(dy, dx); const st = Math.min(d, speed * dt);
      moving = move((dx / d) * st, (dy / d) * st);
      if (!moving) { S.stuckT += dt; if (S.stuckT > 0.5) { S.path = null; S.stuckT = 0; } } else S.stuckT = 0;
    }
  }
  if (moving) { const before = Math.floor(S.walkT * 10 / Math.PI); S.walkT += dt; if (Math.floor(S.walkT * 10 / Math.PI) !== before) AU.step(); }
  const r = roomAt(S.floor, Math.floor(S.p.x), Math.floor(S.p.y)); const rn = r ? r.n : lastRoom;
  if (rn !== lastRoom) { lastRoom = rn; updateHUD(); }
  const n = nearest(); const act = $('#act');
  act.classList.toggle('ready', !!n);
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  update(dt, t);
  if (S.started) render(t);
  if (titleOn) { const tc = $('#tcv'), g = tc.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0); drawHouseExt(g, W, H, t, { glow: true, flash: titleFlash > 0 ? 1 : 0 }); if (titleFlash > 0) titleFlash -= dt; else if (Math.random() < dt / 12) titleFlash = 0.12; }
  if (endEl.classList.contains('on') && endDraw) { eg.setTransform(DPR, 0, 0, DPR, 0, 0); endDraw(eg, W, H, (now - endT0) / 1000); }
  requestAnimationFrame(loop);
}

/* ============================== START ============================== */
let titleOn = true, titleFlash = 0;
function intro() {
  openDocs([
    { t: 'card', text: ['You are Ankit. You are twenty-eight.', 'A parcel arrives from your younger sister, Nisha.'] },
    { t: 'photo', spec: PH.parcel, back: 'Do you remember who this is?', note: 'Grandfather. Your parents. Nisha and you, as children. And one more person, standing between you. You do not recognise them.' },
    { t: 'object', draw: drawKey, note: 'A small brass key.' },
    { ...D.news1, note: 'And a newspaper clipping.' },
    { t: 'card', text: ["You call Nisha. Her phone is switched off.", 'The family house has been mostly empty since Grandfather Bhim died.'] },
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
  S.started = true; document.body.classList.add('playing');
  const q = new URLSearchParams(location.search), jump = parseInt(q.get('chapter'), 10);
  if (jump >= 1 && jump <= 7) { debugJump(jump); showCard(jump); return; }
  intro();
});
addEventListener('resize', resize);
resize();
requestAnimationFrame(loop);
window.KHYAA = { S, OBJ, skipToasts: () => { toastQ.length = 0; toastT = 0; toastGap = 0; }, interact: (id) => { const o = OBJ.find((x) => x.id === id); if (o) interact(o); }, next: () => showNextDoc(), goto: (f, x, y) => { S.floor = f; S.p.x = x; S.p.y = y; } };
