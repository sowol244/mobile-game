const allowedOrigin = 'https://sowol244.github.io';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

const allowedGameIds = new Set([
  'brawl-arena',
  'meteor-dodge',
  'super-jump',
  'neon-block',
  'retro-blocks',
  'gravity-crash',
  'sudoku',
  'lux-umbra',
  'survivor-run',
  'godot-survivor-run',
]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

function getServiceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  const key = secrets.default ?? Object.values(secrets)[0];
  if (!key) throw new Error('Supabase service key is not configured.');
  return key;
}

function hasValidPublishableKey(request: Request): boolean {
  const supplied = request.headers.get('apikey');
  if (!supplied) return false;

  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>;
    if (Object.values(keys).includes(supplied)) return true;
  } catch { /* fall back to the legacy anon key */ }

  return supplied === Deno.env.get('SUPABASE_ANON_KEY');
}

function restHeaders(serviceKey: string, jsonBody = false): HeadersInit {
  return {
    apikey: serviceKey,
    ...(jsonBody ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function restJson(url: string, serviceKey: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { ...restHeaders(serviceKey, Boolean(init.body)), ...init.headers },
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error('Supabase REST request failed:', response.status, detail);
    throw new Error('상태 저장 서버에서 오류가 발생했습니다.');
  }
  if (response.status === 204) return null;
  return response.json();
}

async function getAttempts(projectUrl: string, serviceKey: string, ipHash: string) {
  const url = `${projectUrl}/rest/v1/admin_login_attempts?ip_hash=eq.${encodeURIComponent(ipHash)}&select=failed_attempts,window_started_at`;
  const rows = await restJson(url, serviceKey) as Array<{ failed_attempts: number; window_started_at: string }>;
  return rows[0] ?? null;
}

async function recordFailure(projectUrl: string, serviceKey: string, ipHash: string) {
  await restJson(`${projectUrl}/rest/v1/rpc/record_admin_login_failure`, serviceKey, {
    method: 'POST',
    body: JSON.stringify({ p_ip_hash: ipHash }),
  });
}

async function clearAttempts(projectUrl: string, serviceKey: string, ipHash: string) {
  const url = `${projectUrl}/rest/v1/admin_login_attempts?ip_hash=eq.${encodeURIComponent(ipHash)}`;
  await restJson(url, serviceKey, { method: 'DELETE' });
}

async function checkAdminPassword(
  request: Request,
  password: string,
  projectUrl: string,
  serviceKey: string,
  expectedPassword: string,
) {
  const address = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? 'unknown';
  const ipHash = await sha256Hex(`${address}:${expectedPassword}`);
  const attempts = await getAttempts(projectUrl, serviceKey, ipHash);
  const windowIsOpen = attempts && (Date.now() - Date.parse(attempts.window_started_at)) < 15 * 60 * 1000;

  if (windowIsOpen && attempts.failed_attempts >= 5) {
    return { ok: false, blocked: true };
  }

  if (!constantTimeEqual(password, expectedPassword)) {
    await recordFailure(projectUrl, serviceKey, ipHash);
    return { ok: false, blocked: false };
  }

  await clearAttempts(projectUrl, serviceKey, ipHash);
  return { ok: true, blocked: false };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: '허용되지 않은 요청입니다.' }, 405);

  const origin = request.headers.get('origin');
  if (origin && origin !== allowedOrigin) return json({ error: '허용되지 않은 사이트입니다.' }, 403);
  if (!hasValidPublishableKey(request)) return json({ error: '프로젝트 키를 확인할 수 없습니다.' }, 401);

  try {
    const projectUrl = Deno.env.get('SUPABASE_URL');
    const expectedPassword = Deno.env.get('ADMIN_PASSWORD');
    if (!projectUrl || !expectedPassword) throw new Error('Admin function secrets are not configured.');
    const serviceKey = getServiceKey();
    const input = await request.json();
    const action = input?.action;
    const password = typeof input?.password === 'string' ? input.password : '';
    if (!password || password.length > 64) return json({ error: '암호를 확인해 주세요.' }, 400);

    const auth = await checkAdminPassword(request, password, projectUrl, serviceKey, expectedPassword);
    if (!auth.ok) {
      return json({ error: auth.blocked ? '시도 횟수를 초과했습니다. 15분 후 다시 시도해 주세요.' : '암호가 올바르지 않습니다.' }, auth.blocked ? 429 : 401);
    }

    if (action === 'authenticate') return json({ ok: true });
    if (action !== 'set-status' && action !== 'set-new-games') {
      return json({ error: '요청 내용을 확인해 주세요.' }, 400);
    }

    const rows = await restJson(
      `${projectUrl}/rest/v1/game_status_config?id=eq.1&select=statuses`,
      serviceKey,
    ) as Array<{ statuses: Record<string, unknown> }>;
    if (!rows[0]) throw new Error('The shared game status row does not exist.');

    let statuses: Record<string, unknown>;
    if (action === 'set-status') {
      const gameId = input?.gameId;
      const status = input?.status;
      if (!allowedGameIds.has(gameId)) return json({ error: '게임을 확인할 수 없습니다.' }, 400);
      if (status !== null && status !== 'hidden' && status !== 'development' && status !== 'maintenance') {
        return json({ error: '상태를 확인해 주세요.' }, 400);
      }
      statuses = { ...rows[0].statuses, [gameId]: status };
    } else {
      const requestedNewGames = input?.newGames;
      if (!Array.isArray(requestedNewGames) || requestedNewGames.length > allowedGameIds.size
        || requestedNewGames.some((gameId: unknown) => typeof gameId !== 'string' || !allowedGameIds.has(gameId))) {
        return json({ error: 'NEW 표시할 게임을 확인해 주세요.' }, 400);
      }

      const metaValue = rows[0].statuses.__meta;
      const meta = metaValue && typeof metaValue === 'object' && !Array.isArray(metaValue)
        ? metaValue as Record<string, unknown>
        : {};
      const newGames = [...new Set(requestedNewGames as string[])];
      statuses = { ...rows[0].statuses, __meta: { ...meta, newGames } };
    }

    await restJson(`${projectUrl}/rest/v1/game_status_config?id=eq.1`, serviceKey, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ statuses, updated_at: new Date().toISOString() }),
    });
    return json({ ok: true, statuses, newGames: (statuses.__meta as Record<string, unknown> | undefined)?.newGames });
  } catch (error) {
    console.error('admin-game-status error:', error);
    return json({ error: '관리자 서버 설정이 아직 완료되지 않았습니다.' }, 500);
  }
});
