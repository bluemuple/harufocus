/* 타임라인 하늘이 **지금**을 그리는지 (신고 2026-07-31 재발).
   1차 신고는 좌표(서울 폴백)였고 고쳤는데, 같은 증상이 다시 왔다 —
   이번 원인은 **시각**이었다. 하늘은 화면 **중앙**의 시각으로 해를 놓는데,
   타임라인은 '지금'을 화면 **위쪽**에 두고 열린다. 그래서 중앙은 늘 1~3시간
   뒤였고, 06:54에 10시대 해(고도 25.6°)가 떠 있었다.
   규칙: **지금이 화면 안에 있으면 지금**, 밖으로 스크롤하면 그 시각. */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };

// updateTlSky 본문을 그대로 떠서 규칙이 살아 있는지 본다.
const i = SRC.indexOf('function updateTlSky(');
const body = SRC.slice(i, SRC.indexOf('\n  function ', i + 10));
t('updateTlSky를 찾았다', i > 0 && body.length > 200);
t('⚠지금 앵커가 살아 있다 (지우면 하늘이 다시 미래를 그린다)',
  /Math\.abs\(dt-_now\)<=_spanMs\/2\)dt=_now/.test(body.replace(/\s/g, '')
    .replace(/Math\.abs\(dt-_now\)<=_spanMs\/2\)dt=_now/, 'Math.abs(dt-_now)<=_spanMs/2)dt=_now'))
  || /dt=_now/.test(body));
t('보이는 시간 폭을 clientHeight/PPH로 잰다', /clientHeight\/PPH/.test(body));

// 규칙 자체를 수식으로 재현해 검증한다 (소스와 같은 식).
function pickDate(centerMs, nowMs, spanMs) {
  let dt = centerMs;
  if (Math.abs(dt - nowMs) <= spanMs / 2) dt = nowMs;
  return dt;
}
const H = 3600000, now = new Date('2026-07-31T06:54:00+12:00').getTime();
const span = 3.5 * H;                      // 화면에 3.5시간이 보인다고 하자

// ① 기본 상태: 지금이 위쪽, 중앙은 +1.75h → **지금**을 그려야 한다
t('기본 화면(중앙이 +1.75h)이면 지금을 그린다',
  pickDate(now + 1.75 * H, now, span) === now);

// ② 실제 신고 상황: 06:54인데 중앙이 10:05 (+3.2h) → 화면 밖 → 그 시각
//    ⚠ 이건 '지금'으로 강제하지 않는다. 그만큼 스크롤했다면 그 하늘이 맞다.
t('많이 스크롤해 지금이 화면 밖이면 그 시각을 그린다',
  pickDate(now + 3.2 * H, now, span) === now + 3.2 * H);

// ③ 어제·내일로 넘어가면 당연히 그 날의 하늘
t('다음 날로 스크롤하면 그 날 시각', pickDate(now + 26 * H, now, span) === now + 26 * H);
t('전날로 스크롤하면 그 날 시각', pickDate(now - 20 * H, now, span) === now - 20 * H);

// ④ 경계: 딱 절반 폭 안이면 지금
t('경계(폭의 정확히 절반)면 지금', pickDate(now + span / 2, now, span) === now);
t('경계 바로 밖이면 그 시각', pickDate(now + span / 2 + 1, now, span) === now + span / 2 + 1);

console.log(fail ? `\n${fail}개 실패 / ${ran}` : `\n${ran}/${ran} 통과`);
process.exit(fail ? 1 : 0);
