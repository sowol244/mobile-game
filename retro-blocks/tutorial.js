// First-play tutorial: five short steps played on the real board. `done` sees the tutorial counters.
export const STEPS = [
  { text: '<b>◀ ▶</b>로 블록을 옮겨 보세요.', pc: '← →', done: s => s.moves >= 2 },
  { text: '<b>A</b>로 블록을 돌려 보세요.', pc: 'X', done: s => s.cw >= 2 },
  { text: '<b>▼</b>는 빨리, <b>B</b>는 바로 떨어뜨려요.', pc: '↓ / 스페이스', done: s => s.soft >= 3 || s.hard >= 1 },
  { text: '<b>I</b> 블록을 <b>A</b>로 세워 <b>오른쪽 끝</b> 빈칸에 넣어요.', pc: 'X, →', setup: 'well', done: s => s.cleared >= 1 },
  { text: '가로줄을 채우면 지워져요. <b>4줄</b>을 한 번에 지우면 점수가 가장 커요!', last: true },
];
