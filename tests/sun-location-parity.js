/* 웹 태양 계산의 **관측 좌표**와 **극지 처리** 검증.
   index.html의 실제 함수 소스를 뽑아 node로 돌린다.

   배경(천문 감사에서 확정된 결함 2건):
   · 좌표가 크라이스트처치(-43.53, 172.63)로 하드코딩돼 있었고 사용자 위치로
     바꾸는 경로가 없었다 → 서울 사용자의 '해질녘까지'가 18시간 27분 틀렸다.
   · 극지에서 acos 인자가 |x|>1이면 NaN → Invalid Date가 상단바까지 흘러
     리터럴 'NaN분'이 표시됐다.

   실행: node tests/sun-location-parity.js */
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

// sunTimes가 기대는 상수·보조함수도 실제 소스에서 가져온다.
const CONSTS = [
  (SRC.match(/var rad=Math\.PI\/180[^\n]*/) || [''])[0],
  // 함수 밖 상수도 실제 소스에서 (값이 갈리면 검증이 무의미해진다)
  (SRC.match(/var GEO_KEY='[^']*';/) || [''])[0],
  (SRC.match(/var SEOUL=\{[^}]*\};/) || [''])[0],
].join('\n');
const HELPERS = ['toDays', 'julianCycle', 'approx', 'M', 'eclLng', 'dec',
                 'solarTransitJ', 'hourAngle', 'sunTimes', 'obsLat', 'obsLng', 'geoSaved']
  .map(n => { try { return grab(n); } catch (e) { return '/* missing: ' + n + ' */'; } })
  .join('\n');

const harness = `
  ${CONSTS}
  var store = {};
  var localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  var DATA = { settings: {} };
${HELPERS}
  module.exports = { sunTimes, obsLat, obsLng,
    setSaved(o){ if(o) store['harufocusGeo'] = JSON.stringify(o); else delete store['harufocusGeo']; },
    setSettings(s){ DATA.settings = s || {}; } };
`;
const m = new module.constructor();
m._compile(harness, '/sun-harness.js');
const W = m.exports;

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ── 좌표 우선순위: 설정 → 브라우저 저장값 → 서울 ─────────────────────────
W.setSettings({}); W.setSaved(null);
t('저장값도 설정도 없으면 **서울** (요청: 거부 시 서울)',
  near(W.obsLat(), 37.5665, 1e-6) && near(W.obsLng(), 126.9780, 1e-6));

t('⚠회귀 방지: 크라이스트처치(-43.53)가 아니다', W.obsLat() > 0);

W.setSaved({ lat: 51.5074, lng: -0.1278 });          // 브라우저가 준 런던
t('브라우저 위치가 있으면 그걸 쓴다', near(W.obsLat(), 51.5074, 1e-6));

W.setSettings({ lat: -33.8688, lng: 151.2093 });      // 사용자가 설정한 시드니
t('설정이 브라우저 위치보다 우선', near(W.obsLat(), -33.8688, 1e-6));

W.setSettings({}); W.setSaved(null);

// ── 서울 일출·일몰이 현실적인가 (하지/동지) ───────────────────────────────
function kstHour(d) { return (d.getTime() / 3600000 % 24 + 9 + 24) % 24; }
const summer = W.sunTimes(new Date('2026-06-21T03:00:00Z'), 37.5665, 126.9780);
const winter = W.sunTimes(new Date('2026-12-21T03:00:00Z'), 37.5665, 126.9780);
t('서울 하지 일출 05시대 (KST)', Math.floor(kstHour(summer.sunrise)) === 5);
t('서울 하지 일몰 19시대 (KST)', Math.floor(kstHour(summer.sunset)) === 19);
t('서울 동지 일출 07시대 (KST)', Math.floor(kstHour(winter.sunrise)) === 7);
t('서울 동지 일몰 17시대 (KST)', Math.floor(kstHour(winter.sunset)) === 17);
t('하지 낮이 동지 낮보다 길다',
  (summer.sunset - summer.sunrise) > (winter.sunset - winter.sunrise));

// ── 극지: NaN/Invalid Date가 아니라 명시적 상태 ──────────────────────────
const tromso = W.sunTimes(new Date('2026-07-20T12:00:00Z'), 69.6492, 18.9553);
t('트롬쇠 7월 = 백야 (polar + midnightSun)',
  tromso.polar === true && tromso.midnightSun === true);
t('백야엔 일출·일몰이 null (Invalid Date 아님)',
  tromso.sunrise === null && tromso.sunset === null);

const svalbard = W.sunTimes(new Date('2026-12-21T12:00:00Z'), 78.2232, 15.6267);
t('롱이어비엔 12월 = 극야 (polar, midnightSun 아님)',
  svalbard.polar === true && svalbard.midnightSun === false);
t('극야에도 null (NaN분 회귀 방지)',
  svalbard.sunrise === null && svalbard.sunset === null);

// 일반 위도는 polar=false로 정상 동작
t('서울은 polar=false', summer.polar === false);

console.log(fail ? `\n${fail}/${ran} FAILED` : `\n${ran}/${ran} 통과`);
process.exit(fail ? 1 : 0);
