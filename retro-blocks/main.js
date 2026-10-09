import * as L from './logic.js';
import { createSound } from './sound.js';
import { STEPS } from './tutorial.js';

const $ = id => document.getElementById(id);
const STEP_MS = 1000 / 60;

/* ---------- storage (prefix retro-) ---------- */
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem('retro-' + k)); return v ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem('retro-' + k, JSON.stringify(v)); } catch { /* private mode */ } };

const sound = createSound();
sound.setMuted(load('muted', false));
const opts = Object.assign({ ghost: false, hard: false, swipe: false, lv19: false, music: true }, load('opts', {}));
sound.setMusic(opts.music);
const setup = Object.assign({ mode: 'A', level: 0, height: 0 }, load('setup', {}));

/* ---------- NES level palettes (colour 1, colour 2) ---------- */
const PAL = [
  ['#0058f8', '#3cbcfc'], ['#00a800', '#b8f818'], ['#d800cc', '#f878f8'], ['#0058f8', '#58d854'], ['#e40058', '#58f898'],
  ['#58f898', '#6888fc'], ['#f83800', '#7c7c7c'], ['#6844fc', '#a80020'], ['#0058f8', '#f83800'], ['#f83800', '#fca044'],
];
const pal = level => PAL[((level % 10) + 10) % 10];
const WHITE = '#fcfcfc';

// One NES block: 7×7 pixels plus a 1-pixel gap. style 0 = white centre with colour rim, 1/2 = solid colour with a shine.
function drawBlock(g, x, y, style, p) {
  g.fillStyle = style === 2 ? p[1] : p[0];
  g.fillRect(x, y, 7, 7);
  g.fillStyle = WHITE;
  if (style === 0) { g.fillRect(x + 1, y + 1, 5, 5); g.fillRect(x, y, 1, 1); }
  else { g.fillRect(x, y, 1, 1); g.fillRect(x + 1, y + 1, 2, 1); g.fillRect(x + 1, y + 2, 1, 1); }
}
const styleOf = v => L.STYLE[(v - 1) % 7];

/* ---------- DOM ---------- */
const field = $('field'), fg = field.getContext('2d');
const nextC = $('nextC'), ng = nextC.getContext('2d');
const overlay = $('overlay');
const panels = { main: $('pMain'), ask: $('pAsk'), setup: $('pSetup'), opt: $('pOpt'), pause: $('pPause'), help: $('pHelp'), rank: $('pRank'), entry: $('pEntry') };
const startBtn = $('start'), homeBtn = $('home'), helpBtn = $('helpBtn'), menuLink = $('toMenu');
const statC = [];
for (let t = 0; t < 7; t++) {
  const row = document.createElement('div'); row.className = 'st';
  const c = document.createElement('canvas'); c.width = 32; c.height = 16;
  const s = document.createElement('span'); s.textContent = '000';
  row.append(c, s); $('stats').append(row); statC.push({ c, s });
}

/* ---------- state ---------- */
let game = null;
let phase = 'title';           // title | play | paused | end
let tut = null;                // tutorial progress
let afterGame = false;         // title panel shows 처음으로 instead of 게임 설명/게임 선택
let lastEntryId = null, optFrom = 'setup', endShown = false, levelShown = -1;
let acc = 0, lastT = 0;

/* ---------- input ---------- */
const keys = { left: false, right: false, down: false };
const latch = { left: false, right: false, down: false }; // a press shorter than one frame still counts
let pend = { cw: 0, ccw: 0, hard: 0, nudge: 0 };
let dpadDir = null, swipeDown = false;
const playing = () => phase === 'play';

function press(dir) { latch[dir] = true; }
function readInput() {
  const held = d => keys[d] || dpadDir === d || latch[d];
  const inp = { left: held('left'), right: held('right'), down: held('down') || swipeDown, ...pend };
  latch.left = latch.right = latch.down = false;
  pend = { cw: 0, ccw: 0, hard: 0, nudge: 0 };
  return inp;
}

