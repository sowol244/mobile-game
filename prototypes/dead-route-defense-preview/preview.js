import { createGame, resizeGame, updateGame, applyPlayerDrag } from './game.js';
import { drawScene } from './render.js';
import { isMuted, setMuted, unlock, sfx } from '../../survivor-run/sound.js';

const $ = id => document.getElementById(id);
const stage = $('battlefield');
const canvas = $('field');
const ctx = canvas.getContext('2d', { alpha: false });
const hud = $('hud');
const intro = $('introScrim');
const result = $('resultScrim');
const toast = $('toast');
const soundButton = $('soundBtn');
const MAX_TIME = 60;

const sprite = path => {
  const image = new Image();
  image.src = new URL(path, import.meta.url).href;
  return image;
};
const assets = {
  player: sprite('../../survivor-run/assets/player-back-a.webp'),
  playerRun: sprite('../../survivor-run/assets/player-back-b.webp'),
  walker: sprite('../../survivor-run/assets/zombie-walker.webp'),
  walkerRun: sprite('../../survivor-run/assets/zombie-walker-run.webp'),
  runner: sprite('../../survivor-run/assets/zombie-runner.webp'),
  runnerRun: sprite('../../survivor-run/assets/zombie-runner-run.webp'),
  brute: sprite('../../survivor-run/assets/zombie-brute.webp'),
  bruteAttack: sprite('../../survivor-run/assets/zombie-brute-attack.webp'),
  supportSurvivorA: sprite('../../survivor-run/assets/support-survivor.webp'),
  supportSurvivorARun: sprite('../../survivor-run/assets/support-survivor-run.webp'),
  supportSurvivorB: sprite('../../survivor-run/assets/support-survivor-b.webp'),
  supportSurvivorBRun: sprite('../../survivor-run/assets/support-survivor-b-run.webp'),
  roadsideBackdrop: sprite('../../survivor-run/assets/roadside-backdrop.webp'),
  combatDrone: sprite('../../survivor-run/assets/combat-drone.svg'),
  rocketProjectile: sprite('../../survivor-run/assets/rocket-projectile.svg'),
};

let game = null;
let phase = 'intro';
let width = 1, height = 1, dpr = 1;
let lastFrame = performance.now();
let toastLife = 0;
let shotSoundCooldown = 0;
let hitSoundCooldown = 0;
let pointerId = null;
let pointerLastX = 0;
const keys = new Set();

function resize() {
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const nextWidth = rect.width;
  const nextHeight = rect.height;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvasWidth = Math.round(nextWidth * dpr);
  const canvasHeight = Math.round(nextHeight * dpr);
  if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (game && (width !== nextWidth || height !== nextHeight)) resizeGame(game, nextWidth, nextHeight);
  width = nextWidth;
  height = nextHeight;
}

function addStartingSupporters(state) {
  for (let slot = 0; slot < 2; slot++) {
    const side = slot === 0 ? 1 : -1;
    state.companions.push({
      id: slot + 1, side, slot,
      x: state.x + side * 64, y: state.y + 10,
      life: 60, maxLife: 60, fireTimer: 0.25 + slot * 0.12,
      appear: 0, exit: 0, recoil: 0, muzzleFlash: 0, phase: slot * 2.4,
    });
  }
  state.nextCompanionId = 3;
}

function beginGame() {
  resize();
  unlock();
  game = createGame(width, height);
  game.weapon = 'smg';
  game.weaponLevel.smg = 3;
  game.damageBonus = 3;
  game.damageMultiplier = 1.2;
  game.fireTimer = 0.02;
  game.maxHp = 260;
  game.hp = 260;
  game.moveTutorialShown = true;
  game.moveTutorialVisible = false;
  game.showAimGuide = false;
  game.roadOffset = 0;
  addStartingSupporters(game);
  phase = 'play';
  intro.hidden = true;
  result.hidden = true;
  hud.hidden = false;
  toast.classList.remove('on');
  toastLife = 0;
  lastFrame = performance.now();
  soundButton.setAttribute('aria-label', isMuted() ? '소리 켜기' : '소리 끄기');
  soundButton.textContent = isMuted() ? '🔇' : '🔊';
}

