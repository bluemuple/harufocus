/* 완료의 두 규칙 — **한 곳에서만** 토글하고, 눌러도 시야가 안 움직인다.
   실행: node tests/done-link-keepscroll.js

   신고 두 건(2026-08-06)이 사실 한 뿌리였다.
   ② 타임라인의 마감선 완료 동그라미를 누르면 화면이 '지금'으로 튀었다 —
      renderBig의 기본값이 '지금 줄로 데려가기'인데(첫 렌더·탭 열기엔 맞다)
      완료 토글이 그 기본값을 그대로 다시 돌렸다.
   ③ 할 일 목록에서 완료하면 renderTodo만 돌아, 옆에 나란히 뜬 타임라인의
      같은 작업 마감선은 미완료인 채였다(PC·아이패드는 두 화면이 한 화면에
      같이 있다). 반대 방향(마감선 → 목록)만 renderAll이라 맞았다.

   그래서 규약: **완료 토글은 어느 화면에서 눌러도 renderAllKeepTl 하나**.
   - renderAll  → 마감선·목록·모자이크·매트릭스·아바타가 같은 사실을 본다 (③)
   - KeepTl     → 그 렌더에서만 타임라인 스크롤을 그대로 둔다 (②)

   ⚠ 이 파일이 못 박는 것: 나중에 누가 '가볍게' 되돌리려고 renderTodo로
   낮추거나, KeepTl을 떼고 renderAll로 되돌리면 여기서 깨진다. 둘 다 예전에
   실제로 그랬던 모양이라 주석만으론 안 지켜진다. */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };
const flat = s => s.replace(/\s/g, '');

// ── 0. 헬퍼가 있다 ────────────────────────────────────────────────────────
const SRCF = flat(SRC);
t('renderAllKeepTl = 깃발 세우고 renderAll',
  /functionrenderAllKeepTl\(\)\{tlKeepScroll=true;renderAll\(\);\}/.test(SRCF));
t('tlKeepScroll 깃발이 선언돼 있다', /vartlKeepScroll=false;/.test(SRCF));

// ── 1. renderBig이 깃발을 읽고 **반드시 내린다** ──────────────────────────
const rbI = SRC.indexOf('function renderBig(){');
const rb = SRC.slice(rbI, SRC.indexOf('\n  function ', rbI + 10));
const rbFlat = flat(rb);
t('renderBig을 찾았다', rbI > 0 && rb.length > 2000);
t('keepReq = 깃발 ∧ !tlHomePending ∧ clientHeight>0',
  /varkeepReq=tlKeepScroll&&!tlHomePending&&sc\.clientHeight>0;/.test(rbFlat));
/* ⚠ 일회용이 아니면 다음 렌더까지 자리를 지켜, 날짜를 바꿔도 '지금'으로 못 간다. */
t('⚠깃발을 곧바로 내린다 (일회용)', /varkeepReq=[^;]*;tlKeepScroll=false;/.test(rbFlat));
t('prevScroll이 keepReq를 쓴다',
  /varprevScroll=\(batchIds!=null\|\|tlDragging\|\|keepReq\)\?sc\.scrollTop:null;/.test(rbFlat));
/* ⚠ 화면 밖 렌더(clientHeight 0)에서 자리를 지키면 scrollTop 0 = 어제 자정에
   박힌다. 그 경우의 '지금으로 데려가기'(setTimeout 분기)는 그대로 있어야 한다. */
t('⚠화면 밖이면 tlHomePending을 세우는 분기가 그대로다',
  /if\(!sc\.clientHeight\)\{tlHomePending=true;return;\}/.test(rbFlat));

// ── 2. 완료 토글 **전부**가 같은 한 함수를 부른다 ─────────────────────────
// 마감선 동그라미 (타임라인 → 목록)
const dlI = SRC.indexOf("dl.querySelector('.dl-radio').addEventListener");
const dlH = SRC.slice(dlI, dlI + 260);
t('마감선 동그라미를 찾았다', dlI > 0);
t('② 마감선 동그라미 = renderAllKeepTl', /renderAllKeepTl\(\);/.test(dlH));
t('⚠ 마감선 동그라미가 맨 renderAll로 되돌아가지 않았다', !/[^l]renderAll\(\);/.test(dlH));

// 할 일 bar 체크 (목록 → 타임라인) — 완료 섹션의 해제 포함
const btrI = SRC.indexOf('function buildTodoRow(t,inDone){');
const btr = SRC.slice(btrI, SRC.indexOf('\n  // 인라인 하위작업', btrI));
t('buildTodoRow를 찾았다', btrI > 0 && btr.length > 1000);
const checks = btr.match(/\.check'\)\.addEventListener\('click',function\(\)\{[^}]*\}/g) || [];
t('할 일 bar의 체크 핸들러가 둘이다 (완료·해제)', checks.length === 2);
t('③ 체크 핸들러 둘 다 renderAllKeepTl',
  checks.length === 2 && checks.every(h => /renderAllKeepTl\(\)/.test(h)));
t('⚠ 체크 핸들러에 renderTodo만 남아 있지 않다',
  checks.every(h => !/renderTodo\(\)/.test(h)));

// n회 카운터: **완료가 된 순간만** 전 화면
const plusI = btr.indexOf("var pb=row.querySelector('.t-plus')");
const plus = flat(btr.slice(plusI, plusI + 420));
t('t-plus를 찾았다', plusI > 0);
t('n회 채워 완료된 순간만 renderAllKeepTl',
  /if\(t\.countDone>=t\.countTarget\)\{[^}]*renderAllKeepTl\(\);\}elserenderTodo\(\);/.test(plus));

// ── 3. 완료가 아닌 조작은 그대로 renderTodo (전 화면을 다시 그릴 이유가 없다)
const starH = (btr.match(/\.star'\)\.addEventListener\('click',function\(\)\{[^}]*\}/) || [''])[0];
t('별표는 renderTodo 그대로', /renderTodo\(\)/.test(starH) && !/renderAllKeepTl/.test(starH));

console.log((fail ? 'FAIL ' : 'OK ') + (ran - fail) + '/' + ran);
process.exit(fail ? 1 : 0);
