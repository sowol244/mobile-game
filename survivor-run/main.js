import { createGame, resizeGame, updateGame, STAGE_DURATION, applyPlayerDrag } from './game.js?v=1-1-20261014g';
import { drawScene } from './render.js?v=1-1-20261014g';
import { isMuted, setMuted, unlock, sfx } from './sound.js?v=1-1-20261014';

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
  kills: $('kills'),
  supportRoot: $('supportHud'),
  soldierRoot: $('soldierSupport'), soldierCount: $('soldierCount'), soldierTime: $('soldierTime'), soldierFill: $('soldierFill'),
  droneRoot: $('droneSupport'), droneTime: $('droneTime'), droneFill: $('droneFill'),
  rocketRoot: $('rocketSupport'), rocketCount: $('rocketCount'), rocketFill: $('rocketFill'),
  rapidRoot: $('rapidSupport'), rapidTime: $('rapidTime'), rapidFill: $('rapidFill'),
  bossRoot: $('bossHud'), bossFill: $('bossFill'), tutorialHint: $('tutorialHint'),
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
  supportSoldier: sprite('assets/support-soldier.svg'),
  combatDrone: sprite('assets/combat-drone.svg'),
  rocketProjectile: sprite('assets/rocket-projectile.svg'),
  rewardSupport: sprite('assets/reward-support.svg'),
  rewardDrone: sprite('assets/reward-drone.svg'),
  rewardRocket: sprite('assets/reward-rocket.svg'),
  rewardRapidfire: sprite('assets/reward-rapidfire.svg'),
  rewardHeal: sprite('assets/reward-heal.svg'),
  rewardWeapon: sprite('assets/reward-weapon.svg'),
  rewardUpgrade: sprite('assets/reward-upgrade.svg'),
  rewardExplosive: sprite('assets/reward-explosive.svg'),
};
const tutorials = [
  ['이동', '화면을 좌우로 끌어 도로 안에서 움직입니다. PC에서는 A/D 또는 ←/→ 키를 사용하세요.'],
  ['자동 사격', '총은 자동으로 발사됩니다. 원하는 좀비나 보급통 쪽으로 움직이면 표적이 바뀝니다.'],
  ['보급과 회피', '숫자 내구도를 0으로 만들면 지원 사수·드론·로켓을 얻습니다. 붉은 보스 공격은 차선을 바꿔 피하세요.'],
];

let state = 'title', game = null, lastFrame = performance.now();
let viewW = 1, viewH = 1, dpr = 1;
const TOUCH_DRAG_SENSITIVITY = 1.0;
let pointerDown = false, activePointerId = null, pointerLastClientX = null, keys = new Set();
let tutorialStep = 0, bannerTimer = 0, lastSaved = null;

function showPanel(name) {
  for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== name;
}

function resetPointerInput(stopAtPlayer = true) {
  pointerDown = false;
  activePointerId = null;
  pointerLastClientX = null;
  if (stopAtPlayer && game) game.targetX = game.x;
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
  resetPointerInput();
  state = 'title'; game = null; keys.clear();
  hud.root.hidden = true; hud.bossRoot.hidden = true; hud.tutorialHint.hidden = true;
  $('pause').hidden = true;
  $('title').innerHTML = 'DEAD<br>ROUTE';
  $('msg').innerHTML = '숫자 보급통을 부숴 지원 사수·드론·로켓 화력을 얻고,<br>대규모 웨이브와 최종 보스를 돌파하세요.';
  $('result').hidden = true; $('home').hidden = true;
  $('start').textContent = '작전 시작';
  showPanel('main'); overlay.hidden = false;
}

