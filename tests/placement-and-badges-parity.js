/* 두 항목 묶음 — 둘 다 앱 4fc67771/27dc5714 이식 대상이지만 웹엔 이미
 * 규칙이 있었거나(①) 이번에 이식했다(②):
 *
 * ① 마감 배치(nextSlotToday) — 앱 TaskBlock.nextPlacementStart와 같은 의도
 *    ("새 블록이 들어갈 첫 틈에서 멈춘다, 맨 뒤로 밀지 않는다"). 웹의
 *    nextSlotToday는 조사해 보니 **이미** 이 규칙으로 짜여 있었다 — 새로
 *    고친 게 아니라 "이미 되어 있음"을 잠그는 회귀 테스트다.
 * ② 할일 줄 캡슐 순서 — 앱 27dc5714 이식(요청 4: 언제까지(D-day) > 얼마나
 *    (길이) > 타임라인 > 사분면 … > 몇 조각). buildTodoRow의 실제 조립
 *    순서를 정규식으로 못 박고, subtaskCountHTML의 동작을 직접 검증한다.
 *
 * index.html의 **실제 함수**를 뽑아 돌린다 — 규칙을 여기 베껴 쓰면 본체가
 * 바뀌어도 테스트가 통과해 버린다. */
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

// ── ① nextSlotToday: 첫 빈 틈에서 멈춘다(맨 뒤로 밀지 않는다) ───────────
// '지금'을 07:00으로 고정 — nextSlotToday는 인자 없는 `new Date()`로
// 지금을 읽으므로, Date 생성자 자체를 대역으로 바꾼다(Date.now만으론
// 부족하다). 인자가 있는 호출(new Date(isoString) 등)은 그대로 실제
// 파싱에 위임하고, 인자가 없을 때만 고정 시각을 돌려준다.
{
  const FIXED_NOW = new Date(2026, 6, 31, 7, 0, 0).getTime();   // 2026-07-31 07:00
  const harness = `
    var RealDate = Date;
    function FixedDate(){
      if (arguments.length === 0) return new RealDate(${FIXED_NOW});
      return new (Function.prototype.bind.apply(RealDate, [null].concat(Array.prototype.slice.call(arguments))))();
    }
    FixedDate.prototype = RealDate.prototype;
    Date = FixedDate;
    var DATA = { tasks: [] };
    function dateKey(iso){ var d = new RealDate(iso); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
    function todayKey(){ var d = new RealDate(${FIXED_NOW}); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
    var TS = 6, TE = 24;
${grab('nextSlotToday')}
    module.exports = { nextSlotToday, setTasks(a){ DATA.tasks = a; } };
  `;
  const m = new module.constructor();
  m._compile(harness, '/next-slot-harness.js');
  const W = m.exports;

  const at = (h, min) => new Date(2026, 6, 31, h, min, 0).toISOString();

  // 앱 신고 재현: 지금 07:00, 마감이 08:30·09:00이어도 09:30(마지막 마감선
  // 뒤)에 놓이면 안 된다 — 07:00~08:00 사이의 빈 자리(1시간, 45분 문턱을
  // 넘는다)를 먼저 찾아야 한다.
  W.setTasks([
    { scheduledStart: at(8, 0), durationMin: 30 },   // 8:00~8:30
    { scheduledStart: at(8, 30), durationMin: 30 },  // 8:30~9:00
  ]);
  t('⚠⚠ 핵심: 지금(7:00)과 첫 마감선(8:00) 사이가 넓게 비면 거기서 멈춘다(맨 뒤 9:00행이 아니다)',
    W.nextSlotToday(true) === 7);

  // 틈이 45분(0.75h) 문턱보다 작으면 그 마감선을 넘어 계속 걸어간다.
  W.setTasks([
    { scheduledStart: at(7, 0), durationMin: 15 },   // 7:00~7:15
    { scheduledStart: at(7, 30), durationMin: 30 },  // 7:30~8:00 (7:15~7:30 틈=15분<45분)
  ]);
  t('틈이 문턱보다 작으면 넘어가서 다음 빈 자리(여기선 마지막 마감선 뒤)로', W.nextSlotToday(true) === 8);

  // 완료된 마감선도 자리를 차지한다(취소선으로 타임라인에 남으므로) —
  // 앱과 같은 기준(완료 여부와 무관하게 훑는다).
  W.setTasks([{ scheduledStart: at(7, 0), durationMin: 60, isDone: true }]);
  t('완료된 작업도 오늘 자리를 차지한다(완료 여부 무관)', W.nextSlotToday(true) === 8);
}

// ── ② 할일 줄 캡슐 순서 (요청 4: D-day > 길이 > 타임라인 > … > 몇 조각) ──
{
  const line = SRC.slice(SRC.indexOf("'<div class=\"t-main\">"), SRC.indexOf("memoIconHTML(t)+"));
  t('캡슐 조립 순서 = D-day → 길이(duration) → 타임라인 → 매트릭스 외(taskMetaHTML) → 몇 조각',
    /ddayCapsule\(t\)\s*\+\s*goalLabelHTML\(t\)\s*\+\s*tlBadgeHTML\(t\)\s*\+\s*taskMetaHTML\(t\)\s*\+\s*subtaskCountHTML\(subs\.length\)/.test(line));
}
{
  const harness = `
    var IS_KO = true;
    function L(ko, en) { return IS_KO ? ko : (en || ko); }
    function esc(s) { return String(s == null ? '' : s); }
    var IC = { steps: '<svg class="ic-steps"></svg>' };
${grab('subtaskCountHTML')}
    module.exports = { subtaskCountHTML };
  `;
  const m = new module.constructor();
  m._compile(harness, '/subtask-count-harness.js');
  const W = m.exports;

  t('하위 작업이 없으면(0) 캡슐 없음', W.subtaskCountHTML(0) === '');
  const html = W.subtaskCountHTML(3);
  t('하위 작업 3개 → 캡슐에 개수 3 표기', />3</.test(html));
  t('새 기호를 만들지 않고 기존 IC.steps 아이콘을 재사용한다', /ic-steps/.test(html));
}

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (placement-and-badges-parity)`);
process.exit(fail ? 1 : 0);
