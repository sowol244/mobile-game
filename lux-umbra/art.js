// Character art drawn with canvas paths, in tile units (1 = one tile). The caller sets the transform.
// Used by the renderer and for the home-screen icon.

const TAU = Math.PI * 2;

// Lux: a small black silhouette with glowing eyes, a scarf and a hand torch.
// (x, y) = feet centre. o: { face, aim, on, walk, air, vy, t, col: [r,g,b] torch colour, scale }
export function drawPlayer(g, x, y, o = {}) {
  const face = o.face || 1, t = o.t || 0, walk = o.walk || 0, air = !!o.air;
  const s = o.scale || 1;
  g.save();
  g.translate(x, y); g.scale(s, s);
  const ink = o.ink || '#030308';
  // scarf: trails behind, flutters
  const sw = Math.sin(t * 9 + walk * 3) * 0.05;
  g.fillStyle = o.scarf || '#030308';
  g.beginPath();
  g.moveTo(0.02 * face, -0.5);
  g.quadraticCurveTo(-0.28 * face, -0.52 + sw, -0.5 * face, -0.42 + sw * 2 + (air ? -0.08 : 0));
  g.lineTo(-0.46 * face, -0.36 + sw * 2 + (air ? -0.08 : 0));
  g.quadraticCurveTo(-0.24 * face, -0.42 + sw, 0.02 * face, -0.42);
  g.closePath(); g.fill();
  // legs
  g.strokeStyle = ink; g.lineCap = 'round'; g.lineWidth = 0.11;
  const sp = air ? 0.35 : Math.sin(walk * 2.2) * 0.45;
  g.beginPath();
  g.moveTo(-0.07, -0.2); g.lineTo(-0.07 + Math.sin(sp) * 0.2, -0.02 - (air ? 0.06 : 0));
  g.moveTo(0.07, -0.2); g.lineTo(0.07 - Math.sin(sp) * 0.2, -0.02);
  g.stroke();
  // body (little cloak)
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(-0.13, -0.5); g.lineTo(0.13, -0.5); g.lineTo(0.2, -0.16); g.quadraticCurveTo(0, -0.12, -0.2, -0.16); g.closePath(); g.fill();
  // head + a tuft of hair
  g.beginPath(); g.arc(0, -0.66, 0.235, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-0.04, -0.88); g.quadraticCurveTo(0.02 - 0.1 * face, -1.02, -0.14 * face, -0.98); g.quadraticCurveTo(-0.02 * face, -0.95, 0.06, -0.87); g.fill();
  // arm + torch toward the aim
  const a = o.aim ?? (face > 0 ? 0.2 : Math.PI - 0.2);
  const sx = 0.05 * face, sy = -0.42;
  const hx = sx + Math.cos(a) * 0.26, hy = sy + Math.sin(a) * 0.26;
  g.lineWidth = 0.08; g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke();
  g.save(); g.translate(hx, hy); g.rotate(a);
  g.fillStyle = '#16161f'; g.fillRect(-0.06, -0.05, 0.2, 0.1);
  g.fillStyle = '#2a2a38'; g.fillRect(0.11, -0.065, 0.06, 0.13);
  if (o.on) {
    const c = o.col || [255, 226, 160];
    g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.shadowColor = `rgb(${c[0]},${c[1]},${c[2]})`; g.shadowBlur = 8;
    g.fillRect(0.165, -0.055, 0.03, 0.11);
  }
  g.restore();
  // eyes
  const blink = (t % 3.7) < 0.12 ? 0.25 : 1;
  g.fillStyle = '#fff6dc'; g.shadowColor = 'rgba(255,240,200,0.9)'; g.shadowBlur = 6;
  const ex = 0.07 * face;
  g.beginPath(); g.ellipse(ex - 0.05, -0.68, 0.045, 0.062 * blink, 0, 0, TAU); g.ellipse(ex + 0.08, -0.68, 0.045, 0.062 * blink, 0, 0, TAU); g.fill();
  g.restore();
}

