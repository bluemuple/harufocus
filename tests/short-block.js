/* 5분 미만 집중은 타임라인에 블록을 그리지 않는다 (요청).
 *
 * ⚠ 앱 `SundialTests/ShortBlockTests.swift`와 **한 쌍**이다. 어느 한쪽 규칙을
 * 고치면 두 파일을 같이 고쳐야 한다.
 *
 * index.html에서 dayRecordBlocks의 **실제 소스**를 뽑아 돌린다 — 규칙을 여기에
 * 베껴 쓰면 본체가 바뀌어도 테스트가 통과해 버린다. */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function grab(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('함수를 못 찾음: ' + name);
  let i = html.indexOf('{', start), depth = 0;
  for (let j = i; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(start, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
const SHORT = +/var SHORT_FOCUS_SEC\s*=\s*(\d+)/.exec(html)[1];

// dayRecordBlocks가 기대는 전역들을 흉내낸다.
let DATA = { settings: {}, sessions: [] };
let fTask = null, fStart = 0;
const ctx = {
  DATA, SHORT_FOCUS_SEC: SHORT,
  allSessions: () => DATA.sessions,
  dateKey: (iso) => new Date(iso).toISOString().slice(0, 10),
  todayKey: () => 'X',                      // 활성 세션 분기는 안 탄다
  keepShortBlocks: () => !!(DATA.settings && DATA.settings.keepShortBlocks),
  get fTask() { return fTask; }, get fStart() { return fStart; },
};
const dayRecordBlocks = new Function(
  'DATA', 'allSessions', 'dateKey', 'todayKey', 'keepShortBlocks',
  'fTask', 'fStart', 'SHORT_FOCUS_SEC',
  grab('dayRecordBlocks') + '; return dayRecordBlocks;'
)(ctx.DATA, ctx.allSessions, ctx.dateKey, ctx.todayKey, ctx.keepShortBlocks,
  null, 0, SHORT);

let pass = 0, fail = 0;
function is(got, want, label) {
  if (got === want) { pass++; return; }
  fail++; console.error(`✗ ${label}\n    got  ${got}\n    want ${want}`);
}

const DAY = '2026-07-21';
function sess(startMin, focusedSec, spanMin, taskID = 't1') {
  const s = new Date(`${DAY}T09:00:00.000Z`).getTime() + startMin * 60000;
  return { id: 's' + startMin, taskID, taskTitle: '국어', categoryID: 'focus',
           start: new Date(s).toISOString(),
           end: new Date(s + spanMin * 60000).toISOString(), focusedSec };
}
const key = new Date(`${DAY}T09:00:00.000Z`).toISOString().slice(0, 10);

is(SHORT, 300, '기준은 300초(5분) — 앱 FocusManager.shortBlockMinSec와 같은 값');

// ① 3분 집중 → 안 그린다
DATA.sessions = [sess(0, 180, 3)];
DATA.settings = {};
is(dayRecordBlocks(key).length, 0, '3분 집중은 블록을 안 그린다');

// ② 정확히 5분 → 그린다 (경계는 '미만'이므로 5분은 남는다)
DATA.sessions = [sess(0, 300, 5)];
is(dayRecordBlocks(key).length, 1, '정확히 5분은 그린다 (미만이 아니다)');

// ③ 4분 59초 → 안 그린다
DATA.sessions = [sess(0, 299, 5)];
is(dayRecordBlocks(key).length, 0, '4분 59초는 안 그린다');

// ④ 설정을 켜면 3분짜리도 돌아온다 (지나간 기록까지)
DATA.sessions = [sess(0, 180, 3)];
DATA.settings = { keepShortBlocks: true };
is(dayRecordBlocks(key).length, 1, '설정을 켜면 짧은 기록도 다시 보인다');

// ⑤ ⚠ 기준은 **집중한 시간**이지 통의 길이가 아니다:
//    3분 집중 + 10분 쉼은 통이 13분이라 안 지저분하지만 '수행'은 3분이다.
DATA.settings = {};
DATA.sessions = [sess(0, 180, 13)];
is(dayRecordBlocks(key).length, 0, '통이 13분이어도 집중이 3분이면 안 그린다');

// ⑥ 짧은 세션 둘이 30분 안에 이어지면 합쳐서 판단한다 (3분+3분=6분 → 그린다)
DATA.sessions = [sess(0, 180, 3), sess(10, 180, 3)];
is(dayRecordBlocks(key).length, 1, '3분+3분이 한 블록으로 합쳐지면 6분이라 그린다');
const merged = dayRecordBlocks(key)[0];
is(merged.foc, 360, '합쳐진 블록의 집중 초는 두 세션의 합');
is(merged.rest.length, 1, '두 세션 사이 7분 공백은 쉼(빗금)으로 남는다');

// ⑦ 갭이 30분을 넘으면 안 합쳐지고, 각각 3분이라 둘 다 사라진다
DATA.sessions = [sess(0, 180, 3), sess(40, 180, 3)];
is(dayRecordBlocks(key).length, 0, '30분 넘게 떨어진 3분짜리 둘은 각각 사라진다');

// ⑧ 다른 작업이 사이에 끼면 병합하지 않는다 (기존 규칙 회귀 방지)
DATA.sessions = [sess(0, 180, 3), sess(5, 600, 10, 't2'), sess(20, 180, 3)];
const r8 = dayRecordBlocks(key);
is(r8.length, 1, '사이에 다른 작업이 있으면 안 합쳐져 3분짜리 둘은 사라지고 10분짜리만 남는다');
is(r8[0].taskID, 't2', '남은 건 10분 집중한 작업');

console.log(fail ? `\n${fail}개 실패, ${pass}개 통과` : `${pass}개 통과 (short-block)`);
process.exit(fail ? 1 : 0);
