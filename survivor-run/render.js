import { roadHalfWidth, laneX } from './game.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function roundRect(g, x, y, w, h, r, fill, stroke, lineWidth = 1) {
  r = Math.min(r, w * 0.5, h * 0.5);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = lineWidth; g.strokeStyle = stroke; g.stroke(); }
}

function polygon(g, points, fill, stroke) {
  g.beginPath();
  g.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.stroke(); }
}

function tree(g, x, y, scale, variant) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.fillStyle = 'rgba(15,27,21,.3)';
  g.beginPath(); g.ellipse(0, 3, 24, 7, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4f4030'; g.fillRect(-4, -20, 8, 24);
  const colors = variant % 2 ? ['#516c42', '#728b50', '#3f5b3b'] : ['#647c48', '#869658', '#536d3d'];
  polygon(g, [[0, -72], [-28, -24], [-13, -28], [-34, -2], [34, -2], [14, -29], [29, -25]], colors[0]);
  polygon(g, [[0, -65], [-14, -34], [0, -37], [-21, -8], [22, -8], [6, -36], [18, -33]], colors[1]);
  polygon(g, [[-30, -4], [0, -31], [31, -4], [0, -13]], colors[2]);
  g.restore();
}

function wreck(g, x, y, scale) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.rotate(-0.08);
  g.fillStyle = 'rgba(0,0,0,.34)';
  g.beginPath(); g.ellipse(0, 12, 38, 10, 0, 0, Math.PI * 2); g.fill();
  roundRect(g, -34, -17, 68, 31, 9, '#58717a', '#26343a', 3);
  polygon(g, [[-20, -17], [-11, -33], [13, -33], [24, -17]], '#344c54', '#26343a');
  polygon(g, [[-9, -29], [10, -29], [17, -18], [-15, -18]], '#99b2b1');
  roundRect(g, -35, -7, 10, 14, 4, '#22292a');
  roundRect(g, 24, -7, 10, 14, 4, '#22292a');
  roundRect(g, -31, 3, 11, 9, 3, '#252a2a');
  roundRect(g, 20, 3, 11, 9, 3, '#252a2a');
  g.fillStyle = '#e59c51';
  g.fillRect(-31, -9, 6, 5); g.fillRect(25, -9, 6, 5);
  g.strokeStyle = '#9ba7a1'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-24, -2); g.lineTo(-8, 3); g.lineTo(3, -1); g.stroke();
  g.restore();
}

