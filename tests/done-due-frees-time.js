/* ⭐ 끝낸 앞일은 뒷일의 시간을 안 먹는다 (요청 2026-08-07).
   실행: node tests/done-due-frees-time.js

   요청 원문: "완료한 데드라인은 지금라인 아래에 있을 때 duration을 0m로 돼야
   하고, 그 아래 데드라인 duration은 지금 라인으로부터 그 라인까지로 계산 —
   즉 더 커져야 한다. 완료 취소하면 다시 원래대로. 지금라인 위의 데드라인은
   현재 코드대로. 앱·웹 동일하게."

   규칙 (앱·웹 한 벌):
     · 마감선이 '지금'보다 **위**(이미 지남)  → 손대지 않는다 ('N 지남' 그대로)
     · 마감선이 '지금'보다 **아래** + 완료     → 그 줄 duration = 0m,
                                                  **앵커를 안 옮긴다**
     · 그 아래 줄                              → 앵커가 그대로라 '지금'(또는 그 위의
                                                  아직 안 끝낸 마감)부터 재어져 커진다
     · 완료를 풀면 앵커가 되살아나 원래 수로 (되돌리는 코드는 없다 — 매 렌더가
       이 규칙을 다시 계산할 뿐이다)

   이 파일이 못 박는 것
   ⑴ 규칙을 **수식으로 재현**해 성질을 검증한다 (0m · 아래 줄이 커짐 · 되돌아옴)
   ⑵ 웹 소스가 실제로 그 식을 쓴다 (futureDone · 앵커 안 옮김)
   ⑶ ⚠고스트(떨어뜨리는 중)도 같은 앵커를 쓴다 — 어긋나면 놓는 순간 수가 튄다
   ⑷ ⚠**앱 TimelineScrollView.swift를 직접 읽어** 같은 규칙임을 묶는다.
      한쪽만 고치면 같은 화면이 앱·웹에서 다른 수를 말한다. */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const flat = s => s.replace(/\s/g, '');
/* 주석은 코드가 아니다 — 이 수정을 설명하는 주석이 검사할 글자를 그대로 담고
   있어 통짜 검색이면 가짜 통과/가짜 실패가 난다 (tests/done-section-move.js 참조). */
const codeOnly = flat(
  SRC.replace(/\/\*[\s\S]*?\*\//g, ' ')
     .split('\n').filter(l => !/^\s*(\/\/|⚠|·|①|②|예\))/.test(l)).join('\n'));

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };

// ── ⑴ 규칙을 재현해 성질을 본다 ─────────────────────────────────────────
// 소스의 식과 **같은 모양**으로 옮겨 적는다. 값이 아니라 성질을 검증한다.
function hmText(min) { const m = Math.max(0, Math.round(min)); return m < 60 ? m + 'm' : (m % 60 === 0 ? (m / 60) + 'h' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'); }
function durations(lines, now) {
  let prev = null;
  return lines.map(L => {
    if (L.due < now) return { id: L.id, txt: 'elapsed' };          // 지금 선 위 = 손 안 댐
    const futureDone = L.done && L.due >= now;
    const anchor = (prev != null && prev > now) ? prev : now;
    const avail = Math.round((L.due - anchor) / 60000);
    const txt = futureDone ? hmText(0)
      : (avail > 0 ? hmText(avail) : (L.dur > 0 ? hmText(L.dur) : ''));
    if (!futureDone) prev = L.due;
    return { id: L.id, txt };
  });
}
const M = 60000, now = new Date('2026-08-07T05:22:00').getTime();
const D = s => new Date('2026-08-07T' + s + ':00').getTime();
// 요청 스크린샷 그대로: 지금 05:22 · Weekly 05:38 · Monday 06:08 · Tuesday 06:38
const base = [
  { id: 'weekly', due: D('05:38'), dur: 30, done: false },
  { id: 'monday', due: D('06:08'), dur: 30, done: false },
  { id: 'tuesday', due: D('06:38'), dur: 30, done: false },
];
const before = durations(base, now);
t('완료 전: Weekly 16m (지금→05:38)', before[0].txt === '16m');
t('완료 전: Monday 30m (05:38→06:08)', before[1].txt === '30m');
t('완료 전: Tuesday 30m', before[2].txt === '30m');

const done = durations(base.map(l => l.id === 'weekly' ? { ...l, done: true } : l), now);
t('⭐완료 후: Weekly = 0m', done[0].txt === '0m');
t('⭐완료 후: Monday = 46m (지금→06:08, 16m이 아니다)', done[1].txt === '46m');
t('완료 후: Tuesday는 그대로 30m (06:08→06:38)', done[2].txt === '30m');
/* 되돌리기 = 상태를 되돌리면 수도 되돌아온다 (별도 복구 코드 없음). */
t('완료 취소하면 원래대로', JSON.stringify(durations(base, now)) === JSON.stringify(before));

// 연달아 둘을 완료하면 둘 다 0m이고 셋째가 둘 몫을 다 받는다.
const two = durations(base.map(l => (l.id === 'weekly' || l.id === 'monday') ? { ...l, done: true } : l), now);
t('둘 연속 완료: 둘 다 0m', two[0].txt === '0m' && two[1].txt === '0m');
// 05:22→06:38 = 76분 → hmText는 60분을 넘으면 'Nh Nm' (같은 뜻을 두 표기로 쓰지 않는다).
t('둘 연속 완료: Tuesday가 1h 16m (지금→06:38)', two[2].txt === '1h 16m');

// ⚠ 지금 선 **위**(지난) 마감선은 완료해도 규칙 밖 — '지남' 표기 그대로.
const past = durations([{ id: 'p', due: now - 30 * M, dur: 30, done: true },
                        { id: 'n', due: D('06:08'), dur: 30, done: false }], now);
t('⚠지난 마감선은 완료해도 손대지 않는다', past[0].txt === 'elapsed');
t('⚠지난 마감선은 앵커도 안 건드린다 → 다음 줄은 지금부터 46m', past[1].txt === '46m');

// ── ⑵ 웹 소스가 실제로 그 식을 쓴다 ─────────────────────────────────────
t('웹: futureDone = isDone && due >= now',
  /varfutureDone=t\.isDone&&due\.getTime\(\)>=_nowAbs;/.test(codeOnly));
t('웹: futureDone이면 hmText(0)', /futureDone\?hmText\(0\)/.test(codeOnly));
/* ⚠ 이 한 줄이 규칙의 심장이다 — 앵커를 옮겨 버리면 아래 줄이 안 커진다. */
t('⚠웹: 완료한 미래 마감은 앵커(prevDueMs)를 안 옮긴다',
  /if\(!futureDone\)prevDueMs=due\.getTime\(\);/.test(codeOnly));
t('⚠웹: 옛 무조건 대입(prevDueMs=due.getTime();)이 혼자 남아 있지 않다',
  !/\}\);prevDueMs=due\.getTime\(\);var/.test(codeOnly));

