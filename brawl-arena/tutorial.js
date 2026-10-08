// First-play tutorial: five short steps in a small practice yard against a dummy that never shoots back.
// Each step says what to do and checks for it; main.js shows the text and feeds in what happened.

import { inBush } from './game.js';

export const STEPS = [
  {
    text: '왼쪽 아래 <b>이동</b> 자리를 누른 채 끌어서 <b>노란 표시</b>까지 걸어가 보세요.',
    marker: true,
    done: (t, me, m) => Math.hypot(me.x - m.mapDef.marker.x, me.y - m.mapDef.marker.y) < 0.9,
  },
  {
    text: '오른쪽 아래 <b>공격</b> 자리를 <b>톡</b> 치면 가까운 적을 자동으로 쏴요. 연습 상대를 맞혀 보세요!',
    done: t => t.autoHits > 0,
  },
  {
    text: '이번엔 <b>공격</b> 자리를 누른 채 <b>끌어서</b> 조준선을 맞추고, 손을 떼면 그 방향으로 쏴요.',
    done: t => t.aimHits > 0,
  },
  {
    text: '적을 맞히면 <b>★ 필살기</b> 게이지가 차요. 지금 가득 채워 뒀어요! ★ 버튼을 톡 치거나 끌어서 써 보세요.',
    enter: me => { me.charge = 1; },
    done: t => t.supers > 0,
  },
  {
    text: '<b>수풀</b>에 들어가면 적에게 안 보여요. 오른쪽 위 수풀 속으로 숨어 보세요.',
    done: (t, me, m) => inBush(m.map, me.x, me.y),
  },
];
