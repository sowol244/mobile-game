const SUPABASE_URL = 'https://ffclcaraipfdjzjkojeu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3RU0xXklMJKZWbsc5NTswQ_qH1Sr_1N';
const TABLE_URL = `${SUPABASE_URL}/rest/v1/game_high_scores`;
const NAME_KEY = 'mobile-game-online-score-name';
const MAX_SCORE = 10_000_000;

const GAMES = {
  'brawl-arena': { title: '대난투 아레나', panel: '#pRank', modes: [{ id: 'team', label: '팀전' }, { id: 'survival', label: '생존전' }] },
  'meteor-dodge': { title: '스타 슈터', panel: '#pRank', modes: [{ id: 'main', label: '전체' }] },
  'super-jump': { title: '교행이의 모험', panel: '#pRank', modes: [{ id: 'main', label: '전체' }] },
  'retro-blocks': { title: '레트로 블록', panel: '#pRank', modes: [{ id: 'type-a', label: 'A-TYPE' }, { id: 'type-b', label: 'B-TYPE' }] },
  'gravity-crash': { title: 'Gravity Crash', panel: '#pRank', modes: [{ id: 'crash', label: '크래시' }, { id: 'daily', label: '오늘의 챌린지', daily: true }] },
  sudoku: { title: '스도쿠', panel: '#records', modes: [{ id: 'progress', label: '진행 기록' }] },
  'lux-umbra': { title: 'Lux & Umbra', panel: '#pRank', modes: [{ id: 'progress', label: '진행 기록' }] },
  'survivor-run': { title: 'DEAD ROUTE', panel: '#pRank', modes: [{ id: 'main', label: '전체' }] },
};

const gameId = new URL(import.meta.url).searchParams.get('game');
const game = GAMES[gameId];
if (!game) throw new Error('온라인 순위표에 등록되지 않은 게임입니다.');

const cleanName = value => Array.from(String(value ?? '').normalize('NFC')
  .replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim()).slice(0, 12).join('');
