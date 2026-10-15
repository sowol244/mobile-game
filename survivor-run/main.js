import { createGame, resizeGame, updateGame, DEFAULT_STAGE_ID, getStageDefinition, applyPlayerDrag } from './game.js?v=2-1-20261015d';
import { drawScene } from './render.js?v=2-1-20261015d';
import { isMuted, setMuted, unlock, sfx } from './sound.js?v=1-1-20261014o';

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
  stageNumber: $('stageNumber'), routeName: $('routeName'), bossName: $('bossName'),
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
const KEY_TOP = 'survivor-run-top', KEY_TUT = 'dead-route-tutorial', KEY_CAMPAIGN = 'survivor-run-campaign';
const top = () => { try { return JSON.parse(localStorage.getItem(KEY_TOP)) || []; } catch { return []; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 없이도 플레이할 수 있어요. */ } };
const campaign = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY_CAMPAIGN));
    const saved = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    const records = top();
    const legacyStageOneClear = Array.isArray(records) && records.some(entry => (
      entry && entry.result === '돌파 성공' && (!entry.stage || entry.stage === '1-1')
    ));
    if (legacyStageOneClear && !saved.stage02Unlocked) return { ...saved, stage01Cleared: true, stage02Unlocked: true };
    return saved;
  } catch { return {}; }
};
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
  bruteWalkA: sprite('assets/zombie-brute-walk-a.webp'),
  bruteWalkB: sprite('assets/zombie-brute-walk-b.webp'),
  bruteAttack: sprite('assets/zombie-brute-attack.webp'),
  supportSurvivorA: sprite('assets/support-survivor.webp'),
  supportSurvivorARun: sprite('assets/support-survivor-run.webp'),
  supportSurvivorB: sprite('assets/support-survivor-b.webp'),
  supportSurvivorBRun: sprite('assets/support-survivor-b-run.webp'),
  roadsideBackdrop: sprite('assets/roadside-backdrop.webp'),
  combatDrone: sprite('assets/combat-drone.svg'),
  rocketProjectile: sprite('assets/rocket-projectile.svg'),
};
let stage02AssetsRequested = false;
function loadStage02Assets() {
  if (stage02AssetsRequested) return;
  stage02AssetsRequested = true;
  Object.assign(assets, {
    stage02Backdrop: sprite('assets/stage02-background.webp'),
    bossBreakerIdle: sprite('assets/boss-breaker-idle.webp'),
    bossBreakerWalk: sprite('assets/boss-breaker-walk.webp'),
    bossBreakerWindup: sprite('assets/boss-breaker-windup.webp'),
    bossBreakerImpact: sprite('assets/boss-breaker-impact.webp'),
    bossBreakerDown: sprite('assets/boss-breaker-down.webp'),
  });
}
const tutorials = [
  ['이동', '화면을 좌우로 끌어 도로 안에서 움직입니다. PC에서는 A/D 또는 ←/→ 키를 사용하세요.'],
  ['자동 사격', '총은 자동으로 발사됩니다. 원하는 좀비나 보급통 쪽으로 움직이면 표적이 바뀝니다.'],
  ['보급과 회피', '숫자 내구도를 0으로 만들면 연사·지원 사수·로켓 화력을 얻습니다. 붉은 보스 공격은 차선을 바꿔 피하세요.'],
];

let state = 'title', game = null, lastFrame = performance.now(), selectedStageId = DEFAULT_STAGE_ID;
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

function updateStageChoices() {
  const progress = campaign();
  const unlocked = Boolean(progress.stage02Unlocked || progress.stage01Cleared);
  for (const button of document.querySelectorAll('.stage-choice')) {
    const selected = button.dataset.stageId === selectedStageId;
    const locked = button.dataset.stageId === 'stage02' && !unlocked;
    button.disabled = locked;
    button.classList.toggle('selected', selected);
    button.classList.toggle('locked', locked);
    button.setAttribute('aria-pressed', String(selected));
  }
  $('stage02Lock').textContent = unlocked
    ? (progress.stage02Cleared ? '돌파 완료' : '돌파 가능')
    : '1-1 돌파 후 해금';
  const definition = getStageDefinition(selectedStageId);
  $('msg').textContent = definition.intro;
  if (state === 'over') {
    const advanced = game?.finished === 'win' && game.stageId === 'stage01' && selectedStageId === 'stage02';
    $('start').textContent = advanced ? '2-1 출동' : selectedStageId === game?.stageId ? '다시 출동' : '작전 시작';
  } else if (state === 'title') {
    $('start').textContent = '작전 시작';
  }
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
  $('banner').classList.remove('on', 'boss-warning');
  hud.root.hidden = true; hud.bossRoot.hidden = true; hud.tutorialHint.hidden = true;
  $('pause').hidden = true;
  $('title').innerHTML = 'DEAD<br>ROUTE';
  updateStageChoices();
  $('result').hidden = true; $('home').hidden = true;
  $('start').textContent = '작전 시작';
  showPanel('main'); overlay.hidden = false;
}

