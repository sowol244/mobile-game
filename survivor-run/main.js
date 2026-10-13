import { createGame, resizeGame, updateGame, STAGE_DURATION } from './game.js';
import { drawScene } from './render.js';
import { isMuted, setMuted, unlock, sfx } from './sound.js';

const $ = id => document.getElementById(id);
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const overlay = $('overlay');
const stage = $('stage');
const panels = {
  main: $('pMain'), ask: $('pAsk'), tutorial: $('pTutorial'),
  help: $('pHelp'), rank: $('pRank'), pause: $('pPause'),
};
const hud = {
  root: $('hud'), distance: $('distance'), timer: $('timer'),
  progress: $('progressFill'), healthText: $('healthText'), health: $('healthFill'),
  weapon: $('weapon'), weaponLevel: $('weaponLevel'), weaponIcon: $('weaponIcon'),
  kills: $('kills'), bossRoot: $('bossHud'), bossFill: $('bossFill'),
};
const KEY_TOP = 'survivor-run-top', KEY_TUT = 'dead-route-tutorial';
const top = () => { try { return JSON.parse(localStorage.getItem(KEY_TOP)) || []; } catch { return []; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 없이도 플레이할 수 있어요. */ } };
const sprite = path => {
  const image = new Image();
  image.src = new URL(path, import.meta.url).href;
  return image;
};
const assets = {
  player: sprite('assets/player-back-a.webp'),
  playerRun: sprite('assets/player-back-b.webp'),
  walker: sprite('assets/zombie-walker.webp'),
  walkerRun: sprite('assets/zombie-walker-run.webp'),
  runner: sprite('assets/zombie-runner.webp'),
  runnerRun: sprite('assets/zombie-runner-run.webp'),
  brute: sprite('assets/zombie-brute.webp'),
};
const tutorials = [
  ['이동', '화면을 좌우로 끌어 도로 안에서 움직입니다. PC에서는 A/D 또는 ←/→ 키를 사용하세요.'],
  ['자동 사격', '총은 자동으로 발사됩니다. 목표물과 같은 쪽으로 움직이면 사격 방향이 따라갑니다.'],
  ['보급 선택', '숫자 드럼통을 부수면 보상을 얻습니다. 빨간 드럼통은 큰 폭발을 일으켜요.'],
];

let state = 'title', game = null, lastFrame = performance.now();
let viewW = 1, viewH = 1, dpr = 1;
let pointerDown = false, pointerX = null, keys = new Set();
let tutorialStep = 0, bannerTimer = 0, lastSaved = null;

function showPanel(name) {
  for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== name;
}

function resize() {
  const rect = stage.getBoundingClientRect();
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
  hud.root.hidden = true; hud.bossRoot.hidden = true;
  $('pause').hidden = true;
  $('title').innerHTML = 'DEAD<br>ROUTE';
  $('msg').innerHTML = '무너진 도로를 돌파하고<br>안전지대까지 살아남으세요.';
  $('result').hidden = true; $('home').hidden = true;
  $('start').textContent = '작전 시작';
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
  hud.bossRoot.hidden = true;
  overlay.hidden = true;
  updateHud();
  lastFrame = performance.now();
}

function updateHud() {
  if (!game) return;
  hud.distance.textContent = game.distance.toLocaleString('ko-KR') + ' m';
  hud.progress.style.width = Math.min(100, game.t / STAGE_DURATION * 100) + '%';
  const remaining = Math.max(0, STAGE_DURATION - game.t);
  hud.timer.textContent = game.boss ? '보스' : '00:' + String(Math.ceil(remaining)).padStart(2, '0');
  hud.healthText.textContent = Math.ceil(game.hp) + ' / ' + game.maxHp;
  hud.health.style.width = Math.max(0, game.hp / game.maxHp * 100) + '%';
  hud.health.classList.toggle('critical', game.hp <= 30);
  hud.weapon.textContent = game.weapon === 'smg' ? '기관단총' : '권총';
  hud.weaponIcon.textContent = game.weapon === 'smg' ? '▰' : '●';
  hud.weaponLevel.textContent = String(game.weaponLevel[game.weapon] || 1);
  hud.kills.textContent = String(game.kills);
  hud.bossRoot.hidden = !game.boss;
  if (game.boss) hud.bossFill.style.width = Math.max(0, game.boss.hp / game.boss.maxHp * 100) + '%';
}

