/* 설정 페이지를 **앱과 같은 구조로** + 넓은 화면 2단 (요청 2026-08-07).
   실행: node tests/settings-app-parity.js

   신고: "홈페이지 설정 페이지도 앱처럼 해. 그리고 PC 웹 설정 페이지랑 아이패드
          가로모드는 넓은 화면을 충분히 활용하여 2개 칼럼으로 설정 섹션 및 버튼들 배치"

   ⚠ 이 파일이 못 박는 것
   ⑴ 묶음의 **순서와 이름** — 앱 SettingsView와 한 쌍(취향 → 상단 바 → 동기화 →
      하루 → 기타). 한쪽만 바뀌면 두 화면을 오가는 사람이 매번 길을 잃는다.
   ⑵ 2단의 **세 조각이 다 있는가**: .set-cols(다단) · .set-group(쪼개짐 방지) ·
      900px 경계. 하나만 빠져도 조용히 한 단으로 돌아가거나(경계) 묶음이 칼럼
      경계에서 반 토막 난다(break-inside).
   ⑶ 아바타 패널이 앱과 같은 순서·구성인가 — 특히 **코끼리가 목록에 없다**와
      친구 미리보기가 '나' 표를 단다(그 표가 없으면 어느 줄이 자기인지 못 고른다).
   ⑷ 재구성 때 **id가 하나도 안 빠졌는가** — 이 페이지의 배선은 전부 id 기반이라
      옮기다 하나 흘리면 그 설정만 조용히 죽는다(화면엔 그대로 보인다).            */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const flat = s => s.replace(/\s/g, '');
/* ⚠ 마크업을 자를 땐 **HTML 주석만** 걷는다. `/* … *​/`까지 함께 지우면 JS·CSS의
   여는 주석이 저 멀리의 닫는 주석과 짝지어 그 사이 마크업을 통째로 삼킨다 —
   실제로 178KB(설정 화면 포함)가 사라져 이 파일 전체가 거짓 실패했다. */
const markup = SRC.replace(/<!--[\s\S]*?-->/g, ' ');
const codeOnly = flat(SRC.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'));

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };

// 설정 본문만 잘라 본다 (다른 화면의 같은 글자에 속지 않게).
const bodyStart = markup.indexOf('<div class="setpage-body">');
const bodyEnd = markup.indexOf('id="moreScrim"', bodyStart);
if (bodyStart < 0 || bodyEnd < bodyStart) { console.log('FAIL  설정 본문을 못 찾음'); process.exit(1); }
const body = markup.slice(bodyStart, bodyEnd);

// ── ⑴ 묶음의 순서와 이름 ────────────────────────────────────────────────
const secs = [...body.matchAll(/class="set-sec"[^>]*>([^<]+)</g)].map(m => m[1].trim());
t('묶음이 다섯 개', secs.length === 5);
t('순서 = 취향 → 상단 바 → 동기화 → 하루 → 기타 (앱과 한 쌍)',
  JSON.stringify(secs) === JSON.stringify(['취향', '상단 바', '동기화', '하루', '기타']));
/* ⚠ 영어도 앱과 같은 낱말이라야 한다 — 한쪽만 고치면 언어를 바꾼 순간 구조가 달라 보인다. */
const en = [...body.matchAll(/class="set-sec"\s+data-i18n-en="([^"]+)"/g)].map(m => m[1]);
t('영어 이름도 앱과 같다',
  JSON.stringify(en) === JSON.stringify(['Preference', 'Top Bar', 'Sync', 'Day', 'Other']));

/* 앱은 '추가할 때 기본 길이'를 **하루** 안에 둔다 — 옛 웹은 '작업 추가'라는
   따로 있는 묶음이었다. 하루 묶음 안에 있는지 자리로 확인한다. */
const dayStart = body.indexOf('>하루<'), otherStart = body.indexOf('>기타<');
t('⚠ 추가할 때 기본 길이는 하루 안에 (앱과 같은 자리)',
  body.indexOf('id="setDefDur"') > dayStart && body.indexOf('id="setDefDur"') < otherStart);
t('작업 추가 아이콘은 기타 안에', body.indexOf('id="setCapIcons"') > otherStart);
t("옛 '집중 페이지'·'작업 추가' 머리줄이 남아 있지 않다",
  !/집중 페이지|>작업 추가</.test(body));

