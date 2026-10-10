# Move On 개발중(beta) 모드

시작 → 모드 선택 → **개발중 (beta)** (비밀번호 4자리). 연쇄 합치기 규칙과 새 목표 4가지, 24개 스테이지.
정식 게임(41개 스테이지)은 beta를 거치지 않으며 규칙이 그대로입니다.

## 규칙

- **연쇄 합치기**: 합쳐진 타일 옆(위, 오른쪽, 아래, 왼쪽 순)에 같은 숫자가 있으면 이동 없이 이어서 합쳐집니다. 합쳐질 때마다 문도 열립니다. 고정 타일은 흡수하지 않지만, 고정 타일에 합쳐진 결과는 다른 타일을 흡수할 수 있습니다. 그냥 옮겨서 같은 숫자 옆에 닿는 것만으로는 연쇄가 일어나지 않습니다.
- **목표** (`opts.goal.kind`): `one` 모든 숫자 타일을 한 개로 / `exit` 표시 타일(`k`, 값 1, 합쳐지지 않음)을 출구 칸으로 / `count` 같은 숫자 N개를 동시에 / `line` 모든 타일을 표시된 줄 안으로.
- 별은 정식과 같은 규칙(최소+1수 이내 ★3, 힌트를 쓰면 최대 ★2). 기록은 `onemove-beta-rec`에만 저장됩니다.
- 비밀번호는 솔트 + PBKDF2-SHA256(200,000회) 해시만 `beta-gate.js`에 있습니다. 이 브라우저 세션에서만 열려 있습니다(`sessionStorage`). 4자리는 경우의 수가 1만 개뿐이라 가볍게 막아 두는 용도입니다.
  비밀번호 바꾸기(새 번호는 명령줄에만 쓰고 저장하지 마세요): `node -e "const c=require('crypto'),s=c.randomBytes(16);console.log(s.toString('hex'),c.pbkdf2Sync(process.argv[1],s,200000,32,'sha256').toString('hex'))" 새번호` → 앞은 `SALT_HEX`, 뒤는 `HASH_HEX`.

## 파일 (모두 `one-move/` 안)

| 파일 | 역할 |
| --- | --- |
| `beta.js` | beta 화면 흐름: 모드 선택 연결, 비밀번호 키패드, 단계 목록, 소개 카드, 연쇄 연출, 결과 카드, 풀이 다시 보기 |
| `beta-rules.js` | 연쇄 합치기와 목표 4가지 판정. import하면 `logic.js`의 `ext`에 등록됩니다 |
| `beta-gate.js` | 비밀번호 해시 확인 (`crypto.subtle`, 상수 시간 비교) |
| `beta-stages.js` | 챕터 4개, 스테이지 24개 (풀이 한 줄 `sol`과 최소 이동 `opt` 포함) |
| `beta.css` | beta 전용 스타일 |
| `beta.test.mjs` | `node one-move/beta.test.mjs` |
| `BETA.md` | 이 문서 |

## 기존 파일에 넣은 줄

모든 줄에 `BETA` 표시가 있습니다. `grep -n BETA logic.js main.js solver-worker.js sound.js index.html`

- **한 줄을 더한 곳** (`// BETA`, `<!-- BETA -->`): `logic.js` 7곳(`ext`, 토큰 `k` 2곳, `opts`, 연쇄 호출 3곳), `main.js` 8곳과 끝의 `BETA:begin`~`BETA:end` 블록(beta.js를 `import()`로 불러옴), `sound.js` 1곳, `solver-worker.js` 2곳, `index.html` 3곳과 `BETA:begin`~`BETA:end` 블록(모드 선택, 비밀번호, 단계 목록, 소개, 풀이 다시 보기 화면).
- **원래 줄을 고친 곳** (`BETA (opts)`, `BETA (chain)`, `/* BETA */`): `logic.js` 12곳(`opts` 인자 전달과 `chain` 결과), `main.js` 6곳, `solver-worker.js` 2곳. 모두 `opts`를 넘기거나 받는 것뿐이라 beta 파일이 없으면 아무 일도 하지 않습니다.

beta 파일이 없으면 `main.js`의 `B`가 `null`로 남아 위 줄들이 모두 건너뛰어지고, 시작 버튼은 바로 스테이지 선택으로 갑니다.

## beta 없애기

1. **파일만 지우기** (가장 간단합니다. 남은 줄은 아무 일도 하지 않고, 브라우저 콘솔에 `beta.css`, `beta.js` 404 메시지만 남습니다):
   `cd one-move && rm beta.js beta-rules.js beta-gate.js beta-stages.js beta.css beta.test.mjs BETA.md`
2. **줄까지 깨끗이**: 위 파일을 지우고, 표시된 줄도 없앱니다. 아래 스크립트가 한 번에 합니다(원래 줄 모양이 달라졌으면 멈춥니다).

