/* 도메인 분리 동기화(세션·일기를 행 단위 표로) 의 병합 규칙.
 *
 * ⚠ 앱 `SundialTests/DomainSyncTests.swift`와 **한 쌍**이다 — 양쪽이 같은
 * 표를 읽고 쓰므로 한쪽 규칙만 고치면 두 기기가 서로의 기록을 지운다.
 *
 * index.html에서 domMerge·domRows의 **실제 소스**를 뽑아 돌린다 (규칙을 여기
 * 베껴 쓰면 본체가 바뀌어도 통과해 버린다 — short-block.js와 같은 방식). */
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
const domMerge = new Function(grab('domMerge') + '; return domMerge;')();
const domRows  = new Function(grab('domRows')  + '; return domRows;')();

// 세션은 안 바뀌는 기록(상수), 일기는 updatedAt으로 바뀜을 잰다 — 본체 DOMAINS와 같은 값.
const verSession = () => '1';
const verDiary = (x) => String(x.updatedAt || x.date || '1');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  → ' + JSON.stringify(extra) : '')); }
}
const S = (id, sec) => ({ id, taskID: 't1', taskTitle: '공부', categoryID: 'focus',
  start: '2026-07-22T01:00:00.000Z', end: '2026-07-22T01:30:00.000Z', focusedSec: sec || 1800 });
const row = (id, payload, at, deleted) =>
  ({ id, payload: payload || {}, deleted: !!deleted, updated_at: at });

/* ── pull(domMerge) ─────────────────────────────────────────────── */

{ // 새 항목이 들어온다 + 워터마크는 **마지막 행**의 시각
  const r = domMerge([], [row('a', S('a'), '2026-07-22T00:00:01Z'),
                          row('b', S('b'), '2026-07-22T00:00:02Z')], {}, verSession);
  ok('받은 항목이 목록에 들어간다', r.list.length === 2 && r.list[1].id === 'b', r.list);
  ok('워터마크 = 마지막 행 updated_at', r.since === '2026-07-22T00:00:02Z', r.since);
}

{ // 같은 id는 덮어쓰기(중복 생성 금지)
  const r = domMerge([S('a', 60)], [row('a', S('a', 999), '2026-07-22T00:00:03Z')], {}, verSession);
  ok('같은 id는 하나로 덮어쓴다', r.list.length === 1 && r.list[0].focusedSec === 999, r.list);
}

{ // 받은 것은 '올려 둔 것'으로 표시 — 안 그러면 되올려 무한 왕복
  const r = domMerge([], [row('a', S('a'), '2026-07-22T00:00:01Z')], {}, verSession);
  ok('받은 항목은 sent에 기록된다', r.sent.a === '1', r.sent);
  const back = domRows(r.list, r.sent, verSession, 'u', 'dev');
  ok('받은 것을 되올리지 않는다', back.length === 0, back);
}

{ // 삭제 표식
  const sent = { a: '1' };
  const r = domMerge([S('a')], [row('a', {}, '2026-07-22T00:00:04Z', true)], sent, verSession);
  ok('삭제 표식이면 로컬에서 지운다', r.list.length === 0, r.list);
  ok('삭제되면 sent에서도 빠진다', r.sent.a === undefined, r.sent);
  const after = domRows(r.list, r.sent, verSession, 'u', 'dev');
  ok('지운 뒤 tombstone을 또 만들지 않는다', after.length === 0, after);
}

{ // payload에 id가 없어도 행의 id를 붙여 준다
  const r = domMerge([], [row('z', { taskTitle: '무명' }, '2026-07-22T00:00:05Z')], {}, verSession);
  ok('payload에 id가 없으면 행 id를 채운다', r.list[0].id === 'z', r.list);
}

{ // 일기: 같은 id라도 updatedAt이 다르면 '바뀐 것'
  const d0 = { id: 'd1', text: '처음', updatedAt: '2026-07-01T00:00:00Z' };
  const r = domMerge([], [row('d1', d0, '2026-07-22T00:00:06Z')], {}, verDiary);
  ok('일기 ver는 updatedAt', r.sent.d1 === '2026-07-01T00:00:00Z', r.sent);
}

{ // 입력 배열을 제자리에서 망가뜨리지 않는다 (호출자가 옛 배열을 들고 있다)
  const orig = [S('a')];
  domMerge(orig, [row('b', S('b'), '2026-07-22T00:00:07Z')], {}, verSession);
  ok('입력 목록을 제자리 수정하지 않는다', orig.length === 1, orig);
}

/* ── push(domRows) ──────────────────────────────────────────────── */

{ // 처음 보는 것만 올린다
  const rows = domRows([S('a'), S('b')], { a: '1' }, verSession, 'u', 'dev');
  ok('안 올린 것만 올린다', rows.length === 1 && rows[0].id === 'b', rows);
  ok('행에 user_id·device_id가 실린다', rows[0].user_id === 'u' && rows[0].device_id === 'dev', rows[0]);
}

{ // 로컬에서 사라진 것 = tombstone
  const rows = domRows([], { a: '1' }, verSession, 'u', 'dev');
  ok('사라진 것은 삭제 표식으로 올린다', rows.length === 1 && rows[0].deleted === true, rows);
}

{ // ⚠ sent가 비면 tombstone을 만들지 않는다 (새 브라우저가 남의 기록을 지우면 안 된다)
  const rows = domRows([], {}, verSession, 'u', 'dev');
  ok('sent가 비면 아무것도 지우지 않는다', rows.length === 0, rows);
}

{ // 일기 본문 수정 → updatedAt이 바뀌므로 다시 올린다
  const d = { id: 'd1', text: '고침', updatedAt: '2026-07-22T05:00:00Z' };
  const rows = domRows([d], { d1: '2026-07-01T00:00:00Z' }, verDiary, 'u', 'dev');
  ok('일기를 고치면 다시 올린다', rows.length === 1 && rows[0].payload.text === '고침', rows);
  const same = domRows([d], { d1: '2026-07-22T05:00:00Z' }, verDiary, 'u', 'dev');
  ok('안 고쳤으면 안 올린다', same.length === 0, same);
}

{ // id 없는 쓰레기 항목은 건너뛴다 (예전 데이터)
  const rows = domRows([{ taskTitle: 'id 없음' }, S('a')], {}, verSession, 'u', 'dev');
  ok('id 없는 항목은 올리지 않는다', rows.length === 1 && rows[0].id === 'a', rows);
}

/* ── 왕복: 두 기기가 서로를 밀어 올리지 않는다 ─────────────────── */
{
  // 기기A가 a를 올렸다 → 서버가 그 행을 돌려준다 → A는 다시 안 올린다.
  let listA = [S('a')], sentA = {};
  const upA = domRows(listA, sentA, verSession, 'u', 'A');
  upA.forEach(r => { sentA[r.id] = '1'; });                       // push 성공 반영
  const back = domMerge(listA, [row('a', S('a'), '2026-07-22T00:01:00Z')], sentA, verSession);
  const again = domRows(back.list, back.sent, verSession, 'u', 'A');
  ok('내가 올린 행을 도로 받아도 다시 안 올린다', again.length === 0, again);
  ok('내가 올린 행이 목록에 중복되지 않는다', back.list.length === 1, back.list);
}

console.log('\n' + pass + '/' + (pass + fail) + ' 통과 (domain-sync)');
process.exit(fail ? 1 : 0);
