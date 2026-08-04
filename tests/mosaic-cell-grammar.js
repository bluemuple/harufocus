/* 하루 모자이크 '셀 문법' — 유저 확정 스펙(2026-08-04, 앱과 동일 문법):
 *   집중 = 테마색 채움 / 계획만 = 테두리(전체 둘레) /
 *   10분 칸의 절반(5분) 이하만 계획 = 왼쪽 절반만 테두리 /
 *   겹치면 채움이 이긴다(테두리 없음).
 *
 * index.html의 **실제 mosaicCellSpec**을 뽑아 돌린다 — 규칙을 여기 베껴
 * 쓰면 본체가 바뀌어도 테스트가 통과해 버린다. 순수 함수라 대역이 필요 없다. */
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
${grab('mosaicCellSpec')}
  module.exports = { mosaicCellSpec };
`;
const m = new module.constructor();
m._compile(harness, '/mosaic-cell-harness.js');
const spec = m.exports.mosaicCellSpec;

let pass = 0, fail = 0;
const t = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? 'PASS  ' : 'FAIL  ') + name); };

const MIN = 60000, CELL = 10 * MIN;

// ── 집중 = 채움 ──
let s = spec(CELL, 0);
t('꽉 찬 집중 = 채움 100%, 테두리 없음', s.fillRatio === 1 && s.border === 'none');
s = spec(3 * MIN, 0);
t('3분 집중 = 30% 채움', Math.abs(s.fillRatio - 0.3) < 1e-9 && s.border === 'none');
// keepShort: 2분 미만 기록도 그린다 — 1px라도 채움으로.
s = spec(30 * 1000, 0);
t('30초 집중도 채움(5%) — keepShort 규칙', Math.abs(s.fillRatio - 0.05) < 1e-9);

// ── 계획만 = 테두리 ──
s = spec(0, 6 * MIN);
t('6분 계획(절반 초과) = 전체 테두리', s.fillRatio === 0 && s.border === 'full');
s = spec(0, 4 * MIN);
t('4분 계획(절반 이하) = 왼쪽 절반 테두리', s.border === 'half');
// 경계: 딱 5분(절반)은 "절반만 계획" — 왼쪽 절반 테두리 (스펙: 절반을 **넘으면** 전체).
s = spec(0, 5 * MIN);
t('경계: 딱 5분 = 반 테두리(초과가 아니면 전체가 아니다)', s.border === 'half');
s = spec(0, 5 * MIN + 1);
t('경계: 5분+1ms = 전체 테두리', s.border === 'full');

// ── 겹치면 채움이 이긴다 ──
s = spec(2 * MIN, 8 * MIN);
t('⚠⚠ 핵심: 집중+계획 겹침 = 채움만, 테두리 없음', s.fillRatio > 0 && s.border === 'none');
s = spec(1, CELL);
t('집중이 1ms라도 있으면 테두리는 없다', s.border === 'none');

// ── 빈 칸·방어 ──
s = spec(0, 0);
t('빈 칸 = 채움 0, 테두리 없음', s.fillRatio === 0 && s.border === 'none');
s = spec(20 * MIN, 0);
t('넘친 집중은 100%로 잘린다(클램프)', s.fillRatio === 1);
s = spec(undefined, undefined);
t('undefined 입력도 빈 칸으로 (방어)', s.fillRatio === 0 && s.border === 'none');
// cellMs 기본값 = 10분 — 호출부가 안 넘겨도 같은 답.
s = spec(5 * MIN, 0, undefined);
t('cellMs 기본값 = 10분(600000ms)', Math.abs(s.fillRatio - 0.5) < 1e-9);

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (mosaic-cell-grammar)`);
process.exit(fail ? 1 : 0);
