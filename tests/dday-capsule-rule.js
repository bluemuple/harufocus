/* 상단바 D-day 캡슐 — **남았거나 그날일 때만**, 표기는 `D-3 시험` (요청 2026-08-07).
   실행: node tests/dday-capsule-rule.js

   신고: 상단바에 "19 days since Test."가 계속 떴다. 지난 D-day는
     ⑴할 게 없는 숫자가 영원히 커지고,
     ⑵끝나도 스스로 물러나지 않아 아무도 설정에 들어가 지우지 않으며,
     ⑶회전 풀이 사실상 둘뿐이라 그 죽은 숫자가 **'나의 다짐' 자리를 뺏는다**.
   → 지나면 회전에서 빠진다. 표기는 D-day 관례(`D-3 시험` · `D-day 시험`).

   이 파일이 못 박는 것
   ⑴ 지난 D-day가 회전 풀에 다시 들어오지 않을 것 (신고 그 자체)
   ⑵ 표기가 문장체로 되돌아가지 않을 것 — 할 일 줄 캡슐과 **한 표기**
   ⑶ ⚠앱도 같은 규칙일 것 — 앱 소스를 직접 읽는다. 한쪽만 고치면 같은 D-day가
      폰과 웹에서 다르게 뜬다. */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const flat = s => s.replace(/\s/g, '');
// 주석은 코드가 아니다 (tests/done-section-move.js의 같은 함정 참조).
const codeOnly = flat(
  SRC.replace(/\/\*[\s\S]*?\*\//g, ' ')
     .split('\n').filter(l => !/^\s*(\/\/|⚠|·|⑴|⑵|⑶)/.test(l)).join('\n'));

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };

// ── ⑴ 규칙 재현: 지났으면 풀에서 빠진다 ─────────────────────────────────
function ddayShortLabel(diff) { return diff === 0 ? 'D-day' : (diff > 0 ? 'D-' + diff : 'D+' + (-diff)); }
function pool({ hasDate, chipOn, sinceMs, diff }) {
  const out = ['myword'];
  if (hasDate && chipOn && sinceMs >= 10 * 60 * 1000 && diff >= 0) out.push('dday');
  return out;
}
const P = o => pool({ hasDate: true, chipOn: true, sinceMs: 1e9, diff: 0, ...o });
t('남았으면 뜬다 (D-3)', P({ diff: 3 }).includes('dday'));
t('그날은 뜬다 (D-day)', P({ diff: 0 }).includes('dday'));
t('⭐하루라도 지나면 안 뜬다', !P({ diff: -1 }).includes('dday'));
t('⭐19일 지난 것도 당연히 안 뜬다 (신고 그 자체)', !P({ diff: -19 }).includes('dday'));
t('⚠빠지는 건 D-day 하나뿐 — 나의 다짐은 남는다', P({ diff: -19 }).includes('myword'));
t('10분 쿨다운은 그대로', !P({ diff: 3, sinceMs: 60000 }).includes('dday'));
t('설정 토글이 꺼져 있으면 안 뜬다', !P({ diff: 3, chipOn: false }).includes('dday'));
t('날짜가 없으면 안 뜬다', !P({ diff: 3, hasDate: false }).includes('dday'));

// ── ⑵ 표기 ──────────────────────────────────────────────────────────────
t('표기: D-3', ddayShortLabel(3) === 'D-3');
t('표기: D-day (그날)', ddayShortLabel(0) === 'D-day');
t('표기: D+2 (회전엔 안 오지만 함수는 순수하게)', ddayShortLabel(-2) === 'D+2');

// ── 웹 소스가 실제로 그렇게 쓰는가 ──────────────────────────────────────
const poolI = SRC.indexOf('function capPool(');
t('capPool을 찾았다', poolI > 0);
const capPool = flat(SRC.slice(poolI, poolI + 900).replace(/\/\*[\s\S]*?\*\//g, ' '));
t('⚠웹 capPool이 지난 D-day를 뺀다',
  /ddayDiffDays\(newDate\(\),newDate\(S\.ddayDate\)\)>=0/.test(capPool));
t('웹 capPool의 쿨다운·토글 조건은 그대로',
  /S\.ddayDate&&S\.chipDday!==false&&Date\.now\(\)-lastDdayAt>=DDAY_COOLDOWN_MS/.test(capPool));

t('웹 ddayShortLabel이 관례 표기다',
  /functionddayShortLabel\(diff\)\{if\(diff===0\)return'D-day';returndiff>0\?\('D-'\+diff\):\('D\+'\+\(-diff\)\);\}/.test(codeOnly));
/* ⚠ 상단바 캡슐이 할 일 줄과 **같은 함수**를 써야 표기가 안 갈린다. */
t('⚠상단바 캡슐도 ddayShortLabel을 쓴다 (제 표기를 따로 만들지 않는다)',
  /txt:ddayShortLabel\(diff\)\+\(lab\?''\+lab:''\)/.test(codeOnly));
t('⚠옛 문장체가 남아 있지 않다',
  !/days since/.test(codeOnly) && !/지났어\./.test(codeOnly) && !/남았어\.'/.test(codeOnly));

// ── ⑶ 앱 파리티 ─────────────────────────────────────────────────────────
const ENG = '/Users/moonleon/Documents/Sundial/Sundial/Engine/CapsuleContent.swift';
const TOP = '/Users/moonleon/Documents/Sundial/Sundial/Views/TopBar.swift';
if (!fs.existsSync(ENG) || !fs.existsSync(TOP)) {
  console.log('SKIP  앱 소스를 못 찾았다 — 웹만 검사했다');
} else {
  const strip = f => flat(fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter(l => !/^\s*(\/\/|\/\/\/|⚠|·)/.test(l)).join('\n'));
  const eng = strip(ENG), top = strip(TOP);

  t('앱 pool도 지난 D-day를 뺀다',
    /i\.hasDday,i\.secSinceDday>=ddayCooldown,i\.ddayDaysLeft>=0/.test(eng));
  t('앱 Input에 ddayDaysLeft가 있다 (기본 0 = 오늘 = 안 숨김)',
    /varddayDaysLeft=0/.test(eng));
  t('앱 ddayLine이 관례 표기다',
    /lethead=daysLeft==0\?"D-day":\(daysLeft>0\?"D-\\\(daysLeft\)":"D\+\\\(-daysLeft\)"\)/.test(eng));
  t('⚠앱 옛 문장체가 남아 있지 않다',
    !/dayssince/.test(eng) && !/지났어\."/.test(eng) && !/남았어\."/.test(eng));
  /* ⚠ 자정 기준으로 세지 않으면 "D-day인데 안 뜬다"가 생긴다. */
  t('⚠앱 TopBar가 자정 기준으로 남은 날을 센다',
    /i\.ddayDaysLeft=cal\.dateComponents\(\[\.day\],from:cal\.startOfDay\(for:Date\(\)\),to:cal\.startOfDay\(for:target\)\)\.day\?\?0/.test(top));
}

console.log((fail ? 'FAIL ' : 'OK ') + (ran - fail) + '/' + ran);
process.exit(fail ? 1 : 0);
