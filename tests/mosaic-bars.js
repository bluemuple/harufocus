/* 하루 모자이크 우측 '작업 막대' 칼럼의 분류·정렬 — 유저 확정 스펙(2026-08-04):
 *   ① 그날 마감(이른 마감이 위) + 그날 만든 작업(만든 순) — 항상 보임
 *   ② 〈전날 할 일〉 = 그 전에 만든 미완료 (기본 접힘, 0이면 그룹 없음)
 *   ③ 〈완료한 작업〉 = **그날 완료만** (다른 날 완료는 그 날 칼럼의 몫)
 *   보상·장기목표 분량 제외, 내일로 미룬 일은 그날까지 숨김(renderTodo와 같은 규칙).
 *
 * index.html의 **실제 mosaicBarGroups·taskDueAt·dateKey**를 뽑아 돌린다 —
 * 규칙을 여기 베껴 쓰면 본체가 바뀌어도 테스트가 통과해 버린다. */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');

function grab(name) {
  const at = SRC.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('not found: ' + name);
  let i = SRC.indexOf('{', at), depth = 0;
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return SRC.slice(at, j + 1); }
  }
  throw new Error('unbalanced: ' + name);
}

const harness = `
${grab('dateKey')}
${grab('taskDueAt')}
${grab('mosaicBarGroups')}
  module.exports = { mosaicBarGroups };
`;
const m = new module.constructor();
m._compile(harness, '/mosaic-bars-harness.js');
const groups = m.exports.mosaicBarGroups;

let pass = 0, fail = 0;
const t = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? 'PASS  ' : 'FAIL  ') + name); };

// '오늘' 고정 — dateKey와 같은 식(getFullYear+'-'+(getMonth()+1)+'-'+getDate()).
const D = (h, min, day) => new Date(2026, 7, day == null ? 5 : day, h, min, 0).toISOString();
const TK = '2026-8-5';
const DAY0 = new Date(2026, 7, 5, 0, 0, 0).getTime();
const ids = a => a.map(x => x.id).join(',');

// ── ① 오늘 마감(마감 순) + 오늘 만든 작업(만든 순) ──
const dueLate  = { id: 'dL', scheduledStart: D(14, 0), durationMin: 60, createdAt: D(7, 0), isDone: false };  // 마감 15:00
const dueEarly = { id: 'dE', scheduledStart: D(9, 0),  durationMin: 30, createdAt: D(8, 0), isDone: false };  // 마감 09:30
const madeA    = { id: 'mA', createdAt: D(10, 0), isDone: false };                                            // 마감 없음
const madeB    = { id: 'mB', createdAt: D(11, 0), isDone: false };
let g = groups([madeB, dueLate, madeA, dueEarly], TK, DAY0);
t('⚠⚠ 핵심: 마감(이른 순)이 위, 만든 작업(만든 순)이 뒤', ids(g.main) === 'dE,dL,mA,mB');
t('①만 있으면 전날·완료 그룹은 빈다', g.prev.length === 0 && g.done.length === 0);

// planDueAt이 있으면 그게 마감 — scheduledStart+duration보다 우선(taskDueAt 계약).
const pushed = { id: 'dP', scheduledStart: D(8, 0), durationMin: 30, planDueAt: D(16, 0), createdAt: D(6, 0), isDone: false };
g = groups([pushed, dueLate], TK, DAY0);
t('밀린 마감(planDueAt)이 정렬 기준 — 15:00 마감이 16:00보다 위', ids(g.main) === 'dL,dP');

// 어제 만들었어도 **오늘 마감**이면 ① (마감이 우선).
const oldButDueToday = { id: 'oD', scheduledStart: D(13, 0), durationMin: 30, createdAt: D(9, 0, 3), isDone: false };
g = groups([madeA, oldButDueToday], TK, DAY0);
t('전에 만들었어도 오늘 마감이면 위(①)로', ids(g.main) === 'oD,mA' && g.prev.length === 0);

// 오늘 만들었지만 마감이 **내일**이면 만든 순 자리(마감은 오늘 것만 기준).
const dueTomorrow = { id: 'dT', scheduledStart: D(9, 0, 6), durationMin: 30, createdAt: D(9, 30), isDone: false };
g = groups([dueTomorrow, dueEarly, madeA], TK, DAY0);
t('내일 마감은 오늘 마감 취급이 아니다 — 만든 순 자리로', ids(g.main) === 'dE,dT,mA');

// ── ② 전날 할 일 = 그 전에 만든 미완료 (만든 순) ──
const oldB = { id: 'pB', createdAt: D(9, 0, 4), isDone: false };
const oldA = { id: 'pA', createdAt: D(9, 0, 3), isDone: false };
g = groups([oldB, madeA, oldA], TK, DAY0);
t('전에 만든 미완료는 전날 그룹, 만든 순', ids(g.main) === 'mA' && ids(g.prev) === 'pA,pB');

// ── ③ 완료한 작업 = 그날 완료만 (완료 순) ──
const doneNow   = { id: 'cB', createdAt: D(8, 0), isDone: true, completedAt: D(15, 0) };
const doneEarly = { id: 'cA', createdAt: D(9, 0, 3), isDone: true, completedAt: D(10, 0) };
const doneOther = { id: 'cX', createdAt: D(8, 0, 4), isDone: true, completedAt: D(20, 0, 4) };   // 어제 완료
g = groups([doneNow, doneOther, doneEarly], TK, DAY0);
t('오늘 완료만, 완료 순 — 전에 만든 것도 오늘 완료면 여기', ids(g.done) === 'cA,cB');
t('⚠ 다른 날 완료는 어디에도 없다(그 날 칼럼의 몫)',
  g.main.length === 0 && g.prev.length === 0 && g.done.every(x => x.id !== 'cX'));

// ── 제외 규칙 ──
const reward = { id: 'rw', createdAt: D(9, 0), isDone: false, isRewardItem: true };
const goal   = { id: 'gl', createdAt: D(9, 0), isDone: false, goalID: 'g1' };
const defer  = { id: 'df', createdAt: D(9, 0, 3), isDone: false, deferredUntil: D(0, 0, 6) };    // 내일로 미룸
g = groups([reward, goal, defer, madeA], TK, DAY0);
t('보상·장기목표 분량은 칼럼에 없다', ids(g.main) === 'mA' && g.prev.length === 0);
t('내일로 미룬 일은 그날까지 숨김(renderTodo와 같은 규칙)',
  [...g.main, ...g.prev, ...g.done].every(x => x.id !== 'df'));
// 미룬 날이 **오늘**이 되면 다시 보인다.
const deferHere = { id: 'dh', createdAt: D(9, 0, 3), isDone: false, deferredUntil: D(0, 0) };
g = groups([deferHere], TK, DAY0);
t('미룬 날짜가 오면 다시 보인다(전날 그룹)', ids(g.prev) === 'dh');

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (mosaic-bars)`);
process.exit(fail ? 1 : 0);
