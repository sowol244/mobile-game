# 모바일게임 작업실 (by 석)

휴대폰에서 바로 실행되는 단일 HTML 게임 모음입니다.

- `brawl-arena/` 대난투 아레나: 탑뷰 난투 (봇과 3:3 팀전, 6명 생존전, 튜토리얼, 브롤러 레벨). 기획서는 `brawl-arena/PLAN.md`, 규칙 테스트는 `node brawl-arena/game.test.mjs`
- `super-jump/` 교행이의 모험: 칼로 몬스터를 베며 달리는 모험 게임 (3스테이지, 갈림길, 스테이지마다 상점과 보스)
- `neon-block/` 네온 블록: 8×8 블록 퍼즐 (규칙 로직은 `logic.js`, 테스트는 `node neon-block/logic.test.mjs`)
  - 튜토리얼(`tutorial.js`): 첫 시작 때 자동 실행, 시작 화면의 "게임 방법"으로 다시 볼 수 있음
  - 효과음(`sound.js`, 오디오 파일 없이 합성), 파티클·화면 흔들림 연출, 이어하기(브라우저에 자동 저장)
  - 순위표: Firebase Firestore 사용. 보안 규칙은 `neon-block/firestore.rules`를 Firebase 콘솔 → Firestore → 규칙에 붙여넣어 게시합니다.
- `lux-umbra/` Lux & Umbra: 빛을 켜고 꺼서 길을 여는 퍼즐 게임 (80스테이지 8챕터, 테스트 `node lux-umbra/game.test.mjs`)
- `gravity-crash/` 그라비티 크래시: 중력을 돌려 블록을 터뜨리는 퍼즐 게임 (퍼즐 100스테이지 9챕터, 크래시 무한 모드, 테스트 `node gravity-crash/logic.test.mjs`)
- `retro-blocks/` 레트로 블록: 떨어지는 블록으로 줄을 지우는 고전 퍼즐 게임 (패미콤 스타일 A/B-TYPE, 테스트 `node retro-blocks/logic.test.mjs`)
- `one-move/` Move On: 타일 하나씩 옮겨 숫자를 합치는 퍼즐 게임 (41스테이지, 오늘의 퍼즐, 테스트 `node one-move/logic.test.mjs`)
- `sudoku/` 스도쿠: 빈칸에 1~9를 채우는 숫자 퍼즐 게임 (100탄, 답이 하나뿐인 퍼즐, 테스트 `node sudoku/logic.test.mjs`)
- `meteor-dodge/` 스타 슈터: 적을 쏘며 우주를 나는 슈팅 게임 (기체 3종, 스테이지마다 3페이즈 + 보스)

이곳의 게임들은 예고 없이 추가되거나 삭제될 수 있습니다.

GitHub Pages를 켜면 `index.html`에서 두 게임을 열 수 있습니다.
