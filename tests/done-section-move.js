/* 완료한 것은 **무엇이든** '완료됨'으로 내려간다 (요청 2026-08-07).
   실행: node tests/done-section-move.js

   신고: 타임라인에서 마감선 동그라미를 눌러 완료하면, 할 일 페이지의 그 bar가
   '완료됨'으로 안 내려가고 '담아둔 일'에 취소선만 그어진 채 남았다.
   (스크린샷: 웹 "Inbox 0"인데 그 아래 취소선 한 줄 / 앱 "EVERYTHING 1")

   원인: 완료 판정에 **마감선 유무라는 예외**가 있었다.
     웹  bkDone = !t.scheduledStart && t.isDone   ← 배치된 건 안 내려감
     앱  doneTasks = scheduledStart == nil && isDone
   머리줄 개수는 미완료만 세므로 "0인데 한 줄이 보이는" 모순까지 났다.

   이 파일이 못 박는 것
   ⑴ 웹의 완료/미완료 가르기에 scheduledStart가 다시 끼어들지 않을 것
   ⑵ 머리줄 개수와 실제 줄 수가 어긋나지 않을 것 (모순의 원인 자체)
   ⑶ ⚠앱도 같은 규칙일 것 — **앱 TodoView.swift를 직접 읽어** 판정을 묶는다.
      한쪽만 고치면 또 조용히 갈라지는 자리라서 (선례: tests/task-updated-stamp.js). */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const flat = s => s.replace(/\s/g, '');
/* ⚠ **주석을 걷어낸 사본**. 이 수정을 설명하는 주석이 옛 규칙을 그대로 인용하고
   있어서(“예전엔 `!t.scheduledStart && t.isDone`이라…”), 통짜 검색으로 "옛 규칙이
   없다"를 확인하면 **주석 때문에 영영 실패**한다. 반대로 긍정 검사에서는 주석이
   가짜 통과를 만든다 — 어느 쪽이든 주석은 코드가 아니다.
   (같은 함정을 앱 SundialTests/SyncFeedbackTests.swift에서도 겪었다.) */
const codeOnly = flat(
  SRC.replace(/\/\*[\s\S]*?\*\//g, ' ')          // /* ... */ (CSS·JS 공통)
     .split('\n').filter(l => !/^\s*(\/\/|⚠|·)/.test(l)).join('\n'));

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };

// ── ⑴ 웹: 가르기 기준은 isDone 하나 ──────────────────────────────────────
const i = SRC.indexOf('var bkDone=');
t('완료/미완료 가르기를 찾았다', i > 0);
const split = flat(SRC.slice(i, i + 260));

t('bkDone = isDone 뿐 (마감선 예외 없음)',
  /varbkDone=backlog\.filter\(function\(t\)\{returnt\.isDone;\}\);/.test(split));
t('bkList = !isDone 뿐',
  /varbkList=backlog\.filter\(function\(t\)\{return!t\.isDone;\}\);/.test(split));
/* ⚠ 이 두 줄이 신고 그 자체다 — 되살아나면 또 담아둔 일에 취소선이 남는다. */
t('⚠옛 규칙(!t.scheduledStart&&t.isDone)이 없다',
  !/!t\.scheduledStart&&t\.isDone/.test(codeOnly));
t('⚠옛 규칙(t.scheduledStart||!t.isDone)이 없다',
  !/t\.scheduledStart\|\|!t\.isDone/.test(codeOnly));

// ── ⑵ 머리줄 개수 = 실제로 그 아래 그리는 줄 수 ─────────────────────────
const openI = SRC.indexOf('var bkOpen=');
t('bkOpen을 찾았다', openI > 0);
t('bkOpen = bkList.length (미완료만 담기므로 곧 열린 개수)',
  /varbkOpen=bkList\.length;/.test(flat(SRC.slice(openI, openI + 120))));

// 실제 렌더 순서: bkList → '완료됨' 헤더 → bkDone
const renderI = SRC.indexOf("if(bkList.length){", openI);
const render = flat(SRC.slice(renderI, renderI + 900));
t("'담아둔 일' 머리줄은 bkOpen을 쓴다", /'담아둔일','Inbox'\)\+''\+bkOpen/.test(render) || /bkOpen/.test(render));
t("'완료됨' 섹션은 bkDone을 그린다", /bkDone\.slice\(0,20\)/.test(render));

// ── ⑶ 앱 파리티 — TodoView.swift를 직접 읽는다 ──────────────────────────
const APP = '/Users/moonleon/Documents/Sundial/Sundial/Views/TodoView.swift';
if (!fs.existsSync(APP)) {
  console.log('SKIP  앱 소스를 못 찾았다 (' + APP + ') — 웹만 검사했다');
} else {
  const A = fs.readFileSync(APP, 'utf8');
  const af = flat(A.replace(/\/\*[\s\S]*?\*\//g, " ").split("\n").filter(l => !/^\s*(\/\/|⚠)/.test(l)).join("\n"));   // 주석 제외 (위 codeOnly와 같은 이유)

  const dI = A.indexOf('private var doneTasks:');
  t('앱 doneTasks를 찾았다', dI > 0);
  const dBody = flat(A.slice(dI, A.indexOf('\n    private func scheduledOn', dI)));

  /* ⚠ 앱의 옛 한 줄. 되살아나면 앱만 다시 갈라진다. */
  t('⚠앱 옛 규칙($0.scheduledStart == nil && $0.isDone)이 없다',
    !/\$0\.scheduledStart==nil&&\$0\.isDone/.test(af));
  t('앱 doneTasks는 isDone을 먼저 거른다', /guardt\.isDone,!t\.isRewardItem/.test(dBody));
  t('앱 doneTasks: 배치 안 된 완료는 그대로 담는다',
    /guardletstart=t\.scheduledStart else\{returntrue\}/.test(dBody) ||
    /guardletstart=t\.scheduledStartelse\{returntrue\}/.test(dBody));
  t('앱 doneTasks: 배치된 완료는 **그날 것만** (지난 날이 쏟아지지 않게)',
    /cal\.isDate\(start,inSameDayAs:selectedDate\)/.test(dBody));

  const tI = A.indexOf('private func timelineRows(');
  t('앱 timelineRows를 찾았다', tI > 0);
  const tBody = flat(A.slice(tI, tI + 700));
  /* 완료가 여기 남으면 '완료됨'과 **양쪽에 동시에** 뜬다 (같은 일이 두 줄). */
  t('앱 timelineRows는 완료를 빼고 묶는다',
    /fortindayTaskswhere!t\.isRewardItem&&!t\.isDone/.test(tBody));
}

console.log((fail ? 'FAIL ' : 'OK ') + (ran - fail) + '/' + ran);
process.exit(fail ? 1 : 0);
