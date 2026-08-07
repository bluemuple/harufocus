/* 핀치 사다리 + **연속 2단 안내** (요청 2026-08-07). 실행: node tests/pinch-ladder-coach.js

   요청: "앱, 웹: 타임라인 너비가 가장 큰 타임라인에서 한번 핀치줌아웃 했을 때
          나오는 타임라인 모드 삭제 … 핀치 줌아웃 하라는 가이드 애니메이션
          (아래 연속 2번) 너비 큰 타임라인 → 하루 모자이크 / 하루 모자이크 → 주간 모자이크"

   앱 쪽에서 한 일: TimelineZoomLevel의 중간 단계(.compact)를 지웠다.
   웹엔 그 중간 단계가 **원래 없었다** — 대신 없던 것이 둘이다.
     ⑴ 하루 모자이크에서 한 칸 더 넓히는 핀치 (없으면 안내 2단의 두 번째 걸음이
        갈 곳이 없다 — 예전 웹은 '벌리면 모자이크' 한 방향뿐이었다)
     ⑵ 안내 자체

   ⚠ 이 파일이 못 박는 것
   ⑴ 사다리가 세 칸이고 **양방향**이다 (벌리면 넓게, 오므리면 좁게)
   ⑵ 안내가 두 단계이고 문구의 **도착지가 실제와 같다** — 앱에서 겪은 사고:
      단계를 지웠는데 문구는 "두 번 오므리면"으로 남아 안내가 길을 잃게 했다
   ⑶ 안내는 setMode **한 곳**을 감싼다 — 핀치·모드 버튼·M 키 어느 길로 와도
      같은 판단이 되도록. 길마다 따로 적으면 새 진입로에서 조용히 빠진다
   ⑷ 손가락 없는 기기에선 안 뜬다 (마우스로는 핀치할 수 없어 막다른 길)          */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const flat = s => s.replace(/\s/g, '');
const codeOnly = flat(SRC.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'));

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };

// ── ⑴ 규칙을 그대로 옮겨 성질을 본다 ────────────────────────────────────
const LADDER = ['big', 'mosaic', 'week'];
const step = (mode, dir) => {
  const i = LADDER.indexOf(mode); if (i < 0) return mode;
  return LADDER[Math.max(0, Math.min(LADDER.length - 1, i + dir))];
};
t('타임라인에서 한 번 벌리면 **하루 모자이크** (요청 그 자체)', step('big', 1) === 'mosaic');
t('하루 모자이크에서 한 번 더 벌리면 주간', step('mosaic', 1) === 'week');
t('주간에서 더 벌려도 갈 곳이 없다', step('week', 1) === 'week');
t('주간에서 오므리면 하루로', step('week', -1) === 'mosaic');
t('하루에서 오므리면 타임라인으로', step('mosaic', -1) === 'big');
t('타임라인에서 더 오므려도 갈 곳이 없다', step('big', -1) === 'big');
/* ⚠ 중간에 칸이 하나라도 끼면 이 두 줄이 먼저 깨진다 — 앱에서 지운 그 단계가
   웹에 슬그머니 생기는 것을 막는 자리. */
t('⚠ 사다리는 정확히 세 칸', LADDER.length === 3);

// ── ⑵ 소스가 그 사다리를 쓰는가 ─────────────────────────────────────────
t('핀치 사다리 배열', /varLADDER=\['big','mosaic','week'\];/.test(codeOnly));
t('벌리면 한 칸 넓게', /if\(r>1\.35\)\{base=0;step\(1\);\}/.test(codeOnly));
t('오므리면 한 칸 좁게 (예전 웹엔 없던 방향)', /elseif\(r<0\.74\)\{base=0;step\(-1\);\}/.test(codeOnly));
t('핀치를 듣는 판이 타임라인 **과 하루 모자이크** 둘',
  /\['view-big','view-mosaic'\]\.forEach/.test(codeOnly));

