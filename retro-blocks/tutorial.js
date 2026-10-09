// First-play tutorial: five short steps played on the real board. `done` sees the tutorial counters.
export const STEPS = [
  { text: '<b>◀ ▶</b>로 블록을 옮겨 보세요.', pc: '← →', done: s => s.moves >= 2 },
  { text: '<b>A</b>는 오른쪽, <b>B</b>는 왼쪽으로 돌려요.', pc: 'X / Z', done: s => s.cw >= 1 && s.ccw >= 1 },
  { text: '<b>▼</b>를 누르고 있으면 빨리 내려와요.', pc: '↓', done: s => s.soft >= 3 },
  { text: '<b>I</b> 블록을 <b>A</b>로 세워 <b>오른쪽 끝</b> 빈칸에 넣어요.', pc: 'X, →', setup: 'well', done: s => s.cleared >= 1 },
  { text: '가로줄을 채우면 지워져요. <b>4줄</b>을 한 번에 지우면 점수가 가장 커요!', last: true },
];
