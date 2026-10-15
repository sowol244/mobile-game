import { DEFENSE_LINE_Y_RATIO, roadHalfWidth, laneX } from './game.js?v=2-1-20261015e';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = value => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
const tintedSpriteCache = new WeakMap();
const BARREL_VISUALS = {
  companion: { colors: ['#80909a', '#4d6269', '#29363b'], accent: '#a9c6c8', tag: '지원 사수', stencil: '동료' },
  drone: { colors: ['#9a9994', '#5e6262', '#303432'], accent: '#bcb39a', tag: '전투 드론', stencil: '드론' },
  rocket: { colors: ['#aa7950', '#6e432b', '#342921'], accent: '#e7aa65', tag: '로켓 폭격', stencil: '로켓' },
  rapidfire: { colors: ['#a39463', '#6d6036', '#343125'], accent: '#f0d177', tag: '연사 +30%', stencil: '연사' },
  heal: { colors: ['#929783', '#59694d', '#2d372d'], accent: '#bdd093', tag: '응급 키트', stencil: '치료' },
  weapon: { colors: ['#929b99', '#5b6a68', '#2c3432'], accent: '#c1d0cb', tag: '기관단총', stencil: 'SMG' },
  twin: { colors: ['#788f92', '#465d61', '#273538'], accent: '#c8d8cc', tag: '쌍열 기관총', stencil: 'DUAL' },
  upgrade: { colors: ['#93665a', '#663d36', '#2e2725'], accent: '#e19a82', tag: '공격력 +25%', stencil: '화력' },
  explosive: { colors: ['#9b5c49', '#713a32', '#372b27'], accent: '#ffae60', tag: '폭발통', stencil: '위험' },
  supply: { colors: ['#999585', '#706b59', '#39372f'], accent: '#d4c69d', tag: '보급품', stencil: '보급' },
};

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

function drawStreetLamp(g, x, y, scale, side, phase) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.strokeStyle = '#202727'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(-side * 4, -78); g.lineTo(-side * 10, -83); g.stroke();
  g.strokeStyle = '#727975'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-1, -4); g.lineTo(-side * 5, -73); g.lineTo(-side * 11, -78); g.stroke();
  g.fillStyle = '#303838';
  polygon(g, [[-side * 7, -82], [-side * 3, -88], [side * 1, -86], [side * 4, -80]], '#303838', '#171e1f');
  const glow = 0.42 + (Math.sin(phase) + 1) * 0.16;
  g.shadowColor = '#efb863'; g.shadowBlur = 9 * glow;
  g.fillStyle = 'rgba(246,187,98,' + glow + ')';
  g.beginPath(); g.ellipse(-side * 1, -82, 3, 2, 0, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(28,35,35,.72)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(-side * 8, -78); g.lineTo(-side * 18, -49); g.stroke();
  g.restore();
}

function drawRoadSign(g, x, y, scale, side, variant) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.rotate(side * -0.12);
  g.strokeStyle = '#242a2a'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(side * 3, -37); g.stroke();
  const sx = side * 3;
  polygon(g, [[sx - 14, -57], [sx + 14, -57], [sx + 17, -31], [sx - 17, -31]], '#9e4736', '#272c2b');
  polygon(g, [[sx - 10, -52], [sx + 10, -52], [sx + 12, -37], [sx - 12, -37]], '#d7c7a3', '#4b4033');
  g.strokeStyle = '#a44635'; g.lineWidth = 3;
  if (variant % 2) {
    g.beginPath(); g.moveTo(sx - 7, -47); g.lineTo(sx + 7, -41); g.moveTo(sx + 6, -48); g.lineTo(sx - 6, -40); g.stroke();
  } else {
    g.beginPath(); g.moveTo(sx, -49); g.lineTo(sx, -43); g.stroke();
    g.fillStyle = '#a44635'; g.beginPath(); g.arc(sx, -40, 1.7, 0, Math.PI * 2); g.fill();
  }
  polygon(g, [[-7, -4], [2, -10], [10, -5], [7, 1], [-5, 2]], '#71695a', '#303534');
  g.restore();
}

function drawRubble(g, x, y, scale, side) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.fillStyle = 'rgba(5,8,8,.32)';
  g.beginPath(); g.ellipse(0, 2, 24, 5, 0, 0, Math.PI * 2); g.fill();
  polygon(g, [[-20, 1], [-15, -8], [-7, -4], [-4, -15], [5, -10], [11, -14], [20, -5], [17, 2]], '#625f55', '#2d3331');
  polygon(g, [[-16, -3], [-12, -8], [-8, -5], [-9, -1]], '#a29a84', '#4d4c43');
  polygon(g, [[2, -5], [7, -12], [11, -7], [8, -3]], '#837b68', '#494a42');
  g.strokeStyle = '#363c3b'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(side * 5, -10); g.lineTo(side * 14, -20); g.lineTo(side * 17, -22); g.stroke();
  g.restore();
}

function drawTollgateDetails(g, w, h, offset) {
  const topY = h * 0.145;
  const half = roadHalfWidth(w, h, topY);
  const left = w * 0.5 - half * 1.12;
  const right = w * 0.5 + half * 1.12;
  const sway = Math.sin(offset * Math.PI * 2) * 1.2;
  g.save();
  g.globalAlpha = 0.94;
  // A damaged toll canopy sits in the distance, with its legs outside the lanes.
  polygon(g, [[left - 4, topY + 9], [right + 4, topY + 9], [right + 1, topY + 17], [left - 1, topY + 17]], '#262d2f', '#111719', 1.4);
  polygon(g, [[left - 9, topY + 6], [right + 7, topY + 6], [right + 4, topY + 11], [left - 6, topY + 11]], '#51595a', '#1e2526', 1.2);
  g.strokeStyle = 'rgba(176,166,139,.48)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(left + 2, topY + 11); g.lineTo(w * 0.5 - 4, topY + 12); g.lineTo(w * 0.5 - 10, topY + 15); g.moveTo(w * 0.5 + 5, topY + 11); g.lineTo(right - 4, topY + 13); g.stroke();
  for (const x of [left, right]) {
    polygon(g, [[x - 4, topY + 12], [x + 4, topY + 12], [x + 7, h * 0.24], [x - 8, h * 0.24]], '#41494a', '#202627', 1.2);
    g.strokeStyle = 'rgba(177,157,119,.32)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x - 2, topY + 19); g.lineTo(x + sway, h * 0.24 - 3); g.stroke();
  }
  for (let lane = 0; lane < 3; lane++) {
    const x = laneX(w, h, h * 0.18, lane);
    const boothW = 11 + lane * 0.5;
    const boothY = h * 0.18;
    g.fillStyle = 'rgba(11,16,17,.48)';
    g.beginPath(); g.ellipse(x, boothY + 9, boothW * 0.95, 3, 0, 0, Math.PI * 2); g.fill();
    polygon(g, [[x - boothW, boothY - 7], [x + boothW, boothY - 7], [x + boothW * 0.86, boothY + 8], [x - boothW * 0.9, boothY + 8]], '#343b3c', '#161d1e', 1);
    polygon(g, [[x - boothW - 2, boothY - 8], [x + boothW + 2, boothY - 8], [x + boothW, boothY - 4], [x - boothW, boothY - 4]], '#727473', '#222827', 0.9);
    g.fillStyle = 'rgba(164,151,121,.22)';
    g.fillRect(x - boothW * 0.55, boothY - 3, boothW * 0.34, 7);
    g.fillRect(x + boothW * 0.2, boothY - 3, boothW * 0.22, 7);
  }
  // Broken barrier arms and amber reflectors clarify the abandoned checkpoint.
  for (const lane of [0, 2]) {
    const x = laneX(w, h, h * 0.205, lane);
    const direction = lane === 0 ? 1 : -1;
    const endX = x + direction * 18;
    g.strokeStyle = '#242a2b'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, h * 0.205); g.lineTo(endX, h * 0.202 + direction * 4); g.stroke();
    g.strokeStyle = 'rgba(190,139,61,.7)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x + direction * 3, h * 0.204); g.lineTo(endX - direction * 2, h * 0.202 + direction * 4); g.stroke();
  }
  g.restore();
}

