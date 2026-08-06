/* 예전 다짐 **고치기** — ✕ 왼쪽 연필 (요청 2026-08-07).
   실행: node tests/pledge-edit-row.js

   예전엔 지우기뿐이라 오타 한 자 때문에 지우고 다시 써야 했다.
   이제 연필 → 그 줄이 입력칸으로 → [완료]가 **새로 만들지 않고 그 줄을 고친다**.

   ⚠ 이 기능의 위험은 하나뿐이고, 이 파일은 그것만 집요하게 본다:
      **고치기 상태가 안 내려가면 다음에 쓴 새 다짐이 남의 줄을 덮어쓴다.**
      그래서 상태를 내리는 자리가 셋이어야 한다 — ⑴저장할 때 ⑵'새로 쓰기'를
      누를 때 ⑶시트를 새로 열 때. 하나만 빠져도 조용히 남의 글이 사라진다.
   ⚠ 그리고 고친 글은 updatedAt을 올려야 한다 — 안 올리면 다른 기기의 옛 사본이
      이긴다(37절에서 겪은 그 사고). */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const flat = s => s.replace(/\s/g, '');
const strip = t => flat(t.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').filter(l => !/^\s*(\/\/|⚠|·|⑴|⑵|⑶)/.test(l)).join('\n'));
const code = strip(SRC);

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };

// ── 웹 ───────────────────────────────────────────────────────────────────
t('연필이 ✕ **왼쪽**에 붙는다 (파괴적인 버튼이 늘 바깥)',
  /r\.appendChild\(s\);if\(onEdit\)\{[\s\S]*?r\.appendChild\(p\);\}varx=document\.createElement\('button'\)/.test(code));
t('연필은 mw-edit 클래스를 단다', /p\.className='mw-xmw-edit'/.test(code));
t('예전 다짐 줄에 편집 콜백이 배선돼 있다', /pledgeStartEdit\(\{id:e\.id,text:e\.text\|\|''/.test(code));
t('옛 설정 motto 줄도 고칠 수 있다', /pledgeStartEdit\(\{motto:true/.test(code));

t('고치는 중이면 새로 만들지 않고 그 줄을 고친다',
  /w\.text=v;w\.kind=toDiary\?'word':'wordbar';w\.shownInBar=toBar;/.test(code));
/* ⚠ 없으면 고친 글이 다른 기기의 옛 사본에 덮인다. */
t('⚠고친 줄은 updatedAt을 올린다', /w\.updatedAt=newDate\(\)\.toISOString\(\);/.test(code));
t('motto 편집은 motto 자리에 쓴다', /if\(pledgeEdit&&pledgeEdit\.motto\)\{S\.motto=v;S\.todayVow=v;\}/.test(code));
t('편집이 아니면 예전처럼 새로 만든다',
  /\}else\{newDiaryEntry\(toDiary\?'word':'wordbar',\{text:v,shownInBar:toBar,prompt:'pledge'\}\);\}/.test(code));

// ⚠ 상태를 내리는 자리 셋 — 하나라도 빠지면 남의 줄이 덮인다.
t('⚠① 저장하면 편집 상태가 내려간다', /pledgeEdit=null;pledgeEditBanner\(\);renderDiary\(\)/.test(code));
t("⚠② '새로 쓰기'가 편집 상태를 내린다",
  /functionpledgeEndEdit\(\)\{pledgeEdit=null;/.test(code));
t('⚠③ 시트를 열면 편집 상태가 처음부터', /pledgeEdit=null;pledgeEditBanner\(\);pledgeHistOpen=false/.test(code));
t("'새로 쓰기' 버튼이 배선돼 있다",
  /getElementById\('pledgeEditNew'\)\.addEventListener\('click',pledgeEndEdit\)/.test(code));
t('고치는 중 띠가 마크업에 있다', /id="pledgeEditBar"/.test(SRC));

// ── 앱 파리티 ────────────────────────────────────────────────────────────
const APP = '/Users/moonleon/Documents/Sundial/Sundial/Views/TopBar.swift';
if (!fs.existsSync(APP)) {
  console.log('SKIP  앱 소스를 못 찾았다 — 웹만 검사했다');
} else {
  const a = flat(fs.readFileSync(APP, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter(l => !/^\s*(\/\/|\/\/\/|⚠|·)/.test(l)).join('\n'));

  t('앱: wordRow가 editable 인자를 받는다', /funcwordRow\(_w:DiaryEntry,editable:Bool=false\)/.test(a));
  /* ⚠ 약속 목록은 if–then 패널로 쓰는 구조라 이 자유 입력칸에 못 되돌린다. */
  t('⚠앱: 다짐 목록만 editable, 약속 목록은 아니다',
    /ForEach\(barWords\)\{winwordRow\(w,editable:true\)\}/.test(a) &&
    /ForEach\(Array\(past\)\)\{winwordRow\(w\)\}/.test(a));
  t('앱: 연필이 그 줄을 입력칸으로 불러온다',
    /lineDraft=w\.text/.test(a) && /editingWordID=w\.id;editingMotto=false/.test(a));
  t('앱: 저장 토글도 그 줄 값으로 되돌린다',
    /lineToBar=w\.shownInBar/.test(a) && /lineToDiary=\(w\.kind=="word"\)/.test(a));
  t('앱: 고치는 중이면 그 줄을 고친다', /w\.text=v/.test(a) && /w\.updatedAt=Date\(\)/.test(a));
  t('⚠앱① 저장하면 편집 상태가 내려간다', /editingWordID=nil;editingMotto=false\s*lineDraft=""/.test(a) || /editingWordID=nil;editingMotto=false/.test(a));
  t('⚠앱③ 시트를 열면 편집 상태가 처음부터',
    /editingWordID=nil;editingMotto=false;lineDraft=""/.test(a));
  t('앱: 고치는 중 띠 + 새로 쓰기', /L\("고치는중","Editing"\)/.test(a) && /L\("새로쓰기","Writenew"\)/.test(a));
}

console.log((fail ? 'FAIL ' : 'OK ') + (ran - fail) + '/' + ran);
process.exit(fail ? 1 : 0);