function beginGame() {
  unlock();
  if (selectedStageId === 'stage02') loadStage02Assets();
  resize();
  game = createGame(viewW, viewH, selectedStageId);
  state = 'play'; keys.clear(); resetPointerInput(false);
  bannerTimer = 0;
  $('banner').classList.remove('on', 'boss-warning');
  hud.tutorialHint.hidden = true;
  hud.root.hidden = false; $('pause').hidden = false;
  hud.bossRoot.hidden = true;
  overlay.hidden = true;
  updateHud();
  lastFrame = performance.now();
}

function updateHud() {
  if (!game) return;
  hud.stageNumber.textContent = game.stageDefinition.number;
  hud.routeName.textContent = game.stageDefinition.name;
  hud.bossName.textContent = game.stageDefinition.boss.label;
  hud.distance.textContent = game.distance.toLocaleString('ko-KR') + ' m';
  const progress = game.bossDefeated
    ? 100
    : game.boss
      ? 88 + (1 - game.boss.hp / game.boss.maxHp) * 11
      : Math.min(88, game.t / game.stageDefinition.boss.startAt * 88);
  hud.progress.style.width = progress + '%';
  const elapsed = Math.floor(game.t);
  hud.timer.textContent = String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(elapsed % 60).padStart(2, '0');
  hud.healthText.textContent = Math.ceil(game.hp) + ' / ' + game.maxHp;
  hud.health.style.width = Math.max(0, game.hp / game.maxHp * 100) + '%';
  hud.health.classList.toggle('critical', game.hp <= 30);
  hud.weapon.textContent = game.weapon === 'smg' ? '기관단총' : game.weapon === 'twin' ? '쌍열' : '권총';
  hud.weaponIcon.textContent = game.weapon === 'smg' ? '▰' : game.weapon === 'twin' ? 'Ⅱ' : '●';
  hud.weaponLevel.textContent = String(game.weaponLevel[game.weapon] || 1);
  hud.kills.textContent = String(game.kills);
  hud.tutorialHint.hidden = !game.moveTutorialVisible;
  const soldiers = game.companions.filter(companion => companion.life > 0);
  const soldierLife = soldiers.length ? Math.min(...soldiers.map(companion => companion.life)) : 0;
  const soldierMax = soldiers.length ? Math.max(...soldiers.map(companion => companion.maxLife)) : 1;
  const soldierPermanent = soldiers.length > 0 && soldiers.every(companion => companion.permanent);
  hud.soldierRoot.hidden = soldiers.length === 0;
  hud.soldierCount.textContent = '×' + soldiers.length;
  hud.soldierTime.textContent = soldierPermanent ? '계속' : Math.ceil(soldierLife) + '초';
  hud.soldierFill.style.width = soldierPermanent ? '100%' : Math.max(0, soldierLife / soldierMax * 100) + '%';
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
  hud.rapidRoot.hidden = !game.permanentRapidFire && game.rapidFireTimer <= 0;
  hud.rapidTime.textContent = game.permanentRapidFire ? '계속' : Math.ceil(game.rapidFireTimer) + '초';
  hud.rapidFill.style.width = game.permanentRapidFire ? '100%' : Math.max(0, Math.min(100, game.rapidFireTimer / 12 * 100)) + '%';
  hud.supportRoot.hidden = soldiers.length === 0 && !drone && rockets <= 0 && game.rapidFireTimer <= 0 && !game.permanentRapidFire;
  hud.bossRoot.hidden = !game.boss;
  if (game.boss) hud.bossFill.style.width = Math.max(0, game.boss.hp / game.boss.maxHp * 100) + '%';
}

function announce(message, seconds, variant) {
  const el = $('banner');
  $('bannerMessage').textContent = message;
  el.classList.toggle('boss-warning', variant === 'boss-warning');
  el.classList.add('on');
  bannerTimer = seconds || 1.6;
}