function drawRoad(g, w, h, offset, assets = {}, theme = 'highway') {
  const tollgate = theme === 'tollgate';
  const stageBackdrop = assets.stage02Backdrop;
  if (tollgate && stageBackdrop?.complete && stageBackdrop.naturalWidth) {
    const scale = Math.max(w / stageBackdrop.naturalWidth, h / stageBackdrop.naturalHeight);
    const drawW = stageBackdrop.naturalWidth * scale;
    const drawH = stageBackdrop.naturalHeight * scale;
    g.drawImage(stageBackdrop, (w - drawW) * 0.5, (h - drawH) * 0.5, drawW, drawH);
    g.fillStyle = 'rgba(7,12,15,.13)';
    g.fillRect(0, 0, w, h);

    const horizon = h * 0.27;
    const topHalf = roadHalfWidth(w, h, horizon);
    const bottomHalf = roadHalfWidth(w, h, h);
    for (const side of [-1, 1]) {
      const topX = w / 2 + side * (topHalf - 2);
      const bottomX = w / 2 + side * (bottomHalf - 4);
      g.strokeStyle = 'rgba(7,10,11,.4)';
      g.lineWidth = 4.5;
      g.beginPath(); g.moveTo(topX + side * 4, horizon); g.lineTo(bottomX + side * 6, h); g.stroke();
      g.strokeStyle = 'rgba(211,201,171,.45)';
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(topX, horizon); g.lineTo(bottomX, h); g.stroke();
    }

    for (let lane = 1; lane <= 2; lane++) {
      for (let i = 0; i < 9; i++) {
        const depth = ((i / 9 + offset) % 1);
        const y = horizon + depth * (h - horizon);
        const half = roadHalfWidth(w, h, y);
        const x = w / 2 + (lane - 1.5) * half * 0.385;
        const dashH = 3 + depth * 20;
        g.fillStyle = 'rgba(231,225,198,' + (0.16 + depth * 0.45) + ')';
        roundRect(g, x - (1 + depth * 1.3), y, 2 + depth * 2.6, dashH, 1, g.fillStyle);
      }
    }
    g.save();
    for (let i = 0; i < 46; i++) {
      const x = ((Math.sin(i * 71.3) * 0.5 + 0.5) * w + offset * (12 + i % 13)) % w;
      const y = ((i * 0.173 + offset * 1.7) % 1) * h;
      g.strokeStyle = 'rgba(181,200,204,' + (0.08 + (i % 4) * 0.025) + ')';
      g.lineWidth = 0.55 + (i % 3) * 0.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2.5, y + 8 + i % 10); g.stroke();
    }
    g.restore();
    const vignette = g.createLinearGradient(0, 0, 0, h);
    vignette.addColorStop(0, 'rgba(5,9,12,.05)');
    vignette.addColorStop(0.56, 'rgba(5,9,12,0)');
    vignette.addColorStop(1, 'rgba(5,9,12,.25)');
    g.fillStyle = vignette; g.fillRect(0, 0, w, h);
    return;
  }
  const horizon = h * 0.13;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, tollgate ? '#626a6d' : '#707572'); sky.addColorStop(0.23, tollgate ? '#494f51' : '#555b59'); sky.addColorStop(0.48, tollgate ? '#303638' : '#39413f'); sky.addColorStop(1, tollgate ? '#191e20' : '#1e2926');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);

  const roadside = g.createLinearGradient(0, horizon, 0, h);
  roadside.addColorStop(0, tollgate ? '#484e50' : '#505552'); roadside.addColorStop(0.42, tollgate ? '#303638' : '#353c3a'); roadside.addColorStop(1, tollgate ? '#1c2224' : '#222a29');
  g.fillStyle = roadside; g.fillRect(0, horizon + 3, w, h - horizon - 3);
  const vergeTop = roadHalfWidth(w, h, horizon);
  const vergeBottom = roadHalfWidth(w, h, h);
  polygon(g, [[w / 2 - vergeTop - 21, horizon], [w / 2 - vergeTop - 6, horizon], [w / 2 - vergeBottom - 9, h], [w / 2 - vergeBottom - 34, h]], tollgate ? '#565653' : '#514e43');
  polygon(g, [[w / 2 + vergeTop + 6, horizon], [w / 2 + vergeTop + 21, horizon], [w / 2 + vergeBottom + 34, h], [w / 2 + vergeBottom + 9, h]], tollgate ? '#565653' : '#514e43');
  const ruinHeights = [0.12, 0.2, 0.15, 0.23, 0.17];
  for (const side of [-1, 1]) {
    for (let i = 0; i < ruinHeights.length; i++) {
      const width = w * (0.09 + (i % 2) * 0.018);
      const x = side < 0 ? w * (0.015 + i * 0.092) : w * (0.985 - (i + 1) * 0.092) - width;
      const height = h * ruinHeights[(i + (side > 0 ? 2 : 0)) % ruinHeights.length];
      const base = horizon + 28;
      const tone = ['#414746', '#484d4b', '#3a403f'][i % 3];
      polygon(g, [[x, base - height + 8], [x + width * 0.28, base - height], [x + width * 0.53, base - height + 5], [x + width * 0.73, base - height - 3], [x + width, base - height + 7], [x + width, base], [x, base]], tone, '#303635');
      g.fillStyle = 'rgba(186,157,113,.28)';
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          const wx = x + width * (0.14 + col * 0.34);
          const wy = base - height * 0.78 + row * height * 0.18;
          if (wy < base - 8 && (row + col + i) % 4 !== 0) {
            g.fillRect(wx, wy, Math.max(1.4, width * 0.075), Math.max(2.2, height * 0.045));
          }
        }
      }
      g.strokeStyle = 'rgba(22,28,28,.64)'; g.lineWidth = Math.max(0.8, width * 0.025);
      g.beginPath(); g.moveTo(x + width * 0.68, base - height * 0.54); g.lineTo(x + width * 0.59, base - height * 0.38); g.lineTo(x + width * 0.71, base - height * 0.22); g.stroke();
    }
  }

  const backdrop = assets.roadsideBackdrop;
  if (backdrop?.complete && backdrop.naturalWidth) {
    const coverScale = Math.max(w / backdrop.naturalWidth, h / backdrop.naturalHeight);
    const backdropWidth = backdrop.naturalWidth * coverScale;
    const backdropHeight = backdrop.naturalHeight * coverScale;
    g.save();
    g.globalAlpha = 0.82;
    g.drawImage(backdrop, (w - backdropWidth) / 2, (h - backdropHeight) / 2, backdropWidth, backdropHeight);
    g.restore();
  }

  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const depth = ((i / 5 + offset * 0.56 + (side > 0 ? 0.17 : 0)) % 1);
      const y = horizon + depth * (h - horizon);
      const half = roadHalfWidth(w, h, y);
      const scale = 0.18 + depth * 0.78;
      const x = clamp(w * 0.5 + side * (half + 18 * scale), 8, w - 8);
      const kind = (i + (side > 0 ? 1 : 0)) % 4;
      if (kind === 0) drawStreetLamp(g, x, y, scale, side, offset * 15 + i);
      else if (kind === 1) drawRoadSign(g, x, y, scale, side, i);
      else if (kind === 2) drawRubble(g, x, y, scale, side);
      else drawRubble(g, x, y, scale * 0.78, side);
    }
  }

  const topHalf = roadHalfWidth(w, h, horizon);
  const bottomHalf = roadHalfWidth(w, h, h);
  polygon(g, [[w / 2 - topHalf - 8, horizon], [w / 2 + topHalf + 8, horizon], [w / 2 + bottomHalf + 10, h], [w / 2 - bottomHalf - 10, h]], tollgate ? '#6e6755' : '#847b5f');
  polygon(g, [[w / 2 - topHalf, horizon], [w / 2 + topHalf, horizon], [w / 2 + bottomHalf, h], [w / 2 - bottomHalf, h]], tollgate ? '#373e41' : '#424a4d');
  const asphalt = g.createLinearGradient(w / 2, horizon, w / 2, h);
  asphalt.addColorStop(0, tollgate ? '#555c5e' : '#626b6b'); asphalt.addColorStop(0.38, tollgate ? '#42494c' : '#4e5759'); asphalt.addColorStop(1, tollgate ? '#2c3236' : '#353d41');
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

  for (let i = 0; i < 9; i++) {
    const depth = ((i / 9 + offset * 1.12) % 1);
    const y = horizon + depth * (h - horizon);
    const half = roadHalfWidth(w, h, y);
    const scale = 0.3 + depth * 0.8;
    const x = w / 2 + Math.sin(i * 17.3) * half * 0.62;
    g.strokeStyle = 'rgba(21,25,26,' + (0.18 + depth * 0.18) + ')';
    g.lineWidth = Math.max(0.7, scale * 1.1);
    g.beginPath();
    g.moveTo(x, y); g.lineTo(x + 3 * scale, y + 5 * scale); g.lineTo(x - 2 * scale, y + 10 * scale); g.lineTo(x + 5 * scale, y + 15 * scale);
    g.stroke();
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
  if (tollgate) drawTollgateDetails(g, w, h, offset);
}

