import { DEFENSE_LINE_Y_RATIO, roadHalfWidth, laneX } from './game.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const tintedSpriteCache = new WeakMap();

function tintedSprite(image, tint) {
  let variants = tintedSpriteCache.get(image);
  if (!variants) {
    variants = new Map();
    tintedSpriteCache.set(image, variants);
  }
  if (variants.has(tint)) return variants.get(tint);

  // The main game canvas is opaque (alpha:false), so source-atop there colors
  // the whole sprite rectangle. Build the tint on a transparent layer first.
  const layer = document.createElement('canvas');
  layer.width = image.naturalWidth;
  layer.height = image.naturalHeight;
  const layerContext = layer.getContext('2d');
  layerContext.drawImage(image, 0, 0);
  layerContext.globalCompositeOperation = 'source-atop';
  layerContext.fillStyle = tint;
  layerContext.fillRect(0, 0, layer.width, layer.height);
  variants.set(tint, layer);
  return layer;
}

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
  sky.addColorStop(0, '#707572'); sky.addColorStop(0.23, '#555b59'); sky.addColorStop(0.48, '#39413f'); sky.addColorStop(1, '#1e2926');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);

  g.fillStyle = '#353b3b'; g.fillRect(0, horizon + 3, w, h - horizon - 3);
  const ruinHeights = [0.12, 0.2, 0.15, 0.23, 0.17];
  for (const side of [-1, 1]) {
    for (let i = 0; i < ruinHeights.length; i++) {
      const width = w * (0.09 + (i % 2) * 0.018);
      const x = side < 0 ? w * (0.015 + i * 0.092) : w * (0.985 - (i + 1) * 0.092) - width;
      const height = h * ruinHeights[(i + (side > 0 ? 2 : 0)) % ruinHeights.length];
      const base = horizon + 28;
      const tone = ['#414746', '#484d4b', '#3a403f'][i % 3];
      polygon(g, [[x, base - height + 8], [x + width * 0.28, base - height], [x + width * 0.53, base - height + 5], [x + width * 0.73, base - height - 3], [x + width, base - height + 7], [x + width, base], [x, base]], tone, '#303635');
      g.fillStyle = 'rgba(186,157,113,.27)';
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          const wx = x + width * (0.2 + col * 0.42);
          const wy = base - height * 0.76 + row * height * 0.22;
          if (wy < base - 8) g.fillRect(wx, wy, Math.max(1.3, width * 0.08), Math.max(2, height * 0.055));
        }
      }
    }
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

  for (let i = 0; i < 8; i++) {
    const depth = ((i / 8 + offset * 0.74) % 1);
    const y = horizon + depth * (h - horizon);
    const half = roadHalfWidth(w, h, y);
    const scale = 0.3 + depth * 0.8;
    for (const side of [-1, 1]) {
      const x = w * 0.5 + side * (half + 8 * scale);
      const blockW = 13 * scale, blockH = 10 * scale;
      polygon(g, [[x - blockW / 2, y - blockH], [x + blockW / 2, y - blockH], [x + blockW * 0.72, y + blockH * 0.34], [x - blockW * 0.72, y + blockH * 0.34]], '#737873', '#444a49');
      g.strokeStyle = 'rgba(190,177,145,.33)'; g.lineWidth = Math.max(0.6, scale);
      g.beginPath(); g.moveTo(x - blockW * 0.36, y - blockH * 0.55); g.lineTo(x + blockW * 0.36, y - blockH * 0.55); g.stroke();
    }
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
    g.fillStyle = 'rgba(156,151,134,' + (0.14 + depth * 0.25) + ')';
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
  const style = {
    companion: { colors: ['#80909a', '#4d6269', '#29363b'], accent: '#8ba0a4', tag: '지원 사수', stencil: 'SQUAD' },
    drone: { colors: ['#9a9994', '#5e6262', '#303432'], accent: '#a39b81', tag: '전투 드론', stencil: 'UAV' },
    rocket: { colors: ['#aa7950', '#6e432b', '#342921'], accent: '#c4844b', tag: '로켓 폭격', stencil: 'RKT' },
    rapidfire: { colors: ['#a39463', '#6d6036', '#343125'], accent: '#cfad51', tag: '연사 +30%', stencil: 'AUTO' },
    heal: { colors: ['#929783', '#59694d', '#2d372d'], accent: '#8f9a78', tag: '응급 키트', stencil: 'MED' },
    weapon: { colors: ['#929b99', '#5b6a68', '#2c3432'], accent: '#93a19d', tag: '기관단총', stencil: 'SMG' },
    upgrade: { colors: ['#93665a', '#663d36', '#2e2725'], accent: '#bd7866', tag: '공격력 +25%', stencil: 'ATK' },
    explosive: { colors: ['#9b5c49', '#713a32', '#372b27'], accent: '#ad7050', tag: '폭발통', stencil: 'DANGER' },
  }[barrel.kind] || { colors: ['#999585', '#706b59', '#39372f'], accent: '#99917a', tag: '보급', stencil: 'SUPPLY' };
  const scale = Math.max(0.58, depthScale(h, barrel.y));
  const shakeX = barrel.hitShake > 0 ? Math.sin(time * 88 + barrel.lane) * barrel.hitShake * 28 : 0;
  const x = barrel.x + shakeX;
  g.save();
  g.translate(x, barrel.y);
  g.scale(scale, scale);
  g.fillStyle = 'rgba(5,8,8,.58)';
  g.beginPath(); g.ellipse(2, 15, 35, 11, 0, 0, Math.PI * 2); g.fill();
  const body = g.createLinearGradient(-29, 0, 29, 0);
  body.addColorStop(0, style.colors[2]); body.addColorStop(0.2, style.colors[1]);
  body.addColorStop(0.49, style.colors[0]); body.addColorStop(0.76, style.colors[1]); body.addColorStop(1, style.colors[2]);
  roundRect(g, -28, -31, 56, 63, 5, body, '#252a26', 2);
  const rim = g.createLinearGradient(0, -1, 0, 7);
  rim.addColorStop(0, '#77796d'); rim.addColorStop(0.48, '#3f4541'); rim.addColorStop(1, '#242a27');
  roundRect(g, -29, -31, 58, 7, 3, rim, '#232825', 1);
  roundRect(g, -29, 25, 58, 7, 3, rim, '#222725', 1);
  g.strokeStyle = 'rgba(190,190,167,.5)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-27, -7); g.lineTo(27, -7); g.moveTo(-27, 19); g.lineTo(27, 19); g.stroke();
  g.strokeStyle = 'rgba(19,25,22,.64)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-20, -22); g.lineTo(-20, 22); g.moveTo(20, -22); g.lineTo(20, 22); g.stroke();
  g.strokeStyle = 'rgba(220,211,184,.28)';
  g.beginPath(); g.moveTo(-10, -21); g.lineTo(-13, -15); g.moveTo(10, 8); g.lineTo(7, 14); g.moveTo(15, -16); g.lineTo(12, -12); g.stroke();
  if (barrel.kind === 'explosive') {
    g.fillStyle = 'rgba(174,119,74,.78)';
    g.fillRect(-27, -3, 54, 10);
    g.fillStyle = '#302d27';
    polygon(g, [[-5, -22], [5, -22], [10, -13], [0, -8], [-10, -13]], '#b28d54', '#342e25');
    g.fillStyle = '#282822'; g.font = '900 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('!', 0, -15);
  }
  roundRect(g, -18, 1, 36, 14, 2, 'rgba(22,27,24,.82)', 'rgba(210,202,178,.46)', 0.8);
  g.fillStyle = '#dfd7bf'; g.font = 'bold 7px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(style.stencil, 0, 8);
  g.fillStyle = '#f0e9d5'; g.font = '900 15px "Black Han Sans", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.76)'; g.shadowBlur = 2;
  g.fillText(String(Math.max(0, Math.ceil(barrel.hp))), 0, 22);
  g.shadowBlur = 0;
  if (barrel.hitFlash > 0) {
    roundRect(g, -27, -29, 54, 57, 4, 'rgba(245,239,215,' + Math.min(0.42, barrel.hitFlash * 3) + ')');
  }
  g.restore();

  const badgeY = barrel.y - 69 * scale * 0.62 - 17;
  const badgeWidth = Math.max(66, style.tag.length * 10 + 18);
  g.save();
  roundRect(g, x - badgeWidth / 2, badgeY - 10, badgeWidth, 20, 3, 'rgba(19,23,21,.94)', 'rgba(179,177,157,.56)', 1);
  g.fillStyle = style.accent;
  g.fillRect(x - badgeWidth / 2 + 1, badgeY - 9, 3, 18);
  g.fillStyle = '#ece6d4'; g.font = 'bold 10px "Arial", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(style.tag, x + 1, badgeY);
  g.restore();
}

