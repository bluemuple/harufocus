/* 달 천문 계산의 **앱 파리티** 검증 (요청 2026-07-26: 전 세계 어디서든
   달의 위치·모양·빛 방향이 실제와 같게).

   앱 쪽 대응: SundialTests/LunarEngineTests.swift(Meeus 47.a·DE405·일월식) +
   MoonTiltRenderTests.swift(가로 부호 불변식·alt/az 방위 항등식·저녁 초승달).
   기준값·허용오차를 앱과 똑같이 쓴다 — 값이 갈리면 파리티가 아니다.

   실행: node tests/moon-astro-parity.js */
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
function grabVar(re, label) {
  const m = SRC.match(re);
  if (!m) throw new Error('not found: ' + label);
  return m[0];
}

const CODE = [
  grabVar(/var MOON_LON=\[[\s\S]*?\]\];/, 'MOON_LON'),
  grabVar(/var MOON_LAT=\[[\s\S]*?\]\];/, 'MOON_LAT'),
  grab('moonEclipticMeeus'),
  grab('sunEclLon'),
  grab('moonIllum'),
  grab('sunAltAt'),
  grab('moonAltAt'),
  grab('moonLimbVector'),
  grab('moonSVG'),
  grab('tlXFrac'),
].join('\n');
eval(CODE);

let failed = 0;
function ok(cond, msg) {
  if (cond) { console.log('  ok', msg); }
  else { failed++; console.error('  FAIL', msg); }
}
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (' + a.toFixed(4) + ' vs ' + b + ' ±' + tol + ')'); }

// ── 1. Meeus 예제 47.a (앱 testMeeusExample47a와 동일 기준·오차) ──
// 1992 Apr 12, 0h TD (JD 2448724.5): λ=133.162655°, β=−3.229126°, Δ=368409.7km.
{
  const m = moonEclipticMeeus(2448724.5 - 2451545);
  near(m.lon, 133.162655, 0.02, 'Meeus 47.a 황경');
  near(m.lat, -3.229126, 0.02, 'Meeus 47.a 황위');
  near(m.dist, 368409.7, 120, 'Meeus 47.a 거리');
}

// ── 2. JPL DE405 대조 (앱 testEquatorialVsDE405와 동일) ──
// 2026-07-04 00:00 UTC: RA 328.995°, Dec −12.976°.
{
  const m = moonAltAt(new Date(Date.UTC(2026, 6, 4, 0, 0)), 37.5665, 126.978);
  let raDeg = m.ra * 180 / Math.PI; if (raDeg < 0) raDeg += 360;
  near(raDeg, 328.995, 0.06, 'DE405 적경');
  near(m.dec * 180 / Math.PI, -12.976, 0.06, 'DE405 적위');
}

// ── 3. 위상: 일월식이 위상을 못 박는다 (앱 phase 테스트와 동일) ──
{
  ok(moonIllum(new Date(Date.UTC(2017, 7, 21, 18, 26))).k <= 0.03, '2017 개기일식 = 신월(k≈0)');
  ok(moonIllum(new Date(Date.UTC(2019, 0, 21, 5, 12))).k >= 0.97, '2019 개기월식 = 보름(k≈1)');
  ok(moonIllum(new Date(Date.UTC(2000, 0, 21, 4, 44))).k >= 0.97, '2000 개기월식 = 보름(k≈1)');
  const waxing = moonIllum(new Date(Date.UTC(2017, 7, 25, 18, 0)));   // 신월 +4일
  ok(waxing.waxing && waxing.k > 0.03 && waxing.k < 0.5, '신월 +4일 = 차오르는 초승');
  const waning = moonIllum(new Date(Date.UTC(2019, 0, 25, 5, 0)));    // 보름 +4일
  ok(!waning.waxing && waning.k > 0.5, '보름 +4일 = 이지러지는 볼록달');
}