function depthScale(h, y) {
  const depth = clamp((y - h * 0.13) / (h * 0.82), 0, 1);
  return 0.48 + depth * 0.72;
}

function drawBarrel(g, barrel, w, h, time) {
  const style = BARREL_VISUALS[barrel.kind] || BARREL_VISUALS.supply;
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
  roundRect(g, -23, 1, 46, 14, 2, 'rgba(18,22,20,.96)', 'rgba(230,218,190,.78)', 0.8);
  g.fillStyle = '#fff0cc'; g.font = '900 ' + (9 / scale).toFixed(1) + 'px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(style.stencil, 0, 8);
  g.fillStyle = '#f0e9d5'; g.font = '900 ' + (14 / scale).toFixed(1) + 'px "Black Han Sans", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.76)'; g.shadowBlur = 2;
  g.fillText(String(Math.max(0, Math.ceil(barrel.hp))), 0, 22);
  g.shadowBlur = 0;
  if (barrel.hitFlash > 0) {
    roundRect(g, -27, -29, 54, 57, 4, 'rgba(245,239,215,' + Math.min(0.42, barrel.hitFlash * 3) + ')');
  }
  g.restore();
}

function drawBarrelBadges(g, barrels, w, h) {
  const placed = [];
  const badges = [];
  g.save();
  g.font = '900 12px sans-serif';
  for (const barrel of barrels.filter(item => !item.dead && item.y > 0 && item.y < h).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const style = BARREL_VISUALS[barrel.kind] || BARREL_VISUALS.supply;
    const width = Math.max(68, g.measureText(style.tag).width + 22);
    const scale = Math.max(0.58, depthScale(h, barrel.y));
    const badgeX = clamp(barrel.x, width / 2 + 4, w - width / 2 - 4);
    const baseY = barrel.y - 31 * scale - 14;
    let row = 0;
    while (row < 8 && placed.some(other => (
      Math.abs(badgeX - other.x) < (width + other.width) / 2 + 7
      && Math.abs(baseY - row * 24 - other.y) < 23
    ))) row++;
    const badgeY = Math.max(12, baseY - row * 24);
    placed.push({ x: badgeX, y: badgeY, width });
    badges.push({ barrel, style, x: badgeX, y: badgeY, width });
  }
  for (const { barrel, style, x, y, width } of badges) {
    const pulse = barrel.hitFlash > 0 ? 0.82 + Math.sin(barrel.hitFlash * 48) * 0.12 : 1;
    g.save();
    g.globalAlpha = pulse;
    g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 7; g.shadowOffsetY = 3;
    roundRect(g, x - width / 2, y - 11, width, 22, 4, 'rgba(13,17,17,.97)', 'rgba(219,205,174,.88)', 1.2);
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    roundRect(g, x - width / 2 + 1, y - 9, 4, 18, 2, style.accent);
    g.fillStyle = '#fff1d6'; g.font = '900 12px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(style.tag, x + 2, y);
    g.restore();
  }
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

function drawArmoredZombie(g, zombie, width, height, yOffset, rotation, alpha) {
  g.save();
  g.translate(zombie.x, zombie.y + yOffset);
  g.rotate(rotation);
  g.globalAlpha = alpha;
  polygon(g, [
    [-width * 0.27, -height * 0.62], [-width * 0.12, -height * 0.7],
    [width * 0.15, -height * 0.68], [width * 0.3, -height * 0.56],
    [width * 0.24, -height * 0.43], [0, -height * 0.38], [-width * 0.25, -height * 0.45],
  ], '#343b3c', '#171d1d', 1.7);
  polygon(g, [
    [-width * 0.17, -height * 0.63], [width * 0.07, -height * 0.65],
    [width * 0.19, -height * 0.55], [width * 0.13, -height * 0.47],
    [-width * 0.09, -height * 0.45], [-width * 0.2, -height * 0.53],
  ], zombie.hitFlash > 0 ? '#b8ac91' : '#59605d', '#252b2b', 1);
  g.strokeStyle = 'rgba(183,169,136,.62)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-width * 0.15, -height * 0.55); g.lineTo(width * 0.14, -height * 0.53); g.stroke();
  for (const side of [-1, 1]) {
    g.fillStyle = '#b09a70';
    g.beginPath(); g.arc(side * width * 0.2, -height * 0.59, Math.max(1.2, width * 0.018), 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function drawZombie(g, zombie, h, time, assets) {
  const scale = depthScale(h, zombie.y);
  const tank = zombie.kind === 'tank' || zombie.kind === 'tanker';
  const height = (tank ? 87 : zombie.kind === 'runner' ? 56 : 60) * scale;
  const width = height * (tank ? 0.9 : 0.82);
  const dying = zombie.dead ? clamp(zombie.dying / 0.48, 0, 1) : 1;
  const runner = zombie.kind === 'runner';
  const stride = time * (runner ? 13 : tank ? 5.4 : 8) + zombie.phase;
  const bob = zombie.dead ? 0 : Math.abs(Math.sin(stride)) * (runner ? 5 : tank ? 1.8 : 2.5);
  const rotation = zombie.dead ? (1 - dying) * (tank ? 0.92 : 1.45) * zombie.deathSide : Math.sin(stride) * (runner ? 0.075 : tank ? 0.025 : 0.045);
  const runningPose = Math.sin(stride) > 0;
  const image = tank
    ? (runningPose && assets.bruteWalkB ? assets.bruteWalkB : assets.brute)
    : runner
      ? (runningPose && assets.runnerRun ? assets.runnerRun : assets.runner)
      : (runningPose && assets.walkerRun ? assets.walkerRun : assets.walker);
  if (!zombie.dead) drawFootstepDust(g, zombie.x, zombie.y, scale * (tank ? 1.2 : 1), stride, tank ? '#827c70' : runner ? '#d4c29b' : '#9daf8d');
  drawSprite(g, image, zombie.x, zombie.y + bob + (zombie.dead ? (1 - dying) * 9 : 0), width, height, 0, rotation, dying, zombie.hitFlash > 0 ? '#fff0bd' : null);
  if (tank) drawArmoredZombie(g, zombie, width, height, bob + (zombie.dead ? (1 - dying) * 9 : 0), rotation, dying);
  if (!zombie.dead && zombie.hp < zombie.maxHp) {
    const barW = (tank ? 42 : 30) * scale;
    roundRect(g, zombie.x - barW / 2, zombie.y - height - 5, barW, 5 * scale, 2, 'rgba(10,15,14,.9)');
    roundRect(g, zombie.x - barW / 2, zombie.y - height - 5, barW * clamp(zombie.hp / zombie.maxHp, 0, 1), 5 * scale, 2, '#ffca61');
  }
}

function drawHydraulicBoss(g, boss, w, h, time, assets) {
  const entryProgress = clamp(boss.entryProgress ?? 1, 0, 1);
  const entryScale = 0.26 + 0.74 * smoothstep(entryProgress);
  const height = clamp(w * 0.74, 214, 282) * entryScale;
  const idle = assets.bossBreakerIdle?.complete && assets.bossBreakerIdle.naturalWidth
    ? assets.bossBreakerIdle : assets.brute;
  const walk = assets.bossBreakerWalk?.complete && assets.bossBreakerWalk.naturalWidth
    ? assets.bossBreakerWalk : idle;
  const windup = assets.bossBreakerWindup?.complete && assets.bossBreakerWindup.naturalWidth
    ? assets.bossBreakerWindup : idle;
  const impact = assets.bossBreakerImpact?.complete && assets.bossBreakerImpact.naturalWidth
    ? assets.bossBreakerImpact : windup;
  const down = assets.bossBreakerDown?.complete && assets.bossBreakerDown.naturalWidth
    ? assets.bossBreakerDown : idle;
  const aspect = idle.naturalWidth && idle.naturalHeight ? idle.naturalWidth / idle.naturalHeight : 0.68;
  const width = height * aspect;
  const collapsing = boss.deathTimer != null;
  const fall = collapsing ? clamp(1 - boss.deathTimer / boss.deathDuration, 0, 1) : 0;
  const topple = collapsing ? smoothstep(clamp((fall - 0.04) / 0.7, 0, 1)) : 0;
  const entering = !collapsing && boss.entryTimer > 0;
  const warningProgress = boss.warning > 0 ? clamp(1 - boss.warning / (boss.warningTotal || 1.2), 0, 1) : 0;
  const windupMix = !collapsing && boss.warning > 0
    ? smoothstep(clamp((warningProgress - 0.08) / 0.68, 0, 1)) : 0;
  const slamMix = !collapsing && boss.stomp > 0 ? smoothstep(clamp(boss.stomp / 0.42, 0, 1)) : 0;
  const moveSpeed = Math.abs(boss.moveSpeed || 0);
  const gait = collapsing || boss.warning > 0 || boss.attackRecover > 0
    ? 0
    : entering ? 0.82 : clamp(moveSpeed / Math.max(1, w * 0.14), 0, 0.78);
  const walkMix = gait * (1 - windupMix) * (1 - slamMix);
  const impactMix = slamMix;
  const windupWeight = windupMix * (1 - impactMix);
  const idleWeight = Math.max(0, 1 - walkMix - windupWeight - impactMix);
  const breath = collapsing ? 0 : Math.sin(time * 3.2) * 1.8;
  const stride = Math.abs(Math.sin((boss.walkPhase || 0) * 1.7)) * gait * 5;
  const warningLunge = boss.warning > 0 ? smoothstep((warningProgress - 0.7) / 0.3) : 0;
  const impactKick = boss.stomp > 0 ? smoothstep((0.42 - boss.stomp) / 0.18) : 0;
  const hitShake = boss.hitShake > 0 ? Math.sin(time * 91) * boss.hitShake * 15 : 0;
  const deathSide = boss.deathSide || 1;
  const deathJolt = collapsing && fall < 0.17 ? Math.sin(time * 62) * (1 - fall / 0.17) * 0.035 : 0;
  const direction = Math.sign(boss.moveSpeed || boss.attackDirection || 0);
  const rotation = collapsing
    ? deathSide * (topple * 0.78 + deathJolt)
    : direction * gait * 0.09 + warningLunge * (boss.attackDirection || 0) * 0.13 + hitShake * 0.003;
  const alpha = collapsing ? 1 - smoothstep(clamp((fall - 0.91) / 0.09, 0, 1)) * 0.12 : 1;
  const x = boss.x + direction * warningLunge * width * 0.055 + hitShake + (collapsing ? deathSide * topple * width * 0.08 : 0);
  const groundY = boss.y + height * 0.33 * entryScale + breath + stride - warningLunge * height * 0.035
    + impactKick * height * 0.03 + (collapsing ? topple * height * 0.12 : 0);

  if (collapsing) {
    g.save();
    g.fillStyle = 'rgba(3,6,8,' + (0.34 + topple * 0.2) + ')';
    g.beginPath(); g.ellipse(x, groundY + 4, width * (0.48 + topple * 0.24), width * (0.13 + topple * 0.07), 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  if (gait > 0.12 || entering) drawFootstepDust(g, x, groundY, 0.78 + gait * 0.32, boss.walkPhase || 0, '#797873');

  const tint = boss.hitFlash > 0 ? '#f1b98f' : null;
  const downMix = collapsing ? smoothstep(clamp((fall - 0.04) / 0.42, 0, 1)) : 0;
  const uprightAlpha = alpha * (1 - downMix);
  if (entering) {
    const canopyEdge = h * 0.27 * (1 - entryProgress);
    g.save();
    g.beginPath(); g.rect(0, canopyEdge, w, h - canopyEdge); g.clip();
  }
  if (idleWeight > 0.015) drawSprite(g, idle, x, groundY, width, height, 0, rotation, uprightAlpha * idleWeight, tint);
  if (walkMix > 0.015) drawSprite(g, walk, x, groundY, width, height, 0, rotation, uprightAlpha * walkMix, tint);
  if (windupWeight > 0.015) drawSprite(g, windup, x, groundY, width, height, 0, rotation - (boss.attackDirection || -1) * windupWeight * 0.035, uprightAlpha * windupWeight, tint);
  if (impactMix > 0.015) drawSprite(g, impact, x, groundY, width, height, 0, rotation + (boss.attackDirection || -1) * impactMix * 0.055, uprightAlpha * impactMix, tint);
  if (downMix > 0.01) drawSprite(g, down, x, groundY + height * topple * 0.025, width, height, 0, deathSide * topple * 0.78 + deathJolt, alpha * downMix, tint);
  if (entering) g.restore();

  if (boss.stomp > 0) {
    const progress = 1 - boss.stomp / 0.42;
    const ramX = x - width * 0.28;
    const ramY = groundY - height * 0.17;
    g.save();
    g.globalAlpha = (1 - progress) * 0.9;
    g.shadowColor = '#e98c43'; g.shadowBlur = 11 * (1 - progress);
    g.fillStyle = '#ffdc9b';
    g.beginPath(); g.arc(ramX, ramY, 5 + progress * 13, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,201,128,.86)'; g.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7 + 0.4;
      const inner = 7 + progress * 8, outer = 18 + progress * 19;
      g.beginPath(); g.moveTo(ramX + Math.cos(angle) * inner, ramY + Math.sin(angle) * inner);
      g.lineTo(ramX + Math.cos(angle) * outer, ramY + Math.sin(angle) * outer); g.stroke();
    }
    g.restore();
  }
}

function drawBoss(g, boss, w, h, time, assets) {
  const entryProgress = clamp(boss.entryProgress ?? 1, 0, 1);
  const entryScale = 0.28 + 0.72 * smoothstep(entryProgress);
  const size = clamp(w * 0.44, 118, 164) * entryScale;
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
    const markerY = h * 0.555;
    g.save();
    g.translate(x, markerY);
    g.globalAlpha = 0.72 + pulse * 0.55;
    g.shadowColor = '#ff6048'; g.shadowBlur = 12;
    polygon(g, [[0, -13], [12, 9], [-12, 9]], '#ef6048', '#ffe3b0', 1.5);
    g.shadowBlur = 0;
    g.fillStyle = '#fff3d6'; g.font = '900 14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('!', 0, 1);
    g.restore();
  }
  if (boss.kind === 'shield-breaker') {
    drawHydraulicBoss(g, boss, w, h, time, assets);
    if (boss.stomp > 0) {
      const progress = 1 - boss.stomp / 0.42;
      g.save();
      g.globalAlpha = (1 - progress) * 0.78;
      g.strokeStyle = '#ffc177'; g.lineWidth = 2.5 * (1 - progress) + 0.8;
      g.beginPath(); g.ellipse(boss.x, boss.y + h * 0.12, clamp(w * 0.18, 34, 76) * (0.55 + progress), clamp(w * 0.045, 9, 18) * (0.55 + progress), 0, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    return;
  }
  const collapsing = boss.deathTimer != null;
  const fall = collapsing ? clamp(1 - boss.deathTimer / boss.deathDuration, 0, 1) : 0;
  const topple = collapsing ? smoothstep(clamp((fall - 0.1) / 0.62, 0, 1)) : 0;
  const entering = !collapsing && boss.entryTimer > 0;
  const warningProgress = boss.warning > 0 ? clamp(1 - boss.warning / (boss.warningTotal || 1.25), 0, 1) : 0;
  const recovery = clamp((boss.attackRecover || 0) / 0.58, 0, 1);
  const lunge = boss.warning > 0 ? smoothstep((warningProgress - 0.68) / 0.32) : 0;
  const crouch = boss.warning > 0 ? Math.sin(Math.min(1, warningProgress / 0.72) * Math.PI * 0.5) * (1 - lunge * 0.75) : 0;
  const impact = boss.stomp > 0 ? Math.pow(boss.stomp / 0.42, 2) : 0;
  const hitShake = boss.hitShake > 0 ? Math.sin(time * 92) * boss.hitShake * 18 : 0;
  const breath = collapsing || entering ? 0 : Math.sin(time * 3.1) * 0.04;
  const idleBob = (Math.sin(time * 4.7) * 2.2 + Math.sin(time * 2.1 + 0.7) * 1.2) * entryScale;
  const walkingSpeed = clamp(Math.abs(boss.moveSpeed || 0) / Math.max(1, w * 0.17), 0, 1);
  const walkPhase = boss.walkPhase || 0;
  const walkFrame = Math.sin(walkPhase) > 0 ? assets.bruteWalkB : assets.bruteWalkA;
  const hasWalkFrame = walkFrame?.complete && walkFrame.naturalWidth;
  const gait = !collapsing && boss.warning <= 0 && recovery < 0.02 && hasWalkFrame
    ? entering ? 0.92 : walkingSpeed * clamp((walkingSpeed - 0.04) / 0.25, 0, 1)
    : 0;
  const bob = collapsing ? 0 : idleBob + Math.abs(Math.sin(walkPhase * 2)) * gait * 3.8;
  const movingDirection = Math.sign(boss.moveSpeed || 0);
  const aimDirection = boss.warning > 0 || recovery > 0.02
    ? (boss.attackDirection || 0)
    : movingDirection * 0.35;
  const deathSide = boss.deathSide || 1;
  const deathJolt = collapsing && fall < 0.16 ? Math.sin(time * 58) * (1 - fall / 0.16) * 0.035 : 0;
  const rotation = collapsing
    ? deathSide * (topple * 1.28 + deathJolt)
    : movingDirection * gait * 0.045 + aimDirection * (crouch * 0.09 + lunge * 0.24) + hitShake * 0.004;
  const alpha = collapsing ? 1 - smoothstep(clamp((fall - 0.9) / 0.1, 0, 1)) * 0.14 : 1;
  const width = size * (1 + breath + crouch * 0.055 + lunge * 0.075 + impact * 0.1 + topple * 0.1);
  const height = size * 1.05 * (1 - breath * 0.6 - crouch * 0.105 + lunge * 0.17 - impact * 0.17 - topple * 0.54);
  const offsetX = aimDirection * lunge * size * 0.14 + hitShake + deathSide * topple * size * 0.16;
  const offsetY = boss.y + 38 * entryScale + bob + crouch * 12 - lunge * size * 0.22 + impact * size * 0.08 + topple * size * 0.06;
  if (collapsing) {
    g.save();
    g.fillStyle = 'rgba(5,8,8,' + (0.28 + topple * 0.2) + ')';
    g.beginPath();
    g.ellipse(boss.x + offsetX * 0.35, offsetY + size * 0.035, size * (0.34 + topple * 0.2), size * (0.07 + topple * 0.035), 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  if (gait > 0.08) drawFootstepDust(g, boss.x + offsetX, offsetY, entryScale * (0.7 + gait * 0.3), walkPhase, '#9a927e');
  if (!collapsing && gait > 0.08) {
    for (const side of [-1, 1]) {
      const footPhase = walkPhase + (side > 0 ? Math.PI : 0);
      const plant = 0.5 + Math.cos(footPhase) * 0.5;
      const slide = Math.sin(footPhase) * size * 0.035;
      g.save();
      g.globalAlpha = gait * (0.09 + plant * 0.12);
      g.fillStyle = 'rgba(6,8,8,.72)';
      g.beginPath();
      g.ellipse(boss.x + offsetX + side * size * 0.14 + slide, offsetY + 1, size * (0.105 + plant * 0.025), size * 0.027, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  const windupPose = boss.warning > 0 ? smoothstep((warningProgress - 0.12) / 0.56) : 0;
  const attackPose = collapsing ? 0 : Math.max(windupPose, recovery);
  const tint = boss.hitFlash > 0 ? '#f2bc86' : null;
  const attackReady = assets.bruteAttack?.complete && assets.bruteAttack.naturalWidth;
  const attackMix = attackReady ? attackPose : 0;
  const walkMix = gait * (1 - attackMix);
  const idleMix = (1 - attackMix) * (1 - walkMix);
  if (idleMix > 0.01) {
    drawSprite(g, assets.brute, boss.x + offsetX, offsetY, width, height, 0, rotation, alpha * idleMix, tint);
  }
  if (walkMix > 0.01) {
    drawSprite(g, walkFrame, boss.x + offsetX, offsetY, width, height, 0, rotation, alpha * walkMix, tint);
  }
  if (attackMix > 0.01) {
    drawSprite(g, assets.brute, boss.x + offsetX, offsetY, width, height, 0, rotation, alpha * (1 - attackMix), tint);
    drawSprite(g, assets.bruteAttack, boss.x + offsetX, offsetY, width * 1.02, height * 1.02, 0, rotation, alpha * attackMix, tint);
  }
  if (boss.stomp > 0) {
    const progress = 1 - boss.stomp / 0.42;
    g.save();
    g.globalAlpha = (1 - progress) * 0.72;
    g.strokeStyle = '#ffbd76'; g.lineWidth = 2.2 * (1 - progress) + 0.8;
    g.beginPath(); g.ellipse(boss.x + offsetX, boss.y + 42, size * (0.3 + progress * 0.64), size * (0.075 + progress * 0.13), 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  }
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
    const stride = time * 12 + companion.id * 1.5;
    const step = Math.sin(stride);
    const bob = Math.abs(step) * 2.6;
    const runSway = step * 0.7;
    const generated = companion.id % 2 === 1;
    const standingImage = generated ? assets.supportSurvivorA : assets.supportSurvivorB;
    const runningImage = generated ? assets.supportSurvivorARun : assets.supportSurvivorBRun;
    const image = step > 0 && runningImage?.complete && runningImage.naturalWidth ? runningImage : standingImage;
    const flipX = companion.side > 0;
    const drawX = companion.x + runSway;
    const muzzleX = drawX + (flipX ? -12 : 12);
    const muzzleY = companion.y - 48 + bob;
    drawFootstepDust(g, companion.x, companion.y, 0.45, stride, '#958b74');
    drawSprite(g, image, drawX, companion.y + bob, 36, 62, 0, step * 0.045 - companion.recoil * 0.025, alpha, null, flipX);
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
  const recoil = clamp(s.playerRecoil / 0.11, 0, 1);
  drawSprite(g, image, s.x, s.y + 17 + bob + recoil * 2, w, h, 0, Math.sin(stride) * 0.035 - recoil * 0.045, 1, s.flash > 0 ? '#ff7068' : null);
  if (s.playerMuzzleFlash > 0) {
    const aim = s.target ? Math.atan2(s.target.x - s.x, s.y - s.target.y) : 0;
    const flash = clamp(s.playerMuzzleFlash / 0.075, 0, 1);
    g.save();
    const muzzles = s.weapon === 'twin' ? [8, 22] : [16];
    for (const muzzle of muzzles) {
      g.save();
      g.translate(s.x + muzzle, s.y - 57);
      g.rotate(aim);
      g.globalAlpha = flash;
      g.shadowColor = s.weapon === 'twin' ? '#d7c78c' : '#f4bd62'; g.shadowBlur = 11;
      polygon(g, [[-3, 2], [-4, -5], [-1, -12], [0, -20], [3, -11], [5, -5], [2, 2]], '#f8dfa2', '#e79b48');
      g.shadowBlur = 0;
      g.fillStyle = '#fff4cf';
      g.beginPath(); g.ellipse(0, -5, 2.1, 6.5, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.restore();
  }
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
  const color = bullet.owner === 'drone' ? '#9bb5b7' : bullet.owner === 'companion' ? '#b18b54' : bullet.weapon === 'twin' ? '#d0c58e' : bullet.rapid ? '#c7a358' : bullet.weapon === 'smg' ? '#c3a066' : '#bd9655';
  g.shadowColor = color;
  g.shadowBlur = 3;
  const grad = g.createLinearGradient(0, -7, 0, 5);
  grad.addColorStop(0, 'rgba(204,170,111,0)'); grad.addColorStop(0.55, color); grad.addColorStop(1, '#e1bd79');
  const width = bullet.owner === 'drone' || bullet.weapon === 'twin' ? 3 : bullet.rapid ? 3 : 2.6;
  g.strokeStyle = color;
  g.lineWidth = width * 0.72;
  g.globalAlpha = 0.68;
  g.beginPath(); g.moveTo(0, 7); g.lineTo(0, 17); g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(0, -1, width, 9, 0, 0, Math.PI * 2); g.fill();
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

function drawExplosion(g, effect, time) {
  const p = 1 - effect.life / effect.total;
  if (effect.source === 'barrel') {
    const expansion = smoothstep(p / 0.22);
    const flash = clamp(1 - p / 0.14, 0, 1);
    const fireFade = clamp((0.66 - p) / 0.42, 0, 1);
    const fireRadius = effect.radius * (0.27 + expansion * 0.34) * fireFade;
    const smokeGrow = smoothstep(clamp((p - 0.04) / 0.62, 0, 1));
    const smokeFade = clamp((1.18 - p) / 0.78, 0, 1);
    const smokeAlpha = smoothstep(clamp((p - 0.045) / 0.15, 0, 1)) * smokeFade;
    g.save();
    if (flash > 0) {
      const coreRadius = effect.radius * (0.19 + flash * 0.13);
      const core = g.createRadialGradient(effect.x, effect.y, 1, effect.x, effect.y, coreRadius);
      core.addColorStop(0, 'rgba(255,244,213,.96)');
      core.addColorStop(0.22, 'rgba(255,197,112,.88)');
      core.addColorStop(0.55, 'rgba(200,79,40,.48)');
      core.addColorStop(1, 'rgba(83,41,31,0)');
      g.globalAlpha = flash * 0.92;
      g.fillStyle = core;
      g.beginPath(); g.ellipse(effect.x, effect.y, coreRadius, coreRadius * 0.58, 0, 0, Math.PI * 2); g.fill();
    }

    const flicker = 0.94 + Math.sin(time * 61) * 0.035;
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5 + 0.4;
      const offset = effect.radius * (0.06 + expansion * 0.13);
      const x = effect.x + Math.cos(angle) * offset;
      const y = effect.y + Math.sin(angle) * offset * 0.48;
      const radius = fireRadius * (0.54 + (i % 3) * 0.09) * flicker;
      const flame = g.createRadialGradient(x, y, radius * 0.04, x, y, radius);
      flame.addColorStop(0, 'rgba(255,211,135,.82)');
      flame.addColorStop(0.28, 'rgba(224,111,54,.75)');
      flame.addColorStop(0.72, 'rgba(116,54,39,.42)');
      flame.addColorStop(1, 'rgba(70,43,35,0)');
      g.globalAlpha = fireFade * (0.72 - i * 0.055);
      g.fillStyle = flame;
      g.beginPath(); g.ellipse(x, y, radius, radius * (0.45 + (i % 2) * 0.1), angle * 0.2, 0, Math.PI * 2); g.fill();
    }

    const dustRadius = effect.radius * (0.28 + expansion * 0.9);
    const dust = g.createRadialGradient(effect.x, effect.y, dustRadius * 0.12, effect.x, effect.y, dustRadius);
    dust.addColorStop(0, 'rgba(96,72,54,.42)');
    dust.addColorStop(0.56, 'rgba(75,66,56,.24)');
    dust.addColorStop(1, 'rgba(47,46,42,0)');
    const dustIn = smoothstep(clamp((p - 0.06) / 0.24, 0, 1));
    g.globalAlpha = dustIn * clamp((1 - p * 1.1) * 0.52, 0, 0.52);
    g.fillStyle = dust;
    g.beginPath(); g.ellipse(effect.x, effect.y + 4, dustRadius, dustRadius * 0.34, 0, 0, Math.PI * 2); g.fill();

    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7 + 0.2;
      const drift = effect.radius * (0.1 + smokeGrow * (0.22 + (i % 3) * 0.045));
      const x = effect.x + Math.cos(angle) * drift;
      const y = effect.y - effect.radius * smokeGrow * (0.08 + (i % 2) * 0.055) + Math.sin(angle) * drift * 0.3;
      const radius = effect.radius * (0.18 + smokeGrow * (0.12 + (i % 3) * 0.035));
      const soot = g.createRadialGradient(x - radius * 0.18, y - radius * 0.24, radius * 0.04, x, y, radius);
      soot.addColorStop(0, 'rgba(71,63,54,.82)');
      soot.addColorStop(0.52, 'rgba(49,47,43,.66)');
      soot.addColorStop(1, 'rgba(36,37,35,0)');
      g.globalAlpha = smokeAlpha * (0.52 + (i % 3) * 0.09);
      g.fillStyle = soot;
      g.beginPath(); g.ellipse(x, y, radius, radius * (0.68 + (i % 2) * 0.1), angle * 0.14, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    return;
  }
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
    drawExplosion(g, effect, time);
    return;
  }
  const progress = 1 - effect.life / effect.total;
  if (effect.kind === 'bossFallDust') {
    const spread = effect.radius * (0.28 + smoothstep(clamp(progress / 0.3, 0, 1)) * 0.72);
    const dust = g.createRadialGradient(effect.x, effect.y - spread * 0.08, spread * 0.08, effect.x, effect.y, spread);
    dust.addColorStop(0, 'rgba(154,143,123,.46)');
    dust.addColorStop(0.48, 'rgba(116,108,94,.3)');
    dust.addColorStop(1, 'rgba(69,68,61,0)');
    g.save();
    g.globalAlpha = (1 - progress) * 0.68;
    g.fillStyle = dust;
    g.beginPath(); g.ellipse(effect.x, effect.y + 2, spread, spread * 0.3, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = (1 - progress) * 0.22;
    g.strokeStyle = 'rgba(183,168,142,.72)'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(effect.x, effect.y + 2, spread * 0.84, spread * 0.23, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
    return;
  }
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
    if (effect.explosive) return;
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
  if (effect.kind === 'kill') {
    const rise = progress * 24;
    const combo = effect.combo || 1;
    const label = combo === 1 ? '+' + effect.amount : combo === 2 ? 'DOUBLE KILL' : combo === 3 ? 'TRIPLE KILL' : 'KILL STREAK ×' + combo;
    g.save();
    g.globalAlpha = clamp((1 - progress) * 1.3, 0, 1);
    g.font = combo === 1 ? '900 13px sans-serif' : '900 15px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(16,20,19,.92)'; g.strokeText(label, effect.x, effect.y - rise);
    g.fillStyle = combo === 1 ? '#dfd4ae' : '#ffd37b'; g.fillText(label, effect.x, effect.y - rise);
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
    const size = effect.radius * (0.45 + progress * 1.15);
    const color = effect.material === 'armor' ? '#fff0b0' : effect.material === 'metal' ? '#d0a66d' : '#b9956c';
    g.globalAlpha = 1 - progress;
    g.strokeStyle = color; g.lineWidth = effect.material === 'armor' ? 2.8 : 1.5;
    g.beginPath(); g.ellipse(effect.x, effect.y, size * 0.72, size * 0.52, 0, 0, Math.PI * 2); g.stroke();
    for (let ray = 0; ray < 6; ray++) {
      const angle = ray * Math.PI / 3 + progress * 0.24;
      const inner = size * 0.48, outer = size * (0.78 + (ray % 2) * 0.32);
      g.beginPath();
      g.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
      g.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
      g.stroke();
    }
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
  const isSupply = ['weapon', 'twin', 'upgrade', 'companion', 'drone', 'rocket', 'rapidfire', 'heal'].includes(target.kind);
  const isExplosive = target.kind === 'explosive';
  const color = isBoss || isExplosive ? '#bc8067' : isSupply ? '#a99772' : '#887b65';
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
  g.strokeStyle = color; g.lineWidth = 1.25;
  const cx = target.x, cy = target.y - radius * 0.45, c = radius * 0.42;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    g.beginPath(); g.moveTo(cx + sx * radius, cy + sy * radius * 0.45); g.lineTo(cx + sx * (radius - c), cy + sy * radius * 0.45); g.lineTo(cx + sx * (radius - c), cy + sy * (radius * 0.45 - c)); g.stroke();
  }
  g.restore();
}

function drawTitleScene(g, w, h, time, assets, stageId) {
  drawRoad(g, w, h, (time * 0.00008) % 1, assets, stageId === 'stage02' ? 'tollgate' : 'highway');
  drawZombie(g, { kind: 'walker', x: w * 0.42, y: h * 0.34, radius: 14, hp: 20, maxHp: 20, phase: 1 }, h, time / 1000, assets);
  drawZombie(g, { kind: 'runner', x: w * 0.66, y: h * 0.48, radius: 14, hp: 15, maxHp: 15, phase: 2 }, h, time / 1000, assets);
  drawBarrel(g, { kind: 'companion', x: w * 0.32, y: h * 0.59, lane: 0, hp: 40 }, w, h, time / 1000);
  drawBarrel(g, {
    kind: stageId === 'stage02' ? 'twin' : 'weapon',
    x: w * 0.72, y: h * 0.62, lane: 2, hp: stageId === 'stage02' ? 58 : 40,
  }, w, h, time / 1000);
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

export function drawScene(ctx, s, w, h, now, title, assets, previewStageId = 'stage01') {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  if (s && s.hitShake > 0) {
    const shake = s.hitShake * 11;
    ctx.translate(Math.sin(now * 0.07) * shake, Math.cos(now * 0.09) * shake * 0.45);
  }
  const offset = s ? s.roadOffset : (now * 0.00008) % 1;
  if (title || !s) {
    drawTitleScene(ctx, w, h, now, assets || {}, previewStageId);
    ctx.restore();
    return;
  }
  drawRoad(ctx, w, h, offset, assets, s.stageDefinition.background);
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
  drawParticles(ctx, s.particles);
  for (const effect of s.effects) drawEffect(ctx, effect, time);
  for (const hazard of s.hazards) drawHazard(ctx, hazard, time);
  drawRocketMissiles(ctx, s.missiles, assets || {}, time);
  for (const bullet of s.bullets) drawBullet(ctx, bullet);
  if (s.powerFlash > 0) {
    const alpha = Math.min(0.12, s.powerFlash * 0.1);
    const glow = ctx.createRadialGradient(s.x, s.y - 20, 4, s.x, s.y - 20, h * 0.32);
    glow.addColorStop(0, 'rgba(190,160,111,' + alpha + ')'); glow.addColorStop(1, 'rgba(151,121,79,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  }
  drawBarrelBadges(ctx, s.barrels, w, h);
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
    const pulse = (Math.sin(now * 0.018) + 1) * 0.5;
    ctx.fillStyle = 'rgba(76,8,9,' + (0.035 + pulse * 0.045) + ')';
    ctx.fillRect(0, 0, w, h);

    const edgeAlpha = 0.11 + pulse * 0.27;
    const topSignal = ctx.createLinearGradient(0, 0, 0, h * 0.22);
    topSignal.addColorStop(0, 'rgba(176,24,22,' + edgeAlpha + ')');
    topSignal.addColorStop(1, 'rgba(176,24,22,0)');
    ctx.fillStyle = topSignal;
    ctx.fillRect(0, 0, w, h * 0.22);
    const bottomSignal = ctx.createLinearGradient(0, h, 0, h * 0.78);
    bottomSignal.addColorStop(0, 'rgba(176,24,22,' + edgeAlpha + ')');
    bottomSignal.addColorStop(1, 'rgba(176,24,22,0)');
    ctx.fillStyle = bottomSignal;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);

    ctx.strokeStyle = 'rgba(239,58,48,' + (0.24 + pulse * 0.48) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 3); ctx.lineTo(w, 3);
    ctx.moveTo(0, h - 3); ctx.lineTo(w, h - 3);
    ctx.stroke();
  }
  ctx.restore();
}