function drawObstacle(g, obstacle, h, time) {
  const scale = Math.max(0.66, depthScale(h, obstacle.y));
  g.save();
  g.translate(obstacle.x, obstacle.y);
  g.scale(scale, scale);
  g.fillStyle = 'rgba(6,10,11,.52)';
  g.beginPath(); g.ellipse(0, 10, 41, 12, 0, 0, Math.PI * 2); g.fill();
  polygon(g, [[-38, -24], [34, -24], [42, 4], [-42, 4]], '#d8c6a4', '#493a2c');
  polygon(g, [[-42, 4], [42, 4], [35, 12], [-35, 12]], '#756b59', '#302e2a');
  g.save();
  g.beginPath(); g.moveTo(-38, -24); g.lineTo(34, -24); g.lineTo(42, 4); g.lineTo(-42, 4); g.closePath(); g.clip();
  g.strokeStyle = '#d9503e'; g.lineWidth = 9;
  for (let x = -48; x < 48; x += 22) { g.beginPath(); g.moveTo(x, -27); g.lineTo(x + 20, 8); g.stroke(); }
  g.restore();
  roundRect(g, -17, -34, 34, 13, 6, 'rgba(13,20,20,.9)', '#f4ca68', 1.5);
  g.fillStyle = '#fff2c8'; g.font = 'bold 9px Jua, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('우회', 0, -27);
  if (Math.sin(time * 8) > 0.7) {
    g.strokeStyle = 'rgba(255,210,97,.8)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-35, -12); g.lineTo(-44, -20); g.moveTo(35, -12); g.lineTo(44, -20); g.stroke();
  }
  g.restore();
}

