/* 주간 모자이크 행 목록 — **행 규칙 v2** (유저 확정 2026-08-05, 앱 실기기
 * 피드백으로 v1 폐기 — 앱 MosaicWeekModelTests와 같은 예제):
 *   · 과거(지금 행 이전) = **집중이 있는 행만** 시간순 — 빈 시간대는 압축
 *   · **지금 행(집중 없어도 무조건) + 아래 2행** — 주 끝([ws,we) 반개구간)에서 클램프
 *   · 미래 주 = 빈 목록 (v1의 '지금부터 주 끝까지 전부'는 폐기)
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
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 함수는 ms 산수만 한다 — 기준을 0에 두면 at(h) = h시간째 행이라 읽기 쉽다.
const H = 3600000, MIN = 60000;
const WS = 0, WE = 7 * 24 * H;
const at = h => WS + h * H;
const rows = (focus, now) => mosaicWeekRows(focus, WS, WE, now);

// ── 유저 예제 ①: 집중한 행만 서고 빈 시간대는 압축, 미래 몫은 지금+2행뿐 ──
// 화(둘째 날) 3:00~3:30·4:00~4:30 집중, 지금 = 토(일곱째 날) 12시.
const SAT12 = at(6 * 24 + 12);
let r = rows([{ s: at(24 + 3), e: at(24 + 3) + 30 * MIN },
              { s: at(24 + 4), e: at(24 + 4) + 30 * MIN }], SAT12);
t('⚠⚠ 핵심 v2: 과거 집중 2행 + [지금, +1h, +2h] — 딱 5행 (v1의 주 끝까지 전부는 폐기)',
  eq(r, [at(24 + 3), at(24 + 4), SAT12, SAT12 + H, SAT12 + 2 * H]));
t('빈 2시·5시 행은 압축', r.indexOf(at(24 + 2)) < 0 && r.indexOf(at(24 + 5)) < 0);

// ── 유저 예제 ②: 지금 3시 → 마지막 세 줄이 3·4·5시 (집중 없어도) ──
const WED3 = at(3 * 24 + 3);                       // 수요일 3시 행
r = rows([{ s: at(24 + 9), e: at(24 + 9) + 20 * MIN }], WED3 + 10 * MIN);
t('⚠⚠ 유저 예 그대로: 마지막 세 줄 = 3·4·5시', eq(r.slice(-3), [WED3, WED3 + H, WED3 + 2 * H]));
t('6시부터 미래 행 없음 + 무집중 과거 행 없음 — 과거 집중 1행이 맨 앞',
  r.length === 4 && r[0] === at(24 + 9));

// ── 정시 종료 경계: 17:00~22:00 집중 = 17~21시 다섯 행, 22시 행은 없다 ──
r = rows([{ s: at(24 + 17), e: at(24 + 22) }], at(167) + 30 * MIN);
t('정시(22:00) 종료 = 22시 행 없음 (0초 겹침은 겹침이 아니다)',
  r.indexOf(at(24 + 22)) < 0 && eq(r.slice(0, 5), [17, 18, 19, 20, 21].map(h => at(24 + h))));
t('지금이 주 마지막 시간(167h) = 발밑 클램프로 지금 행 하나만 — 총 6행',
  r.length === 6 && r[r.length - 1] === at(167));

// ── 발밑 2행의 주 끝 클램프 ──
t('지금 165h(끝-3) = [165,166,167] 셋 다', eq(rows([], at(165) + 10 * MIN), [at(165), at(166), at(167)]));
t('지금 166h = [166,167] 둘로 잘림', eq(rows([], at(166) + 10 * MIN), [at(166), at(167)]));

// ── 집중 0인 주 세 갈래 (현재/미래/과거) ──
t('현재 주 + 집중 0 = 지금 행 + 아래 2행 딱 셋 (지금 행은 무집중이어도 선다)',
  eq(rows([], WED3 + 30 * MIN), [WED3, WED3 + H, WED3 + 2 * H]));
t('미래 주(지금이 주 시작 전) = 빈 목록 — 지금 행조차 없다', rows([], WS - 24 * H).length === 0);
t('과거 주(지금이 주 끝 뒤) + 집중 0 = 빈 목록', rows([], WE + 9 * H).length === 0);

// ── 틱 경계: 집중 없이 지나간 줄은 사라지고, 집중 있던 줄은 남는다 ──
// (주간 뷰 fade out/in은 이 결과를 그리는 것뿐 — 계약의 원본은 여기다.)
let before = rows([], at(13) + 59 * MIN), after = rows([], at(14));
t('⚠ 틱: 집중 없던 13시 줄은 빠지고 16시 줄이 붙는다', eq(before, [at(13), at(14), at(15)]) && eq(after, [at(14), at(15), at(16)]));
t('행 수 불변 = 스크롤이 안 튄다', before.length === after.length);
const f13 = [{ s: at(13) + 10 * MIN, e: at(13) + 20 * MIN }];
t('반대 갈래: 집중 있던 13시 줄은 과거 줄로 남고 아래로만 자란다(+1행)',
  eq(rows(f13, at(14)), [at(13), at(14), at(15), at(16)]));

// ── 지금 행에 걸친 집중 = 중복 없음 (①이 지금 행 직전에서 멈춘다) ──
r = rows([{ s: at(14) + 10 * MIN, e: at(14) + 40 * MIN },
          { s: at(13), e: at(13) + 30 * MIN }], at(14) + 30 * MIN);
t('지금 행과 겹친 집중이 있어도 행은 한 번만 — 시간순',
  eq(r, [at(13), at(14), at(15), at(16)]));

// ── 주 경계: 주 밖 집중은 행을 못 만든다 ──
r = rows([{ s: WS - H, e: WS - 30 * MIN }, { s: WE + H, e: WE + 2 * H },
          { s: at(0), e: at(0) + MIN }], WE + 9 * H);       // 과거 주 조회
t('주 시작 전·주 끝 후 집중은 무시 — 0시 행만 산다', eq(r, [at(0)]));
r = rows([{ s: WS - 10 * MIN, e: WS + 10 * MIN }], WE + 9 * H);
t('주 경계에 걸친 집중은 겹친 안쪽 행만 만든다', eq(r, [at(0)]));

// ── 자정 걸침: 23:40~24:20 → 양쪽 날 행이 모두 산다 ──
r = rows([{ s: at(23) + 40 * MIN, e: at(24) + 20 * MIN }], WE + 9 * H);
t('자정 걸침 = 23시 행과 다음 날 0시 행 둘 다', eq(r, [at(23), at(24)]));

// ── 길이 0 구간(계획-전용)은 행을 못 만든다 ──
t('길이 0 집중 구간은 무시', rows([{ s: at(9), e: at(9) }], WE + 9 * H).length === 0);

// ── 주 시작 순서 (요일 줄 그리는 모든 곳이 이 함수를 쓴다) ──
t('일 시작(기본) = 일월화수목금토', weekdayOrderFrom(false).join(',') === '0,1,2,3,4,5,6');
t('월 시작 = 월화수목금토일', weekdayOrderFrom(true).join(',') === '1,2,3,4,5,6,0');

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (mosaic-week-rows)`);
process.exit(fail ? 1 : 0);