/* ---------- layout: pick a cell size that keeps blocks pixel-crisp ---------- */
function layout() {
  const scr = $('screen').getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  // width: 10 cells + frame (0.5) + gap (0.3) + side (4.2); height: lines box (1.5) + gap + 20 cells + frame + borders
  let c = Math.min((scr.width - 4) / 14.8, (scr.height - 8) / 22.3);
  c = Math.max(8, c);
  const dev = c * dpr, snap = Math.floor(dev / 8) * 8;
  c = snap >= dev * 0.9 && snap > 0 ? snap / dpr : Math.floor(dev) / dpr;
  document.documentElement.style.setProperty('--cell', c + 'px');
  // controller sizes
  const land = matchMedia('(orientation: landscape) and (max-height: 600px)').matches;
  const pad = $('pad').getBoundingClientRect();
  const ds = land ? Math.min(170, innerHeight * 0.5, (innerWidth - 10 * c - 4.6 * c - 80) / 2) : Math.min(168, pad.height - 20, (pad.width - 24) * 0.42);
  document.documentElement.style.setProperty('--dsize', Math.max(110, ds) + 'px');
  document.documentElement.style.setProperty('--absize', Math.max(116, ds * 1.06) + 'px');
}

/* ---------- drawing ---------- */
function drawField() {
  const g = game, p = pal(g ? g.level : setup.level);
  fg.fillStyle = '#000'; fg.fillRect(0, 0, 80, 160);
  if (!g) return;
  if (g.phase === 'clear' && g.clearing.length === 4 && Math.floor(g.timer / 4) % 2 === 0) { fg.fillStyle = '#2c2c2c'; fg.fillRect(0, 0, 80, 160); }
  const wiped = g.phase === 'clear' ? Math.min(5, Math.floor(g.timer / 4) + 1) : 0;
  for (let y = 0; y < L.H; y++) {
    const clearing = wiped && g.clearing.includes(y);
    for (let x = 0; x < L.W; x++) {
      const v = g.board[y * L.W + x];
      if (!v) continue;
      if (clearing && x >= 5 - wiped && x < 5 + wiped) continue;
      drawBlock(fg, x * 8, y * 8, styleOf(v), p);
    }
  }
  if (g.phase === 'play' && g.piece) {
    const pc = g.piece;
    if (opts.ghost) {
      const gy = L.dropY(g.board, pc);
      if (gy > pc.y) {
        fg.fillStyle = L.STYLE[pc.t] === 2 ? p[1] : p[0];
        fg.globalAlpha = 0.85;
        for (const [x, y] of L.cellsOf(pc.t, pc.r, pc.x, gy)) if (y >= 0) { fg.fillRect(x * 8, y * 8, 7, 1); fg.fillRect(x * 8, y * 8 + 6, 7, 1); fg.fillRect(x * 8, y * 8, 1, 7); fg.fillRect(x * 8 + 6, y * 8, 1, 7); }
        fg.globalAlpha = 1;
      }
    }
    for (const [x, y] of L.cellsOf(pc.t, pc.r, pc.x, pc.y)) if (y >= 0) drawBlock(fg, x * 8, y * 8, L.STYLE[pc.t], p);
  }
  if (g.phase === 'over') {
    // NES-style curtain: rows fill from the top down
    const rows = Math.min(L.H, Math.floor(g.timer / 4));
    for (let y = 0; y < rows; y++) for (let x = 0; x < L.W; x++) drawBlock(fg, x * 8, y * 8, y % 2 ? 0 : 1, p);
  }
}

