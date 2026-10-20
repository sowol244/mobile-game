// LumaGrid high scores use the shared Supabase score table.
const SUPABASE_URL = 'https://ffclcaraipfdjzjkojeu.supabase.co/rest/v1/game_high_scores';
const SUPABASE_KEY = 'sb_publishable_3RU0xXklMJKZWbsc5NTswQ_qH1Sr_1N';
const GAME_ID = 'lumagrid';
const MODE = 'main';
const TIMEOUT_MS = 8000;

// Player-chosen names are public: strip control characters and angle brackets, collapse spaces, cap at 12 characters.
export function cleanName(s) {
  const t = String(s ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(t).slice(0, 12).join('');
}

const withTimeout = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({ code: 'timeout' }), TIMEOUT_MS))]);
const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };

async function request(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { ...headers, ...init.headers }, cache: 'no-store' });
  if (!response.ok) throw new Error(`온라인 순위 요청에 실패했습니다 (${response.status}).`);
  return response;
}

const queryUrl = params => {
  const url = new URL(SUPABASE_URL);
  url.search = new URLSearchParams(params).toString();
  return url;
};

async function submit(name, score) {
  const response = await request(SUPABASE_URL, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ game_id: GAME_ID, mode: MODE, player_name: name, score, detail: '' }),
  });
  return (await response.json())[0]?.id ?? null;
}

async function top(n) {
  const response = await request(queryUrl({
    select: 'id,player_name,score', game_id: `eq.${GAME_ID}`, mode: `eq.${MODE}`,
    order: 'score.desc,created_at.asc', limit: String(n),
  }));
  return (await response.json()).map(row => ({ id: row.id, name: String(row.player_name ?? ''), score: Number(row.score) || 0 }));
}

async function rank(score) {
  const response = await request(queryUrl({
    select: 'id', game_id: `eq.${GAME_ID}`, mode: `eq.${MODE}`, score: `gt.${score}`,
  }), { headers: { Prefer: 'count=exact', Range: '0-0' } });
  const total = Number(response.headers.get('content-range')?.split('/')[1]);
  return (Number.isFinite(total) ? total : 0) + 1;
}

function backend() {
  if (globalThis.__LB_MOCK) return Promise.resolve(globalThis.__LB_MOCK);
  return Promise.resolve({ submit, top, rank });
}

export const submitScore = async (name, score) => withTimeout(backend().then(b => b.submit(cleanName(name), Math.floor(score))));
export const fetchTop = async (n = 10) => withTimeout(backend().then(b => b.top(n)));
export const rankOf = async score => withTimeout(backend().then(b => b.rank(Math.floor(score))));
