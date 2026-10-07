# 모바일게임 작업실 (by 석)

휴대폰에서 바로 실행되는 단일 HTML 게임 모음입니다.

- `super-jump/` 슈퍼 점프 1-1: 횡스크롤 플랫폼 게임
- `neon-block/` 네온 블록: 8×8 블록 퍼즐 (규칙 로직은 `logic.js`, 테스트는 `node neon-block/logic.test.mjs`)
  - 효과음(`sound.js`, 오디오 파일 없이 합성), 파티클·화면 흔들림 연출, 이어하기(브라우저에 자동 저장)
  - 순위표: Firebase Firestore 사용. 보안 규칙은 `neon-block/firestore.rules`를 Firebase 콘솔 → Firestore → 규칙에 붙여넣어 게시합니다.
- `meteor-dodge/` 스타 슈터: 드래그로 날아다니며 적을 쏘는 우주 슈팅 게임

이곳의 게임들은 예고 없이 추가되거나 삭제될 수 있습니다.

GitHub Pages를 켜면 `index.html`에서 두 게임을 열 수 있습니다.
