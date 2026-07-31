/* 할일 줄 D-day 캡슐 + 캡슐 재정렬 — 앱 27dc5714 이식(TaskDdayTests.swift와
 * 같은 시나리오: 자정 기준 날짜 차이·자정 경계·시간대 무관).
 *
 * ⚠ 자정 기준 날짜 차이로만 잰다(시각은 안 본다) — 상단바 전역 D-day
 * 캡슐(capContent의 'dday' 분기)과 **같은 계산**을 ddayDiffDays로 공유한다.
 * 지난 것(D+)은 주황 — 이 앱은 나무라지 않으니 빨강은 안 쓴다.
 *
 * index.html의 **실제 ddayDiffDays·ddayShortLabel·ddayCapsule**을 뽑아
 * 돌린다 — 규칙을 여기 베껴 쓰면 본체가 바뀌어도 테스트가 통과해 버린다. */
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
  var IS_KO = true;
  function L(ko, en) { return IS_KO ? ko : (en || ko); }
  function esc(s) { return String(s == null ? '' : s); }
${grab('ddayDiffDays')}
${grab('ddayShortLabel')}
${grab('ddayCapsule')}
  module.exports = { ddayDiffDays, ddayShortLabel, ddayCapsule, setKo(v){ IS_KO = v; } };
`;
const m = new module.constructor();
m._compile(harness, '/dday-capsule-harness.js');
const W = m.exports;

let pass = 0, fail = 0;
const t = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? 'PASS  ' : 'FAIL  ') + name); };

// ── 기본 세 갈래 — 오늘=D-day, 내일=D-1, 어제=D+1 ──────────────────────
{
  const now = new Date();
  t('오늘 = D-day (0)', W.ddayDiffDays(now, now) === 0 && W.ddayShortLabel(0) === 'D-day');
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  t('내일 = D-1', W.ddayDiffDays(now, tomorrow) === 1 && W.ddayShortLabel(1) === 'D-1');
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  t('어제 = D+1', W.ddayDiffDays(now, yesterday) === -1 && W.ddayShortLabel(-1) === 'D+1');
}

// 요청 예시 그대로: 10일 남음 = "D-10", 3일 지남 = "D+3".
{
  const now = new Date();
  const in10 = new Date(now); in10.setDate(in10.getDate() + 10);
  const ago3 = new Date(now); ago3.setDate(ago3.getDate() - 3);
  t('10일 남음 → D-10', W.ddayShortLabel(W.ddayDiffDays(now, in10)) === 'D-10');
  t('3일 지남 → D+3', W.ddayShortLabel(W.ddayDiffDays(now, ago3)) === 'D+3');
}

// ── 자정 경계 — 하루가 튀면 안 된다 ─────────────────────────────────────
{
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const justBefore = new Date(today.getTime() + 23 * 3600000 + 59 * 60000);   // 오늘 23:59
  const justAfter = new Date(today.getTime() + 24 * 3600000 + 60000);          // 내일 00:01
  t('⚠ 실제 시간차는 2분뿐이지만 날짜가 바뀌었으니 D-1', W.ddayDiffDays(justBefore, justAfter) === 1);
  t('반대 방향은 D+1(이미 지남)', W.ddayDiffDays(justAfter, justBefore) === -1);
}
{
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const early = new Date(today.getTime() + 60000);                 // 오늘 00:01
  const late = new Date(today.getTime() + 23 * 3600000 + 59 * 60000);   // 오늘 23:59
  t('같은 날 안에서는 새벽~밤이어도 항상 D-day', W.ddayDiffDays(early, late) === 0
    && W.ddayDiffDays(late, early) === 0);
}

// ── ddayCapsule: dueDate 없으면 빈 문자열, 있으면 라벨·색 문법 ──────────
t('dueDate 없으면 캡슐 없음', W.ddayCapsule({ dueDate: null }) === '');
{
  const now = new Date();
  const overdue = new Date(now); overdue.setDate(overdue.getDate() - 3);
  const html = W.ddayCapsule({ dueDate: overdue.toISOString() });
  t('지난 마감(D+) → 주황(#FF9500), 빨강 아님', /#FF9500/.test(html) && !/red|#f00|#ff0000/i.test(html));
  t('지난 마감 캡슐 텍스트 = D+3', />D\+3</.test(html));
}
{
  const html = W.ddayCapsule({ dueDate: new Date().toISOString() });
  t('오늘 마감 → D-day 텍스트', />D-day</.test(html));
}

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (dday-capsule-parity)`);
process.exit(fail ? 1 : 0);
