/* 마감 재정비 — 지난 마감선에 새로 줄 시간 (요청).
 *
 * ⚠ 앱 `SundialTests/RealignTests.swift`와 **한 쌍**이다. 어느 한쪽 규칙을
 * 고치면 두 파일을 같이 고쳐야 한다.
 *
 * index.html의 realignDues에서 **실제 분기 소스**를 뽑아 돌린다 — 규칙을
 * 여기 베껴 쓰면 본체가 바뀌어도 테스트가 통과해 버린다. */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// realignDues 안의 길이 결정 분기만 떼어 함수로 만든다.
const m = /if\(focMin>=plan\)len=30;\s*\n\s*else if\(focMin>0\)len=([^;]+);\s*\n\s*else len=plan;/
  .exec(html);
if (!m) throw new Error('realignDues의 길이 분기를 못 찾음 — 본체가 바뀌었나?');
const give = new Function('plan', 'focMin',
  'var len;' + m[0] + 'return len;');

let pass = 0, fail = 0;
function is(got, want, label) {
  if (got === want) { pass++; return; }
  fail++; console.error(`✗ ${label}\n    got  ${got}\n    want ${want}`);
}

// ① 하나도 안 했다 → 원래 계획 길이 그대로
is(give(45, 0), 45, '기록 0이면 계획했던 45분 그대로');
is(give(10, 0), 10, '기록 0이면 계획했던 10분 그대로');

// ② 계획만큼(또는 그 이상) 했다 → 30분 덤
is(give(20, 20), 30, '계획만큼 했으면 30분 덤');
is(give(20, 50), 30, '계획보다 더 했어도 30분 덤');

// ③ 일부만 했다 — 남은 게 30분 이상이면 남은 만큼 (요청)
is(give(60, 10), 50, '60분 계획 중 10분 했으면 남은 50분');
is(give(90, 20), 70, '90분 계획 중 20분 했으면 남은 70분');

// ④ ⚠ 일부만 했는데 **남은 게 30분 미만이면 30분** (요청 개정)
//    5분·10분짜리 조각은 다시 앉아 붙기엔 너무 짧다.
is(give(40, 20), 30, '남은 20분 → 30분으로 올려 준다');
is(give(35, 30), 30, '남은 5분 → 30분으로 올려 준다');
is(give(31, 30), 30, '남은 1분 → 30분으로 올려 준다');

// ⑤ 경계: 남은 시간이 정확히 30분이면 그대로 30분 (올림도 내림도 없음)
is(give(50, 20), 30, '남은 30분은 그대로 30분');
is(give(51, 20), 31, '남은 31분은 그대로 31분 — 30분 하한만 걸린다');

console.log(fail ? `\n${fail}개 실패, ${pass}개 통과` : `${pass}개 통과 (realign)`);
process.exit(fail ? 1 : 0);