// ── ⑶ 고스트도 같은 앵커 ────────────────────────────────────────────────
const dropI = SRC.indexOf('function dropAnchorMs(');
t('dropAnchorMs를 찾았다', dropI > 0);
const drop = flat(SRC.slice(dropI, dropI + 900).replace(/\/\*[\s\S]*?\*\//g, ' '));
t('⚠고스트 앵커도 완료한 미래 마감선을 건너뛴다 (놓는 순간 수가 튀지 않게)',
  /if\(x\.isDone&&d>=now\)return;/.test(drop));

// ── ⑷ 앱 파리티 — TimelineScrollView.swift를 직접 읽는다 ────────────────
const APP = '/Users/moonleon/Documents/Sundial/Sundial/Views/TimelineScrollView.swift';
if (!fs.existsSync(APP)) {
  console.log('SKIP  앱 소스를 못 찾았다 (' + APP + ') — 웹만 검사했다');
} else {
  const A = fs.readFileSync(APP, 'utf8');
  const aCode = flat(A.replace(/\/\*[\s\S]*?\*\//g, ' ')
                      .split('\n').filter(l => !/^\s*(\/\/|⚠|·|①|②|예\))/.test(l)).join('\n'));

  t('앱: 완료한 미래 마감의 avail = 0', /ift\.isDone&&d>=now\{out\[t\.id\]=0/.test(aCode));
  /* ⚠ continue가 곧 '앵커를 안 옮긴다'이다 — 빠지면 prev = d가 실행된다.
     줄 끝 주석까지 걷어내진 않으므로(문자열 속 //를 잘못 자를 수 있다) 정규식
     대신 **구간을 잘라** 본다: 0을 넣은 자리와 let anchor 사이에 continue가 있고
     prev 대입이 없어야 한다. */
  const gI = aCode.indexOf('out[t.id]=0');
  const gJ = aCode.indexOf('letanchor=', gI);
  const gap = gI > 0 && gJ > gI ? aCode.slice(gI, gJ) : '';
  t('⚠앱: 그 뒤 continue로 앵커(prev)를 안 옮긴다',
    gap.includes('continue') && !gap.includes('prev=d'));
  t('앱: 지난 마감(d < now)은 여전히 elapsedSinceDueText',
    /ifd<now\{letelapsedMin=Int\(\(now\.timeIntervalSince\(d\)\/60\)\.rounded\(\)\)returnelapsedSinceDueText\(elapsedMin\)\}/.test(aCode));
  /* ⚠ 이게 없으면 avail=0이 '값 없음'으로 읽혀 계획 길이(30m)가 도로 나온다. */
  t('⚠앱: 미래+완료면 hmText(0) — durationMin 폴백을 가로챈다',
    /ift\.isDone\{returnhmText\(0\)\}/.test(aCode));
  t('앱: 폴백(availMin > 0 ? availMin : t.durationMin)은 그대로 남아 있다',
    /letmins=availMin>0\?availMin:t\.durationMin/.test(aCode));
}

console.log((fail ? 'FAIL ' : 'OK ') + (ran - fail) + '/' + ran);
process.exit(fail ? 1 : 0);
