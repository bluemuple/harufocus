/* 캡처 bar 개편 — 상세 줄을 아이콘 줄 위에 쌓기 · '완료' 버튼 삭제 ·
 * 길이 아이콘 활성 색 (앱 5165c146 이식).
 *
 * 규칙:
 *  ① 상세 줄(길이·매트릭스·마감…)은 아이콘 줄을 **대체하지 않고 위에 쌓인다**
 *     — 다른 아이콘을 바로 눌러 1탭으로 전환된다(setCapDetail이 이미 토글).
 *  ② '완료' 버튼은 전부 삭제됐다 — 아이콘 줄이 계속 보이므로 재탭으로 닫으면
 *     충분하다. **메모만 예외**(줄 수가 많아 아이콘 줄을 덮으므로 완료·취소를
 *     남긴다). '마감 없음'·'칸 없음'처럼 **값을 지우는** 버튼도 남는다 — 뜻이
 *     '닫기'가 아니기 때문이다.
 *  ③ 길이 아이콘도 값이 걸리면(durationLocked) 색이 켜진다 — 매트릭스·메모·
 *     보상과 같은 판정.
 *
 * index.html의 **실제 함수**를 뽑아 돌린다 — 규칙을 여기 베껴 쓰면 본체가
 * 바뀌어도 테스트가 통과해 버린다. */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');

function grab(name) {
  const at = SRC.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('not found: ' + name);
  let i = SRC.indexOf('{', at), depth = 0;
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return SRC.slice(at, j + 1); }
  }
  throw new Error('unbalanced: ' + name);
}

let pass = 0, fail = 0;
const t = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? 'PASS  ' : 'FAIL  ') + name); };

// ── ① paintCap: 상세 패널 + 아이콘 줄을 **함께** 조립한다(대체가 아니다) ──
{
  const body = grab('paintCap');
  t('detail!=="note"면 패널과 아이콘 줄을 이어붙인다(패널이 아이콘 줄을 지우지 않는다)',
    /d\.innerHTML\s*=\s*panelHtml\s*\+\s*barHtml/.test(body));
  t('메모는 여전히 예외 — 아이콘 줄 없이 notePanel만 그린다',
    /if\(cap\.detail===['"]note['"]\)\{[\s\S]{0,80}renderNotePanel\(\)/.test(body));
  t('아이콘 줄은 renderOptionsBar로 뽑혀 다른 분기에서도 재사용된다',
    /function renderOptionsBar\(\)/.test(SRC));
}

// ── ② '완료' 버튼 — 전부 삭제, 메모만 예외 ──────────────────────────────
{
  const removed = ['capDurDone', 'capSchDone', 'capRemDone', 'capDueDone',
    'capRepDone', 'capRewDone', 'capMxDone', 'capSubDone'];
  removed.forEach(id => {
    t(`'완료' 버튼 삭제 확인: #${id}가 더 이상 없다`, !SRC.includes(`id="${id}"`));
  });
  t('⚠ 메모만 예외 — #capNoteDone(완료)은 남아 있다', SRC.includes('id="capNoteDone"'));
  t('⚠ 메모만 예외 — #capNoteCancel(취소)도 남아 있다', SRC.includes('id="capNoteCancel"'));
}

// ── ③ 값을 지우는 버튼은 '닫기'가 아니므로 남는다 ────────────────────────
{
  const dueBody = grab('renderDuePanel');
  t("due 패널: '마감 없음'(값 지우기)은 남아 있다", /마감 없음|No due date/.test(dueBody));
  const mxBody = grab('renderMatrixPanel');
  t("matrix 패널: '칸 없음'(값 지우기)은 남아 있다", /칸 없음|No quadrant/.test(mxBody));
}

// ── ④ 길이 아이콘도 값이 걸리면 색이 켜진다(durationLocked) ──────────────
{
  const harness = `
    function L(ko, en){ return ko; }
    function esc(s){ return String(s==null?'':s); }
    var IC = { timer:'<i class="ic-timer"></i>', grid:'', steps:'', note:'', gift:'', bell:'', flag:'', repeat2:'' };
    var localStorage = { getItem(){ return null; } };
    function capDurCompact(m){ return m + 'm'; }
    function appNudge(){}
    var cap = { draft:{ durationLocked:false, matrixQuadrant:0, subtasks:[], notes:'',
      rewardIsMoney:false, rewardText:'', nudgeEnabled:false, reminderOffsets:[],
      dueDate:null, repeatDaysMask:0, durationMin:30 }, moreIcons:false };
${grab('renderOptionsBar')}
    module.exports = { renderOptionsBar, setLocked(v){ cap.draft.durationLocked = v; } };
  `;
  const m = new module.constructor();
  m._compile(harness, '/options-bar-harness.js');
  const W = m.exports;

  const offHtml = W.renderOptionsBar();
  t('길이를 아직 안 만졌으면(durationLocked=false) 길이 아이콘이 꺼져 있다',
    /data-d="duration"[^>]*>/.test(offHtml) && !/class="cap-opt dur on"/.test(offHtml));

  W.setLocked(true);
  const onHtml = W.renderOptionsBar();
  t('길이를 직접 조절하면(durationLocked=true) 길이 아이콘도 켜진다(다른 아이콘과 같은 판정)',
    /class="cap-opt dur on"/.test(onHtml));
}

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (capture-bar-stack-parity)`);
process.exit(fail ? 1 : 0);
