/* 타임라인 하늘이 **지금**을 그리는지 + 스크롤에 **연속**으로 반응하는지
   (신고 2026-08-02 재발: "몇 포인트만 스크롤해도 달이 순식간에 사라진다").

   1차 신고(2026-07-31)는 좌표(서울 폴백)였고, 2차는 화면 **중앙** 시각으로
   해를 놓아 지금과 어긋나던 것 — "지금이 화면 안이면 지금"으로 고쳤다.
   그런데 그 고침이 **갈아 끼우기**(중앙 시각 ↔ 지금, 경계에서 통째로 스위치)
   였다: 경계를 살짝 넘는 순간 dt가 중앙 시각(최대 화면 절반 폭, 1~2시간)
   으로 점프해 해·달 고도가 그만큼 튀어 지평선 아래로 사라졌다 — 이번 신고.

   고친 규칙: dt = clamp(now, 화면 위쪽 시각, 화면 아래쪽 시각). 지금이 보이는
   구간 안이면 지금, 밖이면 가장 가까운 경계 시각 — 그리고 그 경계 시각
   자체가 스크롤에 따라 **연속으로** 움직이므로 어느 경계를 넘어도 dt가
   튀지 않는다. 이 테스트는 그 연속성을 수치로 못 박는다. */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };

// updateTlSky 본문을 그대로 떠서 규칙이 살아 있는지 본다.
const i = SRC.indexOf('function updateTlSky(');
const body = SRC.slice(i, SRC.indexOf('\n  function ', i + 10));
t('updateTlSky를 찾았다', i > 0 && body.length > 200);
// ⚠ y→시각 변환이 공용 함수로 뽑혀 있어야 위/아래 경계에서 같은 식을 쓴다
// (각 지점이 서로 다른 식을 쓰면 다시 어긋난 채 재발할 수 있다).
t('y→시각 변환(tlYToDate)이 공용 함수로 있다', /function tlYToDate\(y\)/.test(body));
t('화면 위쪽 시각을 잰다 (scrollTop)', /tlYToDate\(sc\.scrollTop\)/.test(body));
t('화면 아래쪽 시각을 잰다 (scrollTop\+clientHeight)', /tlYToDate\(sc\.scrollTop\+sc\.clientHeight\)/.test(body));
// ⚠ 회귀 가드: "갈아 끼우기"(중앙 시각 ↔ 지금 스위치) 식이 되살아나면 실패.
t('⚠옛 점프 스위치(중앙 시각 갈아 끼우기)가 되살아나지 않았다',
  !/Math\.abs\(dt-_now\)<=_spanMs\/2\)dt=_now/.test(body.replace(/\s/g, '')));

// 규칙 자체를 수식으로 재현해 검증한다 (소스와 같은 클램프 식).
function pickDateClamp(nowMs, topMs, botMs) {
  let dt = nowMs;
  if (nowMs < topMs) dt = topMs;
  else if (nowMs > botMs) dt = botMs;
  return dt;
}
const H = 3600000;
const now = new Date('2026-08-02T06:54:00+12:00').getTime();
const span = 3.5 * H;                      // 화면에 3.5시간이 보인다고 하자

// ① 기본 상태: 창이 [지금+0.5h, 지금+0.5h+span] → 지금은 창 밖(위) → 위쪽 경계
t('지금이 창 위쪽 밖이면 위쪽 경계 시각', pickDateClamp(now, now + 0.5 * H, now + 0.5 * H + span) === now + 0.5 * H);

// ② 지금이 창 안에 있으면 지금 그대로
t('지금이 창 안이면 지금을 그린다', pickDateClamp(now, now - 1 * H, now - 1 * H + span) === now);

// ③ 지금이 창 아래쪽 밖(많이 스크롤해 과거 창만 보임) → 아래쪽 경계
t('지금이 창 아래쪽 밖이면 아래쪽 경계 시각', pickDateClamp(now, now - 5 * H, now - 5 * H + span) === now - 5 * H + span);

// ④ 어제·내일 창으로 스크롤하면 당연히 그 창의 경계 시각(지금과 멀리 떨어짐)
t('다음 날 창이면 그 창의 경계 시각', pickDateClamp(now, now + 20 * H, now + 20 * H + span) === now + 20 * H);
t('전날 창이면 그 창의 경계 시각', pickDateClamp(now, now - 30 * H, now - 30 * H + span) === now - 30 * H + span);

// ⑤ ⚠⚠ 핵심 회귀 테스트 — **연속성**: 창(위/아래 경계)이 함께 미끄러지며
// '지금'을 넘나드는 동안, dt는 한 스텝(step)만큼만 움직여야 한다. 옛 버그는
// 여기서 dt가 화면 절반 폭(수십~수백 분)만큼 한 번에 뛰었다 — 브라우저 실측
// (2026-08-02)으로 재현: 옛 식은 스크롤 5px에 해 top이 623→770px(147px)
// 튀었는데, 새 식은 같은 5px에 1~3px씩만 움직였다.
(function () {
  const step = 5 * 60000;              // 스크롤 한 칸 = 5분어치 시각 이동(5px 비유)
  let prevDt = null, maxJump = 0;
  for (let top = now - 20 * step; top <= now + 20 * step; top += step) {
    const bot = top + span;
    const dt = pickDateClamp(now, top, bot);
    if (prevDt !== null) maxJump = Math.max(maxJump, Math.abs(dt - prevDt));
    prevDt = dt;
  }
  // 한 스텝(5분) 넘게 튀면 안 된다 — 옛 버그는 여기서 수십~수백 분이 튀었다.
  t('창이 지금을 넘나들어도 dt가 한 스텝(5분) 넘게 튀지 않는다 (연속성)', maxJump <= step);
  t('실제로 튀는 지점이 있었다는 걸 스스로 증명한다 (테스트가 헛돌지 않음 확인용)', maxJump > 0);
})();

console.log(fail ? `\n${fail}개 실패 / ${ran}` : `\n${ran}/${ran} 통과`);
process.exit(fail ? 1 : 0);
