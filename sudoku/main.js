import {
  newGame, place, toggleNote, erase, undo as undoMove, useHint, starsFor, digitCount, fmtTime, hasNote, isCorrect,
  ROW, COL, BOX, UNITS, MAX_MISTAKES, MAX_HINTS,
} from './logic.js';
import { STAGES, TIERS } from './stages.js';
import { createSound } from './sound.js';

const $ = id => document.getElementById(id);
const sound = createSound();
const store = {
  get(k, d) { try { const v = localStorage.getItem('sudoku-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sudoku-' + k, JSON.stringify(v)); } catch (e) {} },
};
const TIER_COLORS = ['#56b38f', '#4f9ad8', '#7b6fd6', '#e0884a', '#d6455d'];
const TIER_TECH = ['싱글', '싱글 · 포인팅', '포인팅 · 페어', '페어 · 트리플', 'X-윙 · 소드피시'];
const PAGE = 20;

let recs = store.get('rec', {});     // stage number -> { stars, best }
let saves = store.get('save', {});   // stage number -> saved game
let mode = 'title';                  // title | play | result
let stageNo = 1, game = null, sel = -1, memo = false, elapsed = 0, lastTick = 0, page = store.get('page', 0);
let toastTimer = 0, busyUntil = 0;

const tierOf = n => TIERS.findIndex(t => n >= t.from && n <= t.to);
const unlocked = n => n === 1 || !!recs[n - 1] || !!recs[n];
const maxUnlocked = () => { let n = 1; while (n < 100 && unlocked(n + 1)) n++; return n; };
const totalStars = () => Object.values(recs).reduce((a, r) => a + r.stars, 0);

