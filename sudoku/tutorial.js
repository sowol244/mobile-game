// Interactive tutorial on a nearly finished board (stage 1's solution with 8 blanks).
// Each step says what to do, which actions it accepts (allow → true or a warning) and when it is done.
import { STAGES } from './stages.js';

// A: first entry, B: wrong entry, C/D: note + auto-removal (same row), X: hint, F: naked single, H1/H2: hidden single in a row
export const TUT = { A: 56, B: 79, C: 3, D: 7, X: 48, F: 53, H1: 75, H2: 76, W: 6 };
export const TUT_SOLUTION = STAGES[0].s;
export const TUT_PUZZLE = Array.from(TUT_SOLUTION, (ch, i) => (Object.values(TUT).slice(0, 8).includes(i) ? '0' : ch)).join('');

const JONG = [0, 1, 0, 1, 0, 0, 1, 1, 1, 0];
const eul = d => d + (JONG[d] ? '을' : '를');
const iga = d => d + (JONG[d] ? '이' : '가');

export function tutorialSteps(sol) {
  const { A, B, C, D, X, F, H1 } = TUT;
  const a = sol[A], k = sol[D], g = sol[H1], w = TUT.W, row = (H1 / 9) | 0;
  const isInput = t => t.type === 'input';
  return [
    {
      title: '규칙', next: true,
      text: '가로줄·세로줄·3×3 상자마다 <b>1~9</b>가 한 번씩 들어가요.',
      allow: () => '<다음>을 눌러 계속해요',
    },
    {
      title: '숫자 넣기', ring: A, key: a,
      text: `빛나는 칸을 누르고, 아래 숫자 패드에서 <b>${eul(a)}</b> 눌러요.`,
      allow: t => !isInput(t) ? '숫자 패드를 눌러요' : t.i !== A ? '빛나는 칸을 먼저 눌러요' : t.memo ? '메모를 꺼 주세요' : t.d !== a ? `이 칸엔 ${iga(a)} 들어가요` : true,
      done: s => s.vals[A] === a,
    },
    {
      title: '실수', ring: B, key: w,
      text: `이번엔 일부러 틀려 봐요. 빛나는 칸에 <b>${eul(w)}</b> 넣어요.`,
      allow: t => !isInput(t) ? '숫자 패드를 눌러요' : t.i !== B ? '빛나는 칸을 먼저 눌러요' : t.d !== w ? `${eul(w)} 눌러 보세요` : true,
      done: s => s.mistakes === 1,
    },
    {
      title: '실수', ring: B, tool: 'erase',
      text: '틀린 숫자는 <b style="color: var(--red)">빨갛게</b> 보이고 실수가 1개 늘어요. 3번 틀리면 실패! <b>지우기</b>로 지워요.',
      allow: t => t.type !== 'erase' ? '지우기를 눌러요' : t.i !== B ? '빨간 칸을 먼저 골라요' : true,
      done: s => s.vals[B] === 0,
    },
    {
      title: '메모', tool: 'memo',
      text: '<b>메모</b>를 켜면 후보 숫자를 작게 적어 둘 수 있어요. 메모를 켜요.',
      allow: t => t.type === 'memo' ? true : '메모 버튼을 눌러요',
      done: (s, c) => c.memo,
    },
    {
      title: '메모', ring: C, key: k,
      text: `빛나는 칸에 후보 <b>${eul(k)}</b> 적어요.`,
      allow: t => t.type === 'memo' ? '메모는 켠 채로 두세요' : !isInput(t) ? '숫자 패드를 눌러요' : t.i !== C ? '빛나는 칸을 먼저 눌러요' : t.d !== k ? `${eul(k)} 눌러요` : true,
      done: s => !!(s.notes[C] & (1 << (k - 1))),
    },
    {
      title: '메모', ring: D, key: k, tool: 'memo',
      text: `메모를 끄고, 같은 줄의 빛나는 칸에 <b>${eul(k)}</b> 넣어 보세요.`,
      allow: t => t.type === 'memo' ? true : !isInput(t) ? '메모를 끄고 숫자를 넣어요' : t.memo ? '먼저 메모를 꺼요' : t.i !== D ? '빛나는 칸을 먼저 눌러요' : t.d !== k ? `${eul(k)} 눌러요` : true,
      done: s => s.vals[D] === k,
    },
    {
      title: '힌트', ring: X, tool: 'hint',
      text: `같은 줄의 메모 ${iga(k)} 저절로 지워졌죠? 이제 빛나는 칸을 고르고 <b>힌트</b>를 눌러요.`,
      allow: t => t.type !== 'hint' ? '힌트 버튼을 눌러요' : t.i !== X ? '빛나는 칸을 먼저 골라요' : true,
      done: s => s.hints === 1,
    },
    {
      title: '되돌리기', ring: D, tool: 'undo',
      text: `힌트는 이유와 함께 한 칸을 채워 줘요(한 판에 3번). <b>되돌리기</b>로 아까 넣은 ${eul(k)} 취소해 봐요.`,
      allow: t => t.type === 'undo' ? true : '되돌리기를 눌러요',
      done: s => s.vals[D] === 0,
    },
    {
      title: '요령 1', ring: F,
      text: '빛나는 칸의 가로·세로·상자를 보면 <b>들어갈 수 있는 숫자는 하나뿐</b>이에요. 찾아서 넣어요.',
      allow: t => !isInput(t) ? '숫자를 넣어요' : t.memo ? '메모를 꺼 주세요' : t.i !== F ? '빛나는 칸에 넣어요' : t.d !== sol[F] ? `${iga(t.d)} 이미 가로·세로·상자에 있어요` : true,
      done: s => s.vals[F] === sol[F],
    },
    {
      title: '요령 2', row,
      text: `초록 가로줄에서 <b>${iga(g)} 들어갈 곳은 한 칸뿐</b>이에요. 다른 빈칸은 세로줄이나 상자에 이미 ${iga(g)} 있어요.`,
      allow: t => !isInput(t) ? '숫자를 넣어요' : t.memo ? '메모를 꺼 주세요' : t.d !== g ? `${eul(g)} 넣을 칸을 찾아요` : t.i !== H1 ? `그 칸은 세로줄이나 상자에 이미 ${iga(g)} 있어요` : true,
      done: s => s.vals[H1] === g,
    },
  ];
}