function drawDefenseLine(g, w, h, flash) {
  const y = h * DEFENSE_LINE_Y_RATIO;
  const half = Math.max(0, roadHalfWidth(w, h, y) - 4);
  const intensity = clamp(flash / 0.38, 0, 1);
  g.save();
  g.strokeStyle = 'rgba(255,75,67,' + (0.28 + intensity * 0.67) + ')';
  g.lineWidth = 1.2 + intensity * 1.5;
  g.shadowColor = '#ff4b43';
  g.shadowBlur = 2 + intensity * 10;
  g.beginPath();
  g.moveTo(w * 0.5 - half, y);
  g.lineTo(w * 0.5 + half, y);
  g.stroke();
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

function drawSprite(g, image, x, y, width, height, bob, rotation, alpha, tint = null, flipX = false) {
  g.save();
  g.translate(x, y);
  if (flipX) g.scale(-1, 1);
  g.rotate(rotation || 0);
  g.globalAlpha = alpha == null ? 1 : alpha;
  g.fillStyle = 'rgba(8,13,14,.3)';
  g.beginPath(); g.ellipse(0, 3, width * 0.39, width * 0.12, 0, 0, Math.PI * 2); g.fill();
  if (image && image.complete && image.naturalWidth) {
    g.shadowColor = 'rgba(3,8,7,.88)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 3;
    const imageY = -height + (bob || 0);
    g.drawImage(image, -width / 2, imageY, width, height);
    if (tint) {
      const flash = tintedSprite(image, tint);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = (alpha == null ? 1 : alpha) * 0.72;
      g.shadowColor = 'transparent';
      g.shadowBlur = 0;
      g.shadowOffsetY = 0;
      g.drawImage(flash, -width / 2, imageY, width, height);
      g.globalAlpha = alpha == null ? 1 : alpha;
    }
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
  const dying = zombie.dead ? clamp(zombie.dying / 0.48, 0, 1) : 1;
  const runner = zombie.kind === 'runner';
  const stride = time * (runner ? 13 : 8) + zombie.phase;
  const bob = zombie.dead ? 0 : Math.abs(Math.sin(stride)) * (runner ? 5 : 2.5);
  const rotation = zombie.dead ? (1 - dying) * 1.45 * zombie.deathSide : Math.sin(stride) * (runner ? 0.075 : 0.045);
  const runningPose = Math.sin(stride) > 0;
  const image = runner
    ? (runningPose && assets.runnerRun ? assets.runnerRun : assets.runner)
    : (runningPose && assets.walkerRun ? assets.walkerRun : assets.walker);
  if (!zombie.dead) drawFootstepDust(g, zombie.x, zombie.y, scale, stride, runner ? '#d4c29b' : '#9daf8d');
  drawSprite(g, image, zombie.x, zombie.y + bob + (zombie.dead ? (1 - dying) * 9 : 0), width, height, 0, rotation, dying, zombie.hitFlash > 0 ? '#fff0bd' : null);
  if (!zombie.dead && zombie.hp < zombie.maxHp) {
    const barW = 30 * scale;
    roundRect(g, zombie.x - barW / 2, zombie.y - height - 5, barW, 5 * scale, 2, 'rgba(10,15,14,.9)', 'rgba(255,255,255,.6)');
    roundRect(g, zombie.x - barW / 2, zombie.y - height - 5, barW * clamp(zombie.hp / zombie.maxHp, 0, 1), 5 * scale, 2, '#ffca61');
  }
}

function drawBoss(g, boss, w, h, time, assets) {
  const size = clamp(w * 0.44, 118, 164);
  if (boss.warning > 0) {
    const x = laneX(w, h, h * 0.7, boss.attackLane);
    const half = roadHalfWidth(w, h, h * 0.7) * 0.2;
    const pulse = 0.28 + (Math.sin(time * 18) + 1) * 0.12;
    g.fillStyle = 'rgba(255,58,45,' + pulse + ')';
    polygon(g, [[x - half * 0.78, h * 0.56], [x + half * 0.78, h * 0.56], [x + half * 1.22, h * 0.77], [x - half * 1.22, h * 0.77]], g.fillStyle, '#ff987c');
    g.save();
    g.beginPath();
    g.moveTo(x - half * 0.78, h * 0.56); g.lineTo(x + half * 0.78, h * 0.56);
    g.lineTo(x + half * 1.22, h * 0.77); g.lineTo(x - half * 1.22, h * 0.77); g.closePath(); g.clip();
    g.strokeStyle = 'rgba(255,236,186,.82)'; g.lineWidth = 2;
    for (let y = h * 0.53; y < h * 0.79; y += 13) { g.beginPath(); g.moveTo(x - half * 1.5, y); g.lineTo(x + half * 1.5, y - 18); g.stroke(); }
    g.restore();
    roundRect(g, x - 46, h * 0.565, 92, 23, 9, 'rgba(88,20,18,.94)', '#ffd37c', 1.5);
    g.fillStyle = '#fff2cc'; g.font = 'bold 12px Jua, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('공격 예고 · 이동!', x, h * 0.577);
  }
  const collapsing = boss.deathTimer != null;
  const fall = collapsing ? clamp(1 - boss.deathTimer / boss.deathDuration, 0, 1) : 0;
  const bob = collapsing ? 0 : Math.sin(time * 4) * 2;
  const rotation = collapsing ? -fall * 0.62 : Math.sin(time * 1.8) * 0.035;
  const alpha = collapsing ? 1 - fall * 0.48 : 1;
  drawSprite(g, assets.brute, boss.x, boss.y + 38 + fall * size * 0.22, size, size * 1.05, bob, rotation, alpha, boss.hitFlash > 0 ? '#fff0bd' : null);
}

function drawSupportMuzzle(g, x, y, alpha, color = '#ffe6a1') {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = Math.min(0.8, alpha * 6);
  g.shadowColor = color; g.shadowBlur = 6;
  g.fillStyle = '#fff2d4';
  g.beginPath(); g.ellipse(x, y, 2.7, 1.6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(216,153,82,.78)';
  g.beginPath(); g.ellipse(x, y, 5, 2.8, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawSupport(g, s, time, assets) {
  for (const companion of s.companions) {
    const alpha = companion.life > 0
      ? clamp(1 - companion.appear / 0.4, 0.08, 1)
      : clamp(companion.exit / 0.42, 0, 1);
    const stride = time * 10 + companion.id * 1.8;
    const bob = Math.abs(Math.sin(stride)) * 2.2;
    const generated = companion.id % 2 === 1;
    const image = generated ? assets.supportSurvivorA : assets.supportSurvivorB;
    const flipX = companion.side > 0;
    const muzzleX = companion.x + (flipX ? -21 : 21);
    const muzzleY = companion.y - 78 + bob;
    drawFootstepDust(g, companion.x, companion.y, 0.78, stride, '#958b74');
    drawSprite(g, image, companion.x, companion.y + bob, 62, 100, 0, Math.sin(stride) * 0.025 - companion.recoil * 0.018, alpha, null, flipX);
    drawSupportMuzzle(g, muzzleX, muzzleY, companion.muzzleFlash, '#d9b27a');
  }

  const drone = s.drone;
  if (!drone) return;
  const alpha = drone.life > 0
    ? clamp(1 - drone.appear / 0.42, 0.08, 1)
    : clamp(drone.exit / 0.4, 0, 1);
  const x = drone.x, y = drone.y + Math.sin(drone.phase * 2.2) * 1.5;
  const rotorPhase = time * 34;
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = 'rgba(6,11,17,.42)';
  g.beginPath(); g.ellipse(x, y + 22, 31, 7, 0, 0, Math.PI * 2); g.fill();
  for (const sideX of [-1, 1]) for (const sideY of [-1, 1]) {
    const rx = x + sideX * 25, ry = y + sideY * 15;
    g.strokeStyle = 'rgba(117,220,255,.7)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(rx, ry, 9, 5, 0, 0, Math.PI * 2); g.stroke();
    g.save();
    g.translate(rx, ry); g.rotate(rotorPhase * (sideX === sideY ? 1 : -1));
    g.fillStyle = 'rgba(210,237,245,.84)';
    roundRect(g, -10, -1.5, 20, 3, 1.5, g.fillStyle);
    g.restore();
    g.fillStyle = '#1d2934';
    g.beginPath(); g.arc(rx, ry, 3.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#71e9ff';
    g.beginPath(); g.arc(rx, ry, 1.25, 0, Math.PI * 2); g.fill();
  }
  if (assets.combatDrone?.complete && assets.combatDrone.naturalWidth) {
    g.shadowColor = 'rgba(29,55,76,.8)'; g.shadowBlur = 7;
    g.drawImage(assets.combatDrone, x - 36 - drone.recoil * 2, y - 23, 72, 48);
    g.shadowBlur = 0;
  }
  const led = 0.55 + (Math.sin(time * 12) + 1) * 0.2;
  g.fillStyle = 'rgba(89,224,255,' + led + ')';
  g.shadowColor = '#59e0ff'; g.shadowBlur = 7;
  g.beginPath(); g.arc(x, y + 2, 2.7, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  drawSupportMuzzle(g, x + 7, y + 19, drone.muzzleFlash, '#84efff');
  g.restore();
}

function drawPlayer(g, s, time, assets) {
  const h = 96, w = 80;
  const stride = time * 12;
  const bob = Math.abs(Math.sin(stride)) * 3.5;
  if (s.invulnerable > 0 && Math.floor(time * 18) % 2 === 0) return;
  drawFootstepDust(g, s.x, s.y + 16, 1.05, stride, '#c8b898');
  const image = Math.sin(stride) > 0 && assets.playerRun ? assets.playerRun : assets.player;
  drawSprite(g, image, s.x, s.y + 17 + bob, w, h, 0, Math.sin(stride) * 0.035, 1, s.flash > 0 ? '#ff7068' : null);
}

function drawParticles(g, particles) {
  for (const particle of particles) {
    const alpha = clamp(particle.life / particle.total, 0, 1);
    g.save();
    g.translate(particle.x, particle.y);
    if (particle.kind === 'smoke') {
      const radius = particle.size * (1.1 - alpha * 0.12);
      const cloud = g.createRadialGradient(-radius * 0.16, -radius * 0.18, radius * 0.08, 0, 0, radius);
      cloud.addColorStop(0, 'rgba(151,140,119,.58)');
      cloud.addColorStop(0.46, particle.color || 'rgba(83,80,71,.72)');
      cloud.addColorStop(1, 'rgba(49,49,45,0)');
      g.globalAlpha = alpha * 0.78;
      g.fillStyle = cloud;
      g.beginPath(); g.ellipse(0, 0, radius, radius * 0.72, 0, 0, Math.PI * 2); g.fill();
    } else {
      g.rotate(particle.rotation || 0);
      g.globalAlpha = alpha * (particle.kind === 'ember' ? 0.82 : 0.72);
      if (particle.kind === 'ember') {
        g.fillStyle = particle.color || '#cc7a3d';
        g.beginPath(); g.ellipse(0, 0, particle.size, particle.size * 0.62, 0, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = particle.color || '#69665c';
        polygon(g, [[-particle.size, -particle.size * 0.28], [particle.size * 0.72, -particle.size], [particle.size, particle.size * 0.16], [-particle.size * 0.32, particle.size * 0.72]], g.fillStyle);
      }
    }
    g.restore();
  }
}

function drawRocketMissiles(g, missiles, assets, time) {
  for (const missile of missiles) {
    const flicker = 0.78 + Math.sin(time * 48 + missile.targetX) * 0.22;
    g.save();
    g.translate(missile.x, missile.y);
    g.globalAlpha = 0.55 + clamp(missile.elapsed / 0.08, 0, 1) * 0.45;
    g.shadowColor = '#ff843b'; g.shadowBlur = 12 * flicker;
    g.fillStyle = '#ffb451';
    g.beginPath(); g.moveTo(-4, -7); g.lineTo(0, -25 * flicker); g.lineTo(4, -7); g.closePath(); g.fill();
    g.shadowBlur = 0;
    if (assets.rocketProjectile?.complete && assets.rocketProjectile.naturalWidth) {
      g.drawImage(assets.rocketProjectile, -13, -29, 26, 52);
    } else {
      roundRect(g, -5, -16, 10, 28, 4, '#b9c5c4', '#39454b', 1.5);
      polygon(g, [[-5, 10], [5, 10], [0, 19]], '#e34c35', '#692d25');
    }
    g.restore();
  }
}

function drawBullet(g, bullet) {
  g.save();
  g.translate(bullet.x, bullet.y);
  g.rotate(Math.atan2(bullet.vy, bullet.vx) - Math.PI / 2);
  const color = bullet.owner === 'drone' ? '#a4c1c3' : bullet.owner === 'companion' ? '#c19a5c' : bullet.rapid ? '#d4b362' : bullet.weapon === 'smg' ? '#d9bd84' : '#c8c0a7';
  g.shadowColor = color;
  g.shadowBlur = 3;
  const grad = g.createLinearGradient(0, -7, 0, 5);
  grad.addColorStop(0, 'rgba(226,204,154,0)'); grad.addColorStop(0.55, color); grad.addColorStop(1, '#eee3c5');
  const width = bullet.owner === 'drone' ? 2.6 : 2;
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(0, -1, width, 7, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawHazard(g, hazard, time) {
  g.save();
  g.translate(hazard.x, hazard.y);
  g.shadowColor = 'rgba(143,67,44,.48)'; g.shadowBlur = 7;
  const impact = g.createRadialGradient(-hazard.radius * 0.24, -hazard.radius * 0.28, 1, 0, 0, hazard.radius);
  impact.addColorStop(0, '#b99870');
  impact.addColorStop(0.24, '#754235');
  impact.addColorStop(0.76, '#3b302c');
  impact.addColorStop(1, 'rgba(38,35,31,.12)');
  g.fillStyle = impact;
  g.beginPath(); g.arc(0, 0, hazard.radius, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(223,190,136,.72)';
  g.beginPath(); g.arc(-hazard.radius * 0.18, -hazard.radius * 0.18, hazard.radius * 0.13, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(157,104,74,.3)'; g.lineWidth = 1.2;
  g.beginPath(); g.arc(0, 0, hazard.radius + 2 + Math.sin(time * 7) * 1.2, 0, Math.PI * 2); g.stroke();
  g.restore();
}

function drawExplosion(g, effect) {
  const p = 1 - effect.life / effect.total;
  const radius = 6 + p * effect.radius * 0.76;
  g.save();
  const flash = clamp(1 - p / 0.22, 0, 1);
  if (flash > 0) {
    const flashRadius = Math.max(8, effect.radius * (0.19 + p * 0.28));
    const core = g.createRadialGradient(effect.x, effect.y, 1, effect.x, effect.y, flashRadius);
    core.addColorStop(0, 'rgba(255,238,187,.92)');
    core.addColorStop(0.24, 'rgba(231,158,79,.72)');
    core.addColorStop(1, 'rgba(150,78,45,0)');
    g.globalAlpha = flash;
    g.fillStyle = core;
    g.beginPath(); g.ellipse(effect.x, effect.y, flashRadius, flashRadius * 0.58, 0, 0, Math.PI * 2); g.fill();
  }
  const waveAlpha = (1 - p) * 0.24;
  if (waveAlpha > 0.02) {
    g.globalAlpha = waveAlpha;
    g.strokeStyle = 'rgba(194,174,140,.7)'; g.lineWidth = 2.2 * (1 - p) + 0.6;
    g.beginPath(); g.ellipse(effect.x, effect.y, radius, radius * 0.55, 0, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}

function drawEffect(g, effect, time) {
  if (effect.kind === 'explosion') {
    drawExplosion(g, effect);
    return;
  }
  const progress = 1 - effect.life / effect.total;
  if (effect.kind === 'rocketWarning') {
    const pulse = 0.72 + Math.sin(time * 24) * 0.16;
    const radius = effect.radius * (0.82 + progress * 0.14);
    g.save();
    g.globalAlpha = (0.34 + progress * 0.34) * pulse;
    g.fillStyle = 'rgba(244,85,45,.24)';
    g.beginPath(); g.ellipse(effect.x, effect.y, radius, radius * 0.58, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffb04f'; g.lineWidth = 2.5;
    g.setLineDash([7, 4]);
    g.beginPath(); g.ellipse(effect.x, effect.y, radius, radius * 0.58, 0, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(255,238,190,.86)'; g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(effect.x - radius * 0.28, effect.y); g.lineTo(effect.x + radius * 0.28, effect.y);
    g.moveTo(effect.x, effect.y - radius * 0.23); g.lineTo(effect.x, effect.y + radius * 0.23);
    g.stroke();
    g.font = 'bold 10px Jua, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff1cc'; g.fillText('로켓 낙하', effect.x, effect.y - radius * 0.7);
    g.restore();
    return;
  }
  if (effect.kind === 'barrelBreak') {
    g.save();
    g.globalAlpha = (1 - progress) * 0.55;
    g.strokeStyle = 'rgba(190,173,139,.68)'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(effect.x, effect.y, 8 + progress * 25, 4 + progress * 13, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
    return;
  }
  if (effect.kind === 'summon') {
    g.save();
    g.globalAlpha = (1 - progress) * 0.38;
    g.strokeStyle = 'rgba(187,172,140,.68)'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(effect.x, effect.y, 8 + progress * 24, 4 + progress * 12, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
    return;
  }
  g.save();
  if (effect.kind === 'damageNumber') {
    const y = effect.y - progress * 21;
    const label = '-' + effect.amount;
    g.globalAlpha = clamp(1 - progress * 0.88, 0, 1);
    g.font = '900 19px "Black Han Sans", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(16,20,19,.92)';
    g.strokeText(label, effect.x, y);
    g.fillStyle = effect.source === 'breach' ? '#ffd37b' : '#ff7770';
    g.fillText(label, effect.x, y);
    g.restore();
    return;
  }
  if (effect.kind === 'breach') {
    const radius = 6 + progress * 18;
    g.globalAlpha = 1 - progress;
    g.strokeStyle = '#ff6258';
    g.lineWidth = 2.5 * (1 - progress) + 0.8;
    g.beginPath();
    g.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    g.stroke();
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(effect.x + side * (radius + 3), effect.y - 3);
      g.lineTo(effect.x + side * (radius + 8), effect.y - 9);
      g.stroke();
    }
    g.restore();
    return;
  }
  if (effect.kind === 'hit') {
    const size = effect.radius * (0.5 + progress * 0.8);
    g.globalAlpha = 1 - progress;
    g.strokeStyle = 'rgba(226,196,144,.8)'; g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(effect.x - size, effect.y - size * 0.3); g.lineTo(effect.x - size * 0.25, effect.y - size * 0.05);
    g.moveTo(effect.x + size * 0.2, effect.y + size * 0.18); g.lineTo(effect.x + size, effect.y + size * 0.34);
    g.stroke();
  } else if (effect.kind === 'slam') {
    const half = effect.radius * (1 + progress * 0.18);
    g.globalAlpha = (1 - progress) * 0.9;
    g.fillStyle = 'rgba(255,78,53,.78)';
    polygon(g, [[effect.x - half * 0.7, effect.y - 31], [effect.x + half * 0.7, effect.y - 31], [effect.x + half, effect.y + 21], [effect.x - half, effect.y + 21]], g.fillStyle, '#fff0b1');
    g.strokeStyle = '#ffe1a0'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(effect.x, effect.y, half * (0.6 + progress * 0.45), 10 + progress * 11, 0, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}

function drawTargetLock(g, s, time) {
  const target = s.target;
  if (!target || target.dead) return;
  const isBoss = target === s.boss;
  const isSupply = ['weapon', 'upgrade', 'companion', 'drone', 'rocket', 'rapidfire', 'heal'].includes(target.kind);
  const isExplosive = target.kind === 'explosive';
  const color = isBoss || isExplosive ? '#bc8067' : isSupply ? '#b2a17b' : '#b4ad96';
  const scale = depthScale(s.h, target.y);
  const radius = Math.max(12, Math.min(30, (target.radius || 45) * scale + 8));
  const pulse = 0.72 + Math.sin(time * 8) * 0.08;
  g.save();
  g.globalAlpha = pulse;
  if (s.showAimGuide) {
    g.save();
    g.globalAlpha = pulse * 0.42;
    g.strokeStyle = color; g.lineWidth = 1;
    g.setLineDash([4, 6]);
    g.beginPath(); g.moveTo(s.x, s.y - 42); g.lineTo(target.x, target.y); g.stroke();
    g.restore();
  }
  g.strokeStyle = color; g.lineWidth = 1.6;
  const cx = target.x, cy = target.y - radius * 0.45, c = radius * 0.42;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    g.beginPath(); g.moveTo(cx + sx * radius, cy + sy * radius * 0.45); g.lineTo(cx + sx * (radius - c), cy + sy * radius * 0.45); g.lineTo(cx + sx * (radius - c), cy + sy * (radius * 0.45 - c)); g.stroke();
  }
  if (isSupply || isExplosive) {
    const label = isExplosive ? '폭발통 조준' : '집중 사격';
    roundRect(g, target.x - 31, target.y - radius - 23, 62, 17, 2, 'rgba(23,23,18,.86)', 'rgba(174,159,129,.58)', 1);
    g.fillStyle = '#ded4be'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, target.x, target.y - radius - 14.5);
  }
  g.restore();
}

function drawTitleScene(g, w, h, time, assets) {
  drawRoad(g, w, h, (time * 0.00008) % 1);
  drawZombie(g, { kind: 'walker', x: w * 0.42, y: h * 0.34, radius: 14, hp: 20, maxHp: 20, phase: 1 }, h, time / 1000, assets);
  drawZombie(g, { kind: 'runner', x: w * 0.66, y: h * 0.48, radius: 14, hp: 15, maxHp: 15, phase: 2 }, h, time / 1000, assets);
  drawBarrel(g, { kind: 'companion', x: w * 0.32, y: h * 0.59, lane: 0, hp: 40 }, w, h, time / 1000);
  drawBarrel(g, { kind: 'weapon', x: w * 0.72, y: h * 0.62, lane: 2, hp: 40 }, w, h, time / 1000);
  const runPhase = time / 1000 * 12;
  drawFootstepDust(g, w * 0.5, h * 0.90, 1, runPhase, '#c8b898');
  const runningPose = Math.sin(runPhase) > 0;
  const playerImage = runningPose && assets.playerRun ? assets.playerRun : assets.player;
  drawSprite(g, playerImage, w * 0.5, h * 0.90 + Math.abs(Math.sin(runPhase)) * 3, 87, 106, 0, Math.sin(runPhase) * 0.035, 1);
  const shade = g.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(12,21,20,.07)');
  shade.addColorStop(0.45, 'rgba(10,17,17,.2)');
  shade.addColorStop(1, 'rgba(8,13,14,.75)');
  g.fillStyle = shade; g.fillRect(0, 0, w, h);
}

export function drawScene(ctx, s, w, h, now, title, assets) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  if (s && s.hitShake > 0) {
    const shake = s.hitShake * 8;
    ctx.translate(Math.sin(now * 0.07) * shake, Math.cos(now * 0.09) * shake * 0.45);
  }
  const offset = s ? s.roadOffset : (now * 0.00008) % 1;
  if (title || !s) {
    drawTitleScene(ctx, w, h, now, assets || {});
    ctx.restore();
    return;
  }
  drawRoad(ctx, w, h, offset);
  drawDefenseLine(ctx, w, h, s.defenseFlash);
  const time = s.t;
  const objects = [];
  for (const barrel of s.barrels) objects.push({ y: barrel.y, kind: 'barrel', item: barrel });
  for (const zombie of s.zombies) objects.push({ y: zombie.y, kind: 'zombie', item: zombie });
  for (const obstacle of s.obstacles) objects.push({ y: obstacle.y, kind: 'obstacle', item: obstacle });
  if (s.boss) objects.push({ y: s.boss.y, kind: 'boss', item: s.boss });
  objects.sort((a, b) => a.y - b.y);
  for (const object of objects) {
    if (object.kind === 'barrel') drawBarrel(ctx, object.item, w, h, time);
    else if (object.kind === 'zombie') drawZombie(ctx, object.item, h, time, assets || {});
    else if (object.kind === 'obstacle') drawObstacle(ctx, object.item, h, time);
    else drawBoss(ctx, object.item, w, h, time, assets || {});
  }
  drawSupport(ctx, s, time, assets || {});
  drawTargetLock(ctx, s, time);
  for (const effect of s.effects) drawEffect(ctx, effect, time);
  drawParticles(ctx, s.particles);
  for (const hazard of s.hazards) drawHazard(ctx, hazard, time);
  drawRocketMissiles(ctx, s.missiles, assets || {}, time);
  for (const bullet of s.bullets) drawBullet(ctx, bullet);
  if (s.powerFlash > 0) {
    const alpha = Math.min(0.12, s.powerFlash * 0.1);
    const glow = ctx.createRadialGradient(s.x, s.y - 20, 4, s.x, s.y - 20, h * 0.32);
    glow.addColorStop(0, 'rgba(190,160,111,' + alpha + ')'); glow.addColorStop(1, 'rgba(151,121,79,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  }
  drawPlayer(ctx, s, time, assets || {});

  if (s.invulnerable > 0) {
    ctx.strokeStyle = 'rgba(255,230,143,' + (0.35 + Math.sin(time * 25) * 0.16) + ')';
    ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(s.x, s.y + 6, 40, 25, 0, 0, Math.PI * 2); ctx.stroke();
  }
  const vignette = ctx.createRadialGradient(w / 2, h * 0.52, h * 0.2, w / 2, h * 0.52, h * 0.86);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.24)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  if (s.flash > 0) { ctx.fillStyle = 'rgba(255,66,48,' + (s.flash * 0.34) + ')'; ctx.fillRect(0, 0, w, h); }
  if (s.bossAlertTimer > 0) {
    const pulse = 0.045 + (Math.sin(now * 0.018) + 1) * 0.018;
    const warningShade = ctx.createLinearGradient(0, 0, 0, h * 0.15);
    warningShade.addColorStop(0, 'rgba(132,30,25,' + pulse * 2 + ')');
    warningShade.addColorStop(1, 'rgba(132,30,25,0)');
    ctx.fillStyle = warningShade;
    ctx.fillRect(0, 0, w, h * 0.15);
    ctx.strokeStyle = 'rgba(218,75,58,' + pulse * 5 + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(w, 2); ctx.stroke();
  }
  ctx.restore();
}