<!-- script:remove -->
```bash
cd one-move && python3 - <<'PY'
import os, re
FILES = ['beta.js', 'beta-rules.js', 'beta-gate.js', 'beta-stages.js', 'beta.css', 'beta.test.mjs', 'BETA.md']
REVERT = {
  'logic.js': [
    ('out, opts) { // BETA (opts)', 'out) {'),
    ('locked, chain }; // BETA (chain)', 'locked };'),
    ('out, s.opts); // BETA (opts)', 'out);'),
    (', win: isWin(state), chain: chain.length ? chain : undefined } }; // BETA (chain)', ', win: isWin(state) } };'),
    ('goal, opts) { // BETA (opts)', 'goal) {'),
    ('s.goal, s.opts); // BETA (opts)', 's.goal);'),
    ('out, s.opts /* BETA */)) res.push', 'out)) res.push'),
    ('const { n, target, goal, opts } = s, len = n * n; // BETA (opts)', 'const { n, target, goal } = s, len = n * n;'),
    ('isWinCodes(s.codes, target, goal, opts /* BETA */)', 'isWinCodes(s.codes, target, goal)'),
    ('if (!(opts && opts.goal) && dead(codes, target, goal)) continue; // BETA (opts)', 'if (dead(codes, target, goal)) continue;'),
    ('if (!moveCodes(codes, n, i, d, out, opts)) continue; // BETA (opts)', 'if (!moveCodes(codes, n, i, d, out)) continue;'),
    ('isWinCodes(out, target, goal, opts /* BETA */)', 'isWinCodes(out, target, goal)'),
  ],
  'main.js': [
    ('goal: s.goal, opts: s.opts /* BETA */ }', 'goal: s.goal }'),
    ('function startDef(def, day, extra /* BETA */) {', 'function startDef(def, day) {'),
    ('cur = { def, index: -1, day, ...extra /* BETA */ };', 'cur = { def, index: -1, day };'),
    ('if (!(ev.chain && B && B.chain(ev, history[history.length - 1]))) sync(ev); /* BETA: chain moves animate in beta.js */\n  hud(); drawMarks();', 'sync(ev); hud(); drawMarks();'),
    ('goal: st.goal, opts: st.opts /* BETA */, maxDepth', 'goal: st.goal, maxDepth'),
    ('if (B && B.back()) return; /* BETA */ ', ''),
  ],
  'solver-worker.js': [
    ('self.onmessage = async e => { // BETA (async)', 'self.onmessage = e => {'),
    ('goal: s.goal, opts: s.opts /* BETA */ }', 'goal: s.goal }'),
  ],
}
for f in FILES:
    if os.path.exists(f): os.remove(f)
for f in ['logic.js', 'main.js', 'solver-worker.js', 'sound.js', 'index.html']:
    s = open(f, encoding='utf-8').read()
    for old, new in REVERT.get(f, []):
        assert s.count(old) == 1, (f, old)
        s = s.replace(old, new)
    s = re.sub(r'[ \t]*(?://|<!--) BETA:begin.*?(?://|<!--) BETA:end[^\n]*\n', '', s, flags=re.S)
    s = re.sub(r'^.*(?:// BETA(?! \()|<!-- BETA -->).*\n', '', s, flags=re.M)
    open(f, 'w', encoding='utf-8').write(s)
print('beta removed')
PY
```

그다음 `node one-move/logic.test.mjs`로 확인하세요. 남는 `BETA` 글자가 없어야 합니다 (`grep -rn BETA one-move`).

## beta를 정식으로 올리기

잠금을 풀고 이름을 "연쇄 모드"로 바꿉니다. 정식/연쇄 모드 두 카드는 그대로 남고, 기록 키(`onemove-beta-…`)도 그대로 씁니다. 아래 스크립트가 비밀번호 화면과 `beta-gate.js`, 그 테스트를 없애고 글자를 바꿉니다.

<!-- script:promote -->
```bash
cd one-move && python3 - <<'PY'
import os, re
def once(s, old, new):
    assert s.count(old) == 1, old
    return s.replace(old, new)
def gate_out(s):
    s = re.sub(r'[ \t]*(?://|<!--) GATE:begin.*?(?://|<!--) GATE:end[^\n]*\n', '', s, flags=re.S)
    return re.sub(r'^.*// GATE.*\n', '', s, flags=re.M)
def edit(f, fn):
    s = open(f, encoding='utf-8').read()
    open(f, 'w', encoding='utf-8').write(fn(s))
def beta_js(s):
    s = gate_out(s)
    s = once(s, 'if (unlocked()) showSelect(); else showGate();', 'showSelect();')
    s = once(s, "'betaGate' /* GATE */, ", '')
    return once(s, '개발중 · ', '')
def index_html(s):
    s = gate_out(s)
    s = re.sub(r'<span class="mi"><svg class="lock".*?</svg></span>', '<span class="mi"><span class="tile" data-e="4"><span class="n">16</span></span></span>', s, flags=re.S)
    s = once(s, 'class="mode beta"', 'class="mode"')
    s = once(s, '<b>개발중 (beta)</b>', '<b>연쇄 모드</b>')
    return once(s, '<h2>개발중 (beta)</h2>', '<h2>연쇄 모드</h2>')
def test_mjs(s):
    s = once(s, "import { pbkdf2Sync } from 'node:crypto';\n", '')
    s = once(s, "import { check, derive, sameHex, ITER, SALT_HEX, HASH_HEX } from './beta-gate.js';\n", '')
    return re.sub(r'/\* -+ password gate.*?(?=\nconsole\.log\()', '', s, flags=re.S)
edit('beta.js', beta_js)
edit('index.html', index_html)
edit('beta.test.mjs', test_mjs)
os.remove('beta-gate.js')
print('beta promoted')
PY
```

그다음 `node one-move/beta.test.mjs`와 `node one-move/logic.test.mjs`로 확인하세요. `BETA` 표시와 `beta-` 파일 이름은 그대로 둬도 동작에 영향이 없습니다. 정식 스테이지 목록에 24개를 섞고 싶으면 `beta-stages.js`의 스테이지(`opts` 포함)를 `stages.js`에 옮기고, `beta.js`의 `header()`와 결과 처리를 `main.js`의 `setHeader()`와 `finish()`로 옮기면 됩니다.
