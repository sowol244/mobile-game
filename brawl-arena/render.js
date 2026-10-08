// Drawing only. Reads the match, never changes it.

import { BLUE, tileAt, inBush, visibleTo, superReady, poisonInset } from './game.js';
import { PAL, paintGround, drawRipples, drawObstacle, drawBush, drawPerson } from './art.js';
import { stickLayout } from './input.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const fx = { pops: [], sparks: [], rings: [], shake: 0 };
  let W = 0, H = 0;
  const cam = { x: 0, y: 0, px: 40, ready: false };
  const walkPhase = new Map();
  let ground = null;
  // Colour side of a team as seen by the viewer: 0 = friend (blue), 1 = foe (red).
  let viewer = null;
  const side = team => (viewer == null ? (team === BLUE ? 0 : 1) : team === viewer ? 0 : 1);

  function resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w; H = h; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Turn match events into short-lived effects.
  function absorb(m, meId) {
    for (const e of m.events) {
      if (e.type === 'hit') {
        const b = m.brawlers[e.id];
        fx.pops.push({ x: e.x + (Math.random() - 0.5) * 0.4, y: e.y - 1.15, t: 0.7, text: String(e.dmg), col: side(b.team) === 0 ? '#ffffff' : PAL.me });
        if (e.id === meId) fx.shake = Math.min(0.25, fx.shake + 0.08);
      } else if (e.type === 'spark') fx.sparks.push({ x: e.x, y: e.y, t: 0.18 });
      else if (e.type === 'splash') fx.rings.push({ x: e.x, y: e.y, r: e.r, t: 0.35, max: 0.35, col: e.isSuper ? '#ff7a2e' : '#ffd36b' });
      else if (e.type === 'storm') fx.rings.push({ x: e.x, y: e.y, r: 1.4, t: 0.3, max: 0.3, col: '#fff3b0' });
      else if (e.type === 'super') fx.rings.push({ x: e.x, y: e.y, r: 0.9, t: 0.3, max: 0.3, col: '#ffe14d' });
      else if (e.type === 'boxbreak') { for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2; fx.sparks.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.5, col: '#c98d4e' }); } }
      else if (e.type === 'cube') fx.rings.push({ x: e.x, y: e.y, r: 0.7, t: 0.3, max: 0.3, col: '#7cf29a' });
      else if (e.type === 'kill') {
        for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2.5; fx.sparks.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.45, col: PAL.team[side(m.brawlers[e.id].team)] }); }
      }
    }
    m.events.length = 0;
  }

  function draw(m, opts, dt) {
    const { meId = null, aim = null, input = null, focus = null, viewTeam = null, marker = null } = opts;
    viewer = viewTeam;
    absorb(m, meId);
    cam.px = Math.max(30, Math.min(64, W / (opts.tilesAcross || 10)));
    const T = cam.px;
    // Camera: follow the focus (the player, or where they fell) and stay inside the map.
    const fx0 = focus ? focus.x : m.map.w / 2, fy0 = focus ? focus.y : m.map.h / 2;
    if (!cam.ready) { cam.x = fx0; cam.y = fy0; cam.ready = true; }
    cam.x += (fx0 - cam.x) * Math.min(1, dt * 8); cam.y += (fy0 - cam.y) * Math.min(1, dt * 8);
    const halfW = W / T / 2, halfH = H / T / 2;
    const cx = m.map.w / 2 > halfW ? Math.max(halfW - 1, Math.min(m.map.w - halfW + 1, cam.x)) : m.map.w / 2;
    // A little extra room below the map so the player at the bottom spawn isn't under the thumb controls.
    const cy = m.map.h / 2 > halfH ? Math.max(halfH - 1, Math.min(m.map.h - halfH + 5, cam.y)) : m.map.h / 2 + 1.5;
    fx.shake = Math.max(0, fx.shake - dt);
    const sh = fx.shake * 18;
    const ox = W / 2 - cx * T + (Math.random() - 0.5) * sh, oy = H / 2 - cy * T + (Math.random() - 0.5) * sh;
    const sx = x => ox + x * T, sy = y => oy + y * T;
    const drawGuide = (b, aim) => drawGuideImpl(m, b, aim, sx, sy, T);

    ctx.fillStyle = '#2f6b3a'; ctx.fillRect(0, 0, W, H);
    const x0 = Math.max(0, Math.floor(-ox / T)), x1 = Math.min(m.map.w - 1, Math.ceil((W - ox) / T));
    const y0 = Math.max(0, Math.floor(-oy / T) - 1), y1 = Math.min(m.map.h - 1, Math.ceil((H - oy) / T) + 1);
    // The ground is painted once per map and zoom, then just copied each frame.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!ground || ground.map !== m.map || ground.T !== T || ground.dpr !== dpr) ground = { map: m.map, T, dpr, img: paintGround(m.map, T, dpr) };
    ctx.drawImage(ground.img, ox, oy, m.map.w * T, m.map.h * T);
    // Outside the arena: a thick row of round treetops instead of an empty band.
    for (let y = Math.floor(-oy / T) - 1; y <= Math.ceil((H - oy) / T); y++) for (let x = Math.floor(-ox / T) - 1; x <= Math.ceil((W - ox) / T); x++) {
      if (x >= 0 && y >= 0 && x < m.map.w && y < m.map.h) continue;
      const k = ((x * 7 + y * 13) % 5 + 5) % 5;
      ctx.fillStyle = k < 2 ? '#2e7d3a' : k < 4 ? '#357f3f' : '#28703a';
      ctx.beginPath(); ctx.arc(sx(x + 0.5), sy(y + 0.5), T * (0.68 + k * 0.04), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(sx(x + 0.38), sy(y + 0.36), T * 0.28, 0, Math.PI * 2); ctx.fill();
    }
    drawRipples(ctx, m.map, m.t, sx, sy, T, x0, y0, x1, y1);
    // Spawn pads.
    if (m.mode !== 'survival') for (const team of [0, 1]) for (const s of m.map.spawns[team]) {
      ctx.strokeStyle = team === BLUE ? 'rgba(63,182,255,0.55)' : 'rgba(255,82,103,0.55)'; ctx.lineWidth = 3;
      ctx.setLineDash([T * 0.12, T * 0.1]); ctx.beginPath(); ctx.ellipse(sx(s.x), sy(s.y), T * 0.5, T * 0.32, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }

    // Fire zones from 짬뽕이's super.
    for (const z of m.zones) {
      ctx.fillStyle = 'rgba(255,110,30,0.28)'; ctx.beginPath(); ctx.ellipse(sx(z.x), sy(z.y), z.r * T, z.r * T * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2 + m.t, rr = z.r * (0.25 + 0.5 * ((k * 37) % 10) / 10);
        const fxp = sx(z.x + Math.cos(a) * rr), fyp = sy(z.y + Math.sin(a) * rr * 0.8), hgt = T * (0.25 + 0.12 * Math.sin(m.t * 12 + k));
        ctx.fillStyle = k % 2 ? '#ff9a2e' : '#ffd23f';
        ctx.beginPath(); ctx.moveTo(fxp - T * 0.1, fyp); ctx.quadraticCurveTo(fxp, fyp - hgt * 1.4, fxp + T * 0.1, fyp); ctx.fill();
      }
    }
    // Where lobbed bowls will land (a fair warning for everybody).
    for (const l of m.lobs) {
      ctx.strokeStyle = l.isSuper ? 'rgba(255,90,30,0.8)' : 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.ellipse(sx(l.tx), sy(l.ty), l.spec.blast * T, l.spec.blast * T * 0.8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    if (marker) {
      const pulse = 1 + Math.sin(m.t * 5) * 0.08;
      ctx.strokeStyle = PAL.me; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(sx(marker.x), sy(marker.y), T * 0.6 * pulse, T * 0.4 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = PAL.me; ctx.beginPath(); const ay = sy(marker.y) - T * (0.9 + Math.sin(m.t * 5) * 0.12);
      ctx.moveTo(sx(marker.x), ay + T * 0.3); ctx.lineTo(sx(marker.x) - T * 0.18, ay); ctx.lineTo(sx(marker.x) + T * 0.18, ay); ctx.fill();
    }

    // Power cubes lying around (survival).
    for (const it of m.items) {
      const bob = Math.sin(m.t * 4 + it.x) * T * 0.06;
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(sx(it.x), sy(it.y) + T * 0.1, T * 0.18, T * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      drawCube(ctx, sx(it.x), sy(it.y) - T * 0.2 + bob, T * 0.2);
    }

    // Aim guide under everything that moves.
    const me = meId != null ? m.brawlers[meId] : null;
    if (me && me.alive && aim) drawGuide(me, aim);

    // Walls and brawlers sorted by y so things lower on screen draw on top.
    const items = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (tileAt(m.map, x, y) === '#') items.push({ y: y + 1, wall: [x, y] });
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (tileAt(m.map, x, y) === '*') items.push({ y: y + 1, bush: [x, y] });
      else if (tileAt(m.map, x, y) === 'X') items.push({ y: y + 1, box: [x, y] });
    for (const b of m.brawlers) {
      if (!b.alive || (viewTeam != null && !visibleTo(m, viewTeam, b))) continue;
      // Someone in a bush is drawn over it, see-through, so the bush doesn't swallow them.
      const hidden = inBush(m.map, b.x, b.y);
      items.push({ y: hidden ? Math.floor(b.y) + 1.01 : b.y + 0.05, b, hidden });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.wall) drawObstacle(ctx, m.map, it.wall[0], it.wall[1], sx, sy, T);
      else if (it.bush) drawBush(ctx, m.map, it.bush[0], it.bush[1], sx, sy, T, m.t);
      else if (it.box) drawPowerBox(ctx, it.box[0], it.box[1], sx, sy, T, (m.boxHp.get(it.box[1] * m.map.w + it.box[0]) || 0) / m.boxMax);
      else {
        if (it.hidden) ctx.globalAlpha = 0.6;
        drawBrawler(it.b, it.b.id === meId);
        ctx.globalAlpha = 1;
      }
    }
    // Poison cloud: everything outside the safe square.
    const pin = poisonInset(m);
    if (pin > 0) {
      const L = sx(pin), Tt = sy(pin), R = sx(m.map.w - pin), B = sy(m.map.h - pin);
      ctx.fillStyle = 'rgba(60,170,70,0.5)';
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(L, Tt, R - L, B - Tt); ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(160,255,150,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([10, 6]); ctx.strokeRect(L, Tt, R - L, B - Tt); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(120,230,120,0.35)';
      for (let k = 0; k < 26; k++) {
        const t = m.t * 0.3 + k * 1.7, px = ((k * 97) % 100) / 100 * W, py = ((k * 57 + t * 8) % 100) / 100 * H;
        if (px > L && px < R && py > Tt && py < B) continue;
        ctx.beginPath(); ctx.arc(px, py, T * (0.3 + (k % 3) * 0.15), 0, Math.PI * 2); ctx.fill();
      }
    }
    // Map edge.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 4; ctx.strokeRect(sx(0), sy(0), m.map.w * T, m.map.h * T);

    for (const s of m.bullets) {
      const a = Math.atan2(s.vy, s.vx);
      ctx.save(); ctx.translate(sx(s.x), sy(s.y)); ctx.rotate(a);
      if (s.kind === 'arrow' || s.kind === 'pierce') {
        const big = s.kind === 'pierce' ? 1.8 : 1;
        if (big > 1) { ctx.fillStyle = 'rgba(160,220,255,0.45)'; ctx.beginPath(); ctx.ellipse(-T * 0.2, 0, T * 0.6, T * 0.18, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = '#6b4424'; ctx.lineWidth = Math.max(2, T * 0.05) * big;
        ctx.beginPath(); ctx.moveTo(-T * 0.4 * big, 0); ctx.lineTo(T * 0.12 * big, 0); ctx.stroke();
        ctx.fillStyle = '#dfe6f0'; ctx.beginPath(); ctx.moveTo(T * 0.25 * big, 0); ctx.lineTo(T * 0.1 * big, -T * 0.07 * big); ctx.lineTo(T * 0.1 * big, T * 0.07 * big); ctx.fill();
        ctx.fillStyle = PAL.team[side(s.team)]; ctx.fillRect(-T * 0.42 * big, -T * 0.06 * big, T * 0.1 * big, T * 0.12 * big);
      } else {
        ctx.fillStyle = s.isSuper ? '#fff3b0' : side(s.team) === 0 ? '#bff0ff' : '#ffd0d5';
        ctx.fillRect(-T * 0.28, -T * 0.06, T * 0.36, T * 0.12);
        ctx.fillStyle = s.isSuper ? '#ffb31a' : PAL.team[side(s.team)];
        ctx.fillRect(-T * 0.08, -T * 0.08, T * 0.16, T * 0.16);
      }
      ctx.restore();
    }
    // Bowls in flight: an arc with a shadow on the ground below.
    for (const l of m.lobs) {
      const k = l.t / l.dur, gx = l.sx + (l.tx - l.sx) * k, gy = l.sy + (l.ty - l.sy) * k, h = Math.sin(Math.PI * k) * (1.2 + 0.4 * Math.hypot(l.tx - l.sx, l.ty - l.sy) / 6);
      const sc = l.isSuper ? 1.5 : 1;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(sx(gx), sy(gy), T * 0.18 * sc, T * 0.08 * sc, 0, 0, Math.PI * 2); ctx.fill();
      const bx = sx(gx), by2 = sy(gy - h);
      ctx.fillStyle = '#d63a2f'; ctx.beginPath(); ctx.ellipse(bx, by2, T * 0.17 * sc, T * 0.13 * sc, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = l.isSuper ? '#ff7a2e' : '#ffcf5a'; ctx.beginPath(); ctx.ellipse(bx, by2, T * 0.16 * sc, T * 0.06 * sc, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = fx.rings.length - 1; i >= 0; i--) {
      const r = fx.rings[i]; r.t -= dt;
      if (r.t <= 0) { fx.rings.splice(i, 1); continue; }
      const k = 1 - r.t / r.max;
      ctx.globalAlpha = r.t / r.max; ctx.strokeStyle = r.col; ctx.lineWidth = Math.max(3, T * 0.12) * (1 - k * 0.6);
      ctx.beginPath(); ctx.ellipse(sx(r.x), sy(r.y), r.r * T * (0.4 + k * 0.6), r.r * T * 0.8 * (0.4 + k * 0.6), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (let i = fx.sparks.length - 1; i >= 0; i--) {
      const p = fx.sparks[i]; p.t -= dt;
      if (p.t <= 0) { fx.sparks.splice(i, 1); continue; }
      if (p.vx) { p.x += p.vx * dt; p.y += p.vy * dt; }
      ctx.fillStyle = p.col || '#fff3b0'; ctx.globalAlpha = Math.min(1, p.t * 5);
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), T * 0.09, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = fx.pops.length - 1; i >= 0; i--) {
      const p = fx.pops[i]; p.t -= dt; p.y -= dt * 1.2;
      if (p.t <= 0) { fx.pops.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.t * 3);
      ctx.font = `700 ${Math.round(T * 0.42)}px Jua, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(p.text, sx(p.x), sy(p.y));
      ctx.fillStyle = p.col; ctx.fillText(p.text, sx(p.x), sy(p.y));
    }
    ctx.globalAlpha = 1;

    if (input) drawSticks(input, me);

    function drawBrawler(b, isMe) {
      const x = sx(b.x), y = sy(b.y), r = b.r * T;
      // Walking animation phase advances with actual speed.
      const w = walkPhase.get(b.id) || 0, speed = Math.hypot(b.vx, b.vy);
      walkPhase.set(b.id, speed > 0.3 ? w + dt * speed * 3.2 : 0);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.95, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = isMe ? PAL.me : PAL.team[side(b.team)]; ctx.lineWidth = isMe ? 3 : 2;
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      const top = drawPerson(ctx, { ...b, team: side(b.team) }, x, y, T, walkPhase.get(b.id), b.hurtFlash > 0);
      if (b.shieldT > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - T * 0.35, T * 0.42, T * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); }
      // Name, HP bar, ammo (mine only)
      const bw = T * 1.05, bh = Math.max(5, T * 0.13), by = top - T * 0.16;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = isMe ? '#5ee08a' : PAL.team[side(b.team)];
      ctx.fillRect(x - bw / 2, by, bw * Math.max(0, b.hp / b.maxHp), bh);
      ctx.font = `${Math.round(T * 0.3)}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      const label = `${b.name} ${Math.ceil(b.hp)}${b.cubes ? ` ◆${b.cubes}` : ''}`;
      ctx.strokeText(label, x, by - 2); ctx.fillStyle = '#fff'; ctx.fillText(label, x, by - 2);
      if (isMe) {
        const n = b.def.ammo, gap = 2, sw = (bw - gap * (n - 1)) / n, ay = by + bh + 3, ah = Math.max(4, T * 0.1);
        for (let i = 0; i < n; i++) {
          const fill = i < Math.floor(b.ammo) ? 1 : i === Math.floor(b.ammo) ? b.reloadT / b.def.reload : 0;
          ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - bw / 2 + i * (sw + gap), ay, sw, ah);
          ctx.fillStyle = fill >= 1 ? '#ff9f1c' : '#a86a1a'; ctx.fillRect(x - bw / 2 + i * (sw + gap), ay, sw * fill, ah);
        }
      }
    }
  }

  function drawCube(c, x, y, s) {
    c.fillStyle = '#3fd36b'; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s, y - s * 0.45); c.lineTo(x, y + s * 0.1); c.lineTo(x - s, y - s * 0.45); c.closePath(); c.fill();
    c.fillStyle = '#25a14d'; c.beginPath(); c.moveTo(x - s, y - s * 0.45); c.lineTo(x, y + s * 0.1); c.lineTo(x, y + s); c.lineTo(x - s, y + s * 0.45); c.closePath(); c.fill();
    c.fillStyle = '#1c7d3b'; c.beginPath(); c.moveTo(x + s, y - s * 0.45); c.lineTo(x, y + s * 0.1); c.lineTo(x, y + s); c.lineTo(x + s, y + s * 0.45); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(x - s * 0.2, y - s * 0.55, s * 0.15, 0, Math.PI * 2); c.fill();
  }

  // Power box: a sturdy chest with a cube emblem, cracking as it takes damage.
  function drawPowerBox(c, x, y, sx, sy, T, hpFrac) {
    const px = sx(x), py = sy(y), L = T * 0.42, i = T * 0.06, s = T - i * 2;
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(px + i, py + T - 2, s, T * 0.14);
    c.fillStyle = '#6a4a8f'; c.fillRect(px + i, py + T - L - 2, s, L);
    c.fillStyle = '#9a74c9'; c.fillRect(px + i, py - L + i, s, T - i * 2);
    c.strokeStyle = '#f2c94c'; c.lineWidth = Math.max(2, T * 0.06);
    c.strokeRect(px + i * 1.5, py - L + i * 1.5, s - i, T - i * 3);
    drawCube(c, px + T / 2, py - L + T * 0.48, T * 0.17);
    if (hpFrac < 0.7) {
      c.strokeStyle = 'rgba(40,20,60,0.7)'; c.lineWidth = Math.max(1, T * 0.03);
      c.beginPath(); c.moveTo(px + T * 0.2, py - L + T * 0.2); c.lineTo(px + T * 0.35, py - L + T * 0.45); c.lineTo(px + T * 0.28, py - L + T * 0.7);
      if (hpFrac < 0.35) { c.moveTo(px + T * 0.8, py - L + T * 0.25); c.lineTo(px + T * 0.65, py - L + T * 0.5); c.lineTo(px + T * 0.75, py - L + T * 0.75); }
      c.stroke();
    }
  }

  // Aim preview while a stick is held: a lane for shots, a landing circle for lobs, a dash arrow for 교행이's super.
  function drawGuideImpl(m, me, aim, sx, sy, T) {
    const spec = aim.type === 'super' ? me.def.super : me.def.attack;
    const col = aim.type === 'super' ? 'rgba(255,214,60,0.45)' : me.ammo >= 1 ? 'rgba(255,255,255,0.3)' : 'rgba(255,90,90,0.28)';
    const cx = sx(me.x), cy = sy(me.y);
    if (spec.type === 'lob' || spec.type === 'firebomb') {
      const d = Math.max(1, spec.range * aim.f), tx = me.x + Math.cos(aim.a) * d, ty = me.y + Math.sin(aim.a) * d;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo((cx + sx(tx)) / 2, (cy + sy(ty)) / 2 - T * 1.5, sx(tx), sy(ty)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(sx(tx), sy(ty), spec.blast * T, spec.blast * T * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (spec.type === 'storm') {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(aim.a);
      ctx.fillStyle = col; ctx.fillRect(0, -T * 0.25, spec.dash * T, T * 0.5); ctx.restore();
      const ex = me.x + Math.cos(aim.a) * spec.dash, ey = me.y + Math.sin(aim.a) * spec.dash;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx(ex), sy(ey), spec.range * T, 0, Math.PI * 2); ctx.stroke();
      return;
    }
    // Straight shots stop at the first wall, except the piercing super.
    let reach = spec.range;
    if (spec.type !== 'pierce') for (let d = me.r; d < reach; d += 0.1) {
      if (tileAt(m.map, Math.floor(me.x + Math.cos(aim.a) * d), Math.floor(me.y + Math.sin(aim.a) * d)) === '#') { reach = d; break; }
    }
    const wdt = spec.type === 'pierce' ? 0.5 : 0.32;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(aim.a);
    ctx.fillStyle = col; ctx.fillRect(0, -T * wdt / 2, reach * T, T * wdt);
    ctx.restore();
  }

  function drawSticks(st, me) {
    const L = stickLayout(W, H);
    // Resting spots: faint, so they show where to put the thumbs without hiding the arena.
    const ghost = (x, y, r, icon, on) => {
      ctx.fillStyle = on ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.13)';
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `${Math.round(r * 0.36)}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icon, x, y + 1);
    };
    if (!st.move) ghost(L.move.x, L.move.y, L.radius, '이동', false);
    if (!st.aim || st.aim.type !== 'fire') ghost(L.attack.x, L.attack.y, L.radius, '공격', false);
    // ★ button with the charge filling around it.
    if (me) {
      const S = L.super, ready = superReady(me);
      ctx.fillStyle = ready ? 'rgba(255,200,40,0.9)' : 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(S.x, S.y, S.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(S.x, S.y, S.r + 3, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = ready ? '#fff6c2' : '#ffc93c'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(S.x, S.y, S.r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, me.charge)); ctx.stroke();
      ctx.fillStyle = ready ? '#5a3a00' : 'rgba(255,255,255,0.55)'; ctx.font = `${Math.round(S.r * 1.1)}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★', S.x, S.y + 1);
      if (ready) { ctx.globalAlpha = 0.4 + 0.3 * Math.sin(performance.now() / 150); ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(S.x, S.y, S.r + 9, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    for (const s of [st.move, st.aim]) {
      if (!s) continue;
      const isAim = s === st.aim, isSuper = isAim && s.type === 'super';
      ctx.lineWidth = 2;
      ctx.strokeStyle = isSuper ? 'rgba(255,214,60,0.8)' : isAim ? 'rgba(255,120,120,0.7)' : 'rgba(255,255,255,0.55)';
      ctx.fillStyle = isSuper ? 'rgba(255,214,60,0.15)' : isAim ? 'rgba(255,90,90,0.12)' : 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.arc(s.ox, s.oy, st.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = isSuper ? 'rgba(255,214,60,0.95)' : isAim ? 'rgba(255,110,110,0.85)' : 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(s.ox + s.x * st.radius, s.oy + s.y * st.radius, 22, 0, Math.PI * 2); ctx.fill();
    }
  }

  return { resize, draw, reset() { cam.ready = false; fx.pops.length = fx.sparks.length = 0; fx.shake = 0; } };
}
