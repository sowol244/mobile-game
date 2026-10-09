import {
  parseStage, applyMove, blockReason, isWin, legalMoves, solve, starsFor, starCut, dailyStage, dayNumber,
  movable, isGate, isNum, expOf, valueOf, kindOf, DIRS, PIN, ONCE, NUM, slideAll, canSlide, spawnTile,
} from './logic.js';
import { STAGES, CHAPTERS } from './stages.js';
import { createSound } from './sound.js';
import { LESSONS, INTROS } from './tutorial.js';

const $ = id => document.getElementById(id);
const sound = createSound();
const store = {
  get(k, d) { try { const v = localStorage.getItem('onemove-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('onemove-' + k, JSON.stringify(v)); } catch (e) {} },
};
const UNDOS = 3, HINTS = 2;
const DIR_ARROW = ['위로', '오른쪽으로', '아래로', '왼쪽으로'];

let recs = store.get('rec', {});        // stage id -> { stars, best }
let dailyRecs = store.get('daily', {}); // day number -> { stars, best }
let mode = 'title';                     // title | play | tutorial | endless | result
let cur = null;                         // { def, index (stage index, -1 = daily), day }
let st = null, history = [], undos = UNDOS, hints = HINTS, hinted = false, selId = 0, hintMove = null, hintMap = new Map();
let tut = null, lastResult = null, panelBack = null;

/* ---------- worker (hint + daily); falls back to the main thread ---------- */
let worker = null, wid = 0;
const pending = new Map();
function local(msg) {
  if (msg.type === 'daily') return dailyStage(msg.day);
  const s = msg.state;
  const r = solve({ n: s.n, codes: new Uint8Array(s.codes), target: s.target, goal: s.goal }, { maxDepth: s.maxDepth, maxStates: 600000 });
  return r && { depth: r.depth, path: r.path, aborted: !!r.aborted };
}
function work(msg) {
  return new Promise(resolve => {
    if (worker === 'broken') { resolve(local(msg)); return; }
    try {
      if (!worker) {
        worker = new Worker(new URL('./solver-worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = e => { const p = pending.get(e.data.id); pending.delete(e.data.id); if (p) p.resolve(e.data.result); };
        worker.onerror = () => { worker = 'broken'; for (const [, p] of pending) p.resolve(local(p.msg)); pending.clear(); };
      }
      const id = ++wid;
      pending.set(id, { resolve, msg });
      worker.postMessage({ ...msg, id });
    } catch (e) { worker = 'broken'; resolve(local(msg)); }
  });
}

/* ---------- board geometry + rendering ---------- */
const boardEl = $('board'), stageEl = $('stage');
let geo = { n: 4, cs: 60, gap: 6, pad: 8, size: 280 };
const tileEls = new Map();
const xy = k => [geo.pad + (k % geo.n) * (geo.cs + geo.gap), geo.pad + Math.floor(k / geo.n) * (geo.cs + geo.gap)];

function layoutBoard() {
  if (!st) return;
  const r = stageEl.getBoundingClientRect();
  const size = Math.max(160, Math.floor(Math.min(r.width, r.height - 40, 520)));
  const n = st.n, pad = Math.round(size * 0.028), gap = Math.round(size * (n > 4 ? 0.02 : 0.026));
  geo = { n, size, pad, gap, cs: (size - 2 * pad - (n - 1) * gap) / n };
  boardEl.style.width = boardEl.style.height = size + 'px';
  boardEl.style.setProperty('--cs', geo.cs + 'px');
  $('status').style.top = boardEl.offsetTop + size + 14 + 'px';
  boardEl.querySelectorAll('.cell, .goalRing').forEach(el => { const [x, y] = xy(+el.dataset.k); el.style.transform = `translate(${x}px,${y}px)`; });
  for (const el of tileEls.values()) el.style.transition = 'none';
  sync(null);
  requestAnimationFrame(() => { for (const el of tileEls.values()) el.style.transition = ''; });
  drawMarks();
}

function buildCells() {
  boardEl.replaceChildren();
  tileEls.clear();
  for (let k = 0; k < st.n * st.n; k++) {
    const c = document.createElement('div');
    c.className = 'cell' + (k === st.goal ? ' goal' : '');
    c.dataset.k = k;
    boardEl.append(c);
  }
  if (st.goal >= 0) { const g = document.createElement('div'); g.className = 'goalRing'; g.dataset.k = st.goal; boardEl.append(g); }
}
function paint(el, code) {
  const kind = kindOf(code), v = valueOf(code), digits = String(v).length;
  el.className = 'tile' + (kind === 'num' ? '' : ' ' + kind) + (digits >= 4 ? ' d4' : digits === 3 ? ' d3' : '') + (el.dataset.id == selId && movable(code) ? ' sel' : '');
  if (isNum(code)) el.dataset.e = expOf(code); else delete el.dataset.e;
  const txt = kind === 'wall' ? '' : String(v);
  if (el.firstChild.textContent !== txt) el.firstChild.textContent = txt;
  el.setAttribute('aria-label', kind === 'wall' ? '벽' : kind === 'gate' ? `${v}의 문` : kind === 'pin' ? `고정 ${v}` : kind === 'once' ? `한 번 ${v}` : String(v));
}
function place(el, k) { const [x, y] = xy(k); el.style.transform = `translate(${x}px,${y}px)`; }
function makeTile(id, k) {
  const el = document.createElement('div');
  el.dataset.id = id;
  el.append(document.createElement('span'));
  el.firstChild.className = 'n';
  el.style.transition = 'none';
  place(el, k);
  boardEl.append(el);
  requestAnimationFrame(() => { el.style.transition = ''; });
  tileEls.set(id, el);
  return el;
}
const cellOfId = id => { if (!id) return -1; for (let k = 0; k < st.ids.length; k++) if (st.ids[k] === id) return k; return -1; };

// Brings the DOM in line with st. ev (from applyMove) adds the slide / merge / gate / lock animations.
function sync(ev) {
  const live = new Set();
  for (let k = 0; k < st.ids.length; k++) {
    const id = st.ids[k];
    if (!id) continue;
    live.add(id);
    const el = tileEls.get(id) || makeTile(id, k);
    place(el, k);
    if (ev && ev.merged && id === ev.into) {
      el.dataset.id = id;
      setTimeout(() => {
        const at = cellOfId(id); if (at < 0) return;
        paint(el, st.codes[at]);
        el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        sparks(at, el);
      }, 105);
    } else if (ev && ev.locked && id === ev.id) {
      setTimeout(() => { const at = cellOfId(id); if (at < 0) return; paint(el, st.codes[at]); el.classList.add('locked'); }, 110);
    } else paint(el, st.codes[k]);
  }
  for (const [id, el] of tileEls) {
    if (live.has(id)) continue;
    tileEls.delete(id);
    if (ev && ev.merged && id === ev.id) { el.classList.add('moving'); place(el, ev.to); setTimeout(() => el.remove(), 125); }
    else if (ev && ev.removed.includes(id)) { el.classList.add('open'); setTimeout(() => el.remove(), 450); }
    else el.remove();
  }
}
function sparks(k, el) {
  const [x, y] = xy(k), cx = x + geo.cs / 2, cy = y + geo.cs / 2, color = getComputedStyle(el).backgroundColor;
  for (let i = 0; i < 9; i++) {
    const s = document.createElement('span'), a = (i / 9) * Math.PI * 2 + Math.random() * 0.5, d = geo.cs * (0.55 + Math.random() * 0.35);
    s.className = 'spark';
    s.style.left = cx - 4 + 'px'; s.style.top = cy - 4 + 'px'; s.style.background = color;
    s.style.setProperty('--tx', Math.cos(a) * d + 'px'); s.style.setProperty('--ty', Math.sin(a) * d + 'px');
    boardEl.append(s); setTimeout(() => s.remove(), 560);
  }
}
// Selection arrows, hint arrow and the tutorial ring.
function drawMarks() {
  boardEl.querySelectorAll('.arrow, .tutRing').forEach(e => e.remove());
  if (!st || (mode !== 'play' && mode !== 'tutorial')) { $('status').textContent = mode === 'endless' ? '밀면 모든 타일이 함께 움직여요' : ''; return; }
  const at = cellOfId(selId);
  $('status').textContent = at >= 0 ? '화살표 칸을 누르거나 그쪽으로 밀어요' : '움직일 타일을 눌러 고르세요';
  for (const el of tileEls.values()) el.classList.toggle('sel', +el.dataset.id === selId && at >= 0 && movable(st.codes[at]));
  const addArrow = (from, d, cls) => {
    const k = from + DIRS[d][0] * st.n + DIRS[d][1], a = document.createElement('div');
    a.className = 'arrow ' + cls;
    a.style.setProperty('--rot', d * 90 + 'deg'); a.style.setProperty('--dx', DIRS[d][1]); a.style.setProperty('--dy', DIRS[d][0]);
    place(a, k);
    if (cls === 'merge') { const [x, y] = xy(k), o = -(geo.cs + geo.gap) * 0.3; a.style.transform = `translate(${x + DIRS[d][1] * o}px,${y + DIRS[d][0] * o}px)`; }
    boardEl.append(a);
  };
  if (at >= 0 && movable(st.codes[at])) {
    for (let d = 0; d < 4; d++) {
      if (blockReason(st, at, d)) continue;
      const k = at + DIRS[d][0] * st.n + DIRS[d][1];
      const isHint = hintMove && hintMove[0] === at && hintMove[1] === d;
      addArrow(at, d, isHint ? 'hint' : isNum(st.codes[k]) ? 'merge' : '');
    }
  }
  if (mode === 'tutorial' && tut && !tut.done) {
    const [r, c, d] = LESSONS[tut.l].steps[tut.s].move, k = r * st.n + c;
    const ring = document.createElement('div'); ring.className = 'tutRing'; place(ring, k); boardEl.append(ring);
    if (at !== k) addArrow(k, d, 'hint');
  }
}

/* ---------- HUD ---------- */
function hud() {
  const left = st.limit - st.moves;
  $('moves').innerHTML = `${left}<span>/${st.limit}</span>`;
  $('movesCard').classList.toggle('low', left <= 2 && mode === 'play');
  $('undoN').textContent = undos; $('hintN').textContent = hints;
  const inTut = mode === 'tutorial';
  $('undo').disabled = inTut || !history.length || undos <= 0;
  $('hint').disabled = inTut || hints <= 0;
  $('restart').disabled = inTut || st.moves === 0;
}
function setHeader() {
  const d = cur.def;
  if (mode === 'tutorial') $('stageName').innerHTML = '튜토리얼<small>기본 규칙</small>';
  else if (cur.index < 0) { const dt = new Date(cur.day * 864e5); $('stageName').innerHTML = `오늘의 퍼즐<small>${dt.getUTCMonth() + 1}월 ${dt.getUTCDate()}일</small>`; }
  else { const s = STAGES[cur.index]; $('stageName').innerHTML = `${s.id}<small>${CHAPTERS[s.ch - 1].name}</small>`; }
  const gt = $('goalTile'), e = Math.round(Math.log2(d.target));
  gt.dataset.e = e; gt.textContent = d.target; gt.className = 'tile' + (String(d.target).length >= 3 ? ' d3' : '');
  gt.style.position = 'static'; gt.style.width = 'auto'; gt.style.height = '32px'; gt.style.fontSize = '19px';
  $('goalWhere').hidden = !d.goal;
  const cuts = $('cuts');
  if (mode === 'tutorial' || !d.opt) cuts.innerHTML = '<span>—</span>';
  else { const c = starCut(d.opt, d.limit); cuts.innerHTML = `<span><b>★★★</b> ${Math.min(c.three, d.limit)}수 이내</span>`; }
  $('liveStars').innerHTML = mode === 'tutorial' ? '' : starsText(bestStars());
}
const starsText = n => '★'.repeat(n) + '<i>' + '★'.repeat(3 - n) + '</i>';
function bestStars() { const r = cur.index < 0 ? dailyRecs[cur.day] : recs[STAGES[cur.index].id]; return r ? r.stars : 0; }

let toastT = 0;
function toast(text, ms = 1500) {
  const t = $('toast'); t.textContent = text; t.classList.remove('fade');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('fade'), ms);
}

/* ---------- game flow ---------- */
function showPanel(id) {
  for (const p of ['title', 'offer', 'help', 'records', 'select', 'modes']) $(p).hidden = p !== id;
  if (id) $('result').hidden = true;
}
function loadDef(def) {
  setEndlessUI(false);
  st = parseStage(def);
  boardEl.classList.remove('win');
  document.querySelectorAll('.confetti').forEach(c => c.remove());
  history = []; selId = 0; hintMove = null;
  buildCells(); layoutBoard();
}
function startStage(index) {
  cur = { def: STAGES[index], index };
  mode = 'play'; tut = null; $('coach').hidden = true;
  hints = HINTS; hintMap = new Map();
  showPanel(null); $('result').hidden = true;
  restart(true);
  const id = STAGES[index].id, seen = store.get('seen', {});
  if (INTROS[id] && !seen[id]) { toast(INTROS[id], 3600); seen[id] = 1; store.set('seen', seen); }
}
function startDef(def, day) {
  cur = { def, index: -1, day };
  mode = 'play'; tut = null; $('coach').hidden = true;
  hints = HINTS; hintMap = new Map();
  showPanel(null); $('result').hidden = true;
  restart(true);
}
function restart(fresh) {
  if (!fresh && mode !== 'play') return;
  undos = UNDOS; hinted = false;
  loadDef(cur.def);
  setHeader(); hud(); drawMarks();
  if (!fresh) sound.undo();
}
function undo() {
  if (mode === 'endless' || (mode === 'result' && lastResult && lastResult.endless)) { endlessUndo(); return; }
  if (mode !== 'play' && !(mode === 'result' && lastResult && !lastResult.win)) return;
  if (!history.length || undos <= 0) return;
  st = history.pop(); undos--; hintMove = null;
  if (mode === 'result') { mode = 'play'; $('result').hidden = true; }
  sync(null); hud(); drawMarks(); sound.undo();
}

function attempt(i, d) {
  if (mode !== 'play' && mode !== 'tutorial') return;
  if (mode === 'tutorial') {
    const [r, c, dd] = LESSONS[tut.l].steps[tut.s].move;
    if (tut.done || i !== r * st.n + c || d !== dd) { coach(LESSONS[tut.l].steps[tut.s].text + ' (표시된 타일·방향)', 'warn'); sound.blocked(); return; }
  }
  const reason = blockReason(st, i, d);
  if (reason) { blocked(i, d, reason); return; }
  history.push(st);
  const { state, ev } = applyMove(st, i, d);
  st = state; hintMove = null;
  selId = ev.merged ? ev.into : ev.locked ? 0 : ev.id;
  if (ev.merged) sound.merge(Math.log2(ev.value)); else sound.move();
  if (ev.opened.length) setTimeout(() => { sound.gate(); toast('문이 열렸어요!'); }, 120);
  if (ev.locked) setTimeout(() => sound.lock(), 110);
  sync(ev); hud(); drawMarks();
  if (mode === 'tutorial') { tutStep(); return; }
  if (ev.win) { mode = 'result'; drawMarks(); setTimeout(() => finish(true), 520); }
  else if (st.moves >= st.limit || !legalMoves(st).length) { mode = 'result'; drawMarks(); setTimeout(() => finish(false), 420); }
}
function blocked(i, d, reason) {
  const code = st.codes[i], el = tileEls.get(st.ids[i]);
  if (el) {
    el.style.setProperty('--sx', DIRS[d][1] * geo.cs * 0.12 + 'px'); el.style.setProperty('--sy', DIRS[d][0] * geo.cs * 0.12 + 'px');
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }
  sound.blocked();
  const n = st.n, k = i + DIRS[d][0] * n + DIRS[d][1];
  const msg = {
    fixed: kindOf(code) === 'pin' ? '고정된 타일은 움직일 수 없어요.' : '움직일 수 없어요.',
    edge: '판 밖으로는 못 가요.', wall: '벽에 막혔어요.',
    gate: reason === 'gate' ? `문은 ${valueOf(st.codes[k])}을 만들면 열려요.` : '',
    diff: '다른 숫자에는 못 가요.',
  }[reason];
  if (mode === 'tutorial') coach(msg, 'warn'); else toast(msg);
}
function finish(win) {
  const d = cur.def;
  lastResult = { win };
  $('result').hidden = false;
  $('perfect').hidden = true; $('perfect').textContent = '완벽! 최소 이동';
  const rNext = $('rNext'), rRetry = $('rRetry');
  if (win) {
    const stars = starsFor(st.moves, d.opt, d.limit, hinted), perfect = st.moves === d.opt && !hinted;
    const key = cur.index < 0 ? cur.day : STAGES[cur.index].id, book = cur.index < 0 ? dailyRecs : recs;
    const prev = book[key];
    book[key] = { stars: Math.max(stars, prev ? prev.stars : 0), best: Math.min(st.moves, prev ? prev.best : 99) };
    store.set(cur.index < 0 ? 'daily' : 'rec', book);
    $('rTitle').textContent = perfect ? '완벽해요!' : '클리어!';
    $('rStars').innerHTML = Array.from({ length: 3 }, (_, i) => (i < stars ? `<span class="s" style="animation-delay:${150 + i * 180}ms">★</span>` : '<i>★</i>')).join('');
    $('perfect').hidden = !perfect;
    $('rMsg').innerHTML = `<b>${st.moves}</b>수 만에 성공 · 최소 <b>${d.opt}</b>수` + (hinted ? ' · 힌트 사용' : '');
    const last = cur.index < 0 || cur.index === STAGES.length - 1;
    rNext.textContent = last ? '단계 선택' : '다음 단계';
    rRetry.textContent = '다시 하기';
    boardEl.classList.remove('win'); void boardEl.offsetWidth; boardEl.classList.add('win');
    confetti(perfect ? 70 : 40);
    sound.win(perfect);
    lastResult.next = last ? 'select' : 'next';
  } else {
    $('rTitle').textContent = st.moves >= st.limit ? '이동을 다 썼어요' : '더 움직일 수 없어요';
    $('rStars').innerHTML = '<i>★★★</i>';
    $('rMsg').innerHTML = `목표 <b>${d.target}</b> · ${d.goal ? '★ 칸에서 · ' : ''}${st.limit}수 이내`;
    rNext.textContent = '다시 하기';
    const canUndo = history.length && undos > 0;
    rRetry.textContent = canUndo ? `되돌리기 ${undos}` : '단계 선택';
    sound.fail();
    lastResult.next = 'retry';
  }
  lastResult.canUndo = !win && history.length && undos > 0;
  setHeader();
}
function confetti(count) {
  const colors = ['#f5b276', '#e9706a', '#3f9a8a', '#f2b33d', '#b673cc', '#589fd4'];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('span');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + '%'; c.style.background = colors[i % colors.length];
    c.style.setProperty('--dx', (Math.random() - 0.5) * 160 + 'px'); c.style.setProperty('--r', (Math.random() - 0.5) * 1080 + 'deg');
    c.style.animationDuration = 1.4 + Math.random() * 1.2 + 's'; c.style.animationDelay = Math.random() * 0.3 + 's';
    $('fx').append(c); setTimeout(() => c.remove(), 3000);
  }
}

/* ---------- hint ---------- */
const keyOf = codes => String.fromCharCode.apply(null, codes);
let hintBusy = false;
async function hint() {
  if (mode !== 'play' || hintBusy) return;
  if (hints <= 0) { toast('힌트를 다 썼어요.'); return; }
  let mv = hintMap.get(keyOf(st.codes));
  if (!mv) {
    hintBusy = true; toast('생각 중…', 4000);
    const snapshot = st;
    const r = await work({ type: 'solve', state: { n: st.n, codes: Array.from(st.codes), target: st.target, goal: st.goal, maxDepth: st.limit - st.moves } });
    hintBusy = false;
    if (snapshot !== st || mode !== 'play') { toast(''); $('toast').classList.add('fade'); return; }
    if (!r || r.error) { toast('이대로는 깰 수 없어요. 되돌리거나 다시 해 보세요.', 2600); return; }
    if (r.aborted) { toast('힌트를 찾지 못했어요.'); return; }
    // remember the whole optimal line so the next hints along it are instant
    let s = st;
    for (const [i, d] of r.path) { hintMap.set(keyOf(s.codes), [i, d]); s = applyMove(s, i, d).state; }
    mv = r.path[0];
  }
  hints--; hinted = true;
  hintMove = mv; selId = st.ids[mv[0]];
  toast(`힌트: 이 타일을 ${DIR_ARROW[mv[1]]}`, 2200);
  sound.hint(); hud(); drawMarks();
}

/* ---------- tutorial ---------- */
const tutorialDone = () => store.get('tut', 0) === 1 || Object.keys(recs).length > 0;
function coach(text, cls = '') { const c = $('ctext'); c.textContent = text; c.className = cls; }
function startTutorial(auto) {
  mode = 'tutorial'; tut = { l: 0, s: 0, auto, done: false };
  showPanel(null); $('result').hidden = true; $('coach').hidden = false;
  setupLesson();
}
function setupLesson() {
  const L = LESSONS[tut.l];
  cur = { def: L.def, index: -2 };
  tut.s = 0; tut.done = false;
  loadDef(L.def); setHeader(); hud();
  $('cstep').textContent = `튜토리얼 ${tut.l + 1}/${LESSONS.length}`;
  coach(L.steps[0].text); drawMarks();
}
function tutStep() {
  const L = LESSONS[tut.l];
  tut.s++;
  if (tut.s < L.steps.length) { coach(L.steps[tut.s].text); drawMarks(); return; }
  tut.done = true; drawMarks();
  const last = tut.l === LESSONS.length - 1;
  coach(last ? '완벽해요! 정해진 이동 안에 목표를 만들면 돼요.' : '좋아요! 목표 숫자를 만들었어요.');
  sound.win(false);
  const token = tut;
  setTimeout(() => {
    if (tut !== token || mode !== 'tutorial') return;
    if (last) endTutorial(); else { tut.l++; setupLesson(); }
  }, last ? 1700 : 1200);
}
function endTutorial() {
  const auto = tut && tut.auto;
  store.set('tut', 1); tut = null; $('coach').hidden = true;
  if (auto) startStage(0); else { mode = 'title'; showTitle(); }
}

/* ---------- panels ---------- */
function showTitle() { mode = 'title'; showPanel('title'); }
function unlocked(i) { return i === 0 || !!recs[STAGES[i].id] || !!recs[STAGES[i - 1].id] || (i > 1 && !!recs[STAGES[i - 2].id]); }
function totalStars() { return STAGES.reduce((a, s) => a + (recs[s.id] ? recs[s.id].stars : 0), 0); }
function showSelect() {
  mode = 'title'; showPanel('select');
  $('selTot').textContent = `★ ${totalStars()}`;
  const host = $('chapters'); host.replaceChildren();
  let curIdx = STAGES.findIndex((s, i) => unlocked(i) && !recs[s.id]);
  CHAPTERS.forEach(ch => {
    const list = STAGES.map((s, i) => [s, i]).filter(([s]) => s.ch === ch.id);
    const got = list.reduce((a, [s]) => a + (recs[s.id] ? recs[s.id].stars : 0), 0);
    const box = document.createElement('section'); box.className = 'chap';
    box.innerHTML = `<h3>${ch.id}. ${ch.name}<span>★ ${got}/${list.length * 3}</span></h3><p>${ch.desc}</p>`;
    const grid = document.createElement('div'); grid.className = 'grid';
    for (const [s, i] of list) {
      const b = document.createElement('button'), r = recs[s.id];
      b.type = 'button'; b.className = 'lv' + (r ? ' done' : '') + (i === curIdx ? ' cur' : '');
      b.innerHTML = `${s.id.split('-')[1]}<small>${r ? starsText(r.stars) : ''}</small>`;
      b.setAttribute('aria-label', `${s.id} 단계${r ? `, 별 ${r.stars}개` : ''}`);
      b.disabled = !unlocked(i);
      b.addEventListener('click', () => { sound.unlock(); sound.pick(); startStage(i); });
      grid.append(b);
    }
    box.append(grid); host.append(box);
  });
  const day = dayNumber(new Date()), dr = dailyRecs[day];
  $('dailySub').textContent = dr ? `오늘 클리어 ★${dr.stars} · 연속 ${streak()}일` : `매일 새로운 한 판 · ${new Date().getMonth() + 1}월 ${new Date().getDate()}일`;
  $('dailyGo').textContent = dr ? '다시' : '도전';
  const c = host.querySelector('.cur');
  if (c) c.scrollIntoView({ block: 'center', inline: 'nearest' });
}
function streak() {
  let d = dayNumber(new Date()), n = 0;
  if (!dailyRecs[d]) d--;
  while (dailyRecs[d]) { n++; d--; }
  return n;
}
async function playDaily() {
  const day = dayNumber(new Date());
  let cache = store.get('dailydef', null);
  if (!cache || cache.day !== day || !cache.def) {
    $('busy').hidden = false;
    const def = await work({ type: 'daily', day });
    $('busy').hidden = true;
    if (!def || def.error) { toast('오늘의 퍼즐을 만들지 못했어요.'); return; }
    cache = { day, def }; store.set('dailydef', cache);
  }
  startDef(cache.def, day);
}
const HELP = [
  ['<div class="tile sel" data-e="1"><span class="n">2</span></div>', '타일을 고르고, 눌러서나 밀어서 한 칸 옮겨요.'],
  ['<div class="tile" data-e="2"><span class="n">4</span></div>', '같은 숫자는 합쳐지고, 다른 숫자엔 막혀요.'],
  ['<div class="tile" data-e="4"><span class="n">16</span></div>', '이동 횟수 안에 목표 숫자를 만들면 클리어!'],
  ['<div class="tile wall"><span class="n"></span></div>', '벽은 움직이지 않고 길을 막아요.'],
  ['<div class="cell goal" style="position:absolute;--cs:30px;width:30px;height:30px"></div>', '★ 칸이 있으면 그 칸에서 만들어야 해요.'],
  ['<div class="tile pin" data-e="2"><span class="n">4</span></div>', '고정 타일은 못 움직이지만 합쳐져요.'],
  ['<div class="tile once" data-e="1"><span class="n">2</span></div>', '① 타일은 한 번 움직이면 고정돼요.'],
  ['<div class="tile gate"><span class="n">8</span></div>', '문은 적힌 숫자를 만들면 열려요.'],
  ['<div class="tile" data-e="5"><span class="n">32</span></div>', '최소 이동에 가까울수록 별이 많아요.'],
  ['<div class="tile" data-e="11" style="font-size:9px"><span class="n">2048</span></div>', '무한 모드: 밀면 모든 타일이 함께 움직여요.'],
  ['<div class="tile" data-e="6"><span class="n">64</span></div>', 'PC: 클릭 후 방향키, Z 되돌리기, H 힌트'],
];
function showHelp() {
  showPanel('help');
  $('helpList').innerHTML = HELP.map(([ic, t]) => `<li><span class="ic">${ic}</span><span>${t}</span></li>`).join('');
}
function showRecords(back) {
  panelBack = back;
  showPanel('records');
  const cleared = STAGES.filter(s => recs[s.id]).length, perfect = STAGES.filter(s => recs[s.id] && recs[s.id].best === s.opt).length;
  $('stats').innerHTML = `<div><b>${totalStars()}</b><small>/ ${STAGES.length * 3} 별</small></div><div><b>${cleared}</b><small>/ ${STAGES.length} 클리어</small></div><div><b>${perfect}</b><small>최소 이동</small></div>`;
  const rows = CHAPTERS.map(ch => {
    const list = STAGES.filter(s => s.ch === ch.id);
    const got = list.reduce((a, s) => a + (recs[s.id] ? recs[s.id].stars : 0), 0), done = list.filter(s => recs[s.id]).length;
    return `<li><span>${ch.id}. ${ch.name}</span><span class="m">${done}/${list.length}</span><span class="s">★ ${got}/${list.length * 3}</span></li>`;
  });
  const days = Object.keys(dailyRecs).length;
  rows.push(`<li><span>오늘의 퍼즐</span><span class="m">${days}일 클리어</span><span class="s">연속 ${streak()}일</span></li>`);
  $('recs').innerHTML = rows.join('');
  const rank = store.get('endless-rank', []), fmt = n => n.toLocaleString('ko-KR');
  $('endlessRecs').innerHTML = rank.length
    ? rank.map((r, i) => { const d = new Date(r.t); return `<li${r.t === lastEntry ? ' class="me"' : ''}><span class="k">${i + 1}</span><span>${fmt(r.score)}점</span><span class="m">최고 ${r.tile} · ${d.getMonth() + 1}/${d.getDate()}</span><span class="s">${i === 0 ? '★' : ''}</span></li>`; }).join('')
    : '<li><span class="empty" style="grid-column:1/-1">아직 기록이 없어요.</span></li>';
}

/* ---------- input ---------- */
let g = null;
const localPt = e => { const b = boardEl.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
function cellAt(p) {
  const step = geo.cs + geo.gap;
  const c = Math.floor((p.x - geo.pad + geo.gap / 2) / step), r = Math.floor((p.y - geo.pad + geo.gap / 2) / step);
  if (r < 0 || c < 0 || r >= geo.n || c >= geo.n) return -1;
  return r * geo.n + c;
}
boardEl.addEventListener('pointerdown', e => {
  sound.unlock();
  if (mode !== 'play' && mode !== 'tutorial') return;
  const p = localPt(e);
  g = { id: e.pointerId, x: p.x, y: p.y, cell: cellAt(p), fired: false };
  try { boardEl.setPointerCapture(e.pointerId); } catch (err) {}
});
boardEl.addEventListener('pointermove', e => {
  if (!g || g.id !== e.pointerId || g.fired) return;
  const p = localPt(e), dx = p.x - g.x, dy = p.y - g.y, thr = Math.max(14, Math.min(28, geo.cs * 0.3));
  if (Math.hypot(dx, dy) < thr) return;
  g.fired = true;
  const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  let from = g.cell >= 0 && movable(st.codes[g.cell]) ? g.cell : cellOfId(selId);
  if (g.cell >= 0 && from !== g.cell && isNum(st.codes[g.cell]) && !movable(st.codes[g.cell])) from = g.cell; // swiping a fixed tile: shake it
  if (from < 0) return;
  if (st.ids[from] !== selId && movable(st.codes[from])) { selId = st.ids[from]; hintMove = hintMove && hintMove[0] === from ? hintMove : null; }
  attempt(from, d);
  drawMarks();
});
const endPointer = e => {
  if (!g || g.id !== e.pointerId) return;
  const tapCell = g.fired ? -2 : g.cell;
  g = null;
  if (e.type === 'pointerup' && tapCell !== -2) tap(tapCell);
};
boardEl.addEventListener('pointerup', endPointer);
boardEl.addEventListener('pointercancel', endPointer);
boardEl.addEventListener('contextmenu', e => e.preventDefault());

function tap(k) {
  if (mode !== 'play' && mode !== 'tutorial') return;
  const at = cellOfId(selId);
  if (k < 0) { selId = 0; drawMarks(); return; }
  if (at >= 0 && k !== at) {
    const dr = Math.floor(k / st.n) - Math.floor(at / st.n), dc = (k % st.n) - (at % st.n);
    if (Math.abs(dr) + Math.abs(dc) === 1) {
      const d = DIRS.findIndex(([a, b]) => a === dr && b === dc);
      if (!blockReason(st, at, d)) { attempt(at, d); return; }
    }
  }
  const c = st.codes[k];
  if (movable(c)) { selId = selId === st.ids[k] ? 0 : st.ids[k]; if (selId) sound.pick(); if (hintMove && hintMove[0] !== k) hintMove = null; drawMarks(); return; }
  if (c && !isNum(c) || (isNum(c) && !movable(c))) {
    const el = tileEls.get(st.ids[k]);
    if (el) { el.style.setProperty('--sx', '3px'); el.style.setProperty('--sy', '0px'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
    sound.blocked();
    const msg = c === 1 ? '벽은 움직이지 않아요.' : isGate(c) ? `문은 ${valueOf(c)}을 만들면 열려요.` : '고정된 타일은 움직일 수 없어요.';
    if (mode === 'tutorial') coach(msg, 'warn'); else toast(msg);
    return;
  }
  selId = 0; drawMarks();
}

const KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
document.addEventListener('keydown', e => {
  if (mode === 'endless') {
    if (e.code in KEYS) { e.preventDefault(); sound.unlock(); endlessMove(KEYS[e.code]); }
    else if (e.code === 'KeyZ' || e.code === 'Backspace') endlessUndo();
    else if (e.code === 'KeyR') endlessRestart();
    return;
  }
  if (mode !== 'play' && mode !== 'tutorial') {
    if (mode === 'result' && e.code === 'KeyZ') undo();
    return;
  }
  if (e.code in KEYS) {
    e.preventDefault(); sound.unlock();
    const at = cellOfId(selId);
    if (at < 0) { cycle(); toast('스페이스로 타일을 바꿔요.'); return; }
    attempt(at, KEYS[e.code]); return;
  }
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Tab') { e.preventDefault(); cycle(e.shiftKey ? -1 : 1); return; }
  if (e.code === 'Escape') { selId = 0; drawMarks(); return; }
  if (mode !== 'play') return;
  if (e.code === 'KeyZ' || e.code === 'Backspace') undo();
  else if (e.code === 'KeyH') hint();
  else if (e.code === 'KeyR') restart(false);
});
function cycle(step = 1) {
  const list = [];
  for (let k = 0; k < st.codes.length; k++) if (movable(st.codes[k])) list.push(k);
  if (!list.length) return;
  const at = cellOfId(selId), i = list.indexOf(at);
  selId = st.ids[list[i < 0 ? 0 : (i + step + list.length) % list.length]];
  sound.pick(); drawMarks();
}


/* ---------- endless mode: 2048 rules, every tile slides at once ---------- */
const EN_SAVE = 'endless-save', EN_RANK = 'endless-rank';
let en = null, enId = 1e6, lastEntry = 0, restartArm = 0;
const fmt = n => n.toLocaleString('ko-KR');
const enBest = () => { const r = store.get(EN_RANK, []); return Math.max(r.length ? r[0].score : 0, en ? en.score : 0); };
const maxTile = vals => Math.max(2, ...vals);
function setEndlessUI(on) {
  $('app').classList.toggle('endless', on);
  $('toSelectLabel').textContent = on ? '메뉴' : '단계';
}
function showModes() {
  mode = 'title'; showPanel('modes');
  $('modeStageSub').textContent = `한 타일씩 한 칸 옮기는 퍼즐 · ★ ${totalStars()}/${STAGES.length * 3}`;
  const save = store.get(EN_SAVE, null), best = store.get(EN_RANK, [])[0];
  $('modeEndlessSub').textContent = save && !save.over ? `이어하기 · ${fmt(save.score)}점` : best ? `모두 함께 밀어 합치기 · 최고 ${fmt(best.score)}점` : '모든 타일을 한꺼번에 밀어 합치기';
}
function enToSt() {
  const codes = new Uint8Array(16), ids = new Int32Array(16);
  en.vals.forEach((v, i) => { if (v) { codes[i] = NUM + Math.round(Math.log2(v)); ids[i] = en.ids[i]; } });
  st = { n: 4, codes, ids, goal: -1, target: 99, limit: 0, moves: en.moves };
}
function addSpawn() {
  const sp = spawnTile(en.vals, Math.random);
  if (!sp) return null;
  en.vals[sp.index] = sp.value; en.ids[sp.index] = ++enId;
  return sp;
}
function startEndless() {
  const save = store.get(EN_SAVE, null);
  if (save && !save.over && Array.isArray(save.vals) && save.vals.length === 16) {
    en = save; enId = Math.max(enId, ...en.ids) + 1;
    openEndless();
  } else newEndless();
}
function newEndless(vals) {
  en = { vals: Array(16).fill(0), ids: Array(16).fill(0), score: 0, moves: 0, undo: null, undoUsed: false, reached: false, over: false };
  if (vals) vals.forEach((v, i) => { en.vals[i] = v; if (v) en.ids[i] = ++enId; });
  else { addSpawn(); addSpawn(); }
  en.reached = maxTile(en.vals) >= 2048;
  openEndless();
}
function openEndless() {
  mode = 'endless'; tut = null; lastResult = null; selId = 0;
  showPanel(null); $('result').hidden = true; $('coach').hidden = true;
  setEndlessUI(true);
  boardEl.classList.remove('win');
  document.querySelectorAll('.confetti').forEach(c => c.remove());
  $('toast').classList.add('fade');
  enToSt(); buildCells(); layoutBoard();
  for (const el of tileEls.values()) el.classList.add('spawn');
  $('stageName').innerHTML = '무한 모드<small>모두 함께 밀기</small>';
  enHud(); saveEndless();
}
function enHud(gain = 0) {
  $('eScore').textContent = fmt(en.score);
  $('eBest').textContent = fmt(enBest());
  const t = maxTile(en.vals), et = $('eTile');
  et.dataset.e = Math.round(Math.log2(t)); et.textContent = t;
  $('undoN').textContent = en.undoUsed || !en.undo ? 0 : 1;
  $('undo').disabled = !en.undo || en.undoUsed;
  $('restart').disabled = false;
  if (gain) {
    const g = $('eGain'); g.textContent = '+' + gain; g.classList.remove('go'); void g.offsetWidth; g.classList.add('go');
    const sc = $('eScore'); sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump');
  }
}
const saveEndless = () => store.set(EN_SAVE, en);
function endlessMove(d) {
  if (mode !== 'endless') return;
  const r = slideAll(en.vals, 4, d, en.ids);
  if (!r.moved) { boardEl.classList.remove('stuck'); void boardEl.offsetWidth; boardEl.classList.add('stuck'); sound.blocked(); return; }
  if (!en.undoUsed) en.undo = { vals: en.vals.slice(), ids: en.ids.slice(), score: en.score, moves: en.moves, reached: en.reached };
  en.vals = r.vals; en.ids = r.ids; en.score += r.score; en.moves++;
  const sp = addSpawn();
  enToSt();
  // slide every tile; merged-away tiles slide under their partner and vanish, the partner pops with the new value
  const merged = new Set();
  for (const a of r.anims) {
    const el = tileEls.get(a.id);
    if (!el) continue;
    place(el, a.to);
    if (a.gone) {
      tileEls.delete(a.id); el.classList.add('under');
      setTimeout(() => el.remove(), 130);
      merged.add(a.into);
    }
  }
  for (const id of merged) {
    const el = tileEls.get(id);
    if (!el) continue;
    setTimeout(() => {
      const at = cellOfId(id); if (at < 0) return;
      paint(el, st.codes[at]);
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      if (st.codes[at] - NUM >= 7) sparks(at, el);
    }, 105);
  }
  if (sp) { const el = makeTile(en.ids[sp.index], sp.index); paint(el, st.codes[sp.index]); el.classList.add('spawn'); }
  if (r.score) sound.merge(Math.round(Math.log2(Math.max(...r.anims.filter(a => a.gone).map(a => a.value))))); else sound.move();
  if (!en.reached && maxTile(en.vals) >= 2048) {
    en.reached = true;
    setTimeout(() => { toast('2048 달성! 계속 가요', 2600); confetti(60); sound.win(true); boardEl.classList.remove('win'); void boardEl.offsetWidth; boardEl.classList.add('win'); }, 200);
  }
  enHud(r.score);
  if (!canSlide(en.vals, 4)) { en.over = true; mode = 'result'; saveEndless(); setTimeout(endlessOver, 650); }
  else saveEndless();
}
function recordEndless() {
  if (!en || en.score <= 0) return 0;
  const t = Date.now(), rank = store.get(EN_RANK, []);
  rank.push({ score: en.score, tile: maxTile(en.vals), t });
  rank.sort((a, b) => b.score - a.score || a.t - b.t);
  const top = rank.slice(0, 10);
  store.set(EN_RANK, top);
  lastEntry = top.some(r => r.t === t) ? t : 0;
  return lastEntry ? top.findIndex(r => r.t === t) + 1 : 0;
}
function endlessOver() {
  const rankPos = recordEndless();
  lastResult = { endless: true, entry: lastEntry, canUndo: !!en.undo && !en.undoUsed };
  $('result').hidden = false;
  $('rTitle').textContent = '게임 끝';
  $('rStars').innerHTML = `<span class="escore">${fmt(en.score)}</span>`;
  $('perfect').hidden = rankPos !== 1; $('perfect').textContent = '새 최고 기록!';
  $('rMsg').innerHTML = `최고 타일 <b>${maxTile(en.vals)}</b>` + (rankPos ? ` · <b>${rankPos}</b>위` : '');
  $('rNext').textContent = '새 게임';
  $('rRetry').textContent = lastResult.canUndo ? '되돌리기 1' : '모드 선택';
  if (rankPos === 1) { confetti(50); sound.win(true); } else sound.fail();
}
function endlessUndo() {
  if (!en || !en.undo || en.undoUsed) return;
  if (mode === 'result' && lastResult && lastResult.endless) {
    // the game was over and is being continued: take back its ranking entry
    if (lastResult.entry) store.set(EN_RANK, store.get(EN_RANK, []).filter(r => r.t !== lastResult.entry));
    $('result').hidden = true; mode = 'endless'; lastResult = null; en.over = false;
  }
  if (mode !== 'endless') return;
  Object.assign(en, en.undo); en.undo = null; en.undoUsed = true;
  enToSt(); sync(null); enHud(); saveEndless(); sound.undo();
}
function endlessRestart() {
  if (mode !== 'endless') return;
  if (en.moves && Date.now() - restartArm > 2500) { restartArm = Date.now(); toast('한 번 더 누르면 새 게임', 2400); return; }
  restartArm = 0;
  recordEndless();
  newEndless(); sound.undo();
}
// Swipe anywhere over the board area; the page itself never scrolls.
let eg = null;
stageEl.addEventListener('pointerdown', e => {
  if (mode !== 'endless') return;
  sound.unlock();
  eg = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
  try { stageEl.setPointerCapture(e.pointerId); } catch (err) {}
});
const enSwipe = (e, min) => {
  if (!eg || eg.id !== e.pointerId || eg.fired) return;
  const dx = e.clientX - eg.x, dy = e.clientY - eg.y;
  if (Math.hypot(dx, dy) < min) return;
  eg.fired = true;
  endlessMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
};
stageEl.addEventListener('pointermove', e => enSwipe(e, 24));
stageEl.addEventListener('pointerup', e => { enSwipe(e, 12); eg = null; });
stageEl.addEventListener('pointercancel', () => { eg = null; });
stageEl.addEventListener('touchmove', e => { if (mode === 'endless') e.preventDefault(); }, { passive: false });

/* ---------- buttons ---------- */
$('start').addEventListener('click', () => { sound.unlock(); if (tutorialDone()) showModes(); else showPanel('offer'); });
$('tutYes').addEventListener('click', () => { sound.unlock(); startTutorial(true); });
$('tutNo').addEventListener('click', () => { store.set('tut', 1); showModes(); });
$('howto').addEventListener('click', showHelp);
$('tutAgain').addEventListener('click', () => { sound.unlock(); startTutorial(false); });
$('helpBack').addEventListener('click', showTitle);
$('rank').addEventListener('click', () => showRecords(showTitle));
$('recBack').addEventListener('click', () => (panelBack || showTitle)());
$('selBack').addEventListener('click', showModes);
$('modeBack').addEventListener('click', showTitle);
$('modeStage').addEventListener('click', () => { sound.unlock(); sound.pick(); showSelect(); });
$('modeEndless').addEventListener('click', () => { sound.unlock(); sound.pick(); startEndless(); });
$('daily').addEventListener('click', () => { sound.unlock(); playDaily(); });
$('toSelect').addEventListener('click', () => {
  if (mode === 'tutorial') { tut = null; $('coach').hidden = true; }
  if (mode === 'endless' || (lastResult && lastResult.endless && mode === 'result')) showModes(); else showSelect();
});
$('cskip').addEventListener('click', () => endTutorial());
$('undo').addEventListener('click', undo);
$('hint').addEventListener('click', hint);
$('restart').addEventListener('click', () => { if (mode === 'endless') endlessRestart(); else restart(false); });
$('rNext').addEventListener('click', () => {
  if (!lastResult) return;
  if (lastResult.endless) { $('result').hidden = true; newEndless(); return; }
  if (lastResult.next === 'next') startStage(cur.index + 1);
  else if (lastResult.next === 'select') showSelect();
  else { mode = 'play'; $('result').hidden = true; restart(false); }
});
$('rRetry').addEventListener('click', () => {
  if (lastResult && lastResult.endless) { if (lastResult.canUndo) endlessUndo(); else showModes(); return; }
  if (lastResult && lastResult.win) { mode = 'play'; $('result').hidden = true; restart(false); }
  else if (lastResult && lastResult.canUndo) undo();
  else showSelect();
});
$('rRank').addEventListener('click', () => showRecords(() => { showPanel(null); $('result').hidden = false; }));
$('rHome').addEventListener('click', showTitle);

let muted = store.get('mute', false);
function paintMute() { sound.setMuted(muted); $('mute').textContent = muted ? '소리 꺼짐' : '소리 켜짐'; $('mute').setAttribute('aria-pressed', String(muted)); }
$('mute').addEventListener('click', () => { muted = !muted; store.set('mute', muted); paintMute(); sound.unlock(); sound.pick(); });
paintMute();

// Two fingers on the board must never start the browser's pinch zoom.
['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());

new ResizeObserver(() => layoutBoard()).observe(stageEl);
// A board sits behind the title so the first frame is never empty.
cur = { def: STAGES[0], index: 0 };
loadDef(STAGES[0]); setHeader(); hud();
showTitle();

// Test hook for automated checks; harmless in normal play.
window.__onemove = {
  get mode() { return mode; },
  get state() { return st && { n: st.n, rows: Array.from({ length: st.n }, (_, r) => Array.from(st.codes.slice(r * st.n, r * st.n + st.n))), moves: st.moves, limit: st.limit, win: isWin(st), codes: Array.from(st.codes) }; },
  get selected() { return cellOfId(selId); },
  get tutorial() { return tut && { l: tut.l, s: tut.s, done: tut.done }; },
  get records() { return recs; },
  get stageIndex() { return cur && cur.index; },
  get hints() { return hints; },
  stages: STAGES,
  cellCenter(k) { const b = boardEl.getBoundingClientRect(), [x, y] = xy(k); return { x: b.left + x + geo.cs / 2, y: b.top + y + geo.cs / 2, cs: geo.cs }; },
  solveHere() { const r = solve(st, { maxDepth: st.limit - st.moves }); return r && r.path; },
  startStage,
  get endless() { return en && { vals: en.vals.slice(), score: en.score, over: en.over, moves: en.moves, undo: !!en.undo && !en.undoUsed }; },
  get endlessRank() { return store.get(EN_RANK, []); },
  setEndless(vals) { newEndless(vals); },
  showModes,
};
