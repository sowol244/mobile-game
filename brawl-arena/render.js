// Drawing only. Reads the match, never changes it.

import { BLUE, tileAt } from './game.js';
import { PAL, paintGround, drawRipples, drawObstacle, drawPerson } from './art.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const fx = { pops: [], sparks: [], shake: 0 };
  let W = 0, H = 0;
  const cam = { x: 0, y: 0, px: 40, ready: false };
  const walkPhase = new Map();
  let ground = null;

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
        fx.pops.push({ x: e.x + (Math.random() - 0.5) * 0.4, y: e.y - 1.15, t: 0.7, text: String(e.dmg), col: b.team === BLUE ? '#ffffff' : PAL.me });
        if (e.id === meId) fx.shake = Math.min(0.25, fx.shake + 0.08);
      } else if (e.type === 'spark') fx.sparks.push({ x: e.x, y: e.y, t: 0.18 });
      else if (e.type === 'kill') {
        for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2.5; fx.sparks.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.45, col: PAL.team[m.brawlers[e.id].team] }); }
      }
    }
    m.events.length = 0;
  }

  function draw(m, opts, dt) {
    const { meId = null, aim = null, input = null, focus = null } = opts;
    absorb(m, meId);
    cam.px = Math.max(30, Math.min(64, W / (opts.tilesAcross || 10)));
    const T = cam.px;
    // Camera: follow the focus (the player, or where they fell) and stay inside the map.
    const fx0 = focus ? focus.x : m.map.w / 2, fy0 = focus ? focus.y : m.map.h / 2;
    if (!cam.ready) { cam.x = fx0; cam.y = fy0; cam.ready = true; }
    cam.x += (fx0 - cam.x) * Math.min(1, dt * 8); cam.y += (fy0 - cam.y) * Math.min(1, dt * 8);
    const halfW = W / T / 2, halfH = H / T / 2;
    const cx = m.map.w / 2 > halfW ? Math.max(halfW - 1, Math.min(m.map.w - halfW + 1, cam.x)) : m.map.w / 2;
    const cy = m.map.h / 2 > halfH ? Math.max(halfH - 1, Math.min(m.map.h - halfH + 1, cam.y)) : m.map.h / 2;
    fx.shake = Math.max(0, fx.shake - dt);
    const sh = fx.shake * 18;
    const ox = W / 2 - cx * T + (Math.random() - 0.5) * sh, oy = H / 2 - cy * T + (Math.random() - 0.5) * sh;
    const sx = x => ox + x * T, sy = y => oy + y * T;

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
    for (const team of [0, 1]) for (const s of m.map.spawns[team]) {
      ctx.strokeStyle = team === BLUE ? 'rgba(63,182,255,0.55)' : 'rgba(255,82,103,0.55)'; ctx.lineWidth = 3;
      ctx.setLineDash([T * 0.12, T * 0.1]); ctx.beginPath(); ctx.ellipse(sx(s.x), sy(s.y), T * 0.5, T * 0.32, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }

    // Aim guide under everything that moves.
    const me = meId != null ? m.brawlers[meId] : null;
    if (me && me.alive && aim != null) {
      // The guide stops where the first wall would stop the bullets.
      let reach = me.def.attack.range;
      for (let d = me.r; d < reach; d += 0.1) {
        if (tileAt(m.map, Math.floor(me.x + Math.cos(aim) * d), Math.floor(me.y + Math.sin(aim) * d)) === '#') { reach = d; break; }
      }
      const len = reach * T;
      ctx.save(); ctx.translate(sx(me.x), sy(me.y)); ctx.rotate(aim);
      ctx.fillStyle = me.ammo >= 1 ? 'rgba(255,255,255,0.28)' : 'rgba(255,90,90,0.25)';
      ctx.fillRect(0, -T * 0.16, len, T * 0.32);
      ctx.restore();
    }

    // Walls and brawlers sorted by y so things lower on screen draw on top.
    const items = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (tileAt(m.map, x, y) === '#') items.push({ y: y + 1, wall: [x, y] });
    for (const b of m.brawlers) if (b.alive) items.push({ y: b.y + 0.05, b });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.wall) drawObstacle(ctx, m.map, it.wall[0], it.wall[1], sx, sy, T);
      else drawBrawler(it.b, it.b.id === meId);
    }
    // Map edge.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 4; ctx.strokeRect(sx(0), sy(0), m.map.w * T, m.map.h * T);

    for (const s of m.bullets) {
      const a = Math.atan2(s.vy, s.vx);
      ctx.save(); ctx.translate(sx(s.x), sy(s.y)); ctx.rotate(a);
      ctx.fillStyle = s.team === BLUE ? '#bff0ff' : '#ffd0d5';
      ctx.fillRect(-T * 0.28, -T * 0.06, T * 0.36, T * 0.12);
      ctx.fillStyle = s.team === BLUE ? PAL.team[0] : PAL.team[1];
      ctx.fillRect(-T * 0.08, -T * 0.08, T * 0.16, T * 0.16);
      ctx.restore();
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

    if (input) drawSticks(input);

    function drawBrawler(b, isMe) {
      const x = sx(b.x), y = sy(b.y), r = b.r * T;
      // Walking animation phase advances with actual speed.
      const w = walkPhase.get(b.id) || 0, speed = Math.hypot(b.vx, b.vy);
      walkPhase.set(b.id, speed > 0.3 ? w + dt * speed * 3.2 : 0);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.95, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = isMe ? PAL.me : PAL.team[b.team]; ctx.lineWidth = isMe ? 3 : 2;
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      const top = drawPerson(ctx, b, x, y, T, walkPhase.get(b.id), b.hurtFlash > 0);
      if (b.shieldT > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - T * 0.35, T * 0.42, T * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); }
      // Name, HP bar, ammo (mine only)
      const bw = T * 1.05, bh = Math.max(5, T * 0.13), by = top - T * 0.16;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = isMe ? '#5ee08a' : b.team === BLUE ? PAL.team[0] : PAL.team[1];
      ctx.fillRect(x - bw / 2, by, bw * Math.max(0, b.hp / b.maxHp), bh);
      ctx.font = `${Math.round(T * 0.3)}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      const label = `${b.name} ${Math.ceil(b.hp)}`;
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

  function drawSticks(st) {
    for (const s of [st.move, st.aim]) {
      if (!s) continue;
      const isAim = s === st.aim;
      ctx.lineWidth = 2;
      ctx.strokeStyle = isAim ? 'rgba(255,120,120,0.7)' : 'rgba(255,255,255,0.55)';
      ctx.fillStyle = isAim ? 'rgba(255,90,90,0.12)' : 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.arc(s.ox, s.oy, st.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = isAim ? 'rgba(255,110,110,0.85)' : 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(s.ox + s.x * st.radius, s.oy + s.y * st.radius, 22, 0, Math.PI * 2); ctx.fill();
    }
  }

  return { resize, draw, reset() { cam.ready = false; fx.pops.length = fx.sparks.length = 0; fx.shake = 0; } };
}
