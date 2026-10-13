import { createGame, resizeGame, updateGame } from './game.js';
import { drawScene } from './render.js';
import { isMuted, setMuted, unlock, sfx } from './sound.js';

const $ = id => document.getElementById(id);
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = $('overlay');
const panels = {
  main: $('pMain'), ask: $('pAsk'), tutorial: $('pTutorial'),
  help: $('pHelp'), rank: $('pRank'), pause: $('pPause'),
};
const hud = { root: $('hud'), score: $('score'), squad: $('squad'), health: $('health') };
const KEY_TOP = 'survivor-run-top', KEY_TUT = 'survivor-run-tutorial';
const top = () => { try { return JSON.parse(localStorage.getItem(KEY_TOP)) || []; } catch { return []; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 기록 없이도 플레이할 수 있어요. */ } };
const tutorials = [
  ['이동', '화면을 좌우로 끌어 움직입니다. 사격은 자동이에요.'],
  ['강화', '길목에서 왼쪽이나 오른쪽 문으로 달리세요.'],
  ['보스', '붉은 탄환을 피하고 세 구역의 보스를 쓰러뜨리세요.'],
];

let state = 'title', game = null, lastFrame = performance.now();
let viewW = 1, viewH = 1, dpr = 1, pointerDown = false, pointerX = null;
let keys = new Set(), tutorialStep = 0, bannerTimer = 0, lastSaved = null;

function showPanel(name) {
  for (const [key, el] of Object.entries(panels)) el.hidden = key !== name;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const w = rect.width, h = rect.height;
  const changed = w !== viewW || h !== viewH;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw; canvas.height = ch;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (changed && game) resizeGame(game, w, h);
  viewW = w; viewH = h;
}

function showTitle() {
  state = 'title'; game = null; keys.clear(); pointerDown = false; pointerX = null;
  hud.root.hidden = true; $('pause').hidden = true;
  $('title').innerHTML = '생존자를 모으며<br>달리는 게임';
  $('msg').textContent = '길을 고르고 좀비 떼를 쓸어내는 슈팅 게임';
  $('result').hidden = true; $('home').hidden = true;
  $('start').textContent = '시작';
  showPanel('main'); overlay.hidden = false;
}

function beginGame() {
  unlock();
  resize();
  game = createGame(viewW, viewH);
  state = 'play'; keys.clear(); pointerDown = false; pointerX = null;
  bannerTimer = 0;
  $('banner').classList.remove('on');
  hud.root.hidden = false; $('pause').hidden = false;
  overlay.hidden = true;
  updateHud();
  lastFrame = performance.now();
}

function updateHud() {
  if (!game) return;
  hud.score.textContent = game.score.toLocaleString('ko-KR');
  hud.squad.textContent = String(game.squad);
  hud.health.textContent = '♥'.repeat(game.hp) + '♡'.repeat(Math.max(0, game.maxHp - game.hp));
}

function announce(message, seconds) {
  const el = $('banner');
  el.textContent = message;
  el.classList.add('on');
  bannerTimer = seconds || 1.8;
}

function handleEvents(events) {
  if (events.includes('shot')) sfx.shot();
  if (events.includes('hit')) sfx.hit();
  if (events.includes('pickup')) { sfx.pick(); announce('생존자 합류', 1.2); }
  if (events.includes('hurt')) { sfx.hurt(); announce('조심하세요!', 1.2); }
  if (events.includes('bossStart')) { sfx.boss(); announce('보스 출현', 2); }
  if (events.includes('bossDown')) { sfx.pick(); announce('보스 격파', 1.6); }
  for (const event of events) {
    if (event && typeof event === 'object' && event.type === 'gate') {
      sfx.pick(); announce(event.label, 1.5);
    }
    if (event && typeof event === 'object' && event.type === 'gateMiss') announce('문을 골라 보세요', 1.4);
  }
  if (events.includes('win')) sfx.win();
  if (events.includes('lose')) sfx.lose();
}

function finishGame(result) {
  if (!game || state === 'over') return;
  state = 'over'; keys.clear(); pointerDown = false;
  $('pause').hidden = true;
  const entry = {
    id: Date.now(),
    score: game.score,
    kills: game.kills,
    distance: game.distance,
    result: result === 'win' ? '돌파 성공' : '탈출',
    date: new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(new Date()),
  };
  const records = top();
  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  save(KEY_TOP, records.slice(0, 10));
  lastSaved = entry.id;
  $('title').textContent = result === 'win' ? '구조대에 도착!' : '작전 종료';
  $('msg').textContent = result === 'win' ? '세 구역을 모두 돌파했어요.' : '생존자 ' + game.squad + '명과 안전지대까지 달렸어요.';
  $('result').textContent = '점수 ' + game.score.toLocaleString('ko-KR') + ' · 처치 ' + game.kills + ' · 거리 ' + game.distance + 'm';
  $('result').hidden = false;
  $('start').textContent = '다시 달리기';
  $('home').hidden = false;
  hud.root.hidden = true;
  showPanel('main'); overlay.hidden = false;
}

