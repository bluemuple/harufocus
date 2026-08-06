/* 타임라인 스크롤의 기본값 + 완료의 단일 경로.
   실행: node tests/done-link-keepscroll.js

   신고 두 건(2026-08-06)이 사실 한 뿌리였다.
   ② 마감선 완료 동그라미를 누르면 화면이 '지금'으로 튀었다.
   ③ 할 일 목록에서 완료하면 renderTodo만 돌아, 나란히 뜬 타임라인의 같은
      작업 마감선은 미완료인 채였다(PC·아이패드는 두 화면이 한 화면에 같이 있다).

   ②의 진짜 정체는 **renderBig의 기본값**이었다. 기본이 '지금 줄로 데려가기'라,
   renderBig을 부르는 스물몇 곳이 전부 시야를 흔들었다 — 완료·✕·드래그를 놓는
   순간·집게를 놓는 순간·타임라인 드롭·편집 bar 전부, 그리고 **원격 동기화
   반영**까지(마감선이 미끄러지는 FLIP을 만들어 놓고 화면을 끌어당겨 못 보게
   했다). 한 곳씩 '자리 지켜' 표를 붙이는 건 이미 실패한 방법이라 **기본값을
   뒤집었다**: 아무 말 없으면 보던 자리, tlGoHome을 세운 곳만 '지금'으로.

   ⚠ 이 파일이 못 박는 것
   ⑴ 기본값이 다시 뒤집히지 않을 것 (goHome은 넷일 때만 참)
   ⑵ ⚠화면 밖(clientHeight 0)은 **반드시 goHome** — 거기서 scrollTop을 읽으면
      0이 나오고, 그 0을 지키면 어제 자정에 박힌다
   ⑶ '지금으로 가라'고 말하는 곳은 셋뿐 (날짜 ‹›·모드 전환)
   ⑷ 완료 토글은 어느 화면에서 눌러도 renderAll 하나 (③) */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };
const flat = s => s.replace(/\s/g, '');
const SRCF = flat(SRC);

// ── 1. 기본값: 보던 자리 유지 ─────────────────────────────────────────────
t('tlGoHome 깃발이 선언돼 있다', /vartlGoHome=false;/.test(SRCF));
t('⚠옛 이름(tlKeepScroll)이 남아 있지 않다 — 뜻이 반대라 섞이면 위험',
  !/tlKeepScroll/.test(SRC));

const rbI = SRC.indexOf('function renderBig(){');
const rb = SRC.slice(rbI, SRC.indexOf('\n  function ', rbI + 10));
const rbF = flat(rb);
t('renderBig을 찾았다', rbI > 0 && rb.length > 2000);
t('goHome = 깃발 ∨ tlHomePending ∨ 빈 컨테이너 ∨ 화면 밖',
  /vargoHome=tlGoHome\|\|tlHomePending\|\|!sc\.firstChild\|\|!sc\.clientHeight;/.test(rbF));
/* ⚠ 일회용이 아니면 다음 렌더까지 따라가, 완료 한 번에 화면이 계속 튄다. */
t('⚠깃발을 곧바로 내린다 (일회용)', /vargoHome=[^;]*;tlGoHome=false;/.test(rbF));
t('⚠기본이 유지 — prevScroll=goHome?null:scrollTop (조건이 뒤집히지 않았다)',
  /varprevScroll=goHome\?null:sc\.scrollTop;/.test(rbF));
t('⚠화면 밖이면 tlHomePending을 세우는 분기가 그대로다',
  /if\(!sc\.clientHeight\)\{tlHomePending=true;return;\}/.test(rbF));

// ── 2. '지금으로 가라'고 말하는 곳은 셋뿐 ────────────────────────────────
const goHomeSites = (SRC.match(/tlGoHome=true/g) || []).length;
t("tlGoHome=true는 정확히 3곳 (날짜 ‹, 날짜 ›, 모드 전환)", goHomeSites === 3);
t('날짜 ‹ 가 홈으로', /dayOffset--;tlGoHome=true;renderBig\(\);/.test(SRCF));
t('날짜 › 가 홈으로', /dayOffset\+\+;tlGoHome=true;renderBig\(\);/.test(SRCF));
t('타임라인 모드로 전환하면 홈으로', /if\(m==='big'\)\{tlGoHome=true;renderBig\(\);\}/.test(SRCF));