// ── 4. 밝은 면 벡터 불변식 (앱 MoonTiltRenderTests와 동일 도시×시각 그리드) ──
const CITIES = [[37.5665, 126.978], [-33.8688, 151.2093], [51.5074, -0.1278],
  [40.7128, -74.006], [1.3521, 103.8198], [69.6492, 18.9553], [-54.8019, -68.303]];
const TIMES = [Date.UTC(2026, 3, 21, 11, 30), Date.UTC(2026, 3, 21, 19, 45),
  Date.UTC(2026, 3, 24, 5, 0), Date.UTC(2026, 3, 24, 14, 0),
  Date.UTC(2026, 6, 20, 3, 0), Date.UTC(2026, 11, 21, 18, 0)];
{
  // (right, up) = (sinψ, cosψ) — **관측자 시야각 그 자체** (앱 bdd3266b 파리티).
  // 독립 alt/az bearing 공식과 두 성분 모두 일치해야 한다.
  let rightBad = 0, upBad = 0;
  for (const [lat, lng] of CITIES) for (const t of TIMES) {
    const d = new Date(t);
    const s = sunAltAt(d, lat, lng), m = moonAltAt(d, lat, lng);
    const lv = moonLimbVector(d, lat, lng);
    const rad = Math.PI / 180, phi = rad * lat;
    function az(p) {   // 방위각(북 기준 시계방향, 라디안) — 앱 horizontal()과 동일 규약
      return Math.atan2(Math.sin(p.H), Math.cos(p.H) * Math.sin(phi) - Math.tan(p.dec) * Math.cos(phi)) + Math.PI;
    }
    const dAz = az(s) - az(m), aS = rad * s.alt, aM = rad * m.alt;
    const vert = Math.cos(aM) * Math.sin(aS) - Math.sin(aM) * Math.cos(aS) * Math.cos(dAz);
    const horiz = Math.sin(dAz) * Math.cos(aS);
    const norm = Math.hypot(vert, horiz);
    if (norm > 1e-9) {
      if (Math.abs(lv.up - vert / norm) > 0.02) upBad++;
      if (Math.abs(lv.right - horiz / norm) > 0.02) rightBad++;
    }
  }
  ok(upBad === 0, 'up = alt/az bearing 항등식 (위반 ' + upBad + ')');
  ok(rightBad === 0, 'right = alt/az bearing 항등식 (위반 ' + rightBad + ')');

  // 반구 관례 (유저 실측 장면): 남반구 왁싱=왼쪽·웨이닝=오른쪽, 북반구 왁싱=오른쪽.
  const chcWax = moonLimbVector(new Date(Date.UTC(2026, 6, 26, 7, 40)), -43.53, 172.63);
  ok(chcWax.right < 0, '크라이스트처치 왁싱 gibbous = 밝은면 왼쪽 (실측 그 장면)');
  const seoulWax = moonLimbVector(new Date(Date.UTC(2026, 6, 26, 12, 0)), 37.5665, 126.978);
  ok(seoulWax.right > 0, '서울 왁싱 gibbous = 밝은면 오른쪽');
  const chcWane = moonLimbVector(new Date(Date.UTC(2026, 7, 7, 18, 30)), -43.53, 172.63);
  ok(chcWane.right > 0, '크라이스트처치 웨이닝 = 밝은면 오른쪽');
}

// ── 5. 저녁 초승달(서울): 밝은 면이 해 쪽(오른쪽)-아래를 본다 ──
{
  const d = new Date(Date.UTC(2026, 3, 21, 11, 30));   // 서울 20:30 KST, 월령 ~4일
  const s = sunAltAt(d, 37.5665, 126.978), m = moonAltAt(d, 37.5665, 126.978);
  const ill = moonIllum(d), lv = moonLimbVector(d, 37.5665, 126.978);
  ok(s.alt < 0 && m.alt > 0 && ill.k < 0.5, '장면 전제(해 짐·달 떠 있음·초승)');
  ok(lv.right > 0, '저녁 초승달: 오른쪽(진 해 방향)을 본다');
  ok(lv.up < 0, '저녁 초승달: 아래(진 해 쪽)를 본다');
}

