/* '마감 시간 늘리기' (meDeadlineTap push) — 앱 4fc67771 이식(TaskBlock.
 * pushDueLater)의 회귀 테스트.
 *
 * ⚠ 예전 버그: durationMin만 고치고 planDueAt은 그대로 둬서, 화면의 마감선
 * (taskDueAt은 planDueAt을 최우선으로 읽는다)이 버튼을 눌러도 **얼어붙은
 * 채** 안 움직였다. 앱은 이게 "durationMin이 몇 시간으로 부풀어 타이머가
 * 736:30까지 흐르는" 폭주로 드러났지만, 웹의 durationMin은 '오늘 목표 분'
 * (goalRemainMin)이라 그 폭주는 없다 — 그래도 "버튼을 눌러도 타임라인의
 * 마감선이 그대로다"는 같은 결함이라 이식한다.
 *
 * index.html의 **실제 pushDueLater**를 뽑아 돌린다 — 규칙을 여기 베껴 쓰면
 * 본체가 바뀌어도 테스트가 통과해 버린다. */
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
${grab('pushDueLater')}
module.exports = { pushDueLater };
`;
const m = new module.constructor();
m._compile(harness, '/push-due-later-harness.js');
const { pushDueLater } = m.exports;

let pass = 0, fail = 0;
const t = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? 'PASS  ' : 'FAIL  ') + name); };

const NOW = Date.parse('2026-07-31T09:00:00.000Z');
const iso = (msOffset) => new Date(NOW + msOffset).toISOString();

// ① 이미 지난 마감(계획-전용, 집중 기록 없음) — 지금+30분으로 다시 앉히고,
//    블록(scheduledStart)도 지금부터 30분으로 재배치한다.
{
  const task = { scheduledStart: iso(-6 * 3600000), durationMin: 30,
                 planDueAt: iso(-3 * 3600000), actualFocusedSec: 0, isDone: false };
  pushDueLater(task, NOW);
  t('지난 마감 + 계획-전용 → planDueAt이 지금+30분', task.planDueAt === iso(30 * 60000));
  t('지난 마감 + 계획-전용 → scheduledStart도 지금으로', task.scheduledStart === iso(0));
  t('지난 마감 + 계획-전용 → durationMin도 30으로 재설정', task.durationMin === 30);
}

// ② 이미 지난 마감인데 **집중 기록이 있다** — 마감선(planDueAt)만 옮기고
//    블록(scheduledStart/durationMin)은 손대지 않는다(기록을 보존).
{
  const task = { scheduledStart: iso(-6 * 3600000), durationMin: 45,
                 planDueAt: iso(-3 * 3600000), actualFocusedSec: 900, isDone: false };
  pushDueLater(task, NOW);
  t('지난 마감 + 집중 기록 있음 → planDueAt은 지금+30분', task.planDueAt === iso(30 * 60000));
  t('지난 마감 + 집중 기록 있음 → scheduledStart는 그대로', task.scheduledStart === iso(-6 * 3600000));
  t('지난 마감 + 집중 기록 있음 → durationMin은 그대로', task.durationMin === 45);
}

// ③ ⚠⚠ 핵심 — 아직 안 지난 마감: durationMin만 늘리면 화면(taskDueAt)이
//    그대로다. planDueAt도 같이 옮겨야 마감선이 실제로 움직인다.
{
  const task = { scheduledStart: iso(0), durationMin: 30, planDueAt: iso(30 * 60000) };
  pushDueLater(task, NOW);
  t('안 지난 마감 → durationMin 30분 늘어남', task.durationMin === 60);
  t('⚠안 지난 마감 → planDueAt도 30분 늦춰져야 한다(예전 버그: 얼어붙음)',
    task.planDueAt === iso(60 * 60000));
}

// ④ 여러 번 누르면 계속 밀린다 (요청 의도) — 두 번째 호출은 이미 미래인
//    첫 결과 위에서 또 30분을 더한다.
{
  const task = { scheduledStart: iso(0), durationMin: 30, planDueAt: iso(30 * 60000) };
  pushDueLater(task, NOW);
  pushDueLater(task, NOW);
  t('연타 → durationMin 60분 더 늘어남(총 +60)', task.durationMin === 90);
  t('연타 → planDueAt도 그만큼 계속 밀림', task.planDueAt === iso(90 * 60000));
}

// ⑤ 타임라인에 없는(scheduledStart 없는) 순수 목표 작업 — 표시할 마감선이
//    없으므로 durationMin만 늘고 planDueAt은 안 생긴다.
{
  const task = { scheduledStart: null, durationMin: 25, planDueAt: null };
  pushDueLater(task, NOW);
  t('미배치 작업 → durationMin만 늘어남', task.durationMin === 55);
  t('미배치 작업 → planDueAt은 여전히 없음', task.planDueAt === null);
}

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (push-due-later-parity)`);
process.exit(fail ? 1 : 0);
