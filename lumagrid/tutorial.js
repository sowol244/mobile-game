// Scripted boards for the interactive tutorial. Each step is played on the real board with the real rules.
import { SHAPES } from './logic.js';

const sh = (h, w, n) => SHAPES.find(s => s.h === h && s.w === w && s.cells.length === n);

// r0/c0: the cell where the piece's top-left must land. `any` means any legal drop is accepted (the target is only a hint).
export const STEPS = [
  {
    text: '아래 블록을 손가락으로 끌어서 판 위에 놓아 보세요.',
    any: true, r0: 5, c0: 3, slot: 1, piece: { shape: sh(2, 2, 4), color: 1 },
    board() {},
  },
  {
    text: '가로나 세로 한 줄을 가득 채우면 그 줄이 사라지고 점수를 얻어요. 표시된 자리에 놓아 보세요.',
    r0: 7, c0: 5, slot: 1, piece: { shape: sh(1, 3, 3), color: 2 },
    board(b) { for (let c = 0; c < 5; c++) b[7][c] = 3 + (c % 5); },
  },
  {
    text: '가로와 세로가 동시에 채워지면 한 번에 지워져서 점수가 크게 올라요.',
    r0: 4, c0: 4, slot: 1, piece: { shape: sh(1, 1, 1), color: 4 },
    board(b) { for (let k = 0; k < 8; k++) if (k !== 4) { b[4][k] = 1 + (k % 7); b[k][4] = 1 + ((k + 3) % 7); } },
  },
];