// ── 6. 자정 시간각 wrap에서 회전이 튀지 않는다 (앱과 동일 스윕) ──
{
  let prev = null, maxJump = 0;
  for (let i = 0; i <= 40; i++) {
    const d = new Date(Date.UTC(2026, 3, 21, 14, 40) + i * 120000);
    const lv = moonLimbVector(d, 37.5665, 126.978);
    const r = Math.atan2(-lv.up, lv.right);
    if (prev !== null) {
      let g = Math.abs(r - prev);
      if (g > Math.PI) g = 2 * Math.PI - g;
      maxJump = Math.max(maxJump, g * 180 / Math.PI);
    }
    prev = r;
  }
  ok(maxJump < 8, '자정 wrap 무점프 (최대 ' + maxJump.toFixed(2) + '°/2분)');
}

// ── 7. SVG 모양 회귀: 터미네이터 호의 sweep — 초승=0(반원−렌즈), 볼록=1(반원+렌즈).
//      옛 코드는 반대로 매핑해 초승↔볼록이 뒤집혀 있었다 (하네스 렌더로 실측).
//      신월 근처엔 보름 원반(<circle>)을 그리지 않는다 (옛 버그 2).
{
  const sweepOf = svg => (svg.match(/a [\d.]+ 16 0 0 (\d) 0 -32/) || [])[1];
  ok(sweepOf(moonSVG(0.2)) === '0', '초승(k=0.2) 터미네이터 sweep=0');
  ok(sweepOf(moonSVG(0.8)) === '1', '볼록(k=0.8) 터미네이터 sweep=1');
  // ⚠ '<circle'만 찾으면 clipPath의 마스크 원까지 걸린다 — **채움 원반**은
  //   fill 속성이 붙은 것만이다.
  const fullDisc = svg => /<circle[^>]*fill=/.test(svg);
  ok(!fullDisc(moonSVG(0.01)), '신월 근처엔 원반을 안 그린다');
  ok(fullDisc(moonSVG(0.99)), '보름은 원반을 채운다');
  // k∈(0.94,0.97]은 아직 보름이 아니다 — isFull 문턱이 noBlur와 어긋나
  // 보름 원반+죽은 blur path를 겹치던 결함(적대 리뷰) 회귀 방지.
  ok(!fullDisc(moonSVG(0.95)), 'k=0.95는 아직 보름 원반이 아니다');
}

// ── 8. 시간각→가로 소프트니 (요청: 뜨고 질 때 수직 낙하 금지) ──
//      중앙은 옛 선형과 동일, |t|>0.9부턴 단조 전진하되 96%에 점근 — x가
//      가장자리에 박히지 않아 해·달이 포물선으로 뜨고 진다.
{
  const rad90 = Math.PI / 2;
  near(tlXFrac(0), 50, 1e-9, '남중 = 중앙 50%');
  near(tlXFrac(0.5 * rad90), 71, 1e-6, '중앙부는 옛 선형 그대로 (t=0.5 → 71%)');
  let mono = true, bounded = true, prev = -1;
  for (let t = -2.4; t <= 2.4; t += 0.02) {
    const x = tlXFrac(t * rad90);
    if (x <= prev) mono = false;
    if (x < 3.9 || x > 96.1) bounded = false;
    prev = x;
  }
  ok(mono, '가로 위치는 시간각에 단조 증가 (가장자리에 안 박힌다)');
  ok(bounded, '가로 위치는 4~96% 안에 머문다');
  ok(tlXFrac(1.3 * rad90) < 96 && tlXFrac(1.3 * rad90) > tlXFrac(1.1 * rad90),
     '옛 클램프 구간(|t|>1.095)에서도 계속 전진');
}

if (failed) { console.error('moon-astro-parity: ' + failed + ' FAILED'); process.exit(1); }
console.log('moon-astro-parity: all passed');
