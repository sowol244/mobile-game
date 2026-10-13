const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function roundRect(g, x, y, w, h, r, fill, stroke) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.stroke(); }
}

function road(g, w, h, offset) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#24392c'); bg.addColorStop(1, '#17261e');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const left = w * 0.17, rw = w * 0.66;
  for (let side = 0; side < 2; side++) {
    const x = side === 0 ? 0 : left + rw, sw = side === 0 ? left : w - x;
    g.fillStyle = side === 0 ? '#304a34' : '#293f31';
    g.fillRect(x, 0, sw, h);
    for (let i = 0; i < 7; i++) {
      const yy = ((i * 127 + offset * 0.46) % (h + 110)) - 70;
      const xx = x + sw * (0.2 + ((i * 37) % 60) / 100);
      g.fillStyle = i % 2 ? '#405d3e' : '#587044';
      g.beginPath(); g.arc(xx, yy, 13 + i % 3 * 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#263a2d'; g.fillRect(xx - 2, yy + 7, 4, 13);
    }
  }
  g.fillStyle = '#374348'; g.fillRect(left, 0, rw, h);
  g.fillStyle = '#53615d'; g.fillRect(left, 0, 4, h); g.fillRect(left + rw - 4, 0, 4, h);
  const shade = g.createLinearGradient(left, 0, left + rw, 0);
  shade.addColorStop(0, 'rgba(0,0,0,.16)'); shade.addColorStop(.5, 'rgba(255,255,255,.025)'); shade.addColorStop(1, 'rgba(0,0,0,.16)');
  g.fillStyle = shade; g.fillRect(left + 4, 0, rw - 8, h);
  g.setLineDash([26, 26]); g.lineDashOffset = -offset;
  g.strokeStyle = 'rgba(222,231,207,.19)'; g.lineWidth = 2;
  for (let lane = 1; lane < 3; lane++) {
    const x = left + rw * lane / 3;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
  }
  g.setLineDash([]);
  for (let i = 0; i < 5; i++) {
    const y = ((i * 167 + offset * .76) % (h + 100)) - 60;
    roundRect(g, left - 8, y, 8, 28, 3, '#d4bf79');
    roundRect(g, left + rw, y, 8, 28, 3, '#d4bf79');
  }
}