const cleanDetail = value => Array.from(String(value ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim()).slice(0, 120).join('');
const getName = () => { try { return cleanName(localStorage.getItem(NAME_KEY)); } catch { return ''; } };
const setName = name => { try { localStorage.setItem(NAME_KEY, name); } catch { /* ranking still works for this session */ } };
const koreaDate = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}`;
};

const style = document.createElement('style');
style.textContent = `
  dialog.online-score-dialog { width: min(420px, calc(100vw - 28px)); max-height: min(88dvh, 720px); padding: 0; border: 1px solid #514878; border-radius: 18px; color: #fdf6e3; background: #201a34; box-shadow: 0 20px 80px #000c; font: 15px/1.45 system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color-scheme: dark; }
  dialog.online-score-dialog::backdrop { background: #080611dd; }
  .online-score-card { display: grid; gap: 12px; padding: 20px; overflow: auto; max-height: min(88dvh, 720px); }
  .online-score-card h2 { margin: 0; font-size: 20px; }
  .online-score-card p { margin: 0; color: #aaa2c7; }
  .online-score-card label { display: grid; gap: 5px; color: #c9c3dc; font-size: 13px; }
  .online-score-card select, .online-score-card input { min-width: 0; width: 100%; box-sizing: border-box; border: 1px solid #514878; border-radius: 10px; padding: 10px 12px; color: #fdf6e3; background: #141020; font: inherit; font-size: 16px; }
  .online-score-card ol { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
  .online-score-card li { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; background: #ffffff0c; }
  .online-score-card .online-rank { color: #a9a1c7; font-size: 13px; font-variant-numeric: tabular-nums; }
  .online-score-card .online-player { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .online-score-card .online-player small { display: block; color: #aaa2c7; font-size: 11px; }
  .online-score-card .online-value { color: #ffd23f; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .online-score-actions { display: flex; gap: 8px; }
  .online-score-actions button, .online-score-open { border: 1px solid #746894; border-radius: 10px; padding: 9px 12px; color: #fdf6e3; background: #302746; font: inherit; font-weight: 700; cursor: pointer; }
  .online-score-actions button:first-child { flex: 1; border-color: #ffd23f; color: #201a34; background: #ffd23f; }
  .online-score-open { display: block; width: 100%; margin-top: 10px; }
  .online-score-actions button:focus-visible, .online-score-open:focus-visible, .online-score-card input:focus-visible, .online-score-card select:focus-visible { outline: 3px solid #ffd23f; outline-offset: 2px; }
`;
document.head.append(style);

const dialog = document.createElement('dialog');
dialog.className = 'online-score-dialog';
dialog.setAttribute('aria-labelledby', 'online-score-title');
dialog.innerHTML = `
  <div class="online-score-card">
    <h2 id="online-score-title"></h2>
    <p id="online-score-note" role="status" aria-live="polite"></p>
    <label id="online-score-mode-label">순위 기준<select id="online-score-mode"></select></label>
    <ol id="online-score-rows"></ol>
    <p>닉네임은 온라인 순위에 공개됩니다.</p>
    <label>닉네임<input id="online-score-name" type="text" maxlength="12" autocomplete="nickname" placeholder="닉네임 (12자)"></label>
    <div class="online-score-actions">
      <button id="online-score-save" type="button">닉네임 저장</button>
      <button id="online-score-close" type="button">닫기</button>
    </div>
  </div>`;
document.body.append(dialog);

const titleEl = dialog.querySelector('#online-score-title');
const noteEl = dialog.querySelector('#online-score-note');
const modeSelect = dialog.querySelector('#online-score-mode');
const modeLabel = dialog.querySelector('#online-score-mode-label');
const rowsEl = dialog.querySelector('#online-score-rows');
const nameInput = dialog.querySelector('#online-score-name');
const saveButton = dialog.querySelector('#online-score-save');
titleEl.textContent = `${game.title} · 온라인 순위`;
modeLabel.hidden = game.modes.length < 2;
game.modes.forEach(mode => {
  const option = document.createElement('option');
  option.value = mode.id;
  option.textContent = mode.daily ? `${mode.label} · ${koreaDate().replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')}` : mode.label;
  modeSelect.append(option);
});
nameInput.value = getName();

let selectedMode = game.modes[0].id;
let pending = null;
let loadToken = 0;

function modeDefinition(id) {
  return game.modes.find(mode => mode.id === id) || game.modes[0];
}

function databaseMode(id) {
  const mode = modeDefinition(id);
  return mode.daily ? `${mode.id}-${koreaDate()}` : mode.id;
}

function formatScore(score) {
  if (gameId === 'brawl-arena') return `${Number(score).toLocaleString('ko-KR')} 트로피`;
  if (gameId === 'sudoku') return `${Math.floor(score / 10_000)}탄 · ★${score % 10_000}`;
  if (gameId === 'lux-umbra') return `★ ${Math.floor(score / 100)} · ${score % 100}탄`;
  return `${Number(score).toLocaleString('ko-KR')}점`;
}

function storageBestKey(entry, name) {
  return `mobile-game-online-score-best:${gameId}:${entry.mode}:${encodeURIComponent(name.toLowerCase())}`;
}

function putPending(entry) {
  try {
    const key = `mobile-game-online-score-pending:${gameId}`;
    const all = JSON.parse(localStorage.getItem(key) || '{}');
    const old = all[entry.mode];
    if (!old || entry.score > old.score) all[entry.mode] = entry;
    localStorage.setItem(key, JSON.stringify(all));
  } catch { pending = entry; }
}

function pendingFor(modeId) {
  if (pending && pending.mode === databaseMode(modeId)) return pending;
  try {
    const all = JSON.parse(localStorage.getItem(`mobile-game-online-score-pending:${gameId}`) || '{}');
    return all[databaseMode(modeId)] || null;
  } catch { return null; }
}

function clearPending(entry) {
  pending = null;
  try {
    const key = `mobile-game-online-score-pending:${gameId}`;
    const all = JSON.parse(localStorage.getItem(key) || '{}');
    delete all[entry.mode];
    localStorage.setItem(key, JSON.stringify(all));
  } catch { /* the uploaded score remains valid */ }
}

async function submit(entry, name) {
  const key = storageBestKey(entry, name);
  let best = 0;
  try { best = Number(localStorage.getItem(key)) || 0; } catch { /* submit without local deduplication */ }
  if (entry.score <= best) { clearPending(entry); return; }

  const response = await fetch(TABLE_URL, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      game_id: gameId,
      mode: entry.mode,
      player_name: name,
      score: entry.score,
      detail: entry.detail,
    }),
  });
  if (!response.ok) throw new Error(`점수를 등록하지 못했습니다 (${response.status}).`);
  try { localStorage.setItem(key, String(entry.score)); } catch { /* uploaded successfully */ }
  clearPending(entry);
}

async function loadTop() {
  const modeId = selectedMode;
  const mode = databaseMode(modeId);
  const token = ++loadToken;
  noteEl.textContent = '순위를 불러오는 중…';
  rowsEl.replaceChildren();
  const url = new URL(TABLE_URL);
  url.search = new URLSearchParams({
    select: 'player_name,score,detail,created_at',
    game_id: `eq.${gameId}`,
    mode: `eq.${mode}`,
    order: 'score.desc,created_at.asc',
    limit: '10',
  }).toString();
  try {
    const response = await fetch(url, { headers: { apikey: SUPABASE_KEY }, cache: 'no-store' });
    if (!response.ok) throw new Error(`순위를 불러오지 못했습니다 (${response.status}).`);
    const rows = await response.json();
    if (token !== loadToken) return;
    rows.forEach((entry, index) => {
      const row = document.createElement('li');
      const rank = document.createElement('span'); rank.className = 'online-rank'; rank.textContent = String(index + 1);
      const player = document.createElement('span'); player.className = 'online-player'; player.textContent = entry.player_name;
      if (entry.detail) { const detail = document.createElement('small'); detail.textContent = entry.detail; player.append(detail); }
      const value = document.createElement('span'); value.className = 'online-value'; value.textContent = formatScore(entry.score);
      row.append(rank, player, value); rowsEl.append(row);
    });
    const queued = pendingFor(modeId);
    noteEl.textContent = queued
      ? `${formatScore(queued.score)} 기록을 아래 닉네임으로 순위에 올려 주세요.`
      : rows.length ? '전체 플레이어의 최고 기록입니다.' : '아직 등록된 기록이 없습니다.';
  } catch (error) {
    if (token !== loadToken) return;
    noteEl.textContent = '온라인 순위에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.';
    console.warn('온라인 순위를 불러오지 못했습니다.', error);
  }
}

function open(modeId = selectedMode) {
  selectedMode = modeDefinition(modeId).id;
  modeSelect.value = selectedMode;
  nameInput.value = getName();
  const queued = pendingFor(selectedMode);
  if (queued && !getName()) noteEl.textContent = `${formatScore(queued.score)} 기록을 올리려면 닉네임을 저장해 주세요.`;
  if (!dialog.open) dialog.showModal();
  loadTop();
  nameInput.focus({ preventScroll: true });
}

async function record(score, modeId = game.modes[0].id, detail = '', suppliedName = '') {
  const value = Math.floor(Number(score));
  if (!Number.isFinite(value) || value <= 0 || value > MAX_SCORE) return;
  const mode = modeDefinition(modeId);
  const entry = { mode: databaseMode(mode.id), score: value, detail: cleanDetail(detail) };
  const name = cleanName(suppliedName) || getName();
  if (name) {
    if (suppliedName) setName(name);
    try {
      await submit(entry, name);
      if (dialog.open && selectedMode === mode.id) {
        await loadTop();
        noteEl.textContent = '최고 기록을 온라인 순위에 올렸습니다.';
      }
    } catch (error) {
      putPending(entry);
      if (dialog.open) noteEl.textContent = '점수를 등록하지 못했습니다. 온라인 순위에서 다시 시도해 주세요.';
      console.warn('온라인 점수를 등록하지 못했습니다.', error);
    }
    return;
  }
  putPending(entry);
  open(mode.id);
}

modeSelect.addEventListener('change', () => { selectedMode = modeSelect.value; loadTop(); });
saveButton.addEventListener('click', async () => {
  const name = cleanName(nameInput.value);
  if (!name) { noteEl.textContent = '닉네임을 입력해 주세요.'; nameInput.focus(); return; }
  nameInput.value = name;
  setName(name);
  const queued = pendingFor(selectedMode);
  if (!queued) { noteEl.textContent = '닉네임을 저장했습니다. 다음 최고 기록부터 자동 등록됩니다.'; return; }
  saveButton.disabled = true;
  noteEl.textContent = '점수를 등록하는 중…';
  try {
    await submit(queued, name);
    await loadTop();
    noteEl.textContent = '점수를 온라인 순위에 올렸습니다.';
  } catch (error) {
    noteEl.textContent = '점수를 등록하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
    console.warn('온라인 점수를 등록하지 못했습니다.', error);
  } finally { saveButton.disabled = false; }
});
dialog.querySelector('#online-score-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target === nameInput) { event.preventDefault(); saveButton.click(); } });

const rankPanel = document.querySelector(game.panel);
if (rankPanel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'online-score-open';
  button.textContent = '온라인 순위';
  button.addEventListener('click', () => open());
  const back = rankPanel.querySelector('.back, #recBack');
  if (back) back.before(button); else rankPanel.append(button);
}

window.__onlineLeaderboard = { record, open };
