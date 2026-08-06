/* 페이지 액센트의 **무채색 가드** — 웹 검증 + 앱 상수 파리티.
   실행: node tests/sky-accent-guard.js

   배경 (2026-08-06):
   앱에서 아침 8시대에 할 일·일기 페이지의 ＋ 버튼이 **초록**으로 떴다.
   액센트는 지평선 색의 hue를 채도 하한 0.45로 부풀려 만드는데, 태양 고도
   10~12°에서 지평선이 거의 무채색(#E6EDEB, 채도 0.03)을 지난다. 무채색의
   hue는 채널 1/255 차이에 100° 넘게 흔들려 무의미한데, 그 값을 0.45까지
   부풀리자 하늘에 없는 초록(#81EBD1)·연두(#BDEB81)가 만들어졌다.
   타임라인만 고정 2색(timelineFixed) 경로라 멀쩡했다 — 같은 사실을 두 곳이
   다르게 판단하던 이 저장소의 단골 결함 모양.

   웹은 이번에 같은 규칙을 **처음** 갖게 됐다(전엔 --sky-blue 고정색). 그래서
   이 파일은 두 가지를 본다: 웹 계산이 초록을 못 만드는가, 그리고 상수 넷이
   앱 SkyTheme.swift와 같은가. */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '/../index.html'), 'utf8');
const SWIFT = path.join(process.env.HOME, 'Documents/Sundial/Sundial/Engine/SkyTheme.swift');

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

const CONSTS = (SRC.match(/var PG_TRUST_LO=[^\n]*/) || [''])[0];
const FNS = ['smooth01', 'hx', 'lerpHex', 'hexInt', 'chan', 'relLum',
             'contrastRatio', 'skyAccent', 'skyPalette'].map(grab).join('\n');
const api = new Function(CONSTS + '\n' + FNS +
  '\nreturn {skyAccent:skyAccent, skyPalette:skyPalette, PG:{lo:PG_TRUST_LO, hi:PG_TRUST_HI,' +
  ' day:PG_REF_DAY, night:PG_REF_NIGHT}};')();

let fails = 0;
function ok(cond, msg) { if (!cond) { fails++; console.error('  ✗ ' + msg); } }
function head(t) { console.log(t); }

function hsb(hex) {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16 & 255) / 255, g = (v >> 8 & 255) / 255, b = (v & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) h = (mx === r ? (((g - b) / d) % 6 + 6) % 6 : (mx === g ? (b - r) / d + 2 : (r - g) / d + 4)) * 60;
  return { h, s: mx === 0 ? 0 : d / mx, b: mx };
}
const accentAt = (alt, dawn) => api.skyAccent(api.skyPalette(alt, dawn)).accent;

// ── 1. 하늘 어디에도 없는 선명한 초록이 나오면 안 된다.
//    가드 없으면 고도 10.5°에서 채도 0.45(#BDEB81)로 깨진다.
head('1. 전 고도 초록대(75~165°) 채도');
{
  let worst = { s: 0 };
  for (const dawn of [true, false]) {
    for (let i = -180; i <= 500; i++) {
      const c = accentAt(i / 10, dawn), t = hsb(c);
      if (t.h >= 75 && t.h <= 165 && t.s > worst.s) worst = { s: t.s, alt: i / 10, c, dawn };
    }
  }
  ok(worst.s < 0.25, `선명한 초록 액센트: 채도 ${worst.s.toFixed(3)} @ 고도 ${worst.alt}° ${worst.c}`);
  console.log(`   최대 채도 ${worst.s.toFixed(3)}${worst.c ? ' (' + worst.c + ' @ ' + worst.alt + '°)' : ''}`);
}

// ── 2. 유저가 초록 ＋를 목격한 순간 (오클랜드 8/6 08:19 ≈ 고도 10.4°).
head('2. 문제의 순간 = 타임라인과 같은 하늘색');
{
  const c = accentAt(10.4, true);
  ok(c.toUpperCase() === '#80CDE9', `고도 10.4°가 ${c} (기대 #80CDE9)`);
}

