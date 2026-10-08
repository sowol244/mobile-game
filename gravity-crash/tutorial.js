// First-play tutorial: four tiny boards played with the real rules. Each step is cleared like a puzzle stage
// (goal within `limit` moves); running out of moves resets the step with a nudge.
const E = '. . . . . . . . .';
const pad = rows => [...Array(9 - rows.length).fill(E), ...rows];

export const STEPS = [
  {
    text: '화면을 <b>왼쪽</b>이나 <b>오른쪽</b>으로 쓸어 보세요. (PC: 방향키) 중력이 바뀌어요!',
    goal: 'clear', limit: 2,
    rows: pad(['c c c . . . . . c']),
  },
  {
    text: '같은 색 <b>4개</b>가 붙으면 터져요. <b>화살표 블록</b>이 터지면 그 방향 한 줄이 통째로 사라져요!',
    goal: 'clear', limit: 2,
    rows: pad(['. . . y . . . . .', 'y y y> p g c p g c']),
  },
  {
    text: '<b>블랙홀</b>은 주변 블록 3개 이상을 한 색으로 바꾸고 사라져요. 끌고 멈추면 <b>착지 미리보기</b>!',
    goal: 'clear', limit: 2,
    rows: pad(['. p . . . . . . .', '. c . . . o c c .']),
  },
  {
    text: '<b>코어</b>를 주황색 <b>출구</b>로 내보내세요. 오른쪽으로, 그다음 위로!',
    goal: 'rescue', exit: 'up:8', limit: 3,
    rows: pad(['# # # # # # # # .', E, E, '. . . . . . . . .', E, E, 'K . . . . . . . .']),
  },
];
