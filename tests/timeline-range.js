/* 타임라인은 **지금과 오늘의 기록**을 반드시 담는다.
 *
 * ⚠ 예전엔 두 가지가 겹쳐 새벽에 앱에서 끝낸 집중이 웹에서 통째로 사라졌다:
 *   ① nowHourFrac()이 지금이 기상 시각보다 이르면 `TS+1.5`라는 **가짜 자리**를
 *      돌려줬다 → 05:12인데 '지금' 선이 08:30에 (남음/지남도 그 거짓말 위에서 계산).
 *   ② 타임라인 범위가 기상~취침으로 고정이라, 기상 전에 끝난 블록은 top이
 *      음수가 되어 **잘려 안 보였다**.
 * 앱 타임라인은 하루 전체를 스크롤하므로 이런 잘림이 없다 — 파리티. */
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
const t = (n, c) => c ? (pass++, console.log('PASS  ' + n)) : (fail++, console.log('FAIL  ' + n));

function grab(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('함수를 못 찾음: ' + name);
  let i = html.indexOf('{', start), depth = 0;
  for (let j = i; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(start, j + 1); }
  }
}

// ① 지금 선은 **진짜 시각**을 가리킨다
const nowSrc = grab('nowHourFrac');
t('nowHourFrac이 기상 시각으로 밀어내지 않는다', !/TS\s*\+\s*1\.5/.test(nowSrc));
t('nowHourFrac은 실제 시계를 쓴다', /hourFrac\(Date\.now\(\)\)/.test(nowSrc));

const nowFn = new Function('dayOffset', 'hourFrac', 'TS',
  grab('nowHourFrac') + '; return nowHourFrac;')(0, () => 5.2, 7);
t('기상(07시) 전 05:12도 그대로 5.2', Math.abs(nowFn() - 5.2) < 1e-9);

// ② 범위가 지금·오늘 기록·오늘 계획까지 넓어진다
const big = html.slice(html.indexOf('function renderBig('));
const head = big.slice(0, big.indexOf("var html='';for(var h=TS"));
t('지금이 범위 밖이면 범위를 넓힌다', /nowH<TS\)TS=/.test(head) && /nowH>TE\)TE=/.test(head));
t('오늘 기록 블록까지 담는다', /dayRecordBlocks\(k\)/.test(head) && /sf<TS\)TS=/.test(head));
t('오늘 계획(마감선)까지 담는다', /taskDueAt\(t\)/.test(head) && /df>TE\)TE=/.test(head));

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (timeline-range)`);
process.exit(fail ? 1 : 0);