// ── 3. 무채색 구간에선 페이지 ＋ = 타임라인 ＋ (유저 불만의 본체).
head('3. 무채색 구간에서 타임라인과 일치');
for (let a = 10; a <= 13; a += 0.25) {
  const c = accentAt(a, true);
  ok(c.toUpperCase() === '#80CDE9', `고도 ${a}°가 ${c}`);
}

// ── 4. 가드가 과하지 않은가 — 일출·일몰의 따뜻한 색은 살아 있어야 한다.
head('4. 일출 따뜻한 액센트 생존');
for (let a = 6; a >= 0; a--) {
  const t = hsb(accentAt(a, true));
  ok(t.h >= 5 && t.h <= 60, `고도 ${a}°의 hue ${t.h.toFixed(0)}°가 따뜻하지 않다`);
  ok(t.s >= 0.45, `고도 ${a}°의 채도 ${t.s.toFixed(2)}가 흐리다`);
}

// ── 5. 고도에 대해 연속 — 튀면 시간이 흐를 때 색이 점프한다.
head('5. 연속성 (0.1° 스텝)');
{
  let worst = { j: 0 };
  for (const dawn of [true, false]) {
    let prev = parseInt(accentAt(-18, dawn).slice(1), 16);
    for (let i = -179; i <= 500; i++) {
      const v = parseInt(accentAt(i / 10, dawn).slice(1), 16);
      const j = Math.max(Math.abs((v >> 16 & 255) - (prev >> 16 & 255)),
                         Math.abs((v >> 8 & 255) - (prev >> 8 & 255)),
                         Math.abs((v & 255) - (prev & 255))) / 255;
      if (j > worst.j) worst = { j, alt: i / 10 };
      prev = v;
    }
  }
  ok(worst.j < 0.09, `고도 ${worst.alt}°에서 점프 ${worst.j.toFixed(3)}`);
  console.log(`   최대 점프 ${worst.j.toFixed(4)} @ 고도 ${worst.alt}°`);
}

// ── 6. 앱과 상수가 같은가. 여기가 갈리면 두 화면이 다른 색을 그린다.
head('6. 앱 SkyTheme.swift 상수 파리티');
if (!fs.existsSync(SWIFT)) {
  console.log('   (앱 저장소 없음 — 건너뜀)');
} else {
  const sw = fs.readFileSync(SWIFT, 'utf8');
  const num = (re, label) => {
    const m = sw.match(re);
    ok(!!m, `Swift에서 ${label}를 못 찾았다 (이름이 바뀌었나?)`);
    return m ? m[1] : null;
  };
  const lo = num(/hueTrustLo\s*=\s*([0-9.]+)/, 'hueTrustLo');
  const hi = num(/hueTrustHi\s*=\s*([0-9.]+)/, 'hueTrustHi');
  const day = num(/refAccentDay\s*=\s*RGB\(hex:\s*0x([0-9A-Fa-f]{6})\)/, 'refAccentDay');
  const night = num(/refAccentNight\s*=\s*RGB\(hex:\s*0x([0-9A-Fa-f]{6})\)/, 'refAccentNight');
  ok(parseFloat(lo) === api.PG.lo, `hueTrustLo 앱 ${lo} ≠ 웹 ${api.PG.lo}`);
  ok(parseFloat(hi) === api.PG.hi, `hueTrustHi 앱 ${hi} ≠ 웹 ${api.PG.hi}`);
  ok(parseInt(day, 16) === api.PG.day, `refAccentDay 앱 #${day} ≠ 웹 #${api.PG.day.toString(16)}`);
  ok(parseInt(night, 16) === api.PG.night, `refAccentNight 앱 #${night} ≠ 웹 #${api.PG.night.toString(16)}`);
}

console.log(fails ? `\n실패 ${fails}건` : '\n통과');
process.exit(fails ? 1 : 0);