function handleEvents(events) {
  let hurtSoundPlayed = false;
  let hitSoundPlayed = false;
  let killCombo = 0;
  for (const event of events) {
    if (event === 'shot') sfx.shot();
    else if (event === 'allyShot') sfx.allyShot();
    else if (event === 'hit') {
      if (!hitSoundPlayed) { sfx.hit(); hitSoundPlayed = true; }
    }
    else if (event && typeof event === 'object' && event.type === 'kill') killCombo = Math.max(killCombo, event.combo || 1);
    else if (event === 'barrelDown') sfx.pick();
    else if (event === 'explosion') sfx.explosion();
    else if (event === 'rocketBlast') sfx.explosion();
    else if (event === 'hurt' || (event && typeof event === 'object' && event.type === 'hurt')) {
      if (!hurtSoundPlayed) { sfx.hurt(); hurtSoundPlayed = true; }
    }
    else if (event === 'bossIncoming') announce('WARNING', 2.2, 'boss-warning');
    else if (event === 'bossStart') sfx.boss();
    else if (event === 'bossSlam') sfx.bossSlam();
    else if (event === 'bossDown') sfx.pick();
    else if (event === 'win') sfx.win();
    else if (event === 'lose' || event === 'timeout') sfx.lose();
    else if (event && typeof event === 'object' && event.type === 'reward') {
      sfx.upgrade(); announce(event.label, 0.85);
    }
  }
  if (killCombo) sfx.kill(killCombo);
}

function finishGame(result) {
  if (!game || state === 'over') return;
  state = 'over'; keys.clear(); resetPointerInput();
  if (result === 'win') {
    const progress = campaign();
    if (game.stageId === 'stage01') {
      progress.stage01Cleared = true;
      progress.stage02Unlocked = true;
      selectedStageId = 'stage02';
      loadStage02Assets();
    } else if (game.stageId === 'stage02') {
      progress.stage02Cleared = true;
    }
    save(KEY_CAMPAIGN, progress);
  }
  $('pause').hidden = true; hud.root.hidden = true; hud.bossRoot.hidden = true;
  const entry = {
    id: Date.now(), score: game.score, kills: game.kills,
    stage: game.stageDefinition.number, stageName: game.stageDefinition.name,
    distance: game.distance, result: result === 'win' ? '돌파 성공' : '작전 종료',
    elapsed: Math.floor(game.t), barrels: game.barrelsBroken,
    date: new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(new Date()),
  };
  window.__onlineLeaderboard?.record(game.score, 'main', `${entry.result} · 처치 ${game.kills} · 보급 ${game.barrelsBroken}`);
  const records = top();
  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  save(KEY_TOP, records.slice(0, 10));
  lastSaved = entry.id;
  $('title').innerHTML = result === 'win' ? 'ROUTE<br>SECURED' : 'MISSION<br>FAILED';
  $('msg').textContent = result === 'win'
    ? game.stageDefinition.clearMessage + (game.stageId === 'stage01' ? ' 2-1이 해금되었습니다.' : '')
    : game.hp <= 0 ? '체력이 소진되었습니다.' : '작전이 종료되었습니다.';
  const elapsed = Math.floor(game.t);
  const clock = String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(elapsed % 60).padStart(2, '0');
  $('result').textContent = '시간 ' + clock + ' · 보급통 ' + game.barrelsBroken + ' · 처치 ' + game.kills + ' · 점수 ' + game.score.toLocaleString('ko-KR');
  $('result').hidden = false;
  $('start').textContent = '다시 출동';
  $('home').hidden = false;
  updateStageChoices();
  $('msg').textContent = result === 'win'
    ? game.stageDefinition.clearMessage + (game.stageId === 'stage01' ? ' 2-1이 해금되었습니다.' : '')
    : game.hp <= 0 ? '체력이 소진되었습니다.' : '작전이 종료되었습니다.';
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
    const date = document.createElement('span'); date.className = 'dt'; date.textContent = (entry.stage || '1-1') + ' ' + (entry.result || '기록') + ' · ' + clock + ' · 보급 ' + (entry.barrels || 0) + ' · ' + (entry.date || '');
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
  if (selectedStageId !== DEFAULT_STAGE_ID) return beginGame();
  let seen = false;
  try { seen = localStorage.getItem(KEY_TUT) === '1'; } catch { seen = false; }
  if (!seen) showPanel('ask');
  else beginGame();
}

$('start').addEventListener('click', startFromTitle);
$('stageChoices').addEventListener('click', event => {
  const button = event.target.closest('.stage-choice');
  if (!button || button.disabled) return;
  selectedStageId = button.dataset.stageId;
  if (selectedStageId === 'stage02') loadStage02Assets();
  updateStageChoices();
});
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
  drawScene(ctx, game, viewW, viewH, now, state === 'title' || !game, assets, selectedStageId);
  requestAnimationFrame(frame);
}

showTitle();
requestAnimationFrame(frame);


