/* 웹에서 집중을 끝내면 **작업에도 블록 자리**가 찍히는가 (앱 파리티).
 *
 * ⚠ 웹은 블록을 세션에서 그리지만 **앱은 작업 필드에서** 그린다
 * (scheduledStart + recordedSpanSec/durationMin, actualFocusedSec≥2분).
 * 이걸 안 찍으면 웹에서 정지한 집중이 아이폰 타임라인에 안 나온다. */
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
const t = (n, c, e) => c ? (pass++, console.log('PASS  ' + n))
                         : (fail++, console.log('FAIL  ' + n + (e ? ' → ' + JSON.stringify(e) : '')));

const src = html.slice(html.indexOf('function endFocusSession('));
const body = src.slice(0, src.indexOf('\n  }') + 4);

t('끝낼 때 작업의 scheduledStart를 다시 찍는다', /fTask\.scheduledStart\s*=/.test(body));
t('기록 길이(recordedSpanSec)를 남긴다', /fTask\.recordedSpanSec\s*=/.test(body));
t('durationMin을 기록 길이로 맞춘다', /fTask\.durationMin\s*=/.test(body));
t('아랫변이 지금 라인 — now에서 길이만큼 뺀다', /nowMs\s*-\s*fTask\.durationMin\s*\*\s*60000/.test(body));
t('2분 미만은 자리를 안 찍는다', /el>=SHORT_FOCUS_SEC\|\|keepShortBlocks\(\)/.test(body));
t('앱이 그리는 조건인 actualFocusedSec도 올린다', /fTask\.actualFocusedSec=/.test(body));

console.log(fail ? `\n${fail}/${pass + fail} FAILED` : `\n${pass}/${pass} 통과 (focus-end-block)`);
process.exit(fail ? 1 : 0);