/* ---------- board ---------- */
const boardEl = $('board'), stageEl = $('stage'), padEl = $('pad');
const cellEls = new Array(81);
for (let b = 0; b < 9; b++) {
  const box = document.createElement('div'); box.className = 'box';
  for (let k = 0; k < 9; k++) {
    const i = (((b / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + (b % 3) * 3 + (k % 3);
    const c = document.createElement('div'); c.className = 'cell'; c.dataset.i = i; c.setAttribute('role', 'gridcell');
    c.style.setProperty('--w', `${(ROW(i) + COL(i)) * 38}ms`);
    box.appendChild(c); cellEls[i] = c;
  }
  boardEl.appendChild(box);
}
const keyEls = [];
for (let d = 1; d <= 9; d++) {
  const k = document.createElement('button'); k.className = 'key'; k.type = 'button'; k.dataset.d = d;
  k.innerHTML = `<b>${d}</b><small></small>`; k.setAttribute('aria-label', `숫자 ${d}`);
  padEl.appendChild(k); keyEls[d] = k;
}
function layoutBoard() {
  const r = stageEl.getBoundingClientRect();
  const size = Math.max(180, Math.floor(Math.min(r.width, r.height, 620)));
  boardEl.style.setProperty('--bs', size + 'px');
}
new ResizeObserver(layoutBoard).observe(stageEl);

function renderCell(i) {
  const c = cellEls[i], v = game.vals[i];
  const given = game.given[i], hinted = !!(game.hinted && game.hinted.includes(i));
  c.classList.toggle('g', given);
  c.classList.toggle('m', !!v && !given && !hinted && v === game.sol[i]);
  c.classList.toggle('h', !!v && hinted);
  c.classList.toggle('x', !!v && v !== game.sol[i]);
  if (v) { if (c.dataset.v !== String(v)) { c.innerHTML = `<span class="v">${v}</span>`; c.dataset.v = v; } }
  else if (game.notes[i]) {
    let h = '<div class="notes">';
    for (let d = 1; d <= 9; d++) h += `<span data-n="${d}">${hasNote(game, i, d) ? d : ''}</span>`;
    c.innerHTML = h + '</div>'; c.dataset.v = 'n' + game.notes[i];
  } else if (c.dataset.v !== '') { c.innerHTML = ''; c.dataset.v = ''; }
  c.setAttribute('aria-label', `${ROW(i) + 1}행 ${COL(i) + 1}열 ${v || '빈칸'}`);
}
function renderAll() { for (let i = 0; i < 81; i++) renderCell(i); paintSel(); hud(); }
function paintSel() {
  const sv = sel >= 0 ? game.vals[sel] : 0;
  for (let i = 0; i < 81; i++) {
    const c = cellEls[i];
    const peer = sel >= 0 && i !== sel && (ROW(i) === ROW(sel) || COL(i) === COL(sel) || BOX(i) === BOX(sel));
    c.classList.toggle('sel', i === sel);
    c.classList.toggle('peer', peer);
    c.classList.toggle('same', !!sv && i !== sel && game.vals[i] === sv);
    if (!game.vals[i] && game.notes[i]) c.querySelectorAll('.notes span').forEach(s => s.classList.toggle('hl', !!sv && +s.dataset.n === sv && s.textContent !== ''));
  }
}
function hud() {
  $('stageName').innerHTML = `${stageNo}탄<small>${TIERS[tierOf(stageNo)].name}</small>`;
  [...$('dots').children].forEach((d, k) => d.classList.toggle('on', k < game.mistakes));
  $('hintN').textContent = MAX_HINTS - game.hints;
  $('hint').disabled = game.hints >= MAX_HINTS;
  $('undo').disabled = !game.history.length;
  const r = recs[stageNo];
  $('best').textContent = r ? fmtTime(r.best) : '-';
  for (let d = 1; d <= 9; d++) {
    const left = 9 - digitCount(game, d);
    keyEls[d].classList.toggle('done', left === 0);
    keyEls[d].querySelector('small').textContent = left;
  }
}
function paintMemo() {
  $('memo').classList.toggle('on', memo); $('memo').setAttribute('aria-pressed', String(memo));
  $('memoTag').textContent = memo ? 'ON' : 'OFF'; padEl.classList.toggle('memo', memo);
}
function paintTime() { $('time').textContent = fmtTime(elapsed); }
function animate(i, cls) { const c = cellEls[i]; c.classList.remove(cls); void c.offsetWidth; c.classList.add(cls); }
function flashUnits(units, origin, color = '') {
  const seen = new Set();
  for (const u of units) for (const i of UNITS[u]) {
    if (seen.has(i)) continue; seen.add(i);
    const d = (Math.abs(ROW(i) - ROW(origin)) + Math.abs(COL(i) - COL(origin))) * 45;
    const c = cellEls[i]; c.style.setProperty('--d', d + 'ms'); c.style.setProperty('--fc', color || 'var(--accent)'); animate(i, 'flash');
  }
}
function toast(msg, kind = '', ms = 1800) {
  const t = $('toast'); t.textContent = msg; t.className = kind; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'fade ' + kind; }, ms);
}

/* ---------- game flow ---------- */
function persist() {
  if (!game || mode !== 'play' || game.won || game.failed) return;
  if (!game.history.length && !game.hints && !game.mistakes) { if (saves[stageNo]) dropSave(stageNo); return; }
  saves[stageNo] = { vals: game.vals, notes: game.notes, mistakes: game.mistakes, hints: game.hints, hinted: game.hinted || [], history: game.history.slice(-60), time: Math.floor(elapsed), at: Date.now() };
  const keys = Object.keys(saves).sort((a, b) => saves[b].at - saves[a].at);
  for (const k of keys.slice(6)) delete saves[k];
  store.set('save', saves);
}
function dropSave(n) { delete saves[n]; store.set('save', saves); }

function startStage(n, { fresh = false } = {}) {
  stageNo = n; const def = STAGES[n - 1];
  game = newGame(def.p, def.s); elapsed = 0;
  const sv = !fresh && saves[n];
  if (sv) {
    game.vals = sv.vals.slice(); game.notes = sv.notes.slice(); game.mistakes = sv.mistakes; game.hints = sv.hints;
    game.hinted = sv.hinted.slice(); game.history = sv.history || []; elapsed = sv.time || 0;
  } else if (fresh) dropSave(n);
  memo = false; paintMemo();
  sel = game.vals.findIndex(v => !v);
  // start near the centre: the first empty cell of the middle box reads nicely
  const mid = UNITS[22].find(i => !game.vals[i]); if (mid != null) sel = mid;
  boardEl.classList.remove('win', 'lost');
  cellEls.forEach(c => { c.dataset.v = 'x'; c.className = 'cell'; });
  $('result').hidden = true;
  showPanel(null); mode = 'play'; lastTick = performance.now(); busyUntil = 0;
  renderAll(); paintTime(); layoutBoard();
  if (sv) toast('이어서 풀어요');
  store.set('last', n);
}
function select(i) {
  if (mode !== 'play' || i < 0 || i > 80) return;
  sel = i; paintSel();
}
function input(d) {
  if (mode !== 'play' || performance.now() < busyUntil) return;
  sound.unlock();
  if (sel < 0) { toast('칸을 먼저 골라 주세요'); return; }
  if (game.given[sel] || isCorrect(game, sel)) {
    // tapping a digit on a filled cell just highlights that digit
    sound.tap(); paintSel(); return;
  }
  if (memo) {
    if (digitCount(game, d) === 9) return;
    if (toggleNote(game, sel, d)) { sound.note(); renderCell(sel); paintSel(); hud(); persist(); }
    return;
  }
  const r = place(game, sel, d);
  if (!r.changed) return;
  renderCell(sel);
  if (r.wrong) {
    sound.wrong(); animate(sel, 'shake');
    const ms = $('mistakeStat'); ms.classList.remove('bump'); void ms.offsetWidth; ms.classList.add('bump');
    if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) {}
    paintSel(); hud();
    if (r.failed) return lose();
    toast(`틀렸어요 (실수 ${game.mistakes}/${MAX_MISTAKES})`, '', 1200);
    persist(); return;
  }
  for (const p of r.removed) renderCell(p);
  animate(sel, 'pop'); paintSel(); hud();
  if (r.won) return win();
  if (r.units.length) { flashUnits(r.units, sel); sound.unit(r.units.length); }
  else if (r.digitDone) sound.digit();
  else sound.place(d);
  if (r.digitDone) { const k = keyEls[d]; k.animate([{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 300 }); }
  persist();
}
function doErase() {
  if (mode !== 'play' || sel < 0) return;
  if (erase(game, sel)) { sound.erase(); renderCell(sel); paintSel(); hud(); persist(); }
  else if (game.given[sel] || isCorrect(game, sel)) toast('이 칸은 지울 수 없어요', '', 1200);
}
function doUndo() {
  if (mode !== 'play') return;
  const before = game.vals.slice(), nb = game.notes.slice();
  if (!undoMove(game)) { toast('되돌릴 수 없어요', '', 1100); return; }
  sound.undo();
  const changed = [];
  for (let i = 0; i < 81; i++) if (before[i] !== game.vals[i] || nb[i] !== game.notes[i]) { renderCell(i); changed.push(i); }
  const main = changed.find(i => before[i] !== game.vals[i]);
  if (main != null) sel = main; else if (changed.length === 1) sel = changed[0];
  paintSel(); hud(); persist();
}
function doHint() {
  if (mode !== 'play') return;
  if (game.hints >= MAX_HINTS) { toast('힌트를 모두 썼어요'); return; }
  const h = useHint(game, sel);
  if (!h) return;
  sound.hint(); sel = h.idx;
  renderCell(h.idx); for (const p of h.removed) renderCell(p);
  animate(h.idx, 'pop'); animate(h.idx, 'hintMark'); paintSel(); hud();
  toast(h.reason, 'hint', 3200);
  if (h.won) return win();
  if (h.units.length) flashUnits(h.units, h.idx);
  else if (h.unit != null) flashUnits([h.unit], h.idx, 'var(--green)');
  persist();
}
function toggleMemo() { if (mode !== 'play') return; memo = !memo; sound.tap(); paintMemo(); }

function win() {
  mode = 'result'; busyUntil = Infinity;
  const stars = starsFor(game.mistakes, game.hints), t = Math.floor(elapsed);
  const prev = recs[stageNo];
  const newBest = !prev || t < prev.best;
  recs[stageNo] = { stars: Math.max(stars, prev ? prev.stars : 0), best: prev ? Math.min(prev.best, t) : t };
  store.set('rec', recs); dropSave(stageNo);
  sel = -1; paintSel(); hud();
  boardEl.classList.remove('win'); void boardEl.offsetWidth; boardEl.classList.add('win');
  sound.win();
  setTimeout(() => {
    $('rTitle').textContent = stageNo === 100 ? '모두 클리어!' : '클리어!';
    $('rStars').innerHTML = [0, 1, 2].map(k => (k < stars ? `<span class="s" style="animation-delay:${150 + k * 160}ms">★</span>` : '<i>★</i>')).join('');
    $('rBadge').hidden = !(newBest && prev);
    const why = game.mistakes + game.hints === 0 ? '실수·힌트 없이 깼어요' : `실수 <b>${game.mistakes}</b> · 힌트 <b>${game.hints}</b>`;
    $('rMsg').innerHTML = `시간 <b>${fmtTime(t)}</b> · 최고 <b>${fmtTime(recs[stageNo].best)}</b><br>${why}`;
    $('rNext').textContent = stageNo < 100 ? '다음 탄' : '단계 선택';
    $('rNext').dataset.act = stageNo < 100 ? 'next' : 'select';
    $('rRetry').hidden = false;
    $('result').hidden = false; confetti();
    setTimeout(() => $('rNext').focus({ preventScroll: true }), 50);
  }, 1250);
}
function lose() {
  mode = 'result'; busyUntil = Infinity; dropSave(stageNo);
  sound.fail(); boardEl.classList.add('lost');
  setTimeout(() => {
    $('rTitle').textContent = '실패';
    $('rStars').innerHTML = '<i>★</i><i>★</i><i>★</i>';
    $('rBadge').hidden = true;
    $('rMsg').innerHTML = `${MAX_MISTAKES}번 틀렸어요. 처음부터 다시 도전해요!`;
    $('rNext').textContent = '다시 도전'; $('rNext').dataset.act = 'retry';
    $('rRetry').hidden = true;
    $('result').hidden = false;
  }, 700);
}
function confetti() {
  const app = $('app'), cols = ['#3d6fd6', '#f2b232', '#56b38f', '#e0884a', '#7b6fd6'];
  for (let k = 0; k < 36; k++) {
    const e = document.createElement('div'); e.className = 'confetti';
    e.style.left = Math.random() * 100 + '%'; e.style.background = cols[k % cols.length];
    e.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px'); e.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    e.style.animationDuration = 1.6 + Math.random() * 1.4 + 's'; e.style.animationDelay = Math.random() * 0.4 + 's';
    app.appendChild(e); setTimeout(() => e.remove(), 3600);
  }
}

/* ---------- timer ---------- */
setInterval(() => {
  const now = performance.now();
  if (mode === 'play' && !document.hidden && !game.won && !game.failed) {
    const was = Math.floor(elapsed);
    elapsed += Math.min(1, (now - lastTick) / 1000);
    if (Math.floor(elapsed) !== was) { paintTime(); if (Math.floor(elapsed) % 5 === 0) persist(); }
  }
  lastTick = now;
}, 250);
document.addEventListener('visibilitychange', () => { lastTick = performance.now(); if (document.hidden) persist(); });
window.addEventListener('pagehide', persist);

/* ---------- panels ---------- */
const PANELS = ['title', 'help', 'records', 'select'];
function showPanel(id) { for (const p of PANELS) $(p).hidden = p !== id; }
function leavePlay() { if (mode === 'play') persist(); }
function showTitle() { leavePlay(); mode = 'title'; $('result').hidden = true; showPanel('title'); }

const HELP = [
  ['1~9', '', '가로·세로·3×3 상자마다 1~9를 한 번씩 넣어요'],
  ['<svg viewBox="0 0 20 20"><path d="M5 3l10 7-5 1.2L8 16 5 3Z" fill="currentColor"/></svg>', '', '칸을 누르고 아래 숫자를 눌러 채워요'],
  ['<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>', '', '메모를 켜면 후보 숫자를 작게 적어요'],
  ['3', 'red', '틀린 숫자는 빨갛게 보이고, 3번 틀리면 실패예요'],
  ['?', '', '힌트는 한 판에 3번, 이유와 함께 한 칸을 채워요'],
  ['★', 'gold', '실수·힌트 없이 깨면 별 3개를 받아요'],
  ['<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 10h1M9.5 10h1M13 10h1M16.5 10h1M8 14h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', '', 'PC: 방향키 이동 · 1~9 입력 · 0 지우기 · N 메모 · Z 되돌리기 · H 힌트'],
];
function showHelp(back) {
  leavePlay(); mode = 'title';
  $('helpList').innerHTML = HELP.map(([ic, c, t]) => `<li><span class="ic ${c}">${ic}</span><span>${t}</span></li>`).join('');
  $('helpBack').onclick = back || showTitle;
  showPanel('help');
}
function showRecords(back) {
  leavePlay(); mode = 'title';
  const cleared = Object.keys(recs).length, stars = totalStars();
  const playTime = Object.values(recs).reduce((a, r) => a + r.best, 0);
  $('stats').innerHTML = `<div><b>${cleared}</b><small>깬 탄 / 100</small></div><div><b>★ ${stars}</b><small>별 / 300</small></div><div><b>${cleared ? fmtTime(playTime) : '-'}</b><small>최고 기록 합계</small></div>`;
  let h = '<li class="h"><span>난이도</span><span class="n">깬 탄</span><span class="s">별</span><span class="t">가장 빠른</span></li>';
  TIERS.forEach((t, ti) => {
    const ns = []; for (let n = t.from; n <= t.to; n++) if (recs[n]) ns.push(n);
    const st = ns.reduce((a, n) => a + recs[n].stars, 0);
    let fast = null; for (const n of ns) if (!fast || recs[n].best < recs[fast].best) fast = n;
    h += `<li><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:7px;background:${TIER_COLORS[ti]}"></i>${t.name}</span><span class="n">${ns.length}/${t.to - t.from + 1}</span><span class="s">★ ${st}</span><span class="t">${fast ? fmtTime(recs[fast].best) + `<em>${fast}탄</em>` : '-'}</span></li>`;
  });
  $('recs').innerHTML = h;
  $('recBack').onclick = back || showTitle;
  showPanel('records');
}
function showSelect(p) {
  leavePlay(); mode = 'title'; $('result').hidden = true;
  if (p == null) page = Math.floor((maxUnlocked() - 1) / PAGE);
  else page = p;
  store.set('page', page);
  $('selTot').textContent = `★ ${totalStars()}`;
  // resume banner: most recent unfinished game
  const last = Object.keys(saves).sort((a, b) => saves[b].at - saves[a].at)[0];
  $('resume').hidden = !last;
  if (last) {
    const s = saves[last], filled = s.vals.filter(v => v).length;
    $('resumeT').textContent = `${last}탄 이어하기`;
    $('resumeS').textContent = `${TIERS[tierOf(+last)].name} · ${fmtTime(s.time)} · ${filled}/81칸`;
    $('resume').onclick = () => { sound.unlock(); sound.tap(); startStage(+last); };
  }
  $('pages').innerHTML = Array.from({ length: 100 / PAGE }, (_, k) => {
    let st = 0; for (let n = k * PAGE + 1; n <= (k + 1) * PAGE; n++) st += recs[n] ? recs[n].stars : 0;
    return `<button type="button" role="tab" data-p="${k}" class="${k === page ? 'on' : ''}" aria-selected="${k === page}">${k * PAGE + 1}–${(k + 1) * PAGE}${st ? '<small>★' + st + '</small>' : ''}</button>`;
  }).join('');
  const from = page * PAGE + 1, to = from + PAGE - 1, cur = maxUnlocked();
  let h = '';
  TIERS.forEach((t, ti) => {
    const a = Math.max(from, t.from), b = Math.min(to, t.to);
    if (a > b) return;
    let sum = 0; for (let n = t.from; n <= t.to; n++) sum += recs[n] ? recs[n].stars : 0;
    h += `<section class="chap" style="--tc:${TIER_COLORS[ti]}"><h3><i></i>${t.name}<span class="tg">${t.from}–${t.to}탄 · ${TIER_TECH[ti]}</span><span class="sum">★ ${sum}/${(t.to - t.from + 1) * 3}</span></h3><div class="grid">`;
    for (let n = a; n <= b; n++) {
      const r = recs[n], open = unlocked(n);
      const stars = r ? '★'.repeat(r.stars) + '<i>' + '★'.repeat(3 - r.stars) + '</i>' : '<i>★★★</i>';
      h += `<button type="button" class="lv${r ? ' done' : ''}${n === cur && !r ? ' cur' : ''}${saves[n] ? ' saved' : ''}" data-n="${n}" ${open ? '' : 'disabled'} aria-label="${n}탄">`
        + (open ? `${n}<small>${stars}</small><em>${r ? fmtTime(r.best) : ''}</em>` : `<svg class="lock" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3.5 7h9v7h-9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><em>${n}</em>`)
        + '</button>';
    }
    h += '</div></section>';
  });
  $('chapters').innerHTML = h;
  showPanel('select');
  $('select').scrollTop = 0;
}
$('pages').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (b) { sound.tap(); showSelect(+b.dataset.p); } });
$('chapters').addEventListener('click', e => {
  const b = e.target.closest('.lv'); if (!b || b.disabled) return;
  sound.unlock(); sound.tap(); startStage(+b.dataset.n);
});