function drawPiece(g, t, ox, oy, p) {
  for (const [dx, dy] of L.SHAPES[t][0]) drawBlock(g, ox + dx * 8, oy + dy * 8, L.STYLE[t], p);
}
function pieceBox(t) {
  const c = L.SHAPES[t][0], xs = c.map(v => v[0]), ys = c.map(v => v[1]);
  return { minx: Math.min(...xs), maxx: Math.max(...xs), miny: Math.min(...ys), maxy: Math.max(...ys) };
}
function drawNext() {
  ng.fillStyle = '#000'; ng.fillRect(0, 0, 36, 20);
  if (!game) return;
  const t = game.next, b = pieceBox(t), w = (b.maxx - b.minx + 1) * 8 - 1, h = (b.maxy - b.miny + 1) * 8 - 1;
  drawPiece(ng, t, Math.round((36 - w) / 2) - b.minx * 8, Math.round((20 - h) / 2) - b.miny * 8, pal(game.level));
}
function drawStats() {
  const p = pal(game ? game.level : setup.level);
  statC.forEach(({ c, s }, t) => {
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 32, 16);
    const b = pieceBox(t), w = (b.maxx - b.minx + 1) * 8 - 1, h = (b.maxy - b.miny + 1) * 8 - 1;
    drawPiece(g, t, Math.round((32 - w) / 2) - b.minx * 8, Math.round((16 - h) / 2) - b.miny * 8, p);
    s.textContent = String(game ? Math.min(999, game.stats[t]) : 0).padStart(3, '0');
  });
}
const pad = (n, k) => String(n).padStart(k, '0');
let hudKey = '';
function hud() {
  const g = game;
  const top = Math.max(topScore(), g ? g.score : 0);
  const key = g ? [g.score, g.lines, g.level, g.next, g.stats.join(), top, g.mode].join('|') : 'none' + top;
  if (key === hudKey) return;
  hudKey = key;
  $('score').textContent = pad(g ? g.score : 0, 6);
  $('top').textContent = pad(top, 6);
  $('level').textContent = pad(g ? g.level : setup.level, 2);
  $('typeLbl').textContent = (g ? g.mode : setup.mode) + '-TYPE';
  $('lines').textContent = pad(g ? (g.mode === 'B' ? L.linesLeft(g) : g.lines) : 0, 3);
  drawNext(); drawStats();
  const p = pal(g ? g.level : 0);
  document.documentElement.style.setProperty('--acc', p[1]);
  document.documentElement.style.setProperty('--acc2', p[0]);
}

function popup(text, kr = false) {
  const el = $('pop');
  el.textContent = text; el.className = kr ? 'kr' : '';
  void el.offsetWidth; el.classList.add('show');
}

/* ---------- game flow ---------- */
const topList = () => load('top', []);
const topScore = () => { const t = topList(); return t.length ? t[0].score : 0; };

function newGame(o) {
  game = L.createGame({ ...o, hardDrop: true, seed: (Math.random() * 2 ** 32) >>> 0 });
  levelShown = game.level; endShown = false; hudKey = '';
  phase = 'play'; acc = 0;
  overlay.hidden = true; $('pausedMask').hidden = true;
  sound.unlock(); sound.setDanger(false);
  if (opts.music) sound.musicStart(); else sound.musicStop();
}
function startGame() {
  tut = null; showCoach(false);
  newGame({ mode: setup.mode, start: setup.level, height: setup.height });
}

function tick() {
  const inp = readInput();
  L.step(game, inp);
  const ev = game.events.splice(0);
  for (const e of ev) onEvent(e);
  if (tut) tutorialTick(ev);
  if ((game.phase === 'over' && game.timer >= L.H * 4 + 45) || (game.phase === 'won' && game.timer >= 100)) endGame();
}

function onEvent(e) {
  switch (e.type) {
    case 'move': sound.move(); break;
    case 'rotate': sound.rotate(); break;
    case 'lock': sound.lock(); break;
    case 'clear':
      if (e.n === 4) { sound.four(); popup('4줄!', true); flash(); } else sound.clear(e.n);
      break;
    case 'level':
      sound.level(); popup('LEVEL ' + pad(e.level, 2));
      break;
    case 'spawn':
      sound.setDanger(L.stackHeight(game.board) >= 14);
      break;
    case 'over': sound.musicStop(); sound.over(); break;
    case 'won': sound.musicStop(); sound.win(); popup('CLEAR!'); break;
  }
}
function flash() {
  const f = $('flash');
  f.animate([{ opacity: 0.35 }, { opacity: 0 }, { opacity: 0.25 }, { opacity: 0 }, { opacity: 0.15 }, { opacity: 0 }], { duration: 340, easing: 'steps(6)' });
}