// ── ⑶ 2단 안내 ──────────────────────────────────────────────────────────
t('안내 1단: 오므리라고 말한다', /두손가락으로오므려보세요/.test(codeOnly));
t('안내 2단: 한 번 더', /한번<b>더<\/b>오므려보세요/.test(codeOnly));
/* ⚠ 도착지가 실제와 같아야 한다. 앱에서 겪은 사고: 중간 단계를 지웠는데
   문구는 "두 번 오므리면 하루"로 남아 있었다. */
t('⚠ 1단 도착지 = 하루 (‘두 번’이 아니다)',
  /오므리면하루전체가모자이크로/.test(codeOnly) && !/두번오므리면/.test(codeOnly));
t('⚠ 2단 도착지 = 이번 주', /한번만더하면이번주전체가모자이크로/.test(codeOnly));
t('영어도 같은 도착지',
  /Pinchinforthefull-daymosaic/.test(codeOnly) && /Justoncemoreforthewholeweek/.test(codeOnly));

t('⑶ 안내는 setMode 한 곳을 감싼다 (핀치·버튼·M 키 공통)',
  /var_setMode=setMode;setMode=function\(m\)\{varbefore=tlMode;_setMode\(m\);/.test(codeOnly));
t('첫 핀치 성공(big→mosaic)이 2단을 잇는다',
  /if\(before==='big'&&tlMode==='mosaic'&&!seen\(K2\)\)\{show\(true\);return;\}/.test(codeOnly));
t('주간에 닿으면 2단은 목적 달성으로 닫힌다',
  /if\(tlMode==='week'&&!seen\(K2\)\)\{mark\(K2\);close\(\);\}/.test(codeOnly));
t('타임라인을 벗어나면 1단은 닫힌다',
  /if\(tlMode!=='big'&&!seen\(K1\)\)\{mark\(K1\);close\(\);\}/.test(codeOnly));
/* ⚠ 스스로 닫힐 때도 '봤음'을 적는다 — 안 적으면 갈 때마다 다시 떠 잔소리가 된다. */
t('⚠ 자동으로 닫힐 때도 봤음으로 적는다',
  /hideT=setTimeout\(function\(\)\{mark\(second\?K2:K1\);close\(\);\}/.test(codeOnly));
t('본 사람에겐 다시 안 뜬다 (localStorage 두 열쇠)',
  /varK1='hfPinchCoach1Seen',K2='hfPinchCoach2Seen';/.test(codeOnly));

// ── ⑷ 손가락 없는 기기에선 안 뜬다 ──────────────────────────────────────
t("⚠ 터치가 없으면 안내를 아예 안 만든다",
  /varcanTouch=\('ontouchstart'inwindow\)\|\|navigator\.maxTouchPoints>0;/.test(codeOnly)
  && /if\(canTouch&&!seen\(K1\)\)setTimeout/.test(codeOnly));
t('모드가 바뀌어도 터치 없는 기기는 그냥 지나간다', /if\(!canTouch\)return;/.test(codeOnly));

// ── 그림·글자가 손을 막지 않는가 ────────────────────────────────────────
t('⚠ 안내는 손가락을 통과시킨다 (보면서 바로 핀치해야 한다)',
  /\.pinch-coach\{[^}]*pointer-events:none/.test(codeOnly));
t('화살표가 안쪽으로 오므려지는 애니메이션', /@keyframespcSqueeze\{/.test(codeOnly));
t('움직임 줄이기 설정이면 멈춘다',
  /@media\(prefers-reduced-motion:reduce\)\{\.pinch-coach\.pc-ringi\{animation:none\}\}/.test(codeOnly));
t('한국어 낱말이 한가운데서 안 끊긴다(keep-all)',
  /\.pinch-coach\.pc-h,\.pinch-coach\.pc-s\{word-break:keep-all/.test(codeOnly));

console.log((fail ? 'FAIL ' : 'OK ') + (ran - fail) + '/' + ran);
process.exit(fail ? 1 : 0);
