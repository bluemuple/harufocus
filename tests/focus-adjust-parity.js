/* 시간 조절 캡슐 파리티 — index.html의 **실제 함수 소스**를 뽑아 node에서
   돌린다. 앱 FocusManager.adjustSessionPlan(byMinutes:proportional:context:)의
   규칙과 1:1로 맞는지 검증한다:
     · 계획 하한 1분 (단 '원래대로'가 실시간 0분 세션을 되돌리는 건 예외)
     · 내 마감선을 d분 이동
     · 12시간 지평 안의 뒤 작업만 대상 (완료·보상·길이0·미배치 제외)
     · 마감 고정 off → 뒤 작업도 통째로 d분 이동
     · 마감 고정 on  → 마지막 마감 고정, 사이를 비례 재배치. 새 폭 < 60초면 거부
   실행: node tests/focus-adjust-parity.js */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');

function grab(name) {
  const at = SRC.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('not found: ' + name);
  let depth = 0;
  for (let j = SRC.indexOf('{', at); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}') { depth--; if (depth === 0) return SRC.slice(at, j + 1); }
  }
  throw new Error('unbalanced: ' + name);
}

const REAL = ['taskDueAt', 'taskByID', 'webAdjustSessionPlan'].map(grab).join('\n');

const harness = `
  var DATA = { tasks: [] };
  var fTask = null, fPlanMin = 0, fPlanAdjust = 0, ftKey = '';
  var pushed = 0;
  function tickFocus(){}
  function renderAll(){}
  function paintAdjRow(){}
  function pushFocusState(){ pushed++; }
${REAL}
  module.exports = {
    adjust: webAdjustSessionPlan,
    set(tasks, active, planMin){ DATA.tasks = tasks; fTask = active; fPlanMin = planMin; fPlanAdjust = 0; pushed = 0; },
    state(){ return { fPlanMin, fPlanAdjust, pushed }; },
  };
`;
const m = new module.constructor();
m._compile(harness, '/web-adjust-harness.js');
const W = m.exports;

const T0 = Date.parse('2026-07-20T09:00:00.000Z');
const iso = t => new Date(t).toISOString();
const mk = (id, startMin, durMin, extra) => Object.assign({
  id, title: id, categoryID: 'focus', durationMin: durMin,
  scheduledStart: iso(T0 + startMin * 60000),
  planDueAt: iso(T0 + (startMin + durMin) * 60000),
}, extra || {});

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };
const dueMin = task => Math.round((Date.parse(task.planDueAt) - T0) / 60000);

// ── 마감 고정 off: 뒤 작업이 통째로 밀린다 ────────────────────────────────
let me = mk('A', 0, 30), next = mk('B', 40, 30);
W.set([me, next], me, 30);
t('+5 → 계획 35분', W.adjust(5, false) && W.state().fPlanMin === 35 && W.state().fPlanAdjust === 5);
t('+5 → 내 마감 30→35분', dueMin(me) === 35);
t('마감 고정 off → 뒤 작업도 +5 (70→75)', dueMin(next) === 75);
t('조절은 즉시 push된다 (요청: 웹-앱 즉시)', W.state().pushed === 1);

// ── '원래대로' = 누적분을 한 번에 되돌린다 ────────────────────────────────
t('원래대로 → 계획 복귀', W.adjust(-5, false) && W.state().fPlanMin === 30 && W.state().fPlanAdjust === 0);
t('원래대로 → 뒤 작업 마감도 복귀', dueMin(next) === 70);

// ── 마감 고정 on: 마지막 마감은 그대로, 사이가 비례로 ─────────────────────
me = mk('A', 0, 30); next = mk('B', 40, 30);
W.set([me, next], me, 30);
t('마감 고정 +5 성공', W.adjust(5, true) === true);
t('마감 고정 on → 마지막 마감 그대로 (70분)', dueMin(next) === 70);
t('마감 고정 on → 내 마감만 이동 (35분)', dueMin(me) === 35);

// ── 뒤 마감을 고정할 수 없을 만큼 좁아지면 거부 ───────────────────────────
me = mk('A', 0, 30); next = mk('B', 30, 1);   // 마지막 마감 = 31분
W.set([me, next], me, 30);
t('공간 부족(새 폭 < 60초)이면 거부', W.adjust(5, true) === false);
t('거부 시 계획이 안 바뀐다', W.state().fPlanMin === 30);
t('거부 시 뒤 마감도 안 바뀐다', dueMin(next) === 31);

// ── 대상 필터: 완료·보상·길이0·미배치·12시간 밖은 안 밀린다 ───────────────
me = mk('A', 0, 30);
const done = mk('done', 40, 30, { isDone: true });
const reward = mk('reward', 40, 30, { isRewardItem: true });
const zero = mk('zero', 40, 0);
const unplaced = mk('unplaced', 40, 30, { scheduledStart: null });
const far = mk('far', 13 * 60, 30);            // 13시간 뒤 = 지평 밖
const before = mk('before', -60, 30);          // 내 마감보다 앞 = 대상 아님
W.set([me, done, reward, zero, unplaced, far, before], me, 30);
W.adjust(5, false);
t('완료 작업은 안 밀린다', dueMin(done) === 70);
t('보상 항목은 안 밀린다', dueMin(reward) === 70);
t('길이 0 작업은 안 밀린다', dueMin(zero) === 40);
t('미배치 작업은 안 밀린다', dueMin(unplaced) === 70);
t('12시간 밖은 안 밀린다', dueMin(far) === 13 * 60 + 30);
t('내 마감보다 앞 작업은 안 밀린다', dueMin(before) === -30);

// ── 하한 규칙 ─────────────────────────────────────────────────────────────
me = mk('A', 0, 3);
W.set([me], me, 3);
t('1분 미만으로는 거부', W.adjust(-5, false) === false && W.state().fPlanMin === 3);
t('정확히 1분까지는 허용', W.adjust(-2, false) === true && W.state().fPlanMin === 1);

// ⚠ 앱에서 발견해 함께 고친 함정: 실시간(0분) 세션은 하한 1분 때문에
// '원래대로'까지 막혀, 한 번 늘리면 세션이 끝날 때까지 실시간으로 못 돌아갔다.
me = mk('A', 0, 30);
W.set([me], me, 0);
t('실시간(0분) 세션에서 +2', W.adjust(2, false) === true && W.state().fPlanMin === 2);
t('실시간 세션도 원래대로로 0분 복귀', W.adjust(-2, false) === true && W.state().fPlanMin === 0);

// ── d == 0 / 세션 없음 ────────────────────────────────────────────────────
t('0분 조절은 무시', W.adjust(0, false) === false);

console.log(fail ? `\n${fail}/${ran} FAILED` : `\n${ran}/${ran} 통과`);
process.exit(fail ? 1 : 0);