function drawRoad(g, w, h, offset) {
  const horizon = h * 0.13;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#8ea995'); sky.addColorStop(0.23, '#687b62'); sky.addColorStop(0.48, '#364839'); sky.addColorStop(1, '#1e2926');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);

  polygon(g, [[0, horizon + 38], [w * 0.18, horizon - 4], [w * 0.34, horizon + 29], [w * 0.5, horizon - 12], [w * 0.69, horizon + 20], [w * 0.87, horizon - 9], [w, horizon + 34], [w, h], [0, h]], '#4a6545');
  polygon(g, [[0, horizon + 24], [w * 0.22, horizon + 10], [w * 0.44, horizon + 33], [w * 0.66, horizon + 4], [w, horizon + 30], [w, h], [0, h]], '#596d48');

  for (let i = 0; i < 9; i++) {
    const depth = ((i / 9 + offset * 0.74) % 1);
    const y = horizon + depth * (h - horizon);
    const half = roadHalfWidth(w, h, y);
    const scale = 0.23 + depth * 0.78;
    tree(g, w * 0.5 - half - w * (0.055 + depth * 0.045), y, scale, i);
    tree(g, w * 0.5 + half + w * (0.055 + depth * 0.045), y + 9 * scale, scale, i + 1);
  }

  const yProp = horizon + (((0.29 + offset * 0.44) % 1) * (h - horizon));
  const propScale = 0.28 + clamp((yProp - horizon) / (h - horizon), 0, 1) * 0.55;
  wreck(g, w * 0.5 - roadHalfWidth(w, h, yProp) - 35 * propScale, yProp, propScale);

  const topHalf = roadHalfWidth(w, h, horizon);
  const bottomHalf = roadHalfWidth(w, h, h);
  polygon(g, [[w / 2 - topHalf - 8, horizon], [w / 2 + topHalf + 8, horizon], [w / 2 + bottomHalf + 10, h], [w / 2 - bottomHalf - 10, h]], '#847b5f');
  polygon(g, [[w / 2 - topHalf, horizon], [w / 2 + topHalf, horizon], [w / 2 + bottomHalf, h], [w / 2 - bottomHalf, h]], '#424a4d');
  const asphalt = g.createLinearGradient(w / 2, horizon, w / 2, h);
  asphalt.addColorStop(0, '#626b6b'); asphalt.addColorStop(0.38, '#4e5759'); asphalt.addColorStop(1, '#353d41');
  polygon(g, [[w / 2 - topHalf + 2, horizon], [w / 2 + topHalf - 2, horizon], [w / 2 + bottomHalf - 3, h], [w / 2 - bottomHalf + 3, h]], asphalt);

  for (const side of [-1, 1]) {
    const x1 = w / 2 + side * (topHalf - 2);
    const x2 = w / 2 + side * (bottomHalf - 4);
    g.strokeStyle = 'rgba(237,226,188,.75)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x1, horizon); g.lineTo(x2, h); g.stroke();
    g.strokeStyle = 'rgba(19,26,27,.3)';
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(x1 + side * 4, horizon); g.lineTo(x2 + side * 6, h); g.stroke();
  }

  for (let lane = 1; lane <= 2; lane++) {
    for (let i = 0; i < 9; i++) {
      const depth = ((i / 9 + offset) % 1);
      const y = horizon + depth * (h - horizon);
      const half = roadHalfWidth(w, h, y);
      const x = w / 2 + (lane - 1.5) * half * 0.385;
      const dashH = 3 + depth * 20;
      g.fillStyle = 'rgba(231,225,198,' + (0.18 + depth * 0.53) + ')';
      roundRect(g, x - (1 + depth * 1.3), y, 2 + depth * 2.6, dashH, 1, g.fillStyle);
    }
  }

  for (let i = 0; i < 12; i++) {
    const depth = ((i / 12 + offset * 1.45) % 1);
    const y = horizon + depth * (h - horizon);
    const half = roadHalfWidth(w, h, y);
    const size = 1.5 + depth * 4;
    g.fillStyle = 'rgba(223,214,183,' + (0.14 + depth * 0.28) + ')';
    g.beginPath(); g.arc(w / 2 - half - size * 2, y, size, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w / 2 + half + size * 2, y, size, 0, Math.PI * 2); g.fill();
  }

  g.fillStyle = 'rgba(255,228,168,.035)';
  g.fillRect(w * 0.39, horizon, w * 0.22, h - horizon);
}

function depthScale(h, y) {
  const depth = clamp((y - h * 0.13) / (h * 0.82), 0, 1);
  return 0.48 + depth * 0.72;
}

