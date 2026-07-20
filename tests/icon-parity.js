/* 작업명 → 아이콘·물통 면 자동 배정이 **앱과 같은가** (요청: 아이콘·색 일치).
   index.html의 실제 CAP_KEYWORDS·matchCapKeyword 소스를 뽑아 node로 돌린다.

   배경(고친 결함):
   · 매칭 규칙이 서로 달랐다. 앱은 '제목에서 **먼저 나온 단어**'가 이기는데
     웹은 '표에서 **먼저 나온 행**'이 이겼다. CAP_KEYWORDS는 마음 범주가 맨
     위라, 제목 어디에 있든 마음이 늘 먼저 걸렸다:
        "운동 후 명상" → 웹 meditate(마음) / 앱 dumbbell(몸)
     같은 작업이 두 기기에서 다른 그림·다른 물통 면으로 보였다.
   · 앱에만 있던 10줄(운전·미용실·택배·화분·반려동물·집 …)이 웹엔 아예
     없어 아이콘이 안 붙었다. 글리프 7개를 새로 그려 채웠다.

   ⚠ 아래 EXPECT의 sf 값은 Sundial/Engine/IconCatalog.swift와 **한 쌍**이다.
   앱을 고치면 SundialTests/IconParityTests.swift가 먼저 깨지고, 그 다음
   여기를 고치면 된다.

   실행: node tests/icon-parity.js */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');

function grab(name) {
  const at = SRC.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('not found: ' + name);
  let depth = 0;
  for (let j = SRC.indexOf('{', at); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}') { depth--; if (depth === 0) return SRC.slice(at, j + 1); }
  }
  throw new Error('unbalanced: ' + name);
}

const kwAt = SRC.indexOf('var CAP_KEYWORDS');
const KEYWORDS = SRC.slice(kwAt, SRC.indexOf('];', kwAt) + 2);
// CAP_BY_WORD / CAP_HANGUL_WORDS는 matchCapKeyword가 기대는 전제라 함께 가져온다.
const PRELUDE = SRC.slice(SRC.indexOf('var CAP_BY_WORD'), SRC.indexOf('function matchCapKeyword'));

const W = new Function(
  KEYWORDS + '\n' + PRELUDE + '\n' + grab('matchCapKeyword') + '\n' +
  'return { match: matchCapKeyword, byWord: CAP_BY_WORD };')();

let ran = 0, fail = 0;
function t(name, ok) {
  ran++;
  if (!ok) { fail++; console.log('  ✗ ' + name); } else console.log('  ✓ ' + name);
}

// ── 앱 IconCatalog와 짝을 이루는 기대표 ────────────────────────────────────
// [제목, 웹 글리프, 물통 면(null=안 바꿈), 짝이 되는 앱 SF 심볼]
const EXPECT = [
  // ⚠ 규칙 자체 — 제목 순서가 표 순서를 이긴다
  ['운동 후 명상',   'dumbbell', 'health', 'dumbbell.fill'],
  ['명상 후 운동',   'meditate', 'mind',   'figure.mind.and.body'],
  // 앱에만 있던 10줄 (새 글리프 7개 포함)
  ['운전 연습',      'car',    null, 'car.fill'],
  ['미용실',        'comb',   null, 'comb.fill'],
  ['집 청소',       'house',  null, 'house.fill'],
  ['강아지 산책시키기', 'paw',    null, 'pawprint.fill'],
  ['택배 부치기',    'box',    null, 'shippingbox.fill'],
  ['화분 물주기',    'plant',  null, 'camera.macro'],
  ['설거지',        'plate',  null, 'sink.fill'],
  ['예방접종',      'pills',  null, 'cross.case.fill'],
  ['영상편집',      'camera', 'focus', 'scissors'],
  ['물 마시기',     'drop',   'health', 'drop.fill'],
  // 빨래는 그대로 세탁기 (웹 글리프 키가 'dishes'지만 그림은 세탁기다)
  ['빨래 개기',     'dishes', null, 'washer.fill'],
];
EXPECT.forEach(function (row) {
  const [title, glyph, cat] = row;
  const m = W.match(title);
  t('"' + title + '" → ' + glyph + (cat ? ' / ' + cat : ''),
    !!m && m.icon === glyph && (m.cat || null) === (cat || null));
});

// ── 규칙 세부: 한 토큰 안에서는 먼저 나온 위치 → 더 긴 단어 ────────────────
t('⚠1글자 한글은 통째로 같은 토큰일 때만 ("물리"는 물이 아니다)',
  W.match('물리 숙제').icon !== 'drop');
t('"산책시키기"가 "산책"보다 길어서 이긴다 (반려동물)',
  W.match('산책시키기').icon === 'paw');
t('"물주기"가 "물"보다 길어서 이긴다 (화분)',
  W.match('물주기').icon === 'plant');
t('한 글자도 안 걸리면 null', W.match('zzzz블라블라') === null);
t('빈 제목도 null', W.match('') === null && W.match(null) === null);

// ── 새로 그린 글리프가 CAP_ICONS에 실제로 있는가 ───────────────────────────
['car', 'comb', 'house', 'paw', 'box', 'plant', 'plate'].forEach(function (g) {
  t('CAP_ICONS에 ' + g + ' 글리프가 있다', SRC.indexOf("['" + g + "','<") >= 0);
});

// ── 표가 참조하는 글리프는 전부 그려져 있어야 한다 (색 조회가 조용히 실패) ──
const referenced = {};
Object.keys(W.byWord).forEach(function (w) { referenced[W.byWord[w].icon] = true; });
const orphans = Object.keys(referenced).filter(function (g) {
  return SRC.indexOf("['" + g + "','<") < 0;
});
t('CAP_KEYWORDS가 가리키는 글리프가 전부 존재 (없으면: ' + orphans.join(',') + ')',
  orphans.length === 0);

console.log(fail ? `\n${fail}/${ran} FAILED` : `\n${ran}/${ran} 통과`);
process.exit(fail ? 1 : 0);