function beginGame() {
  unlock();
  resize();
  game = createGame(viewW, viewH);
  state = 'play'; keys.clear(); resetPointerInput(false);
  bannerTimer = 0;
  $('banner').classList.remove('on');
  hud.tutorialHint.hidden = true;
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
  const elapsed = Math.floor(game.t);
  hud.timer.textContent = String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(elapsed % 60).padStart(2, '0');
  hud.healthText.textContent = Math.ceil(game.hp) + ' / ' + game.maxHp;
  hud.health.style.width = Math.max(0, game.hp / game.maxHp * 100) + '%';
  hud.health.classList.toggle('critical', game.hp <= 30);
  hud.weapon.textContent = game.weapon === 'smg' ? '기관단총' : '권총';
  hud.weaponIcon.textContent = game.weapon === 'smg' ? '▰' : '●';
  hud.weaponLevel.textContent = String(game.weaponLevel[game.weapon] || 1);
  hud.kills.textContent = String(game.kills);
  hud.tutorialHint.hidden = !game.moveTutorialVisible;
  const soldiers = game.companions.filter(companion => companion.life > 0);
  const soldierLife = soldiers.length ? Math.min(...soldiers.map(companion => companion.life)) : 0;
  const soldierMax = soldiers.length ? Math.max(...soldiers.map(companion => companion.maxLife)) : 1;
  hud.soldierRoot.hidden = soldiers.length === 0;
  hud.soldierCount.textContent = '×' + soldiers.length;
  hud.soldierTime.textContent = Math.ceil(soldierLife) + '초';
  hud.soldierFill.style.width = Math.max(0, soldierLife / soldierMax * 100) + '%';
  const drone = game.drone && game.drone.life > 0 ? game.drone : null;
  hud.droneRoot.hidden = !drone;
  if (drone) {
    hud.droneTime.textContent = Math.ceil(drone.life) + '초';
    hud.droneFill.style.width = Math.max(0, drone.life / drone.maxLife * 100) + '%';
  }
  const rockets = game.rocketAmmo + game.missiles.length;
  hud.rocketRoot.hidden = rockets <= 0;
  hud.rocketCount.textContent = String(rockets);
  hud.rocketFill.style.width = Math.min(100, rockets / 6 * 100) + '%';
  hud.rapidRoot.hidden = game.rapidFireTimer <= 0;
  hud.rapidTime.textContent = Math.ceil(game.rapidFireTimer) + '초';
  hud.rapidFill.style.width = Math.max(0, Math.min(100, game.rapidFireTimer / 12 * 100)) + '%';
  hud.supportRoot.hidden = soldiers.length === 0 && !drone && rockets <= 0 && game.rapidFireTimer <= 0;
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
  let hurtSoundPlayed = false;
  for (const event of events) {
    if (event === 'shot') sfx.shot();
    else if (event === 'allyShot') sfx.allyShot();
    else if (event === 'hit') sfx.hit();
    else if (event === 'barrelDown') sfx.pick();
    else if (event === 'explosion') sfx.explosion();
    else if (event === 'rocketBlast') sfx.explosion();
    else if (event === 'hurt' || (event && typeof event === 'object' && event.type === 'hurt')) {
      if (!hurtSoundPlayed) { sfx.hurt(); hurtSoundPlayed = true; }
    }
    else if (event === 'bossStart') { sfx.boss(); announce('보스 출현 · 경고 구역을 피하세요', 2.2); }
    else if (event === 'bossWarn') announce('강타 예고 · 붉은 구역을 피하세요', 1.1);
    else if (event === 'bossSlam') announce('착탄 · 다음 붉은 예고 구역을 피하세요', 1.2);
    else if (event === 'bossDown') { sfx.pick(); announce('대형 변이체 격파', 1.8); }
    else if (event === 'win') sfx.win();
    else if (event === 'lose' || event === 'timeout') sfx.lose();
    else if (event && typeof event === 'object' && event.type === 'reward') {
      sfx.upgrade(); announce(event.label, 0.85);
    } else if (event && typeof event === 'object' && event.type === 'cue') {
      announce(event.label, event.duration);
    }
  }
}

function finishGame(result) {
  if (!game || state === 'over') return;
  state = 'over'; keys.clear(); resetPointerInput();
  $('pause').hidden = true; hud.root.hidden = true; hud.bossRoot.hidden = true;
  const entry = {
    id: Date.now(), score: game.score, kills: game.kills,
    distance: game.distance, result: result === 'win' ? '돌파 성공' : '작전 종료',
    elapsed: Math.floor(game.t), barrels: game.barrelsBroken,
    date: new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(new Date()),
  };
  const records = top();
  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  save(KEY_TOP, records.slice(0, 10));
  lastSaved = entry.id;
  $('title').innerHTML = result === 'win' ? 'ROUTE<br>SECURED' : 'MISSION<br>FAILED';
  $('msg').textContent = result === 'win'
    ? '최종 보스를 격파하고 1-1을 돌파했습니다.'
    : game.hp <= 0 ? '체력이 소진되었습니다. 보급과 회피를 다시 노려보세요.' : '제한 시간 안에 보스를 격파하지 못했습니다.';
  const elapsed = Math.floor(game.t);
  const clock = String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(elapsed % 60).padStart(2, '0');
  $('result').textContent = '시간 ' + clock + ' · 보급통 ' + game.barrelsBroken + ' · 처치 ' + game.kills + ' · 점수 ' + game.score.toLocaleString('ko-KR');
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
    const elapsed = Number(entry.elapsed || 0);
    const clock = String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(elapsed % 60).padStart(2, '0');
    const date = document.createElement('span'); date.className = 'dt'; date.textContent = (entry.result || '기록') + ' · ' + clock + ' · 보급 ' + (entry.barrels || 0) + ' · ' + (entry.date || '');
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
  state = 'paused'; keys.clear(); resetPointerInput();
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
  if (state !== 'play' || !game || pointerDown || event.isPrimary === false) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea, [data-no-drag]')) return;
  event.preventDefault();
  pointerDown = true;
  activePointerId = event.pointerId;
  pointerLastClientX = event.clientX;
  try { canvas.setPointerCapture(event.pointerId); } catch { /* 입력 중단 시 다음 터치에서 복구합니다. */ }
});
canvas.addEventListener('pointermove', event => {
  if (!pointerDown || event.pointerId !== activePointerId || state !== 'play' || !game) return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const deltaCssX = event.clientX - pointerLastClientX;
  pointerLastClientX = event.clientX;
  const deltaGameX = deltaCssX * (viewW / rect.width) * TOUCH_DRAG_SENSITIVITY;
  applyPlayerDrag(game, deltaGameX);
});
const releasePointer = event => {
  if (event && event.pointerId !== activePointerId) return;
  resetPointerInput();
};
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
window.addEventListener('blur', () => { keys.clear(); resetPointerInput(); });
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
    let target = null;
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


