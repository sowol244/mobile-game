(() => {
  const current = document.currentScript;
  const gameId = current?.dataset.gameId;
  if (!gameId) return;

  const defaultStatus = current.dataset.defaultStatus || null;
  const requiresAdmin = current.dataset.requiresAdmin === 'true';
  const supabaseUrl = 'https://ffclcaraipfdjzjkojeu.supabase.co';
  const publishableKey = 'sb_publishable_3RU0xXklMJKZWbsc5NTswQ_qH1Sr_1N';
  const statusUrl = supabaseUrl + '/rest/v1/game_status_config?id=eq.1&select=statuses';
  const adminFlag = 'hub-admin-unlocked';
  let allowed = false;

  document.documentElement.dataset.gameAccess = 'pending';
  const gateStyle = document.createElement('style');
  gateStyle.textContent = [
    'html[data-game-access="pending"] body{visibility:hidden!important}',
    'html[data-game-access="blocked"] body{margin:0;min-height:100vh;background:#14111f;color:#fdf6e3;font-family:system-ui,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}',
    '.game-access-card{box-sizing:border-box;max-width:420px;margin:12vh auto;padding:28px;border:1px solid #4a4170;border-radius:20px;background:#241e3a;text-align:center}',
    '.game-access-card h1{font-size:22px}.game-access-card p{color:#c6bfdc;line-height:1.6}',
    '.game-access-card button{border:0;border-radius:10px;padding:12px 18px;background:#ffd23f;color:#241e3a;font:inherit;font-weight:700;cursor:pointer}'
  ].join('');
  document.head.append(gateStyle);

  function isAdminUnlocked() {
    try { return sessionStorage.getItem(adminFlag) === 'true'; }
    catch { return false; }
  }

  function isLocalPreview() {
    return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  }

  function isOpenedFromHub() {
    if (window.parent === window) return false;
    try {
      const expectedPath = new URL('../', location.href).pathname;
      const parentUrl = new URL(window.parent.location.href);
      const parentPath = parentUrl.pathname.replace(/index\.html$/i, '').replace(/\/?$/, '/');
      return parentUrl.origin === location.origin && parentPath === expectedPath;
    } catch {
      return false;
    }
  }

  async function readStatus() {
    const response = await fetch(statusUrl, {
      headers: { apikey: publishableKey },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('상태를 확인할 수 없습니다.');
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows[0] || !rows[0].statuses || typeof rows[0].statuses !== 'object') {
      throw new Error('상태 설정을 찾을 수 없습니다.');
    }
    const statuses = rows[0].statuses;
    const status = Object.prototype.hasOwnProperty.call(statuses, gameId)
      ? statuses[gameId]
      : defaultStatus;
    if (status !== null && status !== 'hidden' && status !== 'development' && status !== 'maintenance') {
      throw new Error('게임 상태 설정이 올바르지 않습니다.');
    }
    const adminUnlocked = isAdminUnlocked();
    if (!adminUnlocked && status === 'hidden') return 'hidden';
    if (!adminUnlocked && (status === 'development' || status === 'maintenance')) return status;
    if (!adminUnlocked && requiresAdmin) return 'development';
    return null;
  }

  async function readAccessState() {
    if (isLocalPreview()) return null;
    const status = await readStatus();
    if (status) return status;
    return isOpenedFromHub() ? null : 'direct';
  }

  function waitForDocument() {
    if (document.readyState !== 'loading') return Promise.resolve();
    return new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }

  async function activateGameScripts() {
    const placeholders = [...document.querySelectorAll('script[type="application/x-game-gated"]')];
    for (const placeholder of placeholders) {
      if (!allowed) return;
      await new Promise(resolve => {
        const script = document.createElement('script');
        const scriptType = placeholder.dataset.scriptType;
        const scriptSrc = placeholder.dataset.scriptSrc;
        if (scriptType) script.type = scriptType;
        if (scriptSrc) {
          script.src = scriptSrc;
          script.async = false;
          script.onload = resolve;
          script.onerror = () => {
            console.error('게임 스크립트를 불러오지 못했습니다:', scriptSrc);
            resolve();
          };
          placeholder.replaceWith(script);
        } else {
          script.textContent = placeholder.textContent;
          placeholder.replaceWith(script);
          resolve();
        }
      });
    }
  }

  function messageFor(status) {
    if (status === 'development') return '개발 중입니다. 기다려 주세요.';
    if (status === 'maintenance') return '점검 중입니다. 잠시 후 다시 이용해 주세요.';
    if (status === 'hidden') return '이 게임은 현재 이용할 수 없습니다.';
    if (status === 'direct') return '게임 선택 화면에서 게임을 실행해 주세요.';
    return '게임 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  function blockPage(status) {
    allowed = false;
    document.documentElement.dataset.gameAccess = 'blocked';
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'game-access-blocked', status }, location.origin);
      return;
    }
    document.body.replaceChildren();
    const card = document.createElement('main');
    card.className = 'game-access-card';
    const title = document.createElement('h1');
    title.textContent = status === 'development' ? '개발 중입니다'
      : status === 'maintenance' ? '점검 중입니다'
      : status === 'direct' ? '게임 선택 화면에서 실행해 주세요'
      : '게임을 이용할 수 없습니다';
    const message = document.createElement('p');
    message.textContent = messageFor(status);
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = '게임 목록으로';
    back.addEventListener('click', () => location.replace('../'));
    card.append(title, message, back);
    document.body.append(card);
  }

  document.addEventListener('click', event => {
    const target = event.target;
    const menuLink = target instanceof Element && target.closest('a[href="../"],a[href="../index.html"]');
    if (!menuLink || window.parent === window) return;
    event.preventDefault();
    window.parent.postMessage({ type: 'game-hub-close' }, location.origin);
  });

  (async () => {
    await waitForDocument();
    try {
      const status = await readAccessState();
      if (status) {
        blockPage(status);
        return;
      }
      allowed = true;
      document.documentElement.dataset.gameAccess = 'allowed';
      await activateGameScripts();
      window.setInterval(async () => {
        if (!allowed) return;
        try {
          const latestStatus = await readAccessState();
          if (latestStatus) blockPage(latestStatus);
        } catch (error) {
          console.warn('게임 상태 갱신에 실패했습니다.', error);
        }
      }, 15000);
    } catch (error) {
      console.error('게임 접근 상태를 확인하지 못했습니다.', error);
      blockPage('unavailable');
    }
  })();
})();
