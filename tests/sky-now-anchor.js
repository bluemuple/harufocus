/* 타임라인 하늘의 **시각 앵커** — 스크롤에 얼마나 이어서 반응하는가.
   실행: node tests/sky-now-anchor.js

   여기는 **네 번** 고쳤다. 매번 앞의 수정이 만든 부작용이었다:
   ① (07-31) 좌표가 서울 폴백이라 해가 엉뚱한 높이 — 좌표 수정
   ② (08-02) 화면 **중앙** 시각으로 해를 놓아, 지금을 보고 있어도 하늘이 어긋남
      → "지금이 화면 안이면 지금, 밖이면 중앙"으로 **갈아 끼움**
   ③ (08-02) 그 갈아 끼우기가 경계에서 dt를 화면 절반 폭(1~2시간)만큼 **점프**
      시켜 해·달이 지평선 아래로 사라짐("몇 포인트만 스크롤해도 달이 사라진다")
      → [화면 위쪽, 아래쪽] 구간으로 **클램프**
   ④ (08-06) 클램프는 점프를 없앴지만, 지금이 화면 안인 동안 dt가 **상수**라
      해가 **얼어붙었다**. 화면 밖으로 나가야 다시 움직여 "멈췄다가 갑자기
      내려간다"로 보였다 — ③이 만든 평평한 구간이 이번 신고의 정체.
      → dt = tlYToDate(scrollTop + PPH). 뷰포트의 한 점을 시계로 삼는다.

   이 파일이 못 박는 것: **평평한 구간도 점프도 없을 것**(③④ 동시 회귀 방지),
   그리고 '지금' 버튼을 누르면 하늘도 정확히 지금일 것(②가 깨뜨렸던 의도). */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };

const i = SRC.indexOf('function updateTlSky(');
const body = SRC.slice(i, SRC.indexOf('\n  function ', i + 10));
t('updateTlSky를 찾았다', i > 0 && body.length > 200);

// ── 소스가 실제로 그 식을 쓰는가
const flat = body.replace(/\s/g, '');
t('y→시각 변환(tlYToDate)이 공용 함수로 있다', /function tlYToDate\(y\)/.test(body));
t('하늘 시각 = tlYToDate(scrollTop + PPH)', /vardt=tlYToDate\(sc\.scrollTop\+PPH\)/.test(flat));

// ⚠ 회귀 가드 — 지나간 세 가지 식이 되살아나면 실패한다.
t('⚠②옛 갈아 끼우기(중앙 시각 스위치)가 없다', !/Math\.abs\(dt-_now\)<=_spanMs\/2\)dt=_now/.test(flat));
t('⚠③옛 클램프(지금이 화면 안이면 dt=지금)가 없다',
  !/if\(_now\.getTime\(\)<topDt\.getTime\(\)\)/.test(flat));
t('⚠하늘 시각을 new Date()로 직접 잡지 않는다 (그러면 또 얼어붙는다)',
  !/vardt=_now/.test(flat) && !/vardt=newDate\(\)/.test(flat));

// ── 규칙을 수식으로 재현해 성질을 검증한다.
// tlYToDate는 밴드 안에서 y에 대해 선형이다: h = bandTS + (localY-14)/PPH.
const PPH = 120, H = 3600000;
const dtFor = (scrollTop) => (scrollTop + PPH) / PPH * H;   // 콘텐츠 y → 시각(ms)

// ① 평평한 구간이 없어야 한다 — ④ 신고의 본체.
(function () {
  let flatSteps = 0, prev = null;
  for (let top = 0; top <= 4000; top += 5) {          // 5px씩 스크롤
    const dt = dtFor(top);
    if (prev !== null && dt === prev) flatSteps++;
    prev = dt;
  }
  t('스크롤해도 하늘 시각이 멈추는 구간이 없다 (해가 얼어붙지 않는다)', flatSteps === 0);
})();

// ② 점프가 없어야 한다 — ③ 신고의 본체. 5px 스크롤 = 정확히 5px어치 시각.
(function () {
  let maxJump = 0, minJump = Infinity, prev = null;
  for (let top = 0; top <= 4000; top += 5) {
    const dt = dtFor(top);
    if (prev !== null) { const j = Math.abs(dt - prev); maxJump = Math.max(maxJump, j); minJump = Math.min(minJump, j); }
    prev = dt;
  }
  const expected = 5 / PPH * H;                        // 5px = 2.5분
  t('5px 스크롤이 항상 같은 시간만큼 움직인다 (점프도 정체도 없음)',
    Math.abs(maxJump - expected) < 1 && Math.abs(minJump - expected) < 1);
  t('실제로 움직이긴 한다 (테스트가 헛돌지 않음)', maxJump > 0);
})();

// ③ 단조 증가 — 아래로 스크롤하면 하늘도 반드시 미래로 간다.
(function () {
  let ok = true, prev = -Infinity;
  for (let top = 0; top <= 4000; top += 37) { const dt = dtFor(top); if (dt <= prev) ok = false; prev = dt; }
  t('아래로 스크롤하면 하늘 시각이 반드시 늘어난다 (단조)', ok);
})();

// ④ '지금' 버튼을 누르면 하늘도 정확히 지금 — 앵커를 PPH로 잡은 이유.
//    scrollToNowLine: target = 지금줄y - PPH → 앵커(target+PPH) = 지금줄y.
(function () {
  const nowContentY = 1234.5;
  const target = nowContentY - PPH;                    // scrollToNowLine의 목표
  t("'지금' 버튼 위치에서 하늘 시각 = 지금", dtFor(target) === nowContentY / PPH * H);
})();
t("소스의 scrollToNowLine도 같은 PPH 오프셋을 쓴다",
  /tlTodayTop\(\)\+yFor\(nf\)-PPH/.test(SRC));

// ── 달: 지평선에서 fade로 증발하지 말고 해와 같이 **땅에 가려** 져야 한다.
t('달은 fade 하지 않는다 (opacity 고정)', /moon\.style\.opacity='1'/.test(flat));
t("⚠옛 달 fade 식((alt+1.5)/3)이 되살아나지 않았다", !/\(mp\.alt\+1\.5\)\/3/.test(flat));
t('해도 같은 규칙이다 (둘이 갈라지지 않게)', /sun\.style\.opacity='1'/.test(flat));

console.log(fail ? `\n${fail}개 실패 / ${ran}` : `\n${ran}/${ran} 통과`);
process.exit(fail ? 1 : 0);
