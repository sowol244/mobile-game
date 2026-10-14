// First-play tutorial: teach only gravity and matching before the campaign introduces special blocks.
// Each step uses the real rules; running out of moves resets the step with a nudge.
const E = '. . . . . . . . .';
const pad = rows => [...Array(9 - rows.length).fill(E), ...rows];

export const STEPS = [
  {
    text: '화면을 <b>왼쪽</b>이나 <b>오른쪽</b>으로 쓸어 보세요. (PC: 방향키) 중력이 바뀌어요!',
    goal: 'clear', limit: 2,
    rows: pad(['c c c . . . . . c']),
  },
  {
    text: '같은 색 <b>4개 이상</b>이 붙으면 터져요. 색이 달라도 규칙은 같으니, 중력을 바꿔 모아 보세요!',
    goal: 'clear', limit: 3,
    rows: pad([
      '. p . . . c . . .',
      'c p . p . p c . c',
    ]),
  },
];