function endGame() {
  if (endShown) return;
  endShown = true; phase = 'end';
  sound.musicStop();
  if (tut) { endTutorial(false); return; }
  const g = game, top = topList();
  if (L.qualifies(top, g.score)) {
    $('eScore').textContent = pad(g.score, 6);
    $('nameIn').value = load('name', '');
    panel('entry');
    setTimeout(() => { try { $('nameIn').focus({ preventScroll: true }); } catch { } }, 50);
  } else showResult();
}
function saveEntry() {
  const g = game;
  const name = ($('nameIn').value.trim() || 'PLAYER').slice(0, 8);
  save('name', name);
  const d = new Date();
  const entry = { id: Date.now(), t: Date.now(), name, score: g.score, lines: g.lines, level: g.level, mode: g.mode, start: g.start, date: `${d.getMonth() + 1}/${d.getDate()}` };
  const { list } = L.insertScore(topList(), entry);
  save('top', list);
  lastEntryId = entry.id;
  $('nameIn').blur();
  hudKey = '';
  renderTop(); panel('rank');
  afterRank = true;
}
let afterRank = false;
function showResult() {
  const g = game;
  afterGame = true; buttons();
  $('msg').textContent = g.phase === 'won' ? 'B-TYPE 성공!' : '게임 오버';
  $('final').hidden = false; $('final').textContent = pad(g.score, 6);
  $('finalInfo').hidden = false;
  $('finalInfo').textContent = `${g.mode}-TYPE  LV ${pad(g.level, 2)}  ${g.lines} LINES`;
  panel('main');
}
function showTitle() {
  game = null; phase = 'title'; tut = null; afterGame = false; afterRank = false;
  sound.musicStop(); showCoach(false); hudKey = '';
  $('msg').textContent = '떨어지는 블록으로 줄을 지우는 고전 퍼즐 게임';
  $('final').hidden = true; $('finalInfo').hidden = true;
  buttons(); panel('main');
}
function buttons() { helpBtn.hidden = afterGame; menuLink.hidden = afterGame; homeBtn.hidden = !afterGame; }
function panel(name) {
  for (const [k, el] of Object.entries(panels)) el.hidden = k !== name;
  overlay.hidden = false; overlay.scrollTop = 0;
}

function pauseGame() {
  if (phase !== 'play') return;
  phase = 'paused'; sound.musicStop(); sound.pause();
  $('pausedMask').hidden = false;
  releaseAll();
  panel('pause');
}
function resumeGame() {
  if (phase !== 'paused') return;
  phase = 'play'; acc = 0; overlay.hidden = true; $('pausedMask').hidden = true;
  sound.unlock(); sound.pause();
  if (opts.music && game && (game.phase === 'play' || game.phase === 'are' || game.phase === 'clear')) sound.musicStart(false);
}
function releaseAll() { keys.left = keys.right = keys.down = false; dpadDir = null; swipeDown = false; $('dpad').dataset.dir = ''; document.querySelectorAll('.rb.down').forEach(b => b.classList.remove('down')); }

/* ---------- setup / options / help / ranking ---------- */
function buildSetup() {
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === setup.mode));
  const max = opts.lv19 ? 20 : 10;
  if (setup.level >= max) setup.level = 0;
  const lv = $('lvGrid'); lv.replaceChildren(); lv.classList.toggle('many', max > 10);
  for (let i = 0; i < max; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sel' + (i === setup.level ? ' on' : ''); b.textContent = i;
    b.addEventListener('click', () => { setup.level = i; save('setup', setup); sound.click(); buildSetup(); });
    lv.append(b);
  }
  const hg = $('hGrid'); hg.replaceChildren();
  const isB = setup.mode === 'B';
  hg.hidden = !isB; $('hLbl').hidden = !isB;
  for (let i = 0; i <= 5; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sel' + (i === setup.height ? ' on' : ''); b.textContent = i;
    b.addEventListener('click', () => { setup.height = i; save('setup', setup); sound.click(); buildSetup(); });
    hg.append(b);
  }
  hudKey = ''; hud(); drawField();
}
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { setup.mode = b.dataset.mode; save('setup', setup); sound.click(); buildSetup(); }));