function zombie(g, z, time) {
  const colors = { walker: '#90ad69', runner: '#b3c878', brute: '#6e9873' };
  const r = z.r;
  g.save(); g.translate(z.x, z.y);
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(0, r * .95, r * .95, r * .32, 0, 0, Math.PI * 2); g.fill();
  const swing = Math.sin(time * 8 + z.phase) * 3;
  g.strokeStyle = colors[z.kind]; g.lineWidth = z.kind === 'brute' ? 6 : 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-5, 0); g.lineTo(-r - 3, 4 + swing); g.moveTo(5, 0); g.lineTo(r + 3, 4 - swing); g.stroke();
  roundRect(g, -r * .55, -r * .2, r * 1.1, r * 1.05, 5, colors[z.kind]);
  g.fillStyle = '#d3c993';
  g.beginPath(); g.arc(0, -r * .67, r * .48, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#762e2b';
  g.beginPath(); g.arc(-r * .18, -r * .7, 2, 0, Math.PI * 2); g.arc(r * .2, -r * .7, 2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#482c25'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(-3, -r * .48); g.lineTo(2, -r * .45); g.stroke();
  if (z.maxHp > 1) {
    roundRect(g, -r, -r - 7, r * 2, 4, 2, 'rgba(0,0,0,.5)');
    roundRect(g, -r, -r - 7, r * 2 * clamp(z.hp / z.maxHp, 0, 1), 4, 2, '#d7e790');
  }
  g.restore();
}

function survivor(g, x, y, scale, index, time) {
  g.save(); g.translate(x, y + Math.sin(time * 7 + index) * 1.3); g.scale(scale, scale);
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(0, 12, 10, 4, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#d9d4ad'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-4, 4); g.lineTo(-6, 11); g.moveTo(4, 4); g.lineTo(6, 11); g.stroke();
  roundRect(g, -7, -6, 14, 13, 5, index % 2 ? '#4e91a0' : '#d19b56');
  g.fillStyle = '#f0c8a1'; g.beginPath(); g.arc(0, -10, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#39402e'; g.beginPath(); g.arc(0, -12, 6, Math.PI, 0); g.fill();
  g.strokeStyle = '#354334'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(3, -2); g.lineTo(8, -14); g.stroke();
  g.strokeStyle = '#bdc8a0'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(7, -12); g.lineTo(8, -21); g.stroke();
  g.restore();
}

function boss(g, b, time) {
  g.save(); g.translate(b.x, b.y);
  g.fillStyle = 'rgba(0,0,0,.38)';
  g.beginPath(); g.ellipse(0, 34, 53, 15, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6e5142';
  g.beginPath(); g.moveTo(-35, -12); g.lineTo(-50, -45); g.lineTo(-19, -32); g.lineTo(0, -42); g.lineTo(19, -32); g.lineTo(50, -45); g.lineTo(35, -7); g.quadraticCurveTo(51, 31, 0, 40); g.quadraticCurveTo(-51, 31, -35, -12); g.fill();
  g.fillStyle = '#9a7258';
  g.beginPath(); g.ellipse(0, -2, 33, 31, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffcf6e';
  g.beginPath(); g.ellipse(-13, -8, 7, 4, -.12, 0, Math.PI * 2); g.ellipse(13, -8, 7, 4, .12, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#642c27'; g.beginPath(); g.ellipse(0, 16, 14, 8 + Math.sin(time * 3) * 1.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e3d1a1';
  for (let i = 0; i < 4; i++) g.fillRect(-9 + i * 6, 14, 3, 5);
  const bw = 94;
  roundRect(g, -bw / 2, -57, bw, 8, 4, 'rgba(0,0,0,.55)');
  roundRect(g, -bw / 2, -57, bw * clamp(b.hp / b.maxHp, 0, 1), 8, 4, '#ff7767');
  g.restore();
}

function gate(g, item, w) {
  const y = item.y, leftX = w * .34, rightX = w * .66;
  const drawOne = (x, option, good) => {
    const col = good ? '#8fe0a1' : '#ffd56a';
    g.save(); g.translate(x, y);
    g.shadowColor = col; g.shadowBlur = 13;
    roundRect(g, -43, -30, 86, 60, 14, 'rgba(12,26,18,.94)', col);
    g.shadowBlur = 0;
    g.fillStyle = col; g.font = '18px Jua, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(good ? '✚' : '⚡', 0, -12);
    g.font = '13px Jua, sans-serif'; g.fillStyle = '#f3f0dd';
    g.fillText(option.label, 0, 13);
    g.restore();
  };
  drawOne(leftX, item.left, true); drawOne(rightX, item.right, false);
}

function pickup(g, p, time) {
  const y = p.y + Math.sin(p.phase) * 3;
  g.save(); g.translate(p.x, y);
  g.shadowColor = '#9bf1b4'; g.shadowBlur = 15;
  g.fillStyle = '#78d99c'; g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0; g.fillStyle = '#1d4b39';
  g.beginPath(); g.arc(0, -3, 4.5, Math.PI, 0); g.fill();
  roundRect(g, -6, 1, 12, 8, 4, '#1d4b39');
  g.restore();
}

export function drawScene(ctx, s, w, h, now, title = false) {
  ctx.clearRect(0, 0, w, h);
  const offset = s ? s.roadOffset : (now * .045) % 120;
  road(ctx, w, h, offset);
  if (title || !s) {
    zombie(ctx, { x: w * .3, y: h * .31, r: 17, kind: 'walker', hp: 2, maxHp: 2, phase: 0 }, now / 1000);
    zombie(ctx, { x: w * .67, y: h * .43, r: 14, kind: 'runner', hp: 1, maxHp: 1, phase: 2 }, now / 1000);
    survivor(ctx, w * .43, h * .78, 1.05, 0, now / 1000);
    survivor(ctx, w * .5, h * .75, 1.08, 1, now / 1000);
    survivor(ctx, w * .57, h * .78, 1.05, 2, now / 1000);
    gate(ctx, { y: h * .57, left: { label: '+2 생존자' }, right: { label: '연사 +20%' } }, w);
    const vignette = ctx.createRadialGradient(w / 2, h * .45, h * .1, w / 2, h * .45, h * .85);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
    return;
  }
  for (const g of s.gates) gate(ctx, g, w);
  for (const p of s.pickups) pickup(ctx, p, now / 1000);
  for (const z of s.zombies) zombie(ctx, z, s.t);
  if (s.boss) boss(ctx, s.boss, s.t);
  for (const h0 of s.hazards) {
    ctx.fillStyle = 'rgba(255,114,90,.17)';
    ctx.beginPath(); ctx.ellipse(h0.x, h0.y, 20, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff786b'; ctx.beginPath(); ctx.arc(h0.x, h0.y, h0.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(h0.x - 3, h0.y - 3, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of s.bullets) {
    ctx.shadowColor = '#ffe18b'; ctx.shadowBlur = 8;
    roundRect(ctx, b.x - 2, b.y - 7, 4, 13, 2, '#ffe49c');
    ctx.shadowBlur = 0;
  }
  const visible = Math.min(s.squad, 9);
  for (let i = 0; i < visible; i++) {
    const row = Math.floor(i / 5), col = i % 5;
    const cols = Math.min(5, visible - row * 5);
    survivor(ctx, s.x + (col - (cols - 1) / 2) * 19, s.y + row * 18, i === 0 ? 1.08 : .88, i, s.t);
  }
  if (s.squad > visible) {
    ctx.font = '13px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f1edcf';
    ctx.fillText('+' + (s.squad - visible), s.x, s.y + 35);
  }
  if (s.invulnerable > 0) {
    ctx.strokeStyle = 'rgba(255,230,143,' + (.22 + Math.sin(s.t * 24) * .12) + ')';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x, s.y + 6, 28, 28, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (s.t < 3) {
    ctx.fillStyle = 'rgba(245,241,222,.75)';
    ctx.font = '14px Jua, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('좌우로 끌어 이동', w / 2, h - 26);
  }
  const vignette = ctx.createRadialGradient(w / 2, h * .45, h * .1, w / 2, h * .45, h * .85);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.3)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  if (s.flash > 0) { ctx.fillStyle = 'rgba(255,96,80,' + (s.flash * .5) + ')'; ctx.fillRect(0, 0, w, h); }
}
