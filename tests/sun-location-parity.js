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
  // 시간대→좌표 표 (2026-07-31: 폴백이 서울에서 '시간대 추정'으로 바뀜)
  (SRC.match(/var TZ_GEO=\{[\s\S]*?\n  \};/) || [''])[0],
].join('\n');
const HELPERS = ['toDays', 'julianCycle', 'approx', 'M', 'eclLng', 'dec',
                 'solarTransitJ', 'hourAngle', 'sunTimes', 'obsLat', 'obsLng', 'geoSaved',
                 'tzGeo', 'isSeoulPoison', 'isTzEstimate']
  .map(n => { try { return grab(n); } catch (e) { return '/* missing: ' + n + ' */'; } })
  .join('\n');

const harness = `
  ${CONSTS}
  var store = {};
  var localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  var DATA = { settings: {} };
  var __tz = 'Asia/Seoul', __off = -540;
  var Intl = { DateTimeFormat: function(){ return { resolvedOptions: function(){
    return { timeZone: __tz }; } }; } };
  var Date = globalThis.Date;
${HELPERS}
  module.exports = { sunTimes, obsLat, obsLng, geoSaved,
    setSaved(o){ if(o) store['harufocusGeo'] = JSON.stringify(o); else delete store['harufocusGeo']; },
    setSettings(s){ DATA.settings = s || {}; },
    setTZ(z){ __tz = z; },
    tzGeo, isSeoulPoison };
`;
const m = new module.constructor();
m._compile(harness, '/sun-harness.js');
const W = m.exports;

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ── 좌표 우선순위: 설정 → 브라우저 저장값 → 서울 ─────────────────────────
/* ⚠ 2026-07-31 규칙 변경: 폴백은 더 이상 **무조건 서울이 아니다**.
   위치 권한이 없으면 **시간대에서 추정**한다 — 예전엔 뉴질랜드에서 켜도
   서울 하늘을 그려 "일출이 7:44인데 화면엔 벌써 해가 떠 있다"가 됐다.
   (앱 TimeZoneGeo와 같은 규칙 · 한쪽만 고치면 두 기기가 다른 하늘을 그린다.) */
W.setSettings({}); W.setSaved(null); W.setTZ('Asia/Seoul');
t('한국 시간대면 서울', near(W.obsLat(), 37.57, 0.01) && near(W.obsLng(), 126.98, 0.01));

W.setTZ('Pacific/Auckland');
t('⚠뉴질랜드 시간대면 **남반구** 좌표 (서울로 안 떨어진다)', W.obsLat() < 0);

W.setTZ('America/New_York');
t('뉴욕 시간대면 서반구 좌표', W.obsLat() > 0 && W.obsLng() < 0);

W.setTZ('Antarctica/Troll');   // 표에 없는 시간대
t('모르는 시간대면 위도는 적도(어느 반구로도 안 치우침)', W.obsLat() === 0);

// ── 이미 저장돼 버린 서울 좌표 세척 ─────────────────────────────────────
/* 폴백만 고쳐선 부족했다: 옛 앱이 서울 폴백을 스냅샷 settings로 밀어 넣었고,
   위치를 거부한 브라우저는 localStorage에 서울을 박아 뒀다. */
W.setTZ('Pacific/Auckland'); W.setSettings({ lat: 37.5665, lng: 126.9780 });
t('⚠뉴질랜드에서 저장된 서울 값은 무시된다', W.obsLat() < 0);

W.setSettings({}); W.setSaved({ lat: 37.5665, lng: 126.9780 });
t('⚠거부 표식으로 박힌 서울도 무시된다', W.obsLat() < 0);

/* ⚠ 저장된 값이 **시간대 추정치와 똑같으면** 잰 값이 아니다 (2026-07-31 실제
   상황): 옛 코드가 거부 시 추정 좌표를 저장해 둬서, 유저가 나중에 위치를
   허용해도 "이미 저장값이 있다"며 다시 묻지 않아 영영 추정치를 썼다.
   (크라이스트처치 사람이 오클랜드 좌표에 묶여 일출이 23분 일렀다.) */
W.setTZ('Pacific/Auckland'); W.setSettings({}); W.setSaved({ lat: -36.85, lng: 174.76 });
t('⚠저장값이 시간대 추정치와 같으면 잰 값으로 안 친다',
  W.geoSaved() === null);
W.setSaved({ lat: -43.53, lng: 172.64 });     // 진짜로 잰 크라이스트처치
t('진짜 측정값은 그대로 쓴다', near(W.obsLat(), -43.53, 1e-6));
W.setSaved({ est: true });                     // 거부 표식
t('거부 표식이면 시간대 추정으로 떨어진다', near(W.obsLat(), -36.85, 0.01));

W.setTZ('Asia/Seoul'); W.setSettings({ lat: 37.5665, lng: 126.9780 }); W.setSaved(null);
t('한국에서는 서울 값을 그대로 쓴다 (오탐 금지)', near(W.obsLat(), 37.5665, 1e-6));

W.setSettings({}); W.setSaved(null); W.setTZ('Asia/Seoul');

W.setSaved({ lat: 51.5074, lng: -0.1278 });          // 브라우저가 준 런던
t('브라우저 위치가 있으면 그걸 쓴다', near(W.obsLat(), 51.5074, 1e-6));

W.setSettings({ lat: -33.8688, lng: 151.2093 });      // 사용자가 설정한 시드니
t('설정이 브라우저 위치보다 우선', near(W.obsLat(), -33.8688, 1e-6));

W.setSettings({}); W.setSaved(null);

/* ⚠⚠ **실제 관측값 회귀 테스트** (2026-07-31 유저 제보).
   유저가 크라이스트처치에서 "일출 7:44인데 웹 타임라인엔 벌써 해가 떠 있다"고
   신고했고, 구글이 그날 일출을 오전 7:44로 확인해 줬다. 그 숫자를 그대로 못
   박는다 — '서울이 아니다'보다 훨씬 강한 검증이다.
   ⚠ 서울 폴백이었을 땐 같은 날 NZ 시각으로 **일몰 22:43**이 나왔다.
     앱에서 "일몰 10:43"으로 신고된 바로 그 숫자다. */
{
  const nz = t => t.toLocaleTimeString('en-GB',
    { timeZone: 'Pacific/Auckland', hour: '2-digit', minute: '2-digit' });
  const day = new Date('2026-07-31T00:00:00Z');
  const ch = W.sunTimes(day, -43.53, 172.64);
  t('크라이스트처치 2026-07-31 일출 = 07:4x (구글 07:44)', nz(ch.sunrise).startsWith('07:4'));
  const sl = W.sunTimes(day, 37.5665, 126.9780);
  t('⚠서울 폴백이면 NZ 시각 일몰이 22시대 = 앱 "일몰 10:43" 재현', nz(sl.sunset).startsWith('22:'));
}

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
