// BETA stages: 24 stages, 4 chapters, one new goal each. The chain-merge rule is on in every stage (opts.chain).
// Generated from random boards, solved with the beta rules by logic.js (opt = optimal moves, sol = one optimal line as
// [cell, direction] pairs), limits set per chapter. beta.test.mjs re-solves every stage.
// Tokens as in stages.js, plus k = the marked tile of the exit goal. goal kinds: one, exit, count, line (see beta-rules.js).
export const BETA_CHAPTERS = [
  { id: 1, name: '하나로 모으기', desc: '모든 타일을 한 개로 합쳐요.', title: '모두 하나로', intro: ['모든 숫자 타일을 한 개로 합쳐요.', '합쳐진 타일 옆에 같은 숫자가 있으면 이동 없이 이어서 합쳐져요.'] },
  { id: 2, name: '출구로', desc: '★ 타일을 출구 칸까지 옮겨요.', title: '출구로', intro: ['★ 타일을 출구 칸까지 옮겨요.', '★ 타일은 합쳐지지 않아요. 길을 막은 타일은 합쳐서 치워요.'] },
  { id: 3, name: '세 개 만들기', desc: '같은 숫자 3개를 동시에 만들어요.', title: '세 개 만들기', intro: ['같은 숫자 3개를 동시에 만들어요.', '붙은 같은 숫자는 이어서 합쳐지니 떨어뜨려 두세요.'] },
  { id: 4, name: '줄에 모으기', desc: '모든 타일을 표시된 줄 안으로 모아요.', title: '한 줄로', intro: ['모든 타일을 표시된 줄 안으로 모아요.', '합치면 타일이 줄어들어요.'] },
];
export const BETA_STAGES = [
  {id:'B1-1', ch:1, rows:['. . . .','. 2 . .','4 . 2 .','. . . .'], opts:{chain:true, goal:{kind:'one'}}, limit:7, opt:2, sol:[[5,2],[10,3]], intro:true},
  {id:'B1-2', ch:1, rows:['. . . 2','. 8 . 4','. . 2 .','. . . .'], opts:{chain:true, goal:{kind:'one'}}, limit:8, opt:3, sol:[[3,3],[2,2],[10,0]]},
  {id:'B1-3', ch:1, rows:['. 2 2 2','# 2 . .','. . . 8','. . . .'], opts:{chain:true, goal:{kind:'one'}}, limit:8, opt:4, sol:[[5,0],[11,0],[7,3],[3,3]]},
  {id:'B1-4', ch:1, rows:['. 4 . .','. . # .','. . . 16','. 8 . 4'], opts:{chain:true, goal:{kind:'one'}}, limit:10, opt:6, sol:[[1,2],[5,2],[9,1],[10,2],[11,3],[15,3]]},
  {id:'B1-5', ch:1, rows:['. . # 4','. . . 8','. 2 16 2','. . # .'], opts:{chain:true, goal:{kind:'one'}}, limit:11, opt:8, sol:[[10,0],[6,3],[7,3],[3,2],[9,1],[10,1],[11,0],[7,3]]},
  {id:'B1-6', ch:1, rows:['# . # 2 .','# . . . .','4 . 2 32 .','. . . . .','. . 16 8 .'], opts:{chain:true, goal:{kind:'one'}}, limit:11, opt:8, sol:[[3,2],[8,3],[10,1],[7,2],[12,2],[13,3],[23,0],[18,3]]},
  {id:'B2-1', ch:2, rows:['. . k .','. 4 . .','# 2 . .','. 2 . .'], opts:{chain:true, goal:{kind:'exit', cell:[3,0]}}, limit:10, opt:6, sol:[[2,2],[6,2],[10,2],[13,0],[14,3],[13,3]], intro:true},
  {id:'B2-2', ch:2, rows:['4 . . #','. . . .','4 2 . .','k 2 # .'], opts:{chain:true, goal:{kind:'exit', cell:[0,2]}}, limit:10, opt:6, sol:[[13,0],[12,0],[8,0],[4,1],[5,0],[1,1]]},
  {id:'B2-3', ch:2, rows:['# . 2 .','. . 4 2','4 . # k','. 8 . .'], opts:{chain:true, goal:{kind:'exit', cell:[1,1]}}, limit:8, opt:5, sol:[[7,0],[3,3],[11,0],[7,3],[6,3]]},
  {id:'B2-4', ch:2, rows:['8 . . 2','. k . .','. 4 4 #','# # 8 .'], opts:{chain:true, goal:{kind:'exit', cell:[3,3]}}, limit:9, opt:6, sol:[[5,1],[9,1],[10,3],[6,2],[10,2],[14,1]]},
  {id:'B2-5', ch:2, rows:['. . . # .','. k 8 # .','. # 4 2 .','. . 4 . .','. 2 8 . #'], opts:{chain:true, goal:{kind:'exit', cell:[1,4]}}, limit:11, opt:8, sol:[[7,0],[6,1],[12,2],[7,2],[13,2],[12,1],[13,1],[14,0]]},
  {id:'B2-6', ch:2, rows:['. . . . 8','4 # . 4 8','. 2 . 2 #','. # 16 . .','k # . . #'], opts:{chain:true, goal:{kind:'exit', cell:[0,2]}}, limit:10, opt:8, sol:[[11,1],[12,1],[20,0],[15,0],[10,1],[11,1],[12,0],[7,0]]},
  {id:'B3-1', ch:3, rows:['. . . 2','2 . 2 .','. . . 2','. 2 2 .'], opts:{chain:true, goal:{kind:'count', value:4, n:3}}, limit:9, opt:5, sol:[[3,2],[4,1],[5,1],[7,2],[13,1]], intro:true},
  {id:'B3-2', ch:3, rows:['2 . . 2','. 2 2 .','2 . 2 #','. 2 . 2'], opts:{chain:true, goal:{kind:'count', value:4, n:3}}, limit:8, opt:5, sol:[[0,1],[1,2],[6,2],[8,1],[9,2]]},
  {id:'B3-3', ch:3, rows:['4 . . .','4 4 4 .','. . 4 .','. . # 4'], opts:{chain:true, goal:{kind:'count', value:8, n:3}}, limit:7, opt:4, sol:[[0,2],[5,1],[10,1],[11,2]]},
  {id:'B3-4', ch:3, rows:['4 . # 2','2 . 2 2','4 4 . .','4 . . #'], opts:{chain:true, goal:{kind:'count', value:8, n:3}}, limit:9, opt:6, sol:[[6,3],[5,3],[8,2],[9,0],[5,1],[3,2]]},
  {id:'B3-5', ch:3, rows:['4 . # # 4','2 4 4 . .','. . . . .','. . # 4 .','2 4 . . .'], opts:{chain:true, goal:{kind:'count', value:8, n:3}}, limit:9, opt:7, sol:[[6,1],[18,2],[20,0],[15,0],[10,0],[21,1],[22,1]]},
  {id:'B3-6', ch:3, rows:['. # . . .','4 . 4 . 8','. 8 4 . .','# . . . 8','# 4 . . 8'], opts:{chain:true, goal:{kind:'count', value:16, n:3}}, limit:9, opt:7, sol:[[5,1],[9,3],[6,1],[12,2],[17,3],[19,2],[21,0]]},
  {id:'B4-1', ch:4, rows:['. 4 . .','. . 8 .','. . . 2','. . 16 .'], opts:{chain:true, goal:{kind:'line', axis:'col', index:3}}, limit:7, opt:4, sol:[[1,1],[2,1],[6,1],[14,1]], intro:true},
  {id:'B4-2', ch:4, rows:['16 . 8 .','. # . .','. 4 # 2','. . . .'], opts:{chain:true, goal:{kind:'line', axis:'row', index:0}}, limit:9, opt:6, sol:[[0,1],[9,3],[8,0],[4,0],[11,0],[7,0]]},
  {id:'B4-3', ch:4, rows:['4 . 2 2','. # . 8','. . . .','. . . .'], opts:{chain:true, goal:{kind:'line', axis:'row', index:3}}, limit:8, opt:6, sol:[[0,1],[3,3],[2,1],[3,2],[7,2],[11,2]]},
  {id:'B4-4', ch:4, rows:['. # . . .','. . . # 2','. . 4 # 8','16 . . 32 .','. . . . .'], opts:{chain:true, goal:{kind:'line', axis:'row', index:4}}, limit:14, opt:12, sol:[[12,2],[14,2],[9,2],[15,2],[17,2],[18,2],[19,2],[14,2],[19,3],[18,3],[17,3],[16,2]]},
  {id:'B4-5', ch:4, rows:['4 # . . #','2 . 16 2 .','. . . . .','. . . . .','. 8 . 4 #'], opts:{chain:true, goal:{kind:'line', axis:'row', index:2}}, limit:10, opt:9, sol:[[7,2],[8,3],[7,3],[6,3],[5,2],[21,0],[16,0],[23,0],[18,0]]},
  {id:'B4-6', ch:4, rows:['# 16 . . 2','4 . . . 8','. . . # 4','. . . 8 .','. # . . #'], opts:{chain:true, goal:{kind:'line', axis:'col', index:4}}, limit:12, opt:11, sol:[[1,1],[5,1],[6,1],[9,3],[8,0],[7,1],[2,2],[14,0],[9,3],[8,1],[18,1]]},
];
