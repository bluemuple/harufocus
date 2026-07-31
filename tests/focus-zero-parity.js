/* 타이머 '0 도달' — 링 아래에서 묻고, 초과는 연한 링으로. 앱 4c093e80 이식
 * (SundialTests/FocusManagerTests.swift의 zeroReached/zeroBranch/overtimeSec
 * 테스트와 같은 시나리오).
 *
 * 포모도로가 꺼져 있으면 계획 시간이 다 차도 예전엔 웹도 그냥 1시간 랩
 * 카운트업으로 흘려보내 "다 채웠다"는 신호가 전혀 없었다 — 그 결함이
 * 4fc67771의 736:30 버그(마감을 안 옮기고 durationMin만 불림)를 화면에서
 * 아무도 눈치채지 못하게 만든 배경이다.
 *
 * index.html의 **실제 focusZeroReached·focusZeroBranch·focusOvertimeSec·
 * focusPhase**를 뽑아 돌린다 — 규칙을 여기 베껴 쓰면 본체가 바뀌어도
 * 테스트가 통과해 버린다. */
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

// focusPhase는 fPomoOn()/fPlanSec()/pomoSegments 등 세션 전역에 기대므로,
// 그 전역들을 최소 스텁으로 세우고 실제 focusPhase 본체를 그대로 돌린다.
const harness = `
  var _pomoOn = false, _planSec = 0;
  function fPomoOn(){ return _pomoOn; }
  function fPlanSec(){ return _planSec; }
  function pomoSegments(D){
    // 이 파일의 관심사는 포모도로 OFF 분기라, ON 분기는 절대 안 타는 것만
    // 확인하면 되므로 최소 스텁으로 충분하다.
    if (D <= 0) return [];
    return [{ len: D * 60, rest: false }];
  }
${grab('focusZeroReached')}
${grab('focusZeroBranch')}
${grab('focusOvertimeSec')}
${grab('focusPhase')}
  module.exports = {
    focusZeroReached, focusZeroBranch, focusOvertimeSec, focusPhase,
    setPomoOn(v){ _pomoOn = v; }, setPlanSec(v){ _planSec = v; },
  };
`;
const m = new module.constructor();
m._compile(harness, '/focus-zero-harness.js');
const W = m.exports;

let pass = 0, fail = 0;
const t = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? 'PASS  ' : 'FAIL  ') + name); };

// ── focusZeroReached ────────────────────────────────────────────────────
t('포모도로 ON이면 계획을 넘겨도 절대 true가 아니다(25·5 자동전환 경로 몫)',
  W.focusZeroReached(true, 1500, 1600) === false);
t('계획이 0(실시간)이면 카운트다운할 대상이 없어 false', W.focusZeroReached(false, 0, 500) === false);
t('경계: 계획 1초 전은 아직 0 도달이 아니다', W.focusZeroReached(false, 600, 599) === false);
t('경계: 정확히 계획 시각 = 0 도달', W.focusZeroReached(false, 600, 600) === true);
t('계획을 넘긴 뒤도 계속 true', W.focusZeroReached(false, 600, 900) === true);

// ── focusZeroBranch ─────────────────────────────────────────────────────
t('다음 블록이 없으면(null) 무조건 멀거나 없음', W.focusZeroBranch(null) === 'farOrNone');
t('정확히 30분은 아직 임박(near)', W.focusZeroBranch(30 * 60) === 'near');
t('30분을 1초라도 넘으면 멀거나 없음', W.focusZeroBranch(30 * 60 + 1) === 'farOrNone');
t('5분 간격은 당연히 임박', W.focusZeroBranch(5 * 60) === 'near');
t('다음 블록이 이미 시작됐어도(간격 음수) 임박으로 본다', W.focusZeroBranch(-60) === 'near');

// ── focusOvertimeSec ────────────────────────────────────────────────────
t('초과분만 계산', W.focusOvertimeSec(130, 100) === 30);
t('정확히 계획 시각 = 초과 0초', W.focusOvertimeSec(100, 100) === 0);
t('아직 계획 안이면 음수 대신 0으로 클램프', W.focusOvertimeSec(90, 100) === 0);

// ── focusPhase: 포모도로 OFF + 계획 소진 → 정적 초과 링 ────────────────
W.setPomoOn(false); W.setPlanSec(30 * 60);   // 계획 30분
{
  const before = W.focusPhase(30 * 60 - 1);   // 1초 전 — 아직 카운트다운
  t('계획 1초 전 — 아직 overtimeStatic 아님', !before.overtimeStatic);
  t('계획 1초 전 — countdown 그대로 진행 중', before.countdown === true && before.left === 1);
}
{
  const at0 = W.focusPhase(30 * 60);          // 정확히 0 도달
  t('⚠ 정확히 0 도달 — 예전엔 total=3600·countdown=false(1시간 랩)이었다',
    at0.overtimeStatic === true && at0.total === 30 * 60);
  t('0 도달 순간 — 초과 0초', at0.overtimeSec === 0);
}
{
  const over = W.focusPhase(30 * 60 + 200);   // 3분 20초 초과
  t('초과 200초 — overtimeSec가 정확히 그만큼', over.overtimeSec === 200);
  t('초과 상태에서도 total은 계획(plan) 그대로 — 마지막 카운트다운 프레임이 이어진다',
    over.total === 30 * 60);
  t('over 플래그도 함께 선다(경계 자동전환 호환)', over.over === true);
}

// ── focusPhase: 포모도로 ON이면 절대 overtimeStatic이 되지 않는다 ───────
W.setPomoOn(true); W.setPlanSec(30 * 60);
{
  const onOver = W.focusPhase(30 * 60 + 500);   // 계획을 한참 넘김
  t('⚠ 포모도로 ON은 계획을 넘겨도 overtimeStatic이 아니다(25·5 자동전환 경로가 따로 처리)',
    !onOver.overtimeStatic);
}

// ── focusPhase: 0분 딥포커스(실시간)는 overtimeStatic과 무관 ────────────
W.setPomoOn(false); W.setPlanSec(0);
{
  const live = W.focusPhase(500);
  t('계획 없는 실시간은 overtimeStatic이 아니다(소비/잔여 개념이 없는 다른 상태)',
    !live.overtimeStatic);
}

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (focus-zero-parity)`);
process.exit(fail ? 1 : 0);