// ── 3. 시야를 흔들면 안 되는 곳들이 **맨 렌더**를 부른다 ─────────────────
//     (기본이 유지라, 여기에 아무 표시가 없는 것이 곧 올바른 상태다.)
const plain = (label, needle) => {
  const i = SRC.indexOf(needle);
  t(label + ' — 코드를 찾았다', i > 0);
  if (i > 0) t(label + ' — tlGoHome을 안 세운다 (=보던 자리 유지)',
    !/tlGoHome/.test(SRC.slice(Math.max(0, i - 400), i + 400)));
};
plain('② 마감선 완료 동그라미', "if(t.isDone)grantReward(t);renderAll();pushSnapshot();});");
plain('마감선 ✕ (마감선만 삭제)', "t.scheduledStart=null;t.planDueAt=null;\n        renderBig()");
plain('캡슐 드래그를 놓는 순간', 'nudgeDueTo(t,due);\n        renderBig();renderMosaic();pushSnapshot();');
plain('마감집게를 놓는 순간', 'tlDragging=false;clampDragging=false;renderAll();pushSnapshot();');
plain('타임라인에 떨어뜨린 순간', 'dropAt=null;clearDropLine();renderAll();pushSnapshot();return;');
plain('⚠원격 동기화 반영 (pollSync)', 'pullDomains().then(function(any){if(any){syncAnimPending=true;renderAll();}});');

// ── 4. 완료 토글은 어느 화면에서 눌러도 renderAll 하나 (③) ───────────────
const dlI = SRC.indexOf("dl.querySelector('.dl-radio').addEventListener");
t('마감선 동그라미를 찾았다', dlI > 0);
t('③ 마감선 동그라미 = renderAll (목록·모자이크·매트릭스가 같이 안다)',
  /renderAll\(\);/.test(SRC.slice(dlI, dlI + 260)));

const btrI = SRC.indexOf('function buildTodoRow(t,inDone){');
const btr = SRC.slice(btrI, SRC.indexOf('\n  // 인라인 하위작업', btrI));
t('buildTodoRow를 찾았다', btrI > 0 && btr.length > 1000);
const checks = btr.match(/\.check'\)\.addEventListener\('click',function\(\)\{[^}]*\}/g) || [];
t('할 일 bar의 체크 핸들러가 둘이다 (완료·해제)', checks.length === 2);
t('③ 체크 핸들러 둘 다 renderAll', checks.length === 2 && checks.every(h => /renderAll\(\)/.test(h)));
/* ⚠ 이게 신고 ③ 그 자체다 — renderTodo만 돌면 마감선이 안 따라온다. */
t('⚠ 체크 핸들러에 renderTodo만 남아 있지 않다', checks.every(h => !/renderTodo\(\)/.test(h)));

const plusI = btr.indexOf("var pb=row.querySelector('.t-plus')");
const plus = flat(btr.slice(plusI, plusI + 420));
t('t-plus를 찾았다', plusI > 0);
t('n회 채워 완료된 순간만 renderAll',
  /if\(t\.countDone>=t\.countTarget\)\{[^}]*renderAll\(\);\}elserenderTodo\(\);/.test(plus));

// 완료가 아닌 조작은 그대로 renderTodo (전 화면을 다시 그릴 이유가 없다)
const starH = (btr.match(/\.star'\)\.addEventListener\('click',function\(\)\{[^}]*\}/) || [''])[0];
t('별표는 renderTodo 그대로', /renderTodo\(\)/.test(starH) && !/renderAll\(\)/.test(starH));

console.log((fail ? 'FAIL ' : 'OK ') + (ran - fail) + '/' + ran);
process.exit(fail ? 1 : 0);
