// BETA mode: mode choice, password gate, stage list, intro cards, chain animation, result card and solution replay.
// main.js loads this file with a dynamic import() and passes it `api`; if the file is missing the normal game is unaffected.
import './beta-rules.js';
import { applyMove, starsFor, starCut } from './logic.js';
import { check } from './beta-gate.js'; // GATE
import { BETA_STAGES, BETA_CHAPTERS } from './beta-stages.js';

const $ = id => document.getElementById(id);
const REC = 'beta-rec';                     // localStorage onemove-beta-rec: { stageId: { stars, best } }
const UNLOCK = 'onemove-beta-ok'; // GATE sessionStorage: unlocked for this browser session only
const PANELS = ['modes', 'betaGate' /* GATE */, 'betaSelect', 'betaIntro'];
const STEP = 190;                           // ms between chain steps
const sleep = ms => new Promise(r => setTimeout(r, ms));
const starsText = n => '★'.repeat(n) + '<i>' + '★'.repeat(3 - n) + '</i>';

let A = null, tok = 0, busy = false, idle = [], replaying = false, replayTok = 0, res = null;

const recs = () => A.store.get(REC, {});
const totalStars = () => BETA_STAGES.reduce((a, s) => a + ((recs()[s.id] || {}).stars || 0), 0);
const isBeta = () => !!(A && A.cur && A.cur.beta);
const unlocked = () => { try { return sessionStorage.getItem(UNLOCK) === '1'; } catch (e) { return false; } }; // GATE