function paintRank() {
  const list = top(), rows = $('rows');
  rows.replaceChildren();
  list.forEach((entry, index) => {
    const li = document.createElement('li');
    if (entry.id === lastSaved) li.className = 'me';
    const rank = document.createElement('span'); rank.className = 'rk'; rank.textContent = String(index + 1) + '.';
    const score = document.createElement('span'); score.className = 'sc'; score.textContent = Number(entry.score || 0).toLocaleString('ko-KR') + '점';
    const detail = document.createElement('span'); detail.textContent = '처치 ' + (entry.kills || 0);
    const date = document.createElement('span'); date.className = 'dt'; date.textContent = (entry.result || '기록') + ' · ' + (entry.distance || 0) + 'm · ' + (entry.date || '');
    li.append(rank, score, detail, date);
    rows.append(li);
  });
  $('rankNote').textContent = list.length ? '점수가 높은 순서예요. 이 기기에만 저장됩니다.' : '아직 기록이 없어요.';
}

function showTutorial() {
  tutorialStep = 0;
  paintTutorial();
  showPanel('tutorial');
}

function markTutorialSeen() {
  try { localStorage.setItem(KEY_TUT, '1'); } catch { /* 튜토리얼 안내를 다시 보여도 플레이할 수 있어요. */ }
}

function paintTutorial() {
  const item = tutorials[tutorialStep];
  $('tutStep').textContent = '안내 ' + (tutorialStep + 1) + ' / ' + tutorials.length;
  $('tutTitle').textContent = item[0];
  $('tutText').textContent = item[1];
  $('tutNext').textContent = tutorialStep === tutorials.length - 1 ? '출발!' : '다음';
}

function startFromTitle() {
  if (state === 'over') return beginGame();
  unlock();
  let seen = false;
  try { seen = localStorage.getItem(KEY_TUT) === '1'; } catch { seen = false; }
  if (!seen) showPanel('ask');
  else beginGame();
}

$('start').addEventListener('click', startFromTitle);
$('askYes').addEventListener('click', showTutorial);
$('askNo').addEventListener('click', () => { markTutorialSeen(); beginGame(); });
$('tutNext').addEventListener('click', () => {
  tutorialStep++;
  if (tutorialStep >= tutorials.length) { markTutorialSeen(); beginGame(); }
  else paintTutorial();
});
$('tutSkip').addEventListener('click', () => { markTutorialSeen(); beginGame(); });
$('helpBtn').addEventListener('click', () => showPanel('help'));
$('rankBtn').addEventListener('click', () => { paintRank(); showPanel('rank'); });
$('home').addEventListener('click', showTitle);
document.querySelectorAll('.back').forEach(button => button.addEventListener('click', () => showPanel('main')));
$('pause').addEventListener('click', () => {
  if (state !== 'play') return;
  state = 'paused'; keys.clear(); pointerDown = false;
  $('pause').hidden = true; showPanel('pause'); overlay.hidden = false;
});
$('resume').addEventListener('click', () => {
  if (state !== 'paused') return;
  state = 'play'; overlay.hidden = true; $('pause').hidden = false; lastFrame = performance.now();
});
$('quit').addEventListener('click', showTitle);

function paintMute() {
  const button = $('mute');
  button.textContent = isMuted() ? '🔇' : '🔊';
  button.setAttribute('aria-pressed', String(isMuted()));
  button.setAttribute('aria-label', isMuted() ? '소리 켜기' : '소리 끄기');
}
$('mute').addEventListener('click', () => {
  unlock(); setMuted(!isMuted()); paintMute();
});
paintMute();

canvas.addEventListener('pointerdown', event => {
  if (state !== 'play') return;
  event.preventDefault();
  pointerDown = true;
  const rect = canvas.getBoundingClientRect();
  pointerX = event.clientX - rect.left;
  try { canvas.setPointerCapture(event.pointerId); } catch { /* 터치가 화면 밖으로 나가도 다음 입력에서 복구돼요. */ }
});
canvas.addEventListener('pointermove', event => {
  if (!pointerDown || state !== 'play') return;
  const rect = canvas.getBoundingClientRect();
  pointerX = event.clientX - rect.left;
});
const releasePointer = () => { pointerDown = false; };
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);

window.addEventListener('keydown', event => {
  if (state !== 'play') return;
  if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(event.key)) {
    keys.add(event.key.toLowerCase());
    event.preventDefault();
  }
  if (event.key === 'Escape') { $('pause').click(); }
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); pointerDown = false; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'play') $('pause').click();
});
window.addEventListener('resize', resize);
window.addEventListener('gesturestart', event => event.preventDefault(), { passive: false });
window.addEventListener('wheel', event => { if (event.ctrlKey) event.preventDefault(); }, { passive: false });
new ResizeObserver(resize).observe($('stage'));
resize();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (state === 'play' && game) {
    let target = pointerDown ? pointerX : null;
    const direction = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    if (direction) target = game.targetX + direction * game.w * 0.9 * dt;
    const events = updateGame(game, dt, target);
    handleEvents(events);
    updateHud();
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) $('banner').classList.remove('on');
    }
    if (game.finished) finishGame(game.finished);
  }
  drawScene(ctx, game, viewW, viewH, now, state === 'title' || !game);
  requestAnimationFrame(frame);
}

showTitle();
requestAnimationFrame(frame);