function drawBarrel(g, barrel, w, h, time) {
  const scale = Math.max(0.58, depthScale(h, barrel.y));
  const bh = 62 * scale;
  const colors = barrel.kind === 'weapon'
    ? ['#a9e5ff', '#248cdb', '#073d75']
    : barrel.kind === 'upgrade'
      ? ['#ffc2ff', '#a546df', '#55217d']
      : ['#ffe17e', '#ed492e', '#85221d'];
  const glow = barrel.kind === 'weapon' ? '#62c9ff' : barrel.kind === 'upgrade' ? '#df75ff' : '#ff6544';
  const tag = barrel.kind === 'weapon' ? 'SMG' : barrel.kind === 'upgrade' ? '화력 강화' : '폭발물';
  g.save();
  g.translate(barrel.x, barrel.y);
  g.scale(scale, scale);
  g.fillStyle = 'rgba(8,12,12,.54)';
  g.beginPath(); g.ellipse(2, 9, 33, 11, 0, 0, Math.PI * 2); g.fill();
  g.shadowColor = glow; g.shadowBlur = 15 + Math.sin(time * 5 + barrel.lane) * 3;
  g.strokeStyle = glow; g.lineWidth = 2.2;
  g.beginPath(); g.ellipse(0, 6, 29, 8, 0, 0, Math.PI * 2); g.stroke();
  g.shadowBlur = 0;
  const body = g.createLinearGradient(-24, 0, 26, 0);
  body.addColorStop(0, colors[2]); body.addColorStop(0.22, colors[1]); body.addColorStop(0.52, colors[0]); body.addColorStop(0.78, colors[1]); body.addColorStop(1, colors[2]);
  roundRect(g, -23, -27, 46, 56, 8, body, '#172022', 3);
  g.strokeStyle = 'rgba(255,255,255,.84)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(-19, -24); g.lineTo(-19, 25); g.moveTo(19, -24); g.lineTo(19, 25); g.stroke();
  g.fillStyle = colors[1];
  g.beginPath(); g.ellipse(0, -26, 23, 7, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#fff0ce'; g.lineWidth = 3;
  g.beginPath(); g.ellipse(0, -26, 21, 6, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,242,220,.85)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-23, -8); g.lineTo(23, -8); g.moveTo(-23, 15); g.lineTo(23, 15); g.stroke();
  g.fillStyle = 'rgba(18,25,25,.72)';
  roundRect(g, -17, -3, 34, 24, 5, g.fillStyle, 'rgba(255,255,255,.46)', 1);
  g.fillStyle = '#fff9e8'; g.font = '900 17px "Black Han Sans", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 3;
  g.fillText(String(Math.max(0, Math.ceil(barrel.hp))), 0, 8);
  g.shadowBlur = 0;
  g.restore();

  const badgeY = barrel.y - bh * 0.62 - 13;
  const pulse = 0.55 + Math.sin(time * 6 + barrel.lane) * 0.12;
  g.save();
  g.shadowColor = glow; g.shadowBlur = 9;
  roundRect(g, barrel.x - 29, badgeY - 11, 58, 17, 7, 'rgba(14,20,20,.91)', glow, 1.5);
  g.shadowBlur = 0;
  g.globalAlpha = pulse;
  g.fillStyle = '#fff7dc'; g.font = 'bold 10px Jua, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(tag, barrel.x, badgeY - 2.5);
  roundRect(g, barrel.x - 25, badgeY + 8, 50, 22, 8, glow, '#fff5db', 1.5);
  g.globalAlpha = 1;
  g.fillStyle = '#101718'; g.font = '900 14px "Black Han Sans", sans-serif';
  g.fillText(String(Math.max(0, Math.ceil(barrel.hp))), barrel.x, badgeY + 19);
  g.restore();
}