export function init(api) {
  A = api;
  $('modeNormal').addEventListener('click', () => { A.sound.unlock(); A.sound.pick(); if (A.tutorialDone()) A.showSelect(); else A.showPanel('offer'); });
  $('modeBeta').addEventListener('click', () => { A.sound.unlock(); A.sound.pick(); if (unlocked()) showSelect(); else showGate(); });
  $('modesBack').addEventListener('click', () => A.showTitle());
  $('gateBack').addEventListener('click', showModes); // GATE
  $('bsBack').addEventListener('click', showModes);
  $('introBack').addEventListener('click', showSelect);
  $('introGo').addEventListener('click', () => go(res.i));
  $('rReplay').addEventListener('click', () => replay());
  $('brAgain').addEventListener('click', () => replay());
  $('brClose').addEventListener('click', closeReplay);
  $('keypad').addEventListener('click', e => { const b = e.target.closest('button'); if (b) press(b.dataset.k); }); // GATE
  document.addEventListener('keydown', e => { if (replaying) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  // GATE:begin
  document.addEventListener('keydown', e => {
    if ($('betaGate').hidden) return;
    if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('back');
  }, true);
  // GATE:end
}

/* ---------- panels ---------- */
export function hidePanels(id) { for (const p of PANELS) $(p).hidden = p !== id; }
const panel = id => { A.mode = 'title'; A.showPanel(id); };
export function showModes() { tok++; panel('modes'); }

// GATE:begin
/* ---------- password gate ---------- */
let pin = '', checking = false;
function paintDots() { [...$('gateDots').children].forEach((d, i) => d.classList.toggle('on', i < pin.length)); }
function showGate() {
  pin = ''; checking = false; paintDots();
  const ok = !!(globalThis.crypto && crypto.subtle);
  $('gateMsg').textContent = ok ? '비밀번호 4자리' : '이 환경에서는 열 수 없어요';
  $('gateMsg').classList.remove('bad');
  $('keypad').classList.toggle('off', !ok);
  panel('betaGate');
}
async function press(k) {
  if (checking || $('keypad').classList.contains('off')) return;
  A.sound.unlock();
  if (k === 'back') pin = pin.slice(0, -1);
  else if (pin.length < 4) pin += k;
  paintDots(); A.sound.pick();
  $('gateMsg').classList.remove('bad');
  if (pin.length < 4) return;
  checking = true;
  const r = await check(pin);
  if (r === 'ok') {
    try { sessionStorage.setItem(UNLOCK, '1'); } catch (e) {}
    pin = ''; checking = false; showSelect(); return;
  }
  const bad = r === 'bad';
  $('gateMsg').textContent = bad ? '비밀번호가 달라요' : '이 환경에서는 열 수 없어요';
  $('gateMsg').classList.add('bad');
  if (!bad) $('keypad').classList.add('off');
  const dots = $('gateDots'); dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
  A.sound.blocked();
  await sleep(450);
  pin = ''; checking = false; paintDots();
}

// GATE:end

/* ---------- stage list, intro ---------- */
export function showSelect() {
  tok++; replaying = false;
  $('bsTot').textContent = `★ ${totalStars()}`;
  const host = $('bsChapters'); host.replaceChildren();
  const r = recs();
  for (const ch of BETA_CHAPTERS) {
    const list = BETA_STAGES.map((s, i) => [s, i]).filter(([s]) => s.ch === ch.id);
    const got = list.reduce((a, [s]) => a + ((r[s.id] || {}).stars || 0), 0);
    const box = document.createElement('section'); box.className = 'chap';
    box.innerHTML = `<h3>${ch.id}. ${ch.name}<span>★ ${got}/${list.length * 3}</span></h3><p>${ch.desc}</p>`;
    const grid = document.createElement('div'); grid.className = 'grid';
    for (const [s, i] of list) {
      const b = document.createElement('button'), rec = r[s.id];
      b.type = 'button'; b.className = 'lv' + (rec ? ' done' : '');
      b.innerHTML = `${s.id.split('-')[1]}<small>${rec ? starsText(rec.stars) : ''}</small>`;
      b.setAttribute('aria-label', `${s.id} 단계${rec ? `, 별 ${rec.stars}개` : ''}`);
      b.addEventListener('click', () => { A.sound.unlock(); A.sound.pick(); start(i); });
      grid.append(b);
    }
    box.append(grid); host.append(box);
  }
  panel('betaSelect');
}
const ICONS = [
  '<span class="tile" data-e="1"><span class="n">2</span></span><span class="tile" data-e="1"><span class="n">2</span></span><span class="tile" data-e="2"><span class="n">4</span></span><b>→</b><span class="tile" data-e="3"><span class="n">8</span></span>',
  '<span class="tile" data-e="0"><span class="n">1</span></span><b>→</b><span class="exitIcon">출구</span>',
  '<span class="tile" data-e="3"><span class="n">8</span></span><span class="tile" data-e="3"><span class="n">8</span></span><span class="tile" data-e="3"><span class="n">8</span></span>',
  '<span class="tile" data-e="1"><span class="n">2</span></span><span class="tile" data-e="2"><span class="n">4</span></span><span class="tile" data-e="4"><span class="n">16</span></span><span class="lineIcon">줄</span>',
];
function start(i) {
  res = { i };
  const def = BETA_STAGES[i];
  if (!def.intro) { go(i); return; }
  const ch = BETA_CHAPTERS[def.ch - 1];
  $('introIcon').innerHTML = ICONS[def.ch - 1];
  $('introTitle').textContent = ch.title;
  $('introText').innerHTML = ch.intro.map(t => `<span>${t}</span>`).join('');
  panel('betaIntro');
}
function go(i) { A.startDef(BETA_STAGES[i], 0, { beta: true, index: i }); }

/* ---------- in-game hooks (called from main.js) ---------- */
// Called on every board load: cancels a running chain animation, then marks the exit cell / target line.
export function markCells(board, st) {
  tok++; busy = false; idle = [];
  if (!isBeta()) return;
  const g = st.opts.goal, cells = board.querySelectorAll('.cell');
  if (g.kind === 'exit') cells[g.cell[0] * st.n + g.cell[1]].classList.add('exit');
  if (g.kind === 'line') cells.forEach((el, k) => { if ((g.axis === 'row' ? Math.floor(k / st.n) : k % st.n) === g.index) el.classList.add('bline'); });
}
const WHAT = {
  one: () => ['하나로', 3, '모두 합치기'],
  exit: () => ['출구로', 6, '★ 타일 → 출구'],
  count: g => [`${g.value}×${g.n}`, Math.round(Math.log2(g.value)), `동시에 ${g.n}개`],
  line: g => ['한 줄로', 5, `${g.axis === 'row' ? '가로' : '세로'} ${g.index + 1}번째 줄`],
};
// Returns true when it drew the header (beta stage); otherwise hides the beta-only goal text and returns false.
export function header() {
  $('betaWhere').hidden = true;
  if (!isBeta()) return false;
  const d = A.cur.def, [label, e, where] = WHAT[d.opts.goal.kind](d.opts.goal);
  $('stageName').innerHTML = `${d.id}<small>개발중 · ${BETA_CHAPTERS[d.ch - 1].name}</small>`;
  const gt = $('goalTile');
  gt.dataset.e = e; gt.textContent = label; gt.className = 'tile';
  gt.style.position = 'static'; gt.style.width = 'auto'; gt.style.height = '32px'; gt.style.fontSize = '17px';
  $('goalWhere').hidden = true;
  $('betaWhere').hidden = false; $('betaWhere').textContent = where;
  const c = starCut(d.opt, d.limit);
  $('cuts').innerHTML = `<span><b>★★★</b> ${Math.min(c.three, d.limit)}수 이내</span>`;
  $('liveStars').innerHTML = starsText((recs()[d.id] || {}).stars || 0);
  return true;
}

/* ---------- chain animation + effects ---------- */
// Replays the move step by step: the move itself, then each chain absorption, with rising pitch, burst, shake, vibration.
// Input is blocked (mode "anim") until it is done. Returns true so main.js skips its own sync(ev).
export function chain(ev, prev) {
  const final = A.st, my = ++tok;
  const first = applyMove({ ...prev, opts: { ...prev.opts, chain: false } }, ev.from, ev.dir);
  let cur = first.state;
  busy = true; A.mode = 'anim';
  const T = (ms, f) => setTimeout(() => { if (my === tok) f(); }, ms);
  T(0, () => { A.st = cur; A.sync(first.ev); });
  ev.chain.forEach((c, k) => T(STEP * (k + 1), () => {
    const codes = cur.codes.slice(), ids = cur.ids.slice(), removed = [];
    codes[c.cell] = 0; ids[c.cell] = 0; codes[ev.to] += 1;
    for (const g of c.opened) { removed.push(ids[g]); codes[g] = 0; ids[g] = 0; }
    cur = { ...cur, codes, ids };
    A.st = cur;
    A.sync({ merged: true, id: c.id, into: ev.into, to: ev.to, value: 2 ** c.exp, opened: c.opened, removed, locked: false });
    effects(ev.to, k + 1, c.exp);
  }));
  T(STEP * (ev.chain.length + 1) + 40, () => {
    A.st = final; A.sync(null); busy = false;
    if (A.mode === 'anim') A.mode = 'play';
    A.hud(); A.drawMarks();
    for (const f of idle.splice(0)) f();
  });
  return true;
}
function effects(cell, k, exp) {
  A.sound.chain(k);
  const [x, y] = A.xy(cell), cs = parseFloat(getComputedStyle(A.boardEl).getPropertyValue('--cs')) || 60;
  const cx = x + cs / 2, cy = y + cs / 2, color = getComputedStyle(A.boardEl.querySelector('.tile[data-e="' + exp + '"]') || A.boardEl).backgroundColor;
  for (let i = 0; i < 10 + 4 * k; i++) {
    const s = document.createElement('span'), a = Math.random() * Math.PI * 2, d = cs * (0.6 + Math.random() * 0.5 + 0.1 * k);
    s.className = 'spark';
    s.style.left = cx - 4 + 'px'; s.style.top = cy - 4 + 'px'; s.style.background = i % 3 ? color : '#fff';
    s.style.setProperty('--tx', Math.cos(a) * d + 'px'); s.style.setProperty('--ty', Math.sin(a) * d + 'px');
    A.boardEl.append(s); setTimeout(() => s.remove(), 560);
  }
  const tag = document.createElement('span');
  tag.className = 'chainTag'; tag.textContent = `연쇄 ×${k}`;
  tag.style.left = cx - cs * 0.6 + 'px'; tag.style.top = cy - cs * 0.9 + 'px'; tag.style.width = cs * 1.2 + 'px';
  A.boardEl.append(tag); setTimeout(() => tag.remove(), 720);
  const b = A.boardEl;
  b.style.setProperty('--amp', Math.min(12, 3 + 2 * k) + 'px');
  b.classList.remove('bshake'); void b.offsetWidth; b.classList.add('bshake');
  try { if (navigator.vibrate) navigator.vibrate(k === 1 ? 18 : [18, 24, 18 + 8 * k]); } catch (e) {}
}
const whenIdle = f => (busy ? idle.push(f) : f());

/* ---------- result card ---------- */
// Returns true when it handled the result (beta stage). For normal stages it only restores the normal buttons.
export function finish(win) {
  const beta = isBeta();
  if (beta && replaying) return true;
  $('rReplay').hidden = true; $('rRank').hidden = beta;
  if (!beta) return false;
  whenIdle(() => showResult(win));
  return true;
}
function showResult(win) {
  const d = A.cur.def, st = A.st;
  res = { ...res, i: A.cur.index, win };
  A.lastResult = { win, canUndo: false };
  $('result').hidden = false; $('perfect').hidden = true; $('perfect').textContent = '완벽! 최소 이동';
  if (win) {
    const stars = starsFor(st.moves, d.opt, d.limit, A.hinted), perfect = st.moves === d.opt && !A.hinted, book = recs(), prev = book[d.id];
    book[d.id] = { stars: Math.max(stars, prev ? prev.stars : 0), best: Math.min(st.moves, prev ? prev.best : 99) };
    A.store.set(REC, book);
    $('rTitle').textContent = perfect ? '완벽해요!' : '클리어!';
    $('rStars').innerHTML = Array.from({ length: 3 }, (_, i) => (i < stars ? `<span class="s" style="animation-delay:${150 + i * 180}ms">★</span>` : '<i>★</i>')).join('');
    $('perfect').hidden = !perfect;
    $('rMsg').innerHTML = `<b>${st.moves}</b>수 만에 성공 · 최소 <b>${d.opt}</b>수` + (A.hinted ? ' · 힌트 사용' : '');
    $('rNext').textContent = res.i === BETA_STAGES.length - 1 ? '단계 선택' : '다음 단계';
    $('rRetry').textContent = '다시 하기';
    $('rReplay').hidden = false;
    A.boardEl.classList.remove('win'); void A.boardEl.offsetWidth; A.boardEl.classList.add('win');
    A.confetti(perfect ? 70 : 40); A.sound.win(perfect);
  } else {
    $('rTitle').textContent = st.moves >= st.limit ? '이동을 다 썼어요' : '더 움직일 수 없어요';
    $('rStars').innerHTML = '<i>★★★</i>';
    $('rMsg').innerHTML = `${WHAT[d.opts.goal.kind](d.opts.goal)[2]} · ${st.limit}수 이내`;
    $('rNext').textContent = '다시 하기';
    res.canUndo = A.canUndo();
    $('rRetry').textContent = res.canUndo ? '되돌리기' : '단계 선택';
    A.lastResult = { win, canUndo: res.canUndo };
    A.sound.fail();
  }
  header();
}
export function next() {
  if (!isBeta()) return false;
  $('result').hidden = true;
  if (res.win) { if (res.i + 1 < BETA_STAGES.length) start(res.i + 1); else showSelect(); }
  else { A.mode = 'play'; A.restart(false); }
  return true;
}
export function retry() {
  if (!isBeta()) return false;
  if (res.win) { $('result').hidden = true; A.mode = 'play'; A.restart(false); }
  else if (res.canUndo) A.undo();
  else showSelect();
  return true;
}
export function back() {
  if (!isBeta()) return false;
  showSelect();
  return true;
}

/* ---------- optimal solution replay ---------- */
async function replay() {
  const d = A.cur.def, my = ++replayTok;
  replaying = true;
  $('result').hidden = true; $('betaShield').hidden = false; $('betaReplay').hidden = false; $('brAgain').hidden = true;
  A.loadDef(d); A.mode = 'play'; A.hud();
  await sleep(500);
  for (let k = 0; k < d.sol.length && my === replayTok; k++) {
    const [i, dir] = d.sol[k];
    $('brText').textContent = `최소 이동 풀이 ${k + 1}/${d.sol.length}`;
    A.showHint(i, dir);
    await sleep(650);
    if (my !== replayTok) return;
    A.attempt(i, dir);
    await sleep(380);
    while (busy && my === replayTok) await sleep(50);
    await sleep(250);
  }
  if (my !== replayTok) return;
  $('brText').textContent = `풀이 끝 · ${d.sol.length}수`;
  $('brAgain').hidden = false;
}
function closeReplay() {
  replayTok++; replaying = false;
  $('betaShield').hidden = true; $('betaReplay').hidden = true;
  A.mode = 'result'; $('result').hidden = false; $('rReplay').hidden = false;
}
