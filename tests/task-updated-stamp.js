/* 웹→앱 동기화의 **작업 updatedAt 찍기** — 실행: node tests/task-updated-stamp.js
   (신고 2026-08-06 재발: "웹에서 완료 → 앱 sync → 앱엔 반영 안 되고,
    웹을 새로고침하면 완료가 취소돼 있다". 앱→웹만 됐다.)

   원인: 앱은 `SundialSnapshot`에서 **작업별 updatedAt을 견줘 최신 쪽**을 남기는데,
   웹이 그 값을 **한 번도 안 실어 보냈다** — 앱엔 nil → `.distantPast`로 읽혀
   **앱 사본이 무조건 이겼다**. 목표·폴더는 올릴 때 병합하도록 고쳐 뒀는데
   작업만 빠져 있었다(같은 사고를 목표에서 이미 한 번 겪었다: 2026-07-28).

   여기서 못 박는 것:
   ① 바뀐 작업에는 updatedAt이 찍힌다 (안 찍히면 앱이 되돌린다)
   ② **안 바뀐 작업엔 안 찍힌다** (다 찍으면 웹이 항상 이겨 반대 사고가 난다)
   ③ 앱 쪽이 여전히 updatedAt으로 판정하는지 — Swift 원본을 직접 확인 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '/../index.html'), 'utf8');
const SWIFT = path.join(process.env.HOME, 'Documents/Sundial/Sundial/Services/SundialSnapshot.swift');

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
const api = new Function(
  'var uuid=function(){return "id-"+(uuid._n=(uuid._n||0)+1);};\n' +
  ['newTask', 'healTask', 'healTasks', 'taskFingerprint', 'stampTasks'].map(grab).join('\n') +
  '\nreturn {newTask,healTask,taskFingerprint,stampTasks};')();

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };
const NOW = '2026-08-06T20:00:00.000Z';
const OLD = '2026-08-05T10:00:00.000Z';
const mk = (o) => api.healTask(Object.assign({ id: o.id, title: 'T' }, o));

// ── ① 바뀐 작업 = 찍힌다
{
  const server = [mk({ id: 'a', isDone: false })];
  const local = [mk({ id: 'a', isDone: true })];        // 웹에서 완료
  const out = api.stampTasks(local, server, NOW);
  t('완료로 바꾼 작업에 updatedAt이 찍힌다', out[0].updatedAt === NOW);
}

// ── ② 안 바뀐 작업 = 안 찍힌다 (웹이 항상 이기면 반대 사고)
{
  const server = [Object.assign(mk({ id: 'b', isDone: false }), { updatedAt: OLD })];
  const local = [mk({ id: 'b', isDone: false })];
  const out = api.stampTasks(local, server, NOW);
  t('안 바뀐 작업엔 새 updatedAt을 안 찍는다', out[0].updatedAt !== NOW);
  t('안 바뀐 작업은 서버의 updatedAt을 유지한다', out[0].updatedAt === OLD);
}

// ── ③ 서버에 없던 새 작업 = 찍힌다
{
  const out = api.stampTasks([mk({ id: 'c' })], [], NOW);
  t('웹에서 새로 만든 작업에 updatedAt이 찍힌다', out[0].updatedAt === NOW);
}

// ── ④ 필드 기본값 차이로 오탐하지 않는다 (양쪽을 같은 healTask에 통과시키므로)
{
  const server = [{ id: 'd', title: 'T' }];             // 서버본엔 필드가 빠져 있다
  const local = [mk({ id: 'd' })];                      // 로컬은 기본값이 채워져 있다
  const out = api.stampTasks(local, server, NOW);
  t('기본값만 채워진 차이로는 안 찍는다 (오탐 방지)', out[0].updatedAt !== NOW);
}

// ── ⑤ updatedAt 자체는 비교에서 빠진다 (넣으면 매번 전부 찍힌다)
{
  const a = api.taskFingerprint(Object.assign(mk({ id: 'e' }), { updatedAt: OLD }));
  const b = api.taskFingerprint(Object.assign(mk({ id: 'e' }), { updatedAt: NOW }));
  t('지문 비교에서 updatedAt은 제외된다', a === b);
}

// ── ⑥ 소스가 실제로 이 경로를 쓰는가 (함수만 있고 안 부르면 무의미)
{
  const flat = SRC.replace(/\s/g, '');
  t('currentSnap이 stampTasks를 통과시킨다',
    /serverSnap\.tasks=stampTasks\(healTasks\(DATA\.tasks\),serverSnap\.tasks\)/.test(flat));
  t('⚠옛 무조건 덮어쓰기가 되살아나지 않았다',
    !/serverSnap\.tasks=healTasks\(DATA\.tasks\);/.test(flat));
}

// ── ⑦ 앱 쪽이 여전히 updatedAt으로 판정하는가 — 여기가 갈리면 다시 조용히 깨진다
if (!fs.existsSync(SWIFT)) {
  console.log('SKIP  앱 저장소 없음');
} else {
  const sw = fs.readFileSync(SWIFT, 'utf8');
  t('앱 TaskDTO에 updatedAt이 있다', /var updatedAt: Date\?/.test(sw));
  t('앱이 서버 updatedAt과 견줘 최신을 남긴다', /t\.updatedAt > sv/.test(sw));
  t('앱은 updatedAt이 없으면 distantPast로 본다 (= 웹이 안 찍으면 앱이 이긴다)',
    /\$0\.updatedAt \?\? \.distantPast/.test(sw));
}

console.log(fail ? `\n${fail}개 실패 / ${ran}` : `\n${ran}/${ran} 통과`);
process.exit(fail ? 1 : 0);
