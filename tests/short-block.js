/* 2분 미만 집중은 타임라인에 블록을 그리지 않는다 (요청: 처음 5분이었다가
 * "재생했는데 흔적이 없다"는 당황 때문에 낮췄다).
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
// 병합 한도도 **본체에서 뽑는다** — 여기 베껴 쓰면 본체가 바뀌어도 통과한다.
const MERGE = eval(/var MERGE_GAP_MS\s*=\s*([^;]+);/.exec(html)[1]);

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
  'fTask', 'fStart', 'SHORT_FOCUS_SEC', 'MERGE_GAP_MS',
  grab('dayRecordBlocks') + '; return dayRecordBlocks;'
)(ctx.DATA, ctx.allSessions, ctx.dateKey, ctx.todayKey, ctx.keepShortBlocks,
  null, 0, SHORT, MERGE);

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

is(SHORT, 120, '기준은 120초(2분) — 앱 FocusManager.shortBlockMinSec와 같은 값');
is(MERGE, 15 * 60 * 1000, '병합 한도는 15분 — 앱 FocusManager.mergeGapMaxSec와 같은 값');

// ① 1분 집중 → 안 그린다
DATA.sessions = [sess(0, 60, 1)];
DATA.settings = {};
is(dayRecordBlocks(key).length, 0, '1분 집중은 블록을 안 그린다');

// ② 정확히 2분 → 그린다 (경계는 '미만'이므로 2분은 남는다)
DATA.sessions = [sess(0, 120, 2)];
is(dayRecordBlocks(key).length, 1, '정확히 2분은 그린다 (미만이 아니다)');

// ③ 1분 59초 → 안 그린다
DATA.sessions = [sess(0, 119, 2)];
is(dayRecordBlocks(key).length, 0, '1분 59초는 안 그린다');

// ③-2 ⚠ 5분→2분으로 낮춘 이유가 이 경계에 있다 — 3~4분 한 건은 남는다.
DATA.sessions = [sess(0, 180, 3)];
is(dayRecordBlocks(key).length, 1, '3분은 이제 남는다');

// ④ 설정을 켜면 1분짜리도 돌아온다 (지나간 기록까지)
DATA.sessions = [sess(0, 60, 1)];
DATA.settings = { keepShortBlocks: true };
is(dayRecordBlocks(key).length, 1, '설정을 켜면 짧은 기록도 다시 보인다');

// ⑤ ⚠ 기준은 **집중한 시간**이지 통의 길이가 아니다:
//    3분 집중 + 10분 쉼은 통이 13분이라 안 지저분하지만 '수행'은 3분이다.
DATA.settings = {};
DATA.sessions = [sess(0, 60, 13)];
is(dayRecordBlocks(key).length, 0, '통이 13분이어도 집중이 1분이면 안 그린다');

// ⑥ 짧은 세션 둘이 15분 안에 이어지면 합쳐서 판단한다 (1분+1분=2분 → 그린다)
DATA.sessions = [sess(0, 60, 1), sess(10, 60, 1)];
is(dayRecordBlocks(key).length, 1, '1분+1분이 한 블록으로 합쳐지면 2분이라 그린다');
const merged = dayRecordBlocks(key)[0];
is(merged.foc, 120, '합쳐진 블록의 집중 초는 두 세션의 합');
is(merged.rest.length, 1, '두 세션 사이 7분 공백은 쉼(빗금)으로 남는다');

// ⑦ 갭이 15분을 넘으면 안 합쳐지고, 각각 1분이라 둘 다 사라진다
DATA.sessions = [sess(0, 60, 1), sess(40, 60, 1)];
is(dayRecordBlocks(key).length, 0, '15분 넘게 떨어진 1분짜리 둘은 각각 사라진다');

// ⑦-2 ⚠ 병합 한도 경계 (앱 FocusManager.mergeGapMaxSec와 한 쌍):
//      공백 14분은 합쳐지고, 16분은 안 합쳐진다.
DATA.sessions = [sess(0, 60, 1), sess(15, 60, 1)];   // 1분 끝 → 15분 시작 = 공백 14분
is(dayRecordBlocks(key).length, 1, '공백 14분은 한 블록으로 합쳐진다');
DATA.sessions = [sess(0, 60, 1), sess(17, 60, 1)];   // 공백 16분
is(dayRecordBlocks(key).length, 0, '공백 16분은 안 합쳐져 각각 사라진다');

// ⑧ 다른 작업이 사이에 끼면 병합하지 않는다 (기존 규칙 회귀 방지)
DATA.sessions = [sess(0, 60, 1), sess(5, 600, 10, 't2'), sess(20, 60, 1)];
const r8 = dayRecordBlocks(key);
is(r8.length, 1, '사이에 다른 작업이 있으면 안 합쳐져 1분짜리 둘은 사라지고 10분짜리만 남는다');
is(r8[0].taskID, 't2', '남은 건 10분 집중한 작업');


/* ── 겹침 규칙: 이름은 왼쪽, 블록은 오른쪽 (2026-07-23 요청) ──────────────
   ⚠ **자기 블록도 예외가 아니다**. 예전엔 '자기 블록이 덮으면 이름을 통째로
   지운다'는 별도 규칙이 있어 같은 화면에 두 방식이 섞였다(앱도 같았다).
   앱 `TimelineScrollView.dueNarrowed/blockNarrowed`와 한 쌍. */
{
  const computeNarrow = new Function(
    'dueNarrowIds', 'DUE_SLACK', 'DUE_BAND_H',
    grab('computeNarrow') + '; return computeNarrow;')({}, 8, 20);

  // 자기 마감선(y=100) 바로 위에 붙은 자기 블록
  let r = computeNarrow([{ id: 'a', y: 100 }], [{ key: 'a', top: 40, bottom: 99 }], []);
  is(!!r.due.a, true, '자기 블록도 마감선 이름을 왼쪽으로 좁힌다');
  is(!!r.blk.a, true, '자기 블록이 오른쪽으로 물러난다');

  // 멀리 떨어진 블록은 건드리지 않는다
  r = computeNarrow([{ id: 'a', y: 100 }], [{ key: 'a', top: 200, bottom: 260 }], []);
  is(!!r.due.a || !!r.blk.a, false, '안 겹치면 그대로 둔다');
}

console.log(fail ? `\n${fail}개 실패, ${pass}개 통과` : `${pass}개 통과 (short-block)`);
process.exit(fail ? 1 : 0);

