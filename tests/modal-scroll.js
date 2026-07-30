/* 모달이 길어질 때 **안에서 스크롤**되는지 (신고 2026-07-31: '예전 다짐'을
   펼치면 아래 항목이 잘려 못 봤다).
   ⚠ 이 테스트가 지키는 핵심은 `min-height:0`이다. flex 자식은 기본값
   min-height:auto라 내용 높이만큼 버티고, 그러면 overflow-y:auto가 **아무 일도
   하지 않는다** — 있어도 없는 것과 같아 "왜 안 되지"로 되돌아온다.
   나중에 누가 '쓸모없어 보이는' 그 한 줄을 지우면 여기서 잡는다. */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');
let fail = 0, ran = 0;
const t = (n, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + n); if (!ok) fail++; };

const rule = (SRC.match(/#pledgePane,#promisePane\{[^}]*\}/) || [''])[0];
t('다짐·약속 패널에 스크롤 규칙이 있다', rule.length > 0);
t('overflow-y:auto', /overflow-y:\s*auto/.test(rule));
t('⚠min-height:0 (없으면 스크롤이 죽는다)', /min-height:\s*0/.test(rule));
t('flex로 남은 높이를 채운다', /flex:\s*1/.test(rule));

const fold = (SRC.match(/\.me-words-fold\{[^}]*\}/) || [''])[0];
t("'지금 나는' 떠 있는 목록도 길이 제한 + 스크롤",
  /max-height/.test(fold) && /overflow-y:\s*auto/.test(fold));

// 영어에서 캡슐 앞 라벨이 "I'm"으로 끝나면 "Right now I'm I keep drifting"이 된다.
t('⚠캡슐 앞 라벨에 "Right now I\'m"이 남아 있지 않다',
  !/data-i18n-en="Right now I'm"/.test(SRC));

console.log(fail ? `\n${fail}개 실패 / ${ran}` : `\n${ran}/${ran} 통과`);
process.exit(fail ? 1 : 0);