const OPTS = [
  ['ghost', '고스트 블록', '떨어질 자리를 미리 보여 줘요'],
  ['hard', '▲로도 떨어뜨리기', '▲ · 위로 튕겨도 바로 떨어져요'],
  ['swipe', '스와이프 조작', '판을 쓸어 이동, 톡 쳐서 회전'],
  ['lv19', '레벨 0–19 선택', '더 빠른 레벨부터 시작해요'],
  ['music', '배경 음악', '8비트 음악을 틀어요'],
];
function buildOpts() {
  const ul = $('optList'); ul.replaceChildren();
  for (const [k, name, desc] of OPTS) {
    const li = document.createElement('li');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'opt' + (opts[k] ? ' on' : ''); b.dataset.opt = k;
    b.setAttribute('aria-pressed', String(!!opts[k]));
    b.innerHTML = `<span>${name}<small>${desc}</small></span><span class="sw">${opts[k] ? 'ON' : 'OFF'}</span>`;
    b.addEventListener('click', () => { opts[k] = !opts[k]; save('opts', opts); applyOpts(); sound.click(); buildOpts(); });
    li.append(b); ul.append(li);
  }
}
function applyOpts() {
  sound.setMusic(opts.music);
  document.querySelector('#dpad .iu').classList.toggle('off', !opts.hard);
}
function buildHelp() {
  const items = [
    ['◀ ▶', '블록을 옮겨요. 누르고 있으면 계속 가요.'],
    ['▼', '누르고 있으면 빨리 내려와요. (1줄 1점)'],
    ['A B', '<b>A</b> 돌리기, <b>B</b> 바로 떨어뜨리기'],
    ['1-4', '가로줄을 채우면 지워져요. 40·100·300·1200점'],
    ['×LV', '점수는 (레벨+1)배! <b>4줄</b>이 가장 커요.'],
    ['LV↑', '10줄마다 레벨이 올라 빨라져요.'],
    ['B', '<b>B-TYPE</b>: 쌓인 블록 위에서 25줄 지우기'],
    ['PC', '방향키 · X 회전 · 스페이스 떨어뜨리기 · P 일시정지'],
  ];
  const ul = $('helpList'); ul.replaceChildren();
  for (const [k, html] of items) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="k">${k}</span><span>${html}</span>`;
    ul.append(li);
  }
}
function renderTop() {
  const top = topList(), rows = $('rows');
  rows.replaceChildren();
  top.forEach((e, i) => {
    const li = document.createElement('li');
    if (e.id === lastEntryId) li.className = 'me';
    const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = i + 1;
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = e.name;
    const sm = document.createElement('small'); sm.textContent = `${e.mode}-TYPE LV${pad(e.level, 2)} ${e.lines}L ${e.date}`; nm.append(sm);
    const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = pad(e.score, 6);
    li.append(rk, nm, sc); rows.append(li);
  });
  rows.hidden = !top.length;
  $('rankNote').textContent = top.length ? '이 기기에 저장된 상위 10개 기록이에요.' : '아직 기록이 없어요. 한 판 해 보세요!';
}

/* ---------- tutorial ---------- */
function showCoach(on) { $('coach').hidden = !on; $('statsBox').hidden = on; }
function startTutorial() {
  sound.unlock();
  newGame({ mode: 'A', start: 0, sequence: [0, 1, 5, 4, 2, 3, 0, 1, 5] });
  game.fall = 0; // no long first-piece pause in the tutorial
  tut = { i: 0, moves: 0, cw: 0, ccw: 0, soft: 0, cleared: 0 };
  showCoach(true); coach();
}
function coach(warn = false) {
  const s = STEPS[tut.i];
  $('cstep').textContent = `${tut.i + 1}/${STEPS.length}`;
  $('ctext').innerHTML = warn ? '다시 해 봐요! <b>A</b>로 세우고 <b>▶</b>로 끝까지.' : s.text;
  $('ctext').classList.toggle('warn', warn);
  $('cpc').textContent = s.pc ? 'PC: ' + s.pc : '';
  $('cnext').hidden = !s.last; $('cskip').hidden = !!s.last;
}
function wellSetup() {
  const g = game;
  g.board = L.emptyBoard();
  for (let y = L.H - 4; y < L.H; y++) for (let x = 0; x < 9; x++) g.board[y * L.W + x] = 1 + ((x * 3 + y) % 7);
  if (g.phase === 'clear') { g.clearing = []; g.phase = 'are'; g.timer = g.are; }
  if (g.phase === 'play') { g.piece = { t: 6, r: 0, x: 5, y: 0 }; g.fall = 0; }
  L.forceNext(g, 6);
  g.sequence = [6, 6, 6, 6, 6, 6];
}
function tutorialTick(ev) {
  const st = tut, s = STEPS[st.i];
  for (const e of ev) {
    if (e.type === 'move') st.moves++;
    if (e.type === 'rotate') { if (e.dir > 0) st.cw++; else st.ccw++; }
    if (e.type === 'hard') st.hard = (st.hard || 0) + 1;
    if (e.type === 'lock') st.soft = Math.max(st.soft, e.soft);
    if (e.type === 'clear') st.cleared++;
  }
  if (s.setup === 'well' && !st.cleared && ev.some(e => e.type === 'lock') && !ev.some(e => e.type === 'clear')) { wellSetup(); coach(true); return; }
  if (s.done && s.done(st)) {
    st.i++;
    sound.level();
    const n = STEPS[st.i];
    if (n.setup === 'well') { st.cleared = 0; wellSetup(); }
    coach();
  }
}
function endTutorial(completed) {
  save('tut', true);
  tut = null; showCoach(false);
  game = null; phase = 'title'; sound.musicStop(); hudKey = '';
  if (completed !== null) { buildSetup(); panel('setup'); }
}

/* ---------- main loop ---------- */
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(100, now - (lastT || now)); lastT = now;
  if (phase === 'play' && game) {
    acc += dt;
    let n = 0;
    while (acc >= STEP_MS && n < 6) { tick(); acc -= STEP_MS; n++; if (phase !== 'play') break; }
    if (n >= 6) acc = 0;
  } else acc = 0;
  drawField(); hud();
}

/* ---------- controls: keyboard ---------- */
const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down' };
window.addEventListener('keydown', e => {
  if (e.target === $('nameIn')) { if (e.key === 'Enter') saveEntry(); return; }
  const k = KEYMAP[e.code];
  if (phase === 'play') {
    if (k) { e.preventDefault(); if (!keys[k]) press(k); keys[k] = true; return; }
    if (e.repeat) return;
    if (e.code === 'KeyX' || e.code === 'ArrowUp') { e.preventDefault(); pend.cw++; }
    else if (e.code === 'KeyZ' || e.code === 'Space') { e.preventDefault(); pend.hard++; }
    else if (e.code === 'KeyP' || e.code === 'Escape') pauseGame();
  } else if (phase === 'paused' && !e.repeat && (e.code === 'KeyP' || e.code === 'Escape')) resumeGame();
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', releaseAll);

/* ---------- controls: on-screen gamepad (multi-touch, pointer events only) ---------- */
const dpad = $('dpad');
let dpadPointer = null;
function dirAt(e) {
  const r = dpad.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  if (Math.hypot(dx, dy) < r.width * 0.1) return dpadDir; // dead centre: keep the current direction
  if (Math.abs(dx) >= Math.abs(dy) * 0.85) return dx < 0 ? 'left' : 'right';
  return dy > 0 ? 'down' : 'up';
}
function setDir(d) {
  if (d === dpadDir) return;
  dpadDir = d;
  dpad.dataset.dir = d || '';
  if (d === 'up') { if (opts.hard && playing()) pend.hard++; }
  else if (d) press(d);
}
dpad.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (dpadPointer !== null) return;
  dpadPointer = e.pointerId;
  try { dpad.setPointerCapture(e.pointerId); } catch { }
  sound.unlock();
  setDir(dirAt(e) || 'down');
});
dpad.addEventListener('pointermove', e => { if (e.pointerId === dpadPointer) setDir(dirAt(e)); });
const dpadUp = e => { if (e.pointerId !== dpadPointer) return; dpadPointer = null; setDir(null); };
dpad.addEventListener('pointerup', dpadUp);
dpad.addEventListener('pointercancel', dpadUp);
dpad.addEventListener('lostpointercapture', dpadUp);

for (const [id, key] of [['aBtn', 'cw'], ['bBtn', 'hard']]) {
  const b = $(id); const ids = new Set();
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    ids.add(e.pointerId);
    try { b.setPointerCapture(e.pointerId); } catch { }
    b.classList.add('down');
    sound.unlock();
    if (playing()) pend[key]++;
  });
  const up = e => { ids.delete(e.pointerId); if (!ids.size) b.classList.remove('down'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  b.addEventListener('click', e => e.preventDefault());
}
$('pad').addEventListener('contextmenu', e => e.preventDefault());

$('pauseBtn').addEventListener('click', () => { if (phase === 'play') pauseGame(); else if (phase === 'paused') resumeGame(); });
const muteBtn = $('mute');
function syncMute() { muteBtn.classList.toggle('on', sound.muted); muteBtn.setAttribute('aria-pressed', String(sound.muted)); muteBtn.textContent = sound.muted ? '소리 꺼짐' : '소리'; }
muteBtn.addEventListener('click', () => { sound.unlock(); sound.setMuted(!sound.muted); save('muted', sound.muted); syncMute(); if (!sound.muted) sound.click(); });

/* ---------- controls: optional swipe gestures on the playfield ---------- */
let sw = null;
field.addEventListener('pointerdown', e => {
  if (!opts.swipe || !playing()) return;
  e.preventDefault();
  try { field.setPointerCapture(e.pointerId); } catch { }
  sw = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, drop: false, any: false };
});
field.addEventListener('pointermove', e => {
  if (!sw || e.pointerId !== sw.id) return;
  const cell = field.getBoundingClientRect().width / 10;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (!sw.drop) {
    const cells = Math.trunc(dx / (cell * 0.9));
    if (cells !== sw.moved) { pend.nudge += cells - sw.moved; sw.moved = cells; sw.any = true; }
  }
  if (!sw.drop && dy > cell * 1.2 && dy > Math.abs(dx) * 1.3) { sw.drop = true; sw.any = true; }
  swipeDown = sw.drop && dy > cell * 0.5;
});
const swEnd = e => {
  if (!sw || e.pointerId !== sw.id) return;
  const dt = performance.now() - sw.t, dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (!sw.any && dt < 300 && Math.hypot(dx, dy) < 12 && playing()) pend.cw++;
  else if (opts.hard && dy < -40 && dt < 350 && Math.abs(dy) > Math.abs(dx) * 1.5 && playing()) pend.hard++;
  sw = null; swipeDown = false;
};
field.addEventListener('pointerup', swEnd);
field.addEventListener('pointercancel', swEnd);

/* ---------- panel buttons ---------- */
startBtn.addEventListener('click', () => {
  sound.unlock(); sound.click();
  if (!load('tut', false)) { panel('ask'); return; }
  buildSetup(); panel('setup');
});
$('askYes').addEventListener('click', () => { sound.click(); startTutorial(); });
$('askNo').addEventListener('click', () => { save('tut', true); sound.click(); buildSetup(); panel('setup'); });
$('play').addEventListener('click', () => { sound.unlock(); sound.click(); startGame(); });
$('optBtn').addEventListener('click', () => { optFrom = 'setup'; buildOpts(); panel('opt'); });
$('pOptBtn').addEventListener('click', () => { optFrom = 'pause'; buildOpts(); panel('opt'); });
$('optBack').addEventListener('click', () => { if (optFrom === 'setup') buildSetup(); panel(optFrom); });
$('resume').addEventListener('click', resumeGame);
$('quit').addEventListener('click', () => { if (tut) { endTutorial(null); } showTitle(); });
helpBtn.addEventListener('click', () => { buildHelp(); panel('help'); });
$('rankBtn').addEventListener('click', () => { renderTop(); panel('rank'); });
homeBtn.addEventListener('click', showTitle);
$('tutBtn').addEventListener('click', () => { sound.click(); startTutorial(); });
$('save').addEventListener('click', saveEntry);
$('cskip').addEventListener('click', () => { sound.click(); endTutorial(true); });
$('cnext').addEventListener('click', () => { sound.click(); endTutorial(true); });
document.querySelectorAll('.back').forEach(b => b.addEventListener('click', () => {
  sound.click();
  if (afterRank) { afterRank = false; showResult(); return; }
  panel('main');
}));

document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

/* ---------- pinch-zoom lock ---------- */
['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());

/* ---------- title logo ---------- */
function drawLogo(c, level = 0) {
  const g = c.getContext('2d'), p = pal(level);
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  // a little stack: T falling onto a J / Z / I pile
  const cells = [
    [3, 0, 0], [4, 0, 0], [5, 0, 0], [4, 1, 0],
    [0, 2, 1], [0, 3, 1], [1, 3, 1], [2, 3, 1],
    [6, 2, 2], [7, 2, 2], [7, 3, 2], [6, 3, 2],
    [3, 3, 0], [4, 3, 0], [5, 3, 0], [6, 1, 1], [7, 1, 1], [5, 2, 2], [1, 2, 2],
  ];
  for (const [x, y, s] of cells) drawBlock(g, x * 8, y * 8, s, p);
}

/* ---------- boot ---------- */
new ResizeObserver(layout).observe($('screen'));
window.addEventListener('resize', layout);
layout(); applyOpts(); syncMute(); showTitle();
drawLogo($('logo'));
document.fonts && document.fonts.ready.then(() => { hudKey = ''; layout(); });
requestAnimationFrame(frame);

// Test hook for automated checks; harmless in normal play.
window.__retro = {
  get game() { return game; }, get phase() { return phase; }, get opts() { return opts; }, get tut() { return tut && { i: tut.i }; },
  get danger() { return sound.danger; }, get music() { return sound.musicPlaying; },
  L, startGame, startTutorial, pauseGame, resumeGame, setup,
  setBoard(rows) { // rows: strings of 10 chars ('.' empty, else block) aligned to the bottom
    const b = L.emptyBoard(); const off = L.H - rows.length;
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') b[(off + y) * L.W + x] = 1 + ('TJZOSLI'.indexOf(ch) >= 0 ? 'TJZOSLI'.indexOf(ch) : 0); }));
    game.board = b;
  },
  setPiece(t, r = 0, x = 5, y = 0) { game.piece = { t, r, x, y }; game.phase = 'play'; game.fall = 0; },
  forceNext(t) { L.forceNext(game, t); },
  setLevel(lv) { game.level = lv; hudKey = ''; },
  icon(size = 192) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const src = document.createElement('canvas'); src.width = src.height = 40;
    const s = src.getContext('2d'), p = pal(0);
    s.fillStyle = '#000'; s.fillRect(0, 0, 40, 40);
    // frame
    s.fillStyle = '#7c7c7c'; s.fillRect(0, 0, 40, 40); s.fillStyle = '#bcbcbc'; s.fillRect(1, 1, 38, 38); s.fillStyle = '#000'; s.fillRect(3, 3, 34, 34);
    const cells = [[1, 0, 0], [2, 0, 0], [3, 0, 0], [2, 1, 0], [0, 2, 1], [0, 3, 1], [1, 3, 1], [2, 3, 1], [3, 2, 2], [3, 3, 2], [2, 2, 2], [1, 2, 2]];
    for (const [x, y, st] of cells) drawBlock(s, 4 + x * 8, 4 + y * 8, st, p);
    g.drawImage(src, 0, 0, size, size);
    return c.toDataURL('image/png');
  },
};
