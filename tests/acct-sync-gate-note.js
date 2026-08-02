/* 동기화 게이트 조용한 안내(요청 2026-08-02)의 판정 규칙.
 *
 * 앱이 Plus 게이트를 얻어 무료 계정은 서버 push/pull을 안 한다(기존 로그인
 * 세션은 영구 예외). 그러면 웹만 보는 새 무료 유저는 "동기화가 고장났다"로
 * 느낀다 — 계정 상태 자리에 조용한 한 줄을 띄워 원인을 알려준다.
 *
 * index.html에서 acctSyncGateStale의 **실제 소스**를 뽑아 돌린다 (규칙을
 * 여기 베껴 쓰면 본체가 바뀌어도 통과해 버린다 — domain-sync.js와 같은 방식). */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
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
// 함수 안에서 쓰는 상수도 같이 뽑아야 한다 (ACCT_SYNC_STALE_MS=3일).
const constMatch = html.match(/var ACCT_SYNC_STALE_MS=([^;]+);/);
if (!constMatch) throw new Error('ACCT_SYNC_STALE_MS를 못 찾음');
const src = 'var ACCT_SYNC_STALE_MS=' + constMatch[1] + ';\n' + grab('acctSyncGateStale') + '; return acctSyncGateStale;';
const acctSyncGateStale = new Function(src)();

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  → ' + JSON.stringify(extra) : '')); }
}

const DAY = 24 * 3600 * 1000;
const now = Date.parse('2026-08-02T00:00:00.000Z');

{ // 로그아웃 상태: 애초에 안내 대상이 아니다
  ok('로그아웃 상태면 항상 false', acctSyncGateStale(false, null, now) === false);
  ok('로그아웃 상태면 updated_at이 오래돼도 false',
    acctSyncGateStale(false, new Date(now - 10 * DAY).toISOString(), now) === false);
}

{ // 새 계정: 서버에 이 계정 행이 아예 없음(rows 비어 있음 → updatedAtISO=null)
  ok('새 계정(서버에 데이터 없음)은 true', acctSyncGateStale(true, null, now) === true);
}

{ // 오래된 계정: 앱이 3일 넘게 안 올리고 있다
  ok('4일 전 updated_at → true(안내)', acctSyncGateStale(true, new Date(now - 4 * DAY).toISOString(), now) === true);
  ok('정확히 3일보다 살짝 더 지나면 true',
    acctSyncGateStale(true, new Date(now - 3 * DAY - 1000).toISOString(), now) === true);
}

{ // 잘 도는 계정(grandfathered·Plus): 최근에 올라왔으면 절대 안 뜬다
  ok('1시간 전 updated_at → false(침묵)', acctSyncGateStale(true, new Date(now - 3600 * 1000).toISOString(), now) === false);
  ok('정확히 3일 이내면 false', acctSyncGateStale(true, new Date(now - 3 * DAY + 1000).toISOString(), now) === false);
  ok('방금(0ms 전) → false', acctSyncGateStale(true, new Date(now).toISOString(), now) === false);
}

{ // 방어: 깨진 날짜 문자열은 "모른다"보다 안전 쪽(안내)으로
  ok('파싱 안 되는 문자열은 true', acctSyncGateStale(true, '이게-아냐', now) === true);
}

console.log('\n' + pass + '/' + (pass + fail) + ' 통과 (acct-sync-gate-note)');
process.exit(fail ? 1 : 0);