// ── ⑵ 넓은 화면 2단 ─────────────────────────────────────────────────────
t('묶음마다 .set-group', (body.match(/class="set-group"/g) || []).length === 5);
t('.set-cols가 묶음들을 감싼다', /class="set-cols"/.test(body));
t('다단 선언 columns:2', /\.set-cols\{columns:2/.test(codeOnly));
/* ⚠ 이 한 줄이 방식의 핵심 — 없으면 '하루'가 기상/취침에서 잘려 다음 칼럼으로
   넘어가고 머리글과 내용이 갈라진다. */
t('⚠ .set-group은 칼럼 경계에서 안 쪼개진다(break-inside:avoid)',
  /\.set-group\{break-inside:avoid/.test(codeOnly));
t('경계는 900px — 아이패드 세로(834)는 한 단, 가로(1194)는 두 단',
  /@media\(min-width:900px\)/.test(codeOnly));
/* 폰에서 두 단이 되면 글자가 반 폭으로 눌린다 — 규칙이 미디어 쿼리 **안**에만
   있는지 본다(밖에 있으면 어느 폭에서든 두 단이 된다). */
const mq = codeOnly.indexOf('@media(min-width:900px)');
t('⚠ 다단 규칙이 미디어 쿼리 밖에 새어 있지 않다',
  codeOnly.indexOf('.set-cols{columns:2') > mq);

// ── ⑶ 아바타 패널 (앱 AvatarPickerSheet 파리티) ─────────────────────────
const pfAt = markup.indexOf('id="profileScrim"');
const pf = markup.slice(pfAt, pfAt + 2000);
t('큰 얼굴이 맨 위', pf.indexOf('id="pfBig"') < pf.indexOf('id="pfName"'));
t('이름 칸이 얼굴 그리드보다 위', pf.indexOf('id="pfName"') < pf.indexOf('id="pfFaces"'));
t('미리보기는 색 고르는 칸 **아래** (앱과 같은 순서)',
  pf.indexOf('id="pfTones"') < pf.indexOf('id="pfPreview"'));
t("이름 안내글은 '이름 (선택)'", /placeholder="이름 \(선택\)"/.test(pf));
t('머리글에 ↻ 와 👥 기호가 박혀 있다', /↻/.test(pf) && /👥/.test(pf));
t("옛 '친구에게 보여요' 안내 문구는 사라졌다", !/친구에게 보여요/.test(pf));

/* ⚠ 코끼리는 **고를 수 없다**(앱과 같은 결정). 단 읽을 줄은 알아야 한다 —
   친구 서버에 남의 값이 아직 이 글자를 들고 있다. */
t('⚠ 얼굴 목록에 코끼리가 없다', /varPF_FACES=\['🧑'/.test(codeOnly) && !/PF_FACES=\['🐘'/.test(codeOnly));
t('열 때 옛 값(코끼리·hex)을 첫 얼굴로 갈아 준다',
  /if\(PF_FACES\.indexOf\(pfFace\)<0\)\{pfFace=PF_FACES\[0\];pfTone='';\}/.test(codeOnly));

t('미리보기가 두 줄(나 + 예시 친구)',
  (codeOnly.match(/class="pp-row"/g) || []).length === 2);
t("⚠ '나' 표가 있다 — 없으면 어느 줄이 자기인지 못 고른다", /class="pp-me"/.test(codeOnly));
t('이름을 치면 미리보기가 같이 바뀐다 (그림이 아니라 진짜 뷰)',
  /nm\.oninput=paintProfilePreview;/.test(codeOnly));
t('얼굴·색을 고르면 미리보기도 다시 그린다',
  /paintProfilePreview\(\);\}/.test(codeOnly.slice(codeOnly.indexOf('functionpaintProfile('))));
/* ⚠ 오늘 체크한 루틴은 루틴 페이지와 **같은 식**으로 읽어야 화면과 안 어긋난다. */
t('⚠ 오늘 체크는 habitLog/habitKey 한 쌍으로 읽는다',
  /return\(DATA\.habits\|\|\[\]\)\.filter\(function\(h\)\{returnhabitLog\(h\)\[key\]===1;\}\)/.test(codeOnly));

// ── ⑷ 재구성에서 흘린 id가 없는가 ───────────────────────────────────────
['setEleName', 'setProfileBtn', 'setScenery', 'setVow', 'setDdayLabel', 'setDdayDate',
 'setBarItems', 'setBarPeriod', 'setAcctStatus', 'setAccountBtn', 'setWake', 'setBed',
 'setGoal', 'setWeekStart', 'setDefDur', 'setCapIcons', 'setPostIt', 'setPostItQ4',
 'setStatsBtn'].forEach(id => t('id 살아 있음: ' + id, body.indexOf('id="' + id + '"') > 0));

console.log((fail ? 'FAIL ' : 'OK ') + (ran - fail) + '/' + ran);
process.exit(fail ? 1 : 0);
