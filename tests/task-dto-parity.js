/* 웹이 만드는 작업 객체가 **앱 TaskDTO의 필수 필드**를 모두 갖는가.
 *
 * ⚠ 이걸 어기면 증상이 무섭다: 앱의 `tasks`는 **엄격 디코딩**이라 원소 하나가
 * 필드를 빠뜨리면 **스냅샷 전체 디코딩이 실패**하고, 앱은 pull을 못 해
 * **모든 동기화가 조용히 멈춘다**(집중 미러링·작업·설정까지 전부).
 * 실제로 그렇게 났다 — '지금 나' 행동과 하위 작업 '타임라인으로'가 공장을
 * 거치지 않고 객체를 직접 만들어 밀어 넣었다.
 *
 * 필수 필드 목록은 **Swift 원본에서 뽑는다** — 여기 베껴 두면 앱이 필드를
 * 늘렸을 때 이 테스트가 거짓 통과한다. */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const SWIFT = path.join(process.env.HOME, 'Documents/Sundial/Sundial/Services/SundialSnapshot.swift');

let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  → ' + JSON.stringify(extra) : '')); }
}

// ── 앱 TaskDTO의 **비-optional** 필드 뽑기 ────────────────────────────────
let required = [];
if (fs.existsSync(SWIFT)) {
  const swift = fs.readFileSync(SWIFT, 'utf8');
  const body = swift.slice(swift.indexOf('struct TaskDTO'), swift.indexOf('init(_ t: TaskBlock)'));
  for (const line of body.split('\n')) {
    const m = /^\s*var\s+(.+)$/.exec(line);
    if (!m) continue;
    // "id: UUID, title: String, colorKey: String" 처럼 한 줄에 여럿이 온다.
    for (const part of m[1].split(/,\s*(?![^\[]*\])/)) {
      const mm = /^([A-Za-z0-9_]+)\s*:\s*(.+?)\s*$/.exec(part.trim());
      if (!mm) continue;
      if (mm[2].endsWith('?')) continue;              // optional은 없어도 된다
      required.push(mm[1]);
    }
  }
}
t('앱 TaskDTO 필수 필드를 읽었다 (' + required.length + '개)', required.length >= 15, required);

// ── 웹 newTask() 공장이 그 필드를 다 채우는가 ────────────────────────────
function grab(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('함수를 못 찾음: ' + name);
  let i = html.indexOf('{', start), depth = 0;
  for (let j = i; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(start, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
const newTask = new Function('uuid', grab('newTask') + '; return newTask;')(
  () => '00000000-0000-0000-0000-000000000000');
const made = newTask({});
const missing = required.filter((f) => made[f] === undefined);
t('newTask()가 앱 필수 필드를 모두 채운다 (빠지면: ' + missing.join(',') + ')', missing.length === 0);

// ── 작업을 **공장 밖에서** 만들어 밀어 넣는 곳이 없는가 ──────────────────
/* addTask()/newTask() 안의 push는 정상. 그 밖에서 DATA.tasks.push(...)를
   직접 하면 필드가 빠질 위험이 그대로 살아난다. */
const pushes = [...html.matchAll(/DATA\.tasks(?:\s*=\s*DATA\.tasks\s*\|\|\s*\[\])?\s*\)?\.push\(/g)]
  .map((m) => m.index);
const factory = html.indexOf('function addTask(');
const factoryEnd = html.indexOf('\n  }', factory);
const outside = pushes.filter((i) => !(i > factory && i < factoryEnd));
t('공장(addTask) 밖에서 DATA.tasks.push 하는 곳이 없다 (' + outside.length + '곳)',
  outside.length === 0,
  outside.map((i) => html.slice(Math.max(0, i - 60), i + 30).replace(/\n/g, ' ')));

// ── 이번에 문제였던 두 경로가 공장을 쓰는가 (회귀 고정) ──────────────────
for (const fn of ['subToTimeline', 'mePlaceBlock']) {
  const src = grab(fn);
  t(fn + '()는 addTask 공장을 쓴다', /addTask\(/.test(src));
}

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (task-dto-parity)`);
process.exit(fail ? 1 : 0);