// Stone statue (0.8 × 1.5 tiles). (x, y) = feet centre. awake → red eyes, a little shake.
export function drawStatue(g, x, y, o = {}) {
  const awake = !!o.awake, t = o.t || 0, face = o.face || -1;
  g.save();
  const jx = awake ? Math.sin(t * 40) * 0.015 : 0;
  g.translate(x + jx, y);
  const stone = awake ? '#5a5560' : '#343b4c', dark = awake ? '#2c2830' : '#1c2130', lit = o.lit ? 1 : 0;
  // pedestal
  g.fillStyle = dark; g.fillRect(-0.4, -0.16, 0.8, 0.16);
  // legs / robe
  g.fillStyle = stone;
  g.beginPath(); g.moveTo(-0.3, -0.16); g.lineTo(-0.24, -0.92); g.lineTo(0.24, -0.92); g.lineTo(0.3, -0.16); g.closePath(); g.fill();
  // shoulders + arms
  g.beginPath(); g.moveTo(-0.36, -0.9); g.quadraticCurveTo(0, -1.08, 0.36, -0.9); g.lineTo(0.33, -0.5); g.lineTo(0.22, -0.5); g.lineTo(0.2, -0.82); g.lineTo(-0.2, -0.82); g.lineTo(-0.22, -0.5); g.lineTo(-0.33, -0.5); g.closePath(); g.fill();
  // head (blocky mask)
  g.beginPath(); g.moveTo(-0.17, -1.05); g.lineTo(0.17, -1.05); g.lineTo(0.15, -1.42); g.quadraticCurveTo(0, -1.52, -0.15, -1.42); g.closePath(); g.fill();
  // carved lines
  g.strokeStyle = dark; g.lineWidth = 0.035;
  g.beginPath(); g.moveTo(-0.12, -0.6); g.lineTo(0.02, -0.4); g.lineTo(-0.05, -0.25); g.moveTo(0.1, -0.86); g.lineTo(0.16, -0.7);
  g.moveTo(-0.17, -1.12); g.lineTo(0.17, -1.12); g.stroke();
  if (lit) { g.strokeStyle = 'rgba(255,225,170,0.45)'; g.lineWidth = 0.04; g.beginPath(); g.moveTo(-0.36, -0.9); g.quadraticCurveTo(0, -1.08, 0.36, -0.9); g.moveTo(-0.15, -1.42); g.quadraticCurveTo(0, -1.52, 0.15, -1.42); g.stroke(); }
  // eyes
  const ex = 0.04 * face;
  if (awake) { g.fillStyle = '#ff4a36'; g.shadowColor = '#ff3020'; g.shadowBlur = 10; }
  else g.fillStyle = '#10131c';
  g.fillRect(ex - 0.11, -1.3, 0.08, 0.04); g.fillRect(ex + 0.03, -1.3, 0.08, 0.04);
  g.restore();
}

// Wooden crate, (x, y) = top-left, size w×h tiles.
export function drawCrate(g, x, y, w, h, lit) {
  g.save();
  g.fillStyle = lit ? '#3a2a1c' : '#18120d';
  g.fillRect(x, y, w, h);
  g.strokeStyle = lit ? '#6b4e30' : '#2c2117'; g.lineWidth = 0.06;
  g.strokeRect(x + 0.06, y + 0.06, w - 0.12, h - 0.12);
  g.beginPath(); g.moveTo(x + 0.1, y + 0.1); g.lineTo(x + w - 0.1, y + h - 0.1); g.moveTo(x + w - 0.1, y + 0.1); g.lineTo(x + 0.1, y + h - 0.1); g.stroke();
  if (lit) { g.fillStyle = 'rgba(255,220,160,0.5)'; g.fillRect(x, y, w, 0.05); }
  g.restore();
}
