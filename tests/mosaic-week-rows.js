/* 주간 모자이크 행 압축 + 주 시작 순서 — 유저 확정 스펙(2026-08-04):
 *   · 과거(지금 행 이전) = **집중이 있는 행만** 시간순 — 빈 시간대는 압축
 *   · 지금 행부터 주 끝까지 = 전부 (표시된 행의 빈 칸은 그대로)
 *   · weekdayOrderFrom: 설정 '주 시작: 일(기본)/월'이 요일 줄 순서를 정한다
 *
 * index.html의 **실제 mosaicWeekRows·weekdayOrderFrom**을 뽑아 돌린다 —
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
${grab('mosaicWeekRows')}
${grab('weekdayOrderFrom')}
  module.exports = { mosaicWeekRows, weekdayOrderFrom };
`;
const m = new module.constructor();
m._compile(harness, '/mosaic-week-rows-harness.js');
const { mosaicWeekRows, weekdayOrderFrom } = m.exports;

let pass = 0, fail = 0;
const t = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? 'PASS  ' : 'FAIL  ') + name); };

// 함수는 ms 산수만 한다 — 기준을 0에 두면 at(h) = h시간째 행이라 읽기 쉽다.
const H = 3600000;
const WS = 0, WE = 7 * 24 * H;
const at = h => WS + h * H;
const rows = (focus, now) => mosaicWeekRows(focus, WS, WE, now);

// ── 스펙 예제 ①·②: 3시·4시에 집중/5시는 빈 시간, 지금 = 월요일(둘째 날) 17시 ──
const MON17 = at(24 + 17);
let r = rows([{ s: at(3) + 600000, e: at(3) + 1200000 }, { s: at(4), e: at(4) + 300000 }], MON17);
t('⚠⚠ 핵심: 과거는 집중 있는 행(3시·4시)만 — 빈 5시는 압축', r[0] === at(3) && r[1] === at(4) && r.indexOf(at(5)) < 0);
t('지금(월 17시) 행부터는 전부 — 과거 다음 행이 곧 지금 행', r[2] === MON17);
t('마지막 행 = 주의 마지막 시간(167h) — 주 끝 밖은 없다', r[r.length - 1] === at(167));
t('행 수 = 과거 2 + (지금~주 끝 127)', r.length === 2 + (168 - 41));

// ── 스펙 예제 ③ 주 경계: 주 밖 집중은 행을 못 만든다 ──
r = rows([{ s: WS - H, e: WS - 1800000 }, { s: WE + H, e: WE + 2 * H }, { s: at(0), e: at(0) + 60000 }], MON17);
t('주 시작 전·주 끝 후 집중은 무시 — 0시 행만 산다', r[0] === at(0) && r.length === 1 + (168 - 41));
r = rows([{ s: WS - 600000, e: WS + 600000 }], MON17);
t('주 경계에 걸친 집중은 겹친 안쪽 행만 만든다', r[0] === at(0) && r.length === 1 + (168 - 41));

// ── 스펙 예제 ④ 자정 걸침: 23:40~24:20 → 양쪽 날 행이 모두 산다 ──
r = rows([{ s: at(23) + 40 * 60000, e: at(24) + 20 * 60000 }], at(48 + 17));
t('자정 걸침 = 23시 행과 다음 날 0시 행 둘 다', r[0] === at(23) && r[1] === at(24) && r[2] === at(48 + 17));

// ── 스펙 예제 ⑤ 집중 0: 과거 행이 하나도 없다 ──
r = rows([], MON17);
t('집중 0 = 지금 행부터만', r[0] === MON17 && r.length === 168 - 41);

// ── 주 시작 순서 (요일 줄 그리는 모든 곳이 이 함수를 쓴다) ──
t('일 시작(기본) = 일월화수목금토', weekdayOrderFrom(false).join(',') === '0,1,2,3,4,5,6');
t('월 시작 = 월화수목금토일', weekdayOrderFrom(true).join(',') === '1,2,3,4,5,6,0');

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (mosaic-week-rows)`);
process.exit(fail ? 1 : 0);