/* ---------- controls ---------- */
boardEl.addEventListener('pointerdown', e => {
  const c = e.target.closest('.cell'); if (!c) return;
  e.preventDefault(); sound.unlock(); select(+c.dataset.i);
});
padEl.addEventListener('click', e => { const k = e.target.closest('.key'); if (k) input(+k.dataset.d); });
$('undo').addEventListener('click', doUndo);
$('erase').addEventListener('click', doErase);
$('memo').addEventListener('click', toggleMemo);
$('hint').addEventListener('click', doHint);
$('toSelect').addEventListener('click', () => { sound.tap(); showSelect(); });
$('start').addEventListener('click', () => { sound.unlock(); sound.tap(); showSelect(); });
$('howto').addEventListener('click', () => showHelp());
$('rank').addEventListener('click', () => showRecords());
$('selBack').addEventListener('click', showTitle);
$('rNext').addEventListener('click', () => {
  const act = $('rNext').dataset.act;
  if (act === 'next') startStage(stageNo + 1);
  else if (act === 'retry') startStage(stageNo, { fresh: true });
  else showSelect();
});
$('rRetry').addEventListener('click', () => startStage(stageNo, { fresh: true }));
$('rSelect').addEventListener('click', () => showSelect());
$('rHome').addEventListener('click', showTitle);

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { if (mode === 'play') { showSelect(); e.preventDefault(); } else if (!$('help').hidden || !$('records').hidden) showTitle(); return; }
  if (mode !== 'play') return;
  const k = e.key;
  const move = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[k];
  if (move) {
    e.preventDefault();
    if (sel < 0) sel = 40;
    else {
      let r = ROW(sel), c = COL(sel);
      if (move === -9) r = (r + 8) % 9; else if (move === 9) r = (r + 1) % 9; else if (move === -1) c = (c + 8) % 9; else c = (c + 1) % 9;
      sel = r * 9 + c;
    }
    sound.tap(); paintSel(); return;
  }
  const code = e.code || '';
  const dm = /^(Digit|Numpad)([0-9])$/.exec(code);
  const d = dm ? +dm[2] : /^[0-9]$/.test(k) ? +k : -1;
  if (d >= 1 && d <= 9) {
    e.preventDefault();
    if (e.shiftKey && !memo) { memo = true; input(d); memo = false; } else input(d);
    return;
  }
  if (d === 0 || k === 'Backspace' || k === 'Delete') { e.preventDefault(); doErase(); return; }
  const l = k.toLowerCase();
  if (l === 'n' || l === 'm') { e.preventDefault(); toggleMemo(); }
  else if (l === 'z' || l === 'u') { e.preventDefault(); doUndo(); }
  else if (l === 'h') { e.preventDefault(); doHint(); }
});