function announce(message, seconds) {
  const el = $('banner');
  el.textContent = message;
  el.classList.add('on');
  bannerTimer = seconds || 1.6;
}

function handleEvents(events) {
  for (const event of events) {
    if (event === 'shot') sfx.shot();
    else if (event === 'hit') sfx.hit();
    else if (event === 'barrelDown') sfx.pick();
    else if (event === 'explosion') sfx.explosion();
    else if (event === 'hurt') { sfx.hurt(); announce('피격! 도로를 벗어나세요', 1.2); }
    else if (event === 'bossStart') { sfx.boss(); announce('보스 출현 · 경고 구역을 피하세요', 2.2); }
    else if (event === 'bossWarn') announce('강타 예고 · 붉은 구역을 피하세요', 1.1);
    else if (event === 'bossDown') { sfx.pick(); announce('대형 변이체 격파', 1.8); }
    else if (event === 'win') sfx.win();
    else if (event === 'lose' || event === 'timeout') sfx.lose();
    else if (event && typeof event === 'object' && event.type === 'reward') {
      sfx.upgrade(); announce(event.label, 1.8);
    }
  }
}

function finishGame(result) {
  if (!game || state === 'over') return;
  state = 'over'; keys.clear(); pointerDown = false;
  $('pause').hidden = true; hud.root.hidden = true; hud.bossRoot.hidden = true;
  const entry = {
    id: Date.now(), score: game.score, kills: game.kills,
    distance: game.distance, result: result === 'win' ? '돌파 성공' : '작전 종료',
    date: new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(new Date()),
  };
  const records = top();
  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  save(KEY_TOP, records.slice(0, 10));
  lastSaved = entry.id;
  $('title').innerHTML = result === 'win' ? 'ROUTE<br>SECURED' : 'MISSION<br>FAILED';
  $('msg').textContent = result === 'win' ? '안전지대에 도착했습니다.' : '탄약과 체력을 정비하고 다시 출동하세요.';
  $('result').textContent = '점수 ' + game.score.toLocaleString('ko-KR') + ' · 처치 ' + game.kills + ' · 거리 ' + game.distance + 'm';
  $('result').hidden = false;
  $('start').textContent = '다시 출동';
  $('home').hidden = false;
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
  $('rankNote').textContent = list.length ? '높은 점수 순서예요. 이 기기에만 저장됩니다.' : '아직 작전 기록이 없습니다.';
}

function paintTutorial() {
  const item = tutorials[tutorialStep];
  $('tutStep').textContent = '안내 ' + (tutorialStep + 1) + ' / ' + tutorials.length;
  $('tutTitle').textContent = item[0];
  $('tutText').textContent = item[1];
  $('tutNext').textContent = tutorialStep === tutorials.length - 1 ? '출발!' : '다음';
}

function markTutorialSeen() {
  try { localStorage.setItem(KEY_TUT, '1'); } catch { /* 다음 출동에서 안내를 다시 보여도 괜찮아요. */ }
}

function showTutorial() {
  tutorialStep = 0;
  paintTutorial();
  showPanel('tutorial');
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
  try { canvas.setPointerCapture(event.pointerId); } catch { /* 입력 중단 시 다음 터치에서 복구합니다. */ }
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
  if (event.key === 'Escape') $('pause').click();
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); pointerDown = false; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'play') $('pause').click();
});
window.addEventListener('resize', resize);
window.addEventListener('gesturestart', event => event.preventDefault(), { passive: false });
window.addEventListener('wheel', event => { if (event.ctrlKey) event.preventDefault(); }, { passive: false });
new ResizeObserver(resize).observe(stage);
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
  drawScene(ctx, game, viewW, viewH, now, state === 'title' || !game, assets);
  requestAnimationFrame(frame);
}

showTitle();
requestAnimationFrame(frame);
