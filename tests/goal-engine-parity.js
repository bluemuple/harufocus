/* 장기 목표 엔진의 **앱 파리티** (요청 2026-07-27: 웹에서도 만들기).
   앱 쪽 대응: SundialTests/GoalEngineTests.swift — 같은 케이스·같은 기대값.
   실행: node tests/goal-engine-parity.js */
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
/* ⚠ i18n 도입(2026-07-30) 뒤 goalRangeLabel이 전역 IS_KO를 읽는다 — 함수만
   뽑아 eval하는 이 하네스엔 그 전역이 없어 ReferenceError로 죽었다.
   여기서 **언어를 직접 세운다**: 아래 케이스들은 앱의 한국어 기대값과
   맞춘 것이라 기본은 한국어로 두고, 끝에서 영어로 한 번 더 돌려
   '영어에서도 안 죽는지'를 본다(문구까지 고정하면 카피 손볼 때마다 깨진다). */
var IS_KO = true;
function L(ko, en) { return IS_KO ? ko : (en || ko); }
/* ⚠ i18n(2026-07-30) 뒤 goalRangeLabel의 의존성이 늘었다: 단위 표기를
   goalUnitShort에 위임하고, 그 함수는 다시 두 매핑 테이블을 읽는다
   (키 '쪽'을 저장하고 **화면에만** 언어를 입히는 구조).
   함수만 뽑던 하네스로는 테이블을 못 가져와 ReferenceError로 죽었다 —
   `var NAME={...};` 형태도 뽑을 수 있게 grabVar를 더한다. */
function grabVar(name) {
  const at = SRC.indexOf('var ' + name + '=');
  if (at < 0) throw new Error('not found: var ' + name);
  let depth = 0;
  for (let j = SRC.indexOf('{', at); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}') { depth--; if (depth === 0) return SRC.slice(at, j + 1) + ';'; }
  }
  throw new Error('unbalanced: var ' + name);
}
eval([grabVar('GOAL_UNIT_EN'), grabVar('GOAL_UNIT_SHORT_EN'),
      grab('goalAmountText'), grab('goalUnitShort'),
      grab('goalSessionDays'), grab('goalRangeLabel')].join('\n'));

let failed = 0;
function eq(a, b, msg) {
  if (a === b) console.log('  ok', msg);
  else { failed++; console.error('  FAIL', msg, '—', JSON.stringify(a), '≠', JSON.stringify(b)); }
}

// ── 1. 스케줄 (앱 testSessionDays): 7/27~8/15 매일 20 · 월~금 15 · 2일에 1번 10.
{
  const S = '2026-07-27T12:00', E = '2026-08-15T12:00';
  eq(goalSessionDays(S, E, 0, 1).length, 20, '매일 = 20일');
  const weekdayMask = [1, 2, 3, 4, 5].reduce((m, d) => m | (1 << d), 0);   // 월~금
  eq(goalSessionDays(S, E, weekdayMask, 1).length, 15, '월~금 = 15일 (GPT 시안 "읽는 날 15회")');
  const e2 = goalSessionDays(S, E, 0, 2);
  eq(e2.length, 10, '2일에 1번 = 10일');
  eq(e2[0].getDate(), 27, '2일에 1번의 기준점 = 시작일');
}

// ── 2. 챕터 라벨 (앱 testChapterRangeLabels — 문자 단위 동일).
{
  eq(goalRangeLabel(0, 2 / 3, 10, '챕터', 0), '1장 0~67%', '챕터 첫날');
  eq(goalRangeLabel(2 / 3, 4 / 3, 10, '챕터', 0), '1장 67%~2장 33%', '챕터 걸침');
  eq(goalRangeLabel(4 / 3, 2, 10, '챕터', 0), '2장 33%~끝', '장 경계 도달');
  eq(goalRangeLabel(2, 3, 10, '챕터', 0), '3장', '통째 한 장');
  eq(goalRangeLabel(2, 4, 10, '챕터', 0), '3~4장', '통째 두 장');
}

// ── 3. 쪽 라벨 (앱 testPageRangeLabels): 연속 보장.
{
  eq(goalRangeLabel(0, 12.5, 250, '쪽', 0), '1~13쪽', '쪽 첫날');
  eq(goalRangeLabel(12.5, 25, 250, '쪽', 0), '13~25쪽', '쪽 둘째 날 (이어짐)');
  eq(goalRangeLabel(237.5, 250, 250, '쪽', 0), '238~250쪽', '쪽 마지막 날');
}

// ── 4. 시간 라벨 (앱 testTimeLabel): 분 = 그날 양, 시간 <1h = 분.
{
  eq(goalRangeLabel(50, 75, 300, '분', 0), '25분', '분 단위');
  eq(goalRangeLabel(0, 0.43, 6, '시간', 0), '26분', '시간 <1h → 분');
  eq(goalRangeLabel(0, 1.5, 6, '시간', 0), '1.5시간', '시간 ≥1h');
}

// ── 5. 범위 오프셋 (앱 testRangeOffset): "3챕터~5챕터" = 3개, 라벨은 3장부터.
{
  eq(goalRangeLabel(0, 1, 3, '챕터', 2), '3장', '오프셋 통째 장');
  eq(goalRangeLabel(0, 1.5, 3, '챕터', 2), '3장 0%~4장 50%', '오프셋 걸침');
  eq(goalRangeLabel(0, 12.5, 151, '쪽', 99), '100~112쪽', '오프셋 쪽 (100쪽부터)');
}

if (failed) { console.error('goal-engine-parity: ' + failed + ' FAILED'); process.exit(1); }
console.log('goal-engine-parity: all passed');

/* 영어 모드 스모크 (i18n 2026-07-30): 문구를 못 박지 않는다 — 카피는 바뀔 수
   있다. **죽지 않고, 한국어가 새어 나오지 않는지**만 본다. */
IS_KO = false;
{
  const out = [
    goalRangeLabel(0, 3, 100, '쪽', 0),
    goalRangeLabel(0, 2, 10, '챕터', 0),
    goalRangeLabel(0, 30, 30, '분', 0),
    goalRangeLabel(0, 1.5, 10, '시간', 0),
  ];
  const leaked = out.filter(t => /[가-힣]/.test(t));
  eq(leaked.length, 0, '영어 모드에 한국어가 안 새어 나온다' +
     (leaked.length ? ' — ' + JSON.stringify(leaked) : ''));
}
IS_KO = true;
