/* 타임라인 시계 표기 — **앱과 같은 규칙** (요청 2026-08-07).
   실행: node tests/clock-format.js

   신고: "웹 타임라인 좌측 시간을 15:00 → 03:00 형태로 (아무튼 앱과 동일한 형식).
          좌측 시간 및 우측 캡슐에 적용"

   원인: 웹이 24시로 **하드코딩**돼 있었다(`getHours().padStart(2,'0')`).
   앱은 `hour(.twoDigits(amPM: .omitted))`라 **기기 설정을 따른다** — 그래서
   12시간제 지역(뉴질랜드)에서 같은 마감이 앱 `03:00` / 웹 `15:00`으로 갈렸다.
   → 웹도 같은 규칙으로: 기기가 12시간제면 12시간, **두 자리**, 오전/오후는 뺀다.

   ⚠ 이 파일이 못 박는 것
   ⑴ 규칙 자체 (12/24 갈래 · 두 자리 · 자정/정오 경계)
   ⑵ 타임라인의 시계 글자가 **한 함수**에서만 나온다 — 고스트 캡슐과 마감 캡슐이
      다른 식을 쓰면 떨어뜨리는 순간 숫자가 튄다(이 저장소가 이미 겪은 사고). */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const flat = s => s.replace(/\s/g, '');
const codeOnly = flat(SRC.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').filter(l => !/^\s*(\/\/|⚠|·|⑴|⑵)/.test(l)).join('\n'));

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };

// ── ⑴ 규칙을 그대로 옮겨 성질을 본다 ────────────────────────────────────
const clockHM = (h, m, hour12) => {
  let hh = h;
  if (hour12) hh = (h % 12) || 12;
  return ('0' + hh).slice(-2) + ':' + ('0' + m).slice(-2);
};
const clockHour = (h24, hour12) => {
  let h = h24 % 24;
  if (hour12) h = (h % 12) || 12;
  return ('0' + h).slice(-2) + ':00';
};

t('12시간제: 15시 → 03 (신고 그 자체)', clockHour(15, true) === '03:00');
t('12시간제: 자정 0시 → 12 (00이 아니다)', clockHour(0, true) === '12:00');
t('12시간제: 정오 12시 → 12', clockHour(12, true) === '12:00');
t('12시간제: 오전 3시 → 03', clockHour(3, true) === '03:00');
t('12시간제: 23시 → 11', clockHour(23, true) === '11:00');
t('24시간제는 그대로 15', clockHour(15, false) === '15:00');
t('24시간제 자정은 00', clockHour(0, false) === '00:00');
/* ⚠ 두 자리 고정 — 한 자리로 흔들리면 시간줄 글자 폭이 들쭉날쭉해진다. */
t('언제나 두 자리', clockHour(9, true).length === 5 && clockHour(9, false).length === 5);
t('분도 두 자리', clockHM(15, 5, true) === '03:05');
t('24시를 넘겨도 감긴다 (h%24)', clockHour(25, false) === '01:00');

// ── ⑵ 소스가 실제로 그 규칙을 쓰는가 ────────────────────────────────────
t('hour12를 로케일에서 한 번만 판정한다',
  /var_hour12=\(function\(\)\{try\{return!!newIntl\.DateTimeFormat\(LOCALE,\{hour:'numeric'\}\)\.resolvedOptions\(\)\.hour12;\}/.test(codeOnly));
t('clockHM이 12시간 갈래를 갖는다',
  /functionclockHM\(d\)\{varh=d\.getHours\(\);if\(_hour12\)h=\(h%12\)\|\|12;/.test(codeOnly));
t('clockHour도 같은 갈래', /functionclockHour\(h24\)\{varh=h24%24;if\(_hour12\)h=\(h%12\)\|\|12;/.test(codeOnly));
t('fmtTime(할 일 줄 시각)도 같은 함수를 쓴다',
  /functionfmtTime\(iso\)\{if\(!iso\)return'—';returnclockHM\(newDate\(iso\)\);\}/.test(codeOnly));

t('좌측 시간줄이 clockHour를 쓴다', /'<spanclass="lbl">'\+clockHour\(h\)\+'<\/span>'/.test(codeOnly));
t('마감 캡슐이 clockHM을 쓴다', /varhhmmTxt=clockHM\(due\);/.test(codeOnly));

/* ⚠ 고스트 캡슐 둘 — 마감 캡슐과 **같은 함수**여야 놓는 순간 글자가 안 튄다.
   (이 저장소 규칙: "고스트와 추가된 뒤 마감선의 값이 같아야 한다") */
t('⚠드래그 고스트 캡슐도 clockHM', /var_gh=clockHM\(d\);/.test(codeOnly));
t('⚠캡처 고스트 캡슐도 clockHM', /varg=clockHM\(d\);returnL\(g\+'까지','by'\+g\)/.test(codeOnly));
t('집게 라벨도 clockHM', /varlastHm=clockHM\(lastFut\);/.test(codeOnly));

/* ⚠ 옛 하드코딩 24시 식이 타임라인에 되살아나면 앱과 다시 갈린다. */
const tlStart = codeOnly.indexOf('functionrenderBig()');
const tlEnd = codeOnly.indexOf('functionrenderMosaic()', tlStart);
const tl = tlStart > 0 && tlEnd > tlStart ? codeOnly.slice(tlStart, tlEnd) : codeOnly;
t("⚠renderBig 안에 옛 24시 식이 없다",
  !/\('0'\+due\.getHours\(\)\)\.slice\(-2\)/.test(tl) &&
  !/\(h%24\)\.toString\(\)\.padStart\(2,'0'\)\+':00'/.test(tl));

console.log((fail ? 'FAIL ' : 'OK ') + (ran - fail) + '/' + ran);
process.exit(fail ? 1 : 0);