function drawFootstepDust(g, x, y, scale, phase, color) {
  const step = (Math.sin(phase) + 1) * 0.5;
  g.save();
  g.globalAlpha = 0.12 + step * 0.18;
  g.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    const side = i % 2 ? -1 : 1;
    const drift = (i + 1) * scale * 6 + step * scale * 5;
    const rise = (i + 1) * scale * 2 + step * scale * 3;
    g.beginPath();
    g.ellipse(x - side * drift, y + 3 - rise, (2 + i * 1.1) * scale, (1.4 + i * 0.5) * scale, -side * 0.2, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function drawSprite(g, image, x, y, width, height, bob, rotation, alpha) {
  g.save();
  g.translate(x, y);
  g.rotate(rotation || 0);
  g.globalAlpha = alpha == null ? 1 : alpha;
  g.fillStyle = 'rgba(8,13,14,.3)';
  g.beginPath(); g.ellipse(0, 3, width * 0.39, width * 0.12, 0, 0, Math.PI * 2); g.fill();
  if (image && image.complete && image.naturalWidth) {
    g.shadowColor = 'rgba(3,8,7,.88)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 3;
    g.drawImage(image, -width / 2, -height + (bob || 0), width, height);
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;
  } else {
    g.fillStyle = '#7d9767';
    g.beginPath(); g.ellipse(0, -height * 0.52, width * 0.3, height * 0.45, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2ca63';
    g.beginPath(); g.arc(-width * 0.08, -height * 0.68, width * 0.035, 0, Math.PI * 2); g.arc(width * 0.08, -height * 0.68, width * 0.035, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function drawZombie(g, zombie, h, time, assets) {
  const scale = depthScale(h, zombie.y);
  const height = (zombie.kind === 'runner' ? 56 : 60) * scale;
  const width = height * 0.82;
  const dying = zombie.dead ? clamp(zombie.dying / 0.28, 0, 1) : 1;
  const runner = zombie.kind === 'runner';
  const stride = time * (runner ? 13 : 8) + zombie.phase;
  const bob = zombie.dead ? 0 : Math.abs(Math.sin(stride)) * (runner ? 5 : 2.5);
  const rotation = zombie.dead ? (1 - dying) * 1.3 * (zombie.phase % 2 ? -1 : 1) : Math.sin(stride) * (runner ? 0.075 : 0.045);
  const runningPose = Math.sin(stride) > 0;
  const image = runner
    ? (runningPose && assets.runnerRun ? assets.runnerRun : assets.runner)
    : (runningPose && assets.walkerRun ? assets.walkerRun : assets.walker);
  if (!zombie.dead) drawFootstepDust(g, zombie.x, zombie.y, scale, stride, runner ? '#d4c29b' : '#9daf8d');
  drawSprite(g, image, zombie.x, zombie.y + bob, width, height, 0, rotation, dying);
  if (!zombie.dead && zombie.hp < zombie.maxHp) {
    const barW = 30 * scale;
    roundRect(g, zombie.x - barW / 2, zombie.y - height - 5, barW, 5 * scale, 2, 'rgba(10,15,14,.9)', 'rgba(255,255,255,.6)');
    roundRect(g, zombie.x - barW / 2, zombie.y - height - 5, barW * clamp(zombie.hp / zombie.maxHp, 0, 1), 5 * scale, 2, '#ffca61');
  }
}

function drawBoss(g, boss, w, h, time, assets) {
  const size = 164;
  if (boss.warning > 0) {
    const x = laneX(w, h, h * 0.7, boss.attackLane);
    const half = roadHalfWidth(w, h, h * 0.7) * 0.18;
    g.fillStyle = 'rgba(255,58,45,' + (0.19 + Math.sin(time * 18) * 0.08) + ')';
    polygon(g, [[x - half, h * 0.56], [x + half, h * 0.56], [x + half * 1.3, h * 0.77], [x - half * 1.3, h * 0.77]], g.fillStyle);
  }
  drawSprite(g, assets.brute, boss.x, boss.y + 38, size, size * 1.05, Math.sin(time * 4) * 2, Math.sin(time * 1.8) * 0.035, 1);
  const bw = 122, by = boss.y - 28;
  roundRect(g, boss.x - bw / 2, by, bw, 10, 5, 'rgba(14,18,18,.8)', 'rgba(255,255,255,.2)');
  roundRect(g, boss.x - bw / 2 + 2, by + 2, (bw - 4) * clamp(boss.hp / boss.maxHp, 0, 1), 6, 4, '#f05b48');
  g.fillStyle = '#fff4df'; g.font = '12px Jua, sans-serif'; g.textAlign = 'center';
  g.fillText('대형 변이체', boss.x, by - 5);
}

function drawPlayer(g, s, time, assets) {
  if (s.invulnerable > 0 && Math.floor(time * 18) % 2 === 0) return;
  const h = 104, w = 86;
  const stride = time * 12;
  const bob = Math.abs(Math.sin(stride)) * 3.5;
  drawFootstepDust(g, s.x, s.y + 16, 1.05, stride, '#c8b898');
  const image = Math.sin(stride) > 0 && assets.playerRun ? assets.playerRun : assets.player;
  drawSprite(g, image, s.x, s.y + 17 + bob, w, h, 0, Math.sin(stride) * 0.035, 1);
}

function drawBullet(g, bullet) {
  g.save();
  g.translate(bullet.x, bullet.y);
  g.rotate(Math.atan2(bullet.vy, bullet.vx) - Math.PI / 2);
  g.shadowColor = bullet.weapon === 'smg' ? '#ffc75c' : '#f7f0c4';
  g.shadowBlur = 10;
  const grad = g.createLinearGradient(0, -10, 0, 9);
  grad.addColorStop(0, '#fffce9'); grad.addColorStop(0.5, bullet.weapon === 'smg' ? '#ffb544' : '#f2d878'); grad.addColorStop(1, 'rgba(255,133,51,0)');
  roundRect(g, -2, -10, 4, 17, 2, grad);
  g.restore();
}

function drawHazard(g, hazard, time) {
  g.save();
  g.translate(hazard.x, hazard.y);
  g.shadowColor = '#ff392d'; g.shadowBlur = 18;
  g.fillStyle = '#f34f42';
  g.beginPath(); g.arc(0, 0, hazard.radius, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#ffe0a2';
  g.beginPath(); g.arc(-4, -4, hazard.radius * 0.28, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,92,63,.5)'; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, hazard.radius + 5 + Math.sin(time * 10) * 2, 0, Math.PI * 2); g.stroke();
  g.restore();
}

function drawExplosion(g, effect) {
  const p = 1 - effect.life / effect.total;
  const radius = 10 + p * effect.radius * 0.44;
  g.save();
  g.globalAlpha = 1 - p;
  g.strokeStyle = '#ffb947'; g.lineWidth = 6 * (1 - p) + 1;
  g.beginPath(); g.arc(effect.x, effect.y, radius, 0, Math.PI * 2); g.stroke();
  const flame = g.createRadialGradient(effect.x, effect.y, 2, effect.x, effect.y, radius * 0.75);
  flame.addColorStop(0, 'rgba(255,247,166,.95)'); flame.addColorStop(0.35, 'rgba(255,154,51,.75)'); flame.addColorStop(1, 'rgba(229,55,30,0)');
  g.fillStyle = flame; g.beginPath(); g.arc(effect.x, effect.y, radius * 0.78, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawTitleScene(g, w, h, time, assets) {
  drawRoad(g, w, h, (time * 0.00008) % 1);
  drawZombie(g, { kind: 'walker', x: w * 0.42, y: h * 0.34, radius: 14, hp: 20, maxHp: 20, phase: 1 }, h, time / 1000, assets);
  drawZombie(g, { kind: 'runner', x: w * 0.66, y: h * 0.48, radius: 14, hp: 15, maxHp: 15, phase: 2 }, h, time / 1000, assets);
  drawBarrel(g, { kind: 'weapon', x: w * 0.32, y: h * 0.59, hp: 60 }, w, h, time / 1000);
  drawBarrel(g, { kind: 'explosive', x: w * 0.72, y: h * 0.62, hp: 30 }, w, h, time / 1000);
  const runPhase = time / 1000 * 12;
  drawFootstepDust(g, w * 0.5, h * 0.88, 1, runPhase, '#c8b898');
  const runningPose = Math.sin(runPhase) > 0;
  const playerImage = runningPose && assets.playerRun ? assets.playerRun : assets.player;
  drawSprite(g, playerImage, w * 0.5, h * 0.88 + Math.abs(Math.sin(runPhase)) * 3, 95, 116, 0, Math.sin(runPhase) * 0.035, 1);
  const shade = g.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(12,21,20,.07)');
  shade.addColorStop(0.45, 'rgba(10,17,17,.2)');
  shade.addColorStop(1, 'rgba(8,13,14,.75)');
  g.fillStyle = shade; g.fillRect(0, 0, w, h);
}

export function drawScene(ctx, s, w, h, now, title, assets) {
  ctx.clearRect(0, 0, w, h);
  const offset = s ? s.roadOffset : (now * 0.00008) % 1;
  if (title || !s) {
    drawTitleScene(ctx, w, h, now, assets || {});
    return;
  }
  drawRoad(ctx, w, h, offset);
  const time = s.t;
  const objects = [];
  for (const barrel of s.barrels) objects.push({ y: barrel.y, kind: 'barrel', item: barrel });
  for (const zombie of s.zombies) objects.push({ y: zombie.y, kind: 'zombie', item: zombie });
  if (s.boss) objects.push({ y: s.boss.y, kind: 'boss', item: s.boss });
  objects.sort((a, b) => a.y - b.y);
  for (const object of objects) {
    if (object.kind === 'barrel') drawBarrel(ctx, object.item, w, h, time);
    else if (object.kind === 'zombie') drawZombie(ctx, object.item, h, time, assets || {});
    else drawBoss(ctx, object.item, w, h, time, assets || {});
  }
  for (const effect of s.effects) drawExplosion(ctx, effect);
  for (const hazard of s.hazards) drawHazard(ctx, hazard, time);
  for (const bullet of s.bullets) drawBullet(ctx, bullet);
  drawPlayer(ctx, s, time, assets || {});

  if (s.invulnerable > 0) {
    ctx.strokeStyle = 'rgba(255,230,143,' + (0.35 + Math.sin(time * 25) * 0.16) + ')';
    ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(s.x, s.y + 6, 40, 25, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (s.t < 7) {
    roundRect(ctx, w * 0.5 - 94, h * 0.64, 188, 33, 16, 'rgba(18,25,25,.74)', 'rgba(255,255,255,.18)');
    ctx.fillStyle = '#fff4d2'; ctx.font = '15px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('좌우로 움직여 자동 사격을 유도하세요', w * 0.5, h * 0.64 + 17);
  }
  const vignette = ctx.createRadialGradient(w / 2, h * 0.52, h * 0.2, w / 2, h * 0.52, h * 0.86);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.24)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  if (s.flash > 0) { ctx.fillStyle = 'rgba(255,66,48,' + (s.flash * 0.34) + ')'; ctx.fillRect(0, 0, w, h); }
}
