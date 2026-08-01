/* 마감 재정비 — 아직 안 지난 마감선은 절대 건드리지 않는다 (앱 608f979b 이식).
 *
 * ⚠ 앱 신고 재현: 06:10에 Test1(05:10 지남)·Test2(05:51 지남)·수학(06:24,
 * **아직 안 지남**)이 있는 채로 '마감 시간 늦추기'를 누르면, 예전엔 밀린
 * 둘이 수학보다 **앞**에 겹쳐 놓였다(웹은 future를 옮기는 루프 자체가 없어
 * planDueAt이 밀리진 않았지만, 커서가 겹치는지 안 보고 그냥 지금부터
 * 쌓기만 해서 지난 선들의 **블록**이 수학의 블록과 시간상 겹칠 수 있었다).
 *
 * 고친 규칙: 미래(아직 안 지난) 마감선은 **읽기만** 해서 앵커(가장 늦은
 * 것의 마감)만 잡고, 지난 선들은 그 앵커 뒤에 원래 순서대로 서로 안
 * 겹치게 앉는다 — 앱 TaskBlock.reflowLateDues와 같은 규칙.
 *
 * index.html의 **실제 realignDues 함수**를 뽑아 돌린다(todayDueLines·
 * taskDueAt도 함께) — 규칙을 여기 베껴 쓰면 본체가 바뀌어도 통과해 버린다. */
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

let pass = 0, fail = 0;
const t = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? 'PASS  ' : 'FAIL  ') + name); };

// '지금'을 2026-07-31 06:10으로 고정 — 신고 상황 그대로.
const FIXED_NOW = new Date(2026, 6, 31, 6, 10, 0).getTime();
const harness = `
  var RealDate = Date;
  function FixedDate(){
    if (arguments.length === 0) return new RealDate(${FIXED_NOW});
    return new (Function.prototype.bind.apply(RealDate, [null].concat(Array.prototype.slice.call(arguments))))();
  }
  FixedDate.prototype = RealDate.prototype;
  FixedDate.now = function(){ return ${FIXED_NOW}; };
  Date = FixedDate;

  var DATA = { tasks: [] };
  function dateKey(iso){ var d = new RealDate(iso); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function todayKey(){ var d = new RealDate(${FIXED_NOW}); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function L(ko, en){ return ko; }
  function todayFocusSec(){ return 0; }   // 이 테스트에선 '하나도 안 했다' 분기만 본다(len=plan)
  var toastMsgs = [];
  function appToast(msg){ toastMsgs.push(msg); }
  function duePushUndo(){}
  function renderAll(){}
  function pushSnapshot(){}

${grab('taskDueAt')}
${grab('todayDueLines')}
${grab('realignDues')}

  module.exports = { realignDues, setTasks(a){ DATA.tasks = a; }, getTasks(){ return DATA.tasks; }, toastMsgs };
`;
const m = new module.constructor();
m._compile(harness, '/realign-future-safe-harness.js');
const W = m.exports;

const at = (h, min) => new Date(2026, 6, 31, h, min, 0).toISOString();

function mk(id, dueH, dueM, durationMin) {
  // scheduledStart = dueAt - durationMin (앱 pushLateDueLines 이식과 동일 전제).
  const due = new Date(2026, 6, 31, dueH, dueM, 0).getTime();
  return {
    id, title: id, categoryID: 'focus',
    scheduledStart: new Date(due - durationMin * 60000).toISOString(),
    durationMin, createdDurationMin: durationMin,
    planDueAt: null, isDone: false, isRewardItem: false,
  };
}

// ── ① 신고 상황 그대로: Test1(05:10 지남,40분) · Test2(05:51 지남,30분) ·
//    수학(06:24, 아직 안 지남,40분 → 05:44~06:24) ────────────────────────
{
  W.setTasks([
    mk('t1', 5, 10, 40),   // 04:30~05:10
    mk('t2', 5, 51, 30),   // 05:21~05:51
    mk('math', 6, 24, 40), // 05:44~06:24 — 아직 안 지남(06:10 기준)
  ]);
  const mathBefore = JSON.stringify(W.getTasks().find(x => x.id === 'math'));
  W.realignDues();
  const tasks = W.getTasks();
  const math = tasks.find(x => x.id === 'math');
  const t1 = tasks.find(x => x.id === 't1');
  const t2 = tasks.find(x => x.id === 't2');

  t('⚠⚠ 핵심: 아직 안 지난 수학은 손 하나 안 댄다(scheduledStart·durationMin·planDueAt 그대로)',
    JSON.stringify(math) === mathBefore);

  const mathDue = new Date(2026, 6, 31, 6, 24, 0).getTime();
  const t1Start = new Date(t1.scheduledStart).getTime();
  const t1Due = new Date(t1.planDueAt).getTime();
  const t2Start = new Date(t2.scheduledStart).getTime();
  const t2Due = new Date(t2.planDueAt).getTime();

  t('Test1은 수학의 마감(06:24) 이후에 시작한다 — 그 앞은 이미 지킨 약속의 자리',
    t1Start >= mathDue);
  t('Test2도 수학의 마감(06:24) 이후에 시작한다', t2Start >= mathDue);
  t('Test1·Test2는 원래 순서(오래된 것 먼저)를 유지한다', t1Due <= t2Start);
  t('Test1·Test2는 서로 겹치지 않는다', t1Due <= t2Start || t2Due <= t1Start);
}

// ── ② 미래 마감선이 아예 없으면 앵커는 그냥 '지금' ──────────────────────
{
  W.setTasks([
    mk('t1', 5, 10, 40),   // 04:30~05:10, 지남
  ]);
  W.realignDues();
  const t1 = W.getTasks().find(x => x.id === 't1');
  t('미래 마감선이 없으면 지금(06:10)부터 시작한다',
    new Date(t1.scheduledStart).getTime() === FIXED_NOW);
}

// ── ③ 미래 마감선이 여럿이면 '가장 늦은 것' 뒤가 앵커 ───────────────────
{
  W.setTasks([
    mk('t1', 5, 10, 30),     // 지남
    mk('soon', 6, 30, 20),   // 미래, 06:10~06:30
    mk('late', 8, 0, 30),    // 미래, 가장 늦음 — 07:30~08:00
  ]);
  W.realignDues();
  const t1 = W.getTasks().find(x => x.id === 't1');
  const lateDue = new Date(2026, 6, 31, 8, 0, 0).getTime();
  t('여러 미래 마감선 중 가장 늦은 것(08:00) 뒤에서 시작한다',
    new Date(t1.scheduledStart).getTime() >= lateDue);
}

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (realign-future-safe)`);
process.exit(fail ? 1 : 0);