let muted = store.get('mute', false);
function paintMute() { sound.setMuted(muted); $('mute').textContent = muted ? '소리 꺼짐' : '소리 켜짐'; $('mute').setAttribute('aria-pressed', String(muted)); }
$('mute').addEventListener('click', () => { muted = !muted; store.set('mute', muted); paintMute(); sound.unlock(); sound.tap(); });
paintMute();

// Two fingers must never start the browser's pinch zoom.
['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());

// A board sits behind the title so the first frame is never empty.
stageNo = Math.min(store.get('last', 1), maxUnlocked());
game = newGame(STAGES[stageNo - 1].p, STAGES[stageNo - 1].s); sel = -1;
renderAll();
showPanel('title');

// Test hook for automated checks; harmless in normal play.
window.__sudoku = {
  get mode() { return mode; },
  get stage() { return stageNo; },
  get selected() { return sel; },
  get memo() { return memo; },
  get page() { return page; },
  get game() { return game && { vals: game.vals.slice(), notes: game.notes.slice(), sol: game.sol.slice(), given: game.given.slice(), mistakes: game.mistakes, hints: game.hints, won: game.won, failed: game.failed, history: game.history.length }; },
  get time() { return elapsed; },
  get records() { return recs; },
  get saves() { return saves; },
  stages: STAGES,
  tiers: TIERS,
  cellCenter(i) { const b = cellEls[i].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; },
  keyCenter(d) { const b = keyEls[d].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; },
  startStage,
};
