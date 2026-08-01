/* 마감선 duration 자리의 '지남' 표기 (앱 elapsedSinceDueText 파리티,
 * 608f979b 이식). 규칙: 30분 지남 → "30m 지남" · 2시간 → "2h 지남" ·
 * 1일 1시간 → "1d 1h 지남" · 7일을 넘으면 "7d+ 지남"으로 뭉친다.
 * **순수 분 계산**이라 자정·시간대와 무관해야 한다 — 이 파일 어디에도
 * Date 생성자를 실제 값으로 안 부른다(입력이 이미 '경과 분' 숫자다).
 *
 * ⚠ 앱 SundialTests/ElapsedSinceDueTextTests.swift와 **한 쌍**이다 — 문구
 * 예시가 거기 명시된 것과 같다.
 *
 * index.html의 **실제 elapsedSinceDueText 함수**를 뽑아 돌린다(hmText도
 * 함께, 내부에서 재사용하므로) — 규칙을 여기 베껴 쓰면 본체가 바뀌어도
 * 통과해 버린다. */
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
  function L(ko, en){ return ko; }
${grab('hmText')}
${grab('elapsedSinceDueText')}
  module.exports = { elapsedSinceDueText, hmText };
`;
const m = new module.constructor();
m._compile(harness, '/elapsed-since-due-harness.js');
const W = m.exports;

let pass = 0, fail = 0;
const t = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? 'PASS  ' : 'FAIL  ') + name); };

// 1시간 미만은 기존 hmText와 완전히 같은 규칙 — 30분 지남 → "30m 지남" (요청 예시 그대로).
t('30분 지남 → "30m 지남" (요청 예시)', W.elapsedSinceDueText(30) === '30m 지남');
t('1시간 미만은 hmText(m)+" 지남"과 완전히 같다', W.elapsedSinceDueText(45) === W.hmText(45) + ' 지남');

// 2시간 → "2h 지남" (요청 예시 그대로) — 정각은 분을 안 붙인다.
t('2시간 → "2h 지남" (요청 예시)', W.elapsedSinceDueText(120) === '2h 지남');

// 23시간 59분 — 아직 하루 미만이니 시간 단위 그대로(일 단위로 안 넘어간다).
t('23시간 59분은 아직 시간 단위 그대로', W.elapsedSinceDueText(23 * 60 + 59) === '23h 59m 지남');

// 정확히 하루(1440분) — 시간 나머지가 0이면 "1d"만, "1d 0h"처럼 0을 안 붙인다.
t('정확히 하루 → "1d 지남" (0시간은 안 붙인다)', W.elapsedSinceDueText(24 * 60) === '1d 지남');

// 1일 1시간(=25시간=1500분) → "1d 1h 지남" (요청 예시 그대로).
t('1일 1시간 → "1d 1h 지남" (요청 예시)', W.elapsedSinceDueText(25 * 60) === '1d 1h 지남');

// 정확히 7일(10080분) — "넘으면" 뭉친다는 조건이므로 아직 안 뭉친다: "7d 지남" 그대로.
t('정확히 7일은 아직 안 뭉친다 → "7d 지남"', W.elapsedSinceDueText(7 * 24 * 60) === '7d 지남');

// 7일을 1분이라도 넘으면 "7d+ 지남"으로 뭉친다.
t('7일 초과 → "7d+ 지남"으로 뭉친다', W.elapsedSinceDueText(7 * 24 * 60 + 1) === '7d+ 지남');
t('30일 지나도 여전히 "7d+ 지남" (한없이 안 길어진다)', W.elapsedSinceDueText(30 * 24 * 60) === '7d+ 지남');

// 0분·음수 입력도 최소 1분으로 — "0m 지남" 같은 어색한 표기를 안 만든다.
t('0분 입력 → 최소 1분 취급', W.elapsedSinceDueText(0) === W.elapsedSinceDueText(1));

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (elapsed-since-due)`);
process.exit(fail ? 1 : 0);
