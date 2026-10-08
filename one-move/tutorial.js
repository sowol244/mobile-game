// Scripted tutorial boards. Each lesson runs on the real board with the real rules; only the expected move is accepted.
// move: [row, col, dir] with dir 0 up, 1 right, 2 down, 3 left.
export const LESSONS = [
  {
    def: { rows: ['. . . .', '. 2 . 2', '. . . .', '. . . .'], target: 4, limit: 2 },
    steps: [
      { text: '타일을 눌러 고른 뒤, 오른쪽 화살표를 눌러 한 칸 옮겨요.', move: [1, 1, 1] },
      { text: '같은 숫자에 부딪히면 합쳐져요. 한 번 더 오른쪽으로!', move: [1, 2, 1] },
    ],
  },
  {
    def: { rows: ['. . . .', '. 4 2 .', '. . . .', '. . 2 .'], target: 8, limit: 3 },
    steps: [
      { text: '타일을 손가락으로 위로 밀어도 한 칸 움직여요.', move: [3, 2, 0] },
      { text: '위의 2와 합쳐 4를 만들어요.', move: [2, 2, 0] },
      { text: '4와 4를 합쳐 목표 8을 만들면 클리어!', move: [1, 2, 3] },
    ],
  },
];
// One short line shown the first time a stage introduces a mechanic.
export const INTROS = {
  '2-1': '벽은 움직이지 않고 길을 막아요.',
  '2-3': '별 칸에서 목표 숫자를 만들어야 해요.',
  '3-1': '핀 타일은 못 움직여요. 같은 숫자는 합쳐져요.',
  '3-4': '점 타일은 한 번 움직이면 고정돼요.',
  '4-1': '문에 적힌 숫자를 만들면 문이 열려요.',
};
