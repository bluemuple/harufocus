/* '다음 작업'에 하한이 없어 지난 마감선이 뽑히던 버그 — 앱 d51b12b0 이식
 * (SundialTests/NextBlockPickTests.swift와 같은 시나리오).
 *
 * 앱 신고 그대로: "Test1을 누르면 다음 데드라인인 Test2가 떠야 하는데
 * 지난 작업이 뜬다." 원인은 웹의 nextDueTask()도 앱의 adjacentNext와 같은
 * 모양이었다 — `dm>myDue`만 보고 하한(지금)이 없었다. myDue(내 마감)가
 * 계획 시간을 다 써서 **과거가 되는 바로 그 순간**(집중 화면이 '다음'을
 * 찾는 그 순간)부터, myDue~지금 사이의 '이미 지난' 마감선이 dm>myDue를
 * 통과해 '다음' 후보로 새어 들어온다.
 *
 * index.html의 **실제 nextDueTask·taskDueAt·isPlanOnly·dateKey**를 뽑아
 * 돌린다 — 규칙을 여기 베껴 쓰면 본체가 바뀌어도 테스트가 통과해 버린다.
 * ⚠ todayKey()만 실제 시계에 묶여 있어(오늘 날짜에 따라 결과가 흔들린다)
 * 고정된 '오늘'을 돌려주는 대역으로 바꾼다 — dateKey와 **같은 식**
 * (getFullYear+'-'+(getMonth()+1)+'-'+getDate())을 고정 날짜에 적용했을
 * 뿐이라 실제 계약은 그대로다. Date.now()도 같은 이유로 고정한다. */
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

// 2026-07-31 고정 — dateKey와 같은 식을 이 날짜에 적용.
const FIXED_TODAY = new Date(2026, 6, 31);
const TODAY_KEY = FIXED_TODAY.getFullYear() + '-' + (FIXED_TODAY.getMonth() + 1) + '-' + FIXED_TODAY.getDate();
// 09:10 — myDue(09:00)를 이미 10분 지난 '0 도달' 순간.
const NOW = new Date(2026, 6, 31, 9, 10, 0).getTime();

const harness = `
  var DATA = { tasks: [] }, fTask = null;
  function todayKey(){ return ${JSON.stringify(TODAY_KEY)}; }
  Date.now = function(){ return ${NOW}; };   // 이 프로세스 안에서만 고정
${grab('taskDueAt')}
${grab('isPlanOnly')}
${grab('dateKey')}
${grab('nextDueTask')}
  module.exports = {
    nextDueTask,
    setFTask(t){ fTask = t; },
    setTasks(a){ DATA.tasks = a; },
  };
`;
const m = new module.constructor();
m._compile(harness, '/next-task-harness.js');
const W = m.exports;

let pass = 0, fail = 0;
const t = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? 'PASS  ' : 'FAIL  ') + name); };

const at = (h, min) => new Date(2026, 6, 31, h, min, 0).toISOString();

// 신고 상황 재현: myDue(09:00)를 지난 09:10. Test1(내 작업)의 마감은 09:00,
// 지난 작업(A)의 마감은 09:05(=myDue보다는 늦지만 이미 지났다), 진짜 다음
// 작업(B)의 마감은 09:30(아직 안 왔다).
const myTask = { id: 'F', scheduledStart: at(8, 30), durationMin: 30, planDueAt: at(9, 0), isDone: false };
const stalePast = { id: 'A', scheduledStart: at(8, 40), durationMin: 25, planDueAt: at(9, 5), isDone: false };
const realNext = { id: 'B', scheduledStart: at(9, 20), durationMin: 10, planDueAt: at(9, 30), isDone: false };

W.setFTask(myTask);
W.setTasks([myTask, stalePast, realNext]);
let picked = W.nextDueTask();
t('⚠⚠ 핵심: myDue 이후지만 이미 지난 마감선(A)이 아니라 진짜 미래(B)를 고른다',
  picked && picked.id === 'B');

// A만 있으면(진짜 다음이 없으면) 아무것도 못 고른다 — 지난 마감선을 대신
// 내주면 안 된다.
W.setTasks([myTask, stalePast]);
t('진짜 다음이 없으면 지난 마감선을 대신 내주지 않는다(null)', W.nextDueTask() === null);

// 경계: 정확히 now-60초는 아직 '지났다'로 친다(포함 안 됨) — 그 1초 뒤는 포함.
const boundaryExact = { id: 'C', scheduledStart: at(8, 50), durationMin: 19, planDueAt: at(9, 9), isDone: false };     // 09:09:00 = now-60s
const boundaryPass = { id: 'D', scheduledStart: at(8, 50), durationMin: 19, planDueAt: new Date(at(9, 9)).getTime() + 1000, isDone: false }; // 09:09:01
boundaryPass.planDueAt = new Date(boundaryPass.planDueAt).toISOString();
W.setTasks([myTask, boundaryExact]);
t('경계: now-60초 정각은 아직 제외', W.nextDueTask() === null);
W.setTasks([myTask, boundaryPass]);
t('경계: now-60초를 1초라도 넘으면 포함', W.nextDueTask() && W.nextDueTask().id === 'D');

// 하루 필터는 그대로 — 다른 날짜(내일) 마감선은 여전히 제외된다(회귀 방지).
const tomorrow = { id: 'E', scheduledStart: new Date(2026, 7, 1, 9, 0).toISOString(), durationMin: 30,
                   planDueAt: new Date(2026, 7, 1, 9, 30).toISOString(), isDone: false };
W.setTasks([myTask, tomorrow]);
t('다른 날짜(내일) 마감선은 여전히 제외', W.nextDueTask() === null);

// isPlanOnly 가드도 그대로 살아있는지(집중 기록 있는 건 후보에서 빠진다).
const alreadyFocused = { id: 'G', scheduledStart: at(9, 20), durationMin: 10, planDueAt: at(9, 30),
                         isDone: false, actualFocusedSec: 300 };
W.setTasks([myTask, alreadyFocused]);
t('집중 기록이 있는 작업은 계획-전용이 아니라 후보에서 빠진다', W.nextDueTask() === null);

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (next-task-lower-bound)`);
process.exit(fail ? 1 : 0);