function conciseReward(event) {
  const label = event.label || '';
  if (label.includes('지원 사수')) return '지원 사수 합류';
  if (label.includes('드론')) return '드론 지원';
  if (label.includes('로켓')) return '로켓 지원';
  if (label.includes('체력') || label.includes('키트')) return '체력 회복';
  if (label.includes('연사')) return '연사 강화';
  return '화력 강화';
}

function announce(message) {
  toast.textContent = message;
  toast.classList.add('on');
  toastLife = 1.2;
}

function handleEvents(events, dt) {
  shotSoundCooldown = Math.max(0, shotSoundCooldown - dt);
  hitSoundCooldown = Math.max(0, hitSoundCooldown - dt);
  for (const event of events) {
    if (event === 'shot' && shotSoundCooldown <= 0) {
      sfx.shot();
      shotSoundCooldown = 0.095;
    } else if (event === 'hit' && hitSoundCooldown <= 0) {
      sfx.hit();
      hitSoundCooldown = 0.12;
    } else if (event === 'barrelDown') sfx.pick();
    else if (event === 'explosion' || event === 'rocketBlast') sfx.explosion();
    else if (event === 'hurt') sfx.hurt();
    else if (event?.type === 'reward') {
      sfx.upgrade();
      announce(conciseReward(event));
    }
  }
}

function finish(won) {
  if (phase !== 'play') return;
  phase = 'result';
  hud.hidden = true;
  result.hidden = false;
  $('resultEyebrow').textContent = won ? 'STAGE 1-1' : '작전 종료';
  $('resultTitle').textContent = won ? '방어 성공' : '다시 도전';
  $('resultCopy').textContent = won ? '1분 동안 좀비 떼를 막았습니다.' : '밀어서 움직이며 좀비를 막아보세요.';
  if (won) sfx.win();
}

function updateHud() {
  if (!game) return;
  const seconds = Math.min(MAX_TIME, Math.floor(game.t));
  $('clockText').textContent = `00:${String(seconds).padStart(2, '0')}`;
  const health = Math.max(0, Math.min(100, game.hp / game.maxHp * 100));
  $('healthMeter').style.width = `${health}%`;
  const healthBar = document.querySelector('.health');
  healthBar.setAttribute('aria-valuenow', String(Math.round(health)));
  healthBar.setAttribute('aria-valuetext', `${Math.round(health)}%`);
  healthBar.classList.toggle('low', health <= 28);
}

function draw(now) {
  resize();
  if (phase === 'intro' || !game) {
    drawScene(ctx, null, width, height, now, true, assets);
  } else {
    game.roadOffset = 0;
    drawScene(ctx, game, width, height, now, false, assets);
  }
}

function frame(now) {
  const dt = Math.min(0.04, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (phase === 'play' && game) {
    let steer = 0;
    if (keys.has('ArrowLeft') || keys.has('a')) steer -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) steer += 1;
    if (steer) applyPlayerDrag(game, steer * 390 * dt);
    const events = updateGame(game, dt);
    handleEvents(events, dt);
    game.roadOffset = 0;
    updateHud();
    toastLife = Math.max(0, toastLife - dt);
    if (toastLife <= 0) toast.classList.remove('on');
    if (game.finished) finish(false);
    else if (game.t >= MAX_TIME) {
      game.t = MAX_TIME;
      finish(true);
      updateHud();
    }
  }
  draw(now);
  requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown', event => {
  if (phase !== 'play') return;
  pointerId = event.pointerId;
  pointerLastX = event.clientX;
  canvas.setPointerCapture(pointerId);
  event.preventDefault();
});
canvas.addEventListener('pointermove', event => {
  if (phase !== 'play' || event.pointerId !== pointerId) return;
  applyPlayerDrag(game, event.clientX - pointerLastX);
  pointerLastX = event.clientX;
  event.preventDefault();
});
function releasePointer(event) {
  if (event.pointerId === pointerId) pointerId = null;
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
window.addEventListener('keydown', event => {
  if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(event.key)) {
    keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    event.preventDefault();
  }
});
window.addEventListener('keyup', event => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', resize);
$('startBtn').addEventListener('click', beginGame);
$('restartBtn').addEventListener('click', beginGame);
soundButton.addEventListener('click', () => {
  setMuted(!isMuted());
  soundButton.textContent = isMuted() ? '🔇' : '🔊';
  soundButton.setAttribute('aria-label', isMuted() ? '소리 켜기' : '소리 끄기');
  if (!isMuted()) unlock();
});

resize();
requestAnimationFrame(frame);
