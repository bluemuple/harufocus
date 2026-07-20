/* 웹 index.html에서 **실제 함수 소스**를 뽑아 node에서 돌린다 (focus-end-parity와
   같은 방식). 지키는 규약: 웹 네비게이션(navBar)과 앱 탭바(barTabsRaw)는 **다른
   키**이고, 겹치는 id만 barTabsRaw로 건너간다.

   예전엔 둘이 같은 키를 써서 양방향으로 서로를 지웠다:
     ① 웹이 friends/about을 barTabsRaw에 실으면 앱의 compactMap이 조용히
        떨어뜨려 폰 탭바가 줄었다(전부 떨어지면 기본 6개로 리셋).
     ② 앱이 탭바를 고쳐 push하면 SettingsDTO에 없던 웹 구성이 통째로 사라졌다.
   ②는 앱 쪽 SettingsDTO.navBar pass-through가, ①은 아래 saveNav가 막는다. */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');

function grab(name) {
  const at = SRC.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('not found: ' + name);
  let i = SRC.indexOf('{', at), depth = 0;
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return SRC.slice(at, j + 1); }
  }
  throw new Error('unbalanced: ' + name);
}
// 상수도 실제 소스에서 — 목록이 갈리면 그게 바로 이 버그다.
function grabVar(name) {
  const at = SRC.indexOf('var ' + name + '=');
  if (at < 0) throw new Error('not found: var ' + name);
  const eol = SRC.indexOf('\n', at);
  return SRC.slice(at, eol) + (SRC[eol - 1] === ';' ? '' : ';');
}

const REAL = [grabVar('NAV_ALL'), grabVar('APP_TAB_IDS')].join('\n') + '\n' +
  ['navBarKeys', 'saveNav', 'navOverflowKeys'].map(grab).join('\n');

// --- 스텁: 저장·렌더만 대체하고 판정 로직은 손대지 않는다 -------------------
// ⚠ REAL이 먼저 와야 한다 — var 선언은 끌어올려져도 **대입은 순서대로**라,
// 아래 스텁이 NAV_ALL을 읽을 시점에 값이 들어가 있어야 한다.
const harness = `
${REAL}
  var NAV_MAX = 6;
  var pushes = 0;
  function pushSnapshot(){ pushes++; }
  // NAV_DEF는 아이콘 SVG 덩어리라 키만 있으면 충분하다 (navBarKeys가 존재만 본다).
  var NAV_DEF = {};
  NAV_ALL.forEach(function(k){ NAV_DEF[k] = { label: k }; });
  var DATA = { settings: {} };
  return {
    saveNav: saveNav, navBarKeys: navBarKeys, navOverflowKeys: navOverflowKeys,
    NAV_ALL: NAV_ALL, APP_TAB_IDS: APP_TAB_IDS,
    settings: function(){ return DATA.settings; },
    setSettings: function(s){ DATA.settings = s; },
    pushes: function(){ return pushes; }
  };
`;
const W = new Function(harness)();

let ran = 0, fail = 0;
function t(name, ok) {
  ran++;
  if (!ok) { fail++; console.log('  ✗ ' + name); } else console.log('  ✓ ' + name);
}

// NAV_DEF에 실제로 있는 키인지도 소스로 확인 (스텁이 가리지 않도록 따로).
W.NAV_ALL.forEach(function (k) {
  t('NAV_DEF에 ' + k + ' 정의가 있다', SRC.indexOf('\n    ' + k + ':{label:') >= 0);
});

// --- ⚠ 앱 TabID와의 파리티 ---------------------------------------------------
// Sundial/Views/MainTabView.swift 의 `enum TabID` case 목록과 **정확히** 같아야
// 한다. 앱에 탭이 늘거나 줄면 앱 쪽 SettingsSyncTests가 먼저 깨지고, 그 다음
// 여기를 고치면 된다.
const APP_TAB_ID_EXPECTED =
  ['timeline', 'todo', 'matrix', 'routine', 'bucket', 'diary', 'lock', 'settings'];
t('APP_TAB_IDS가 앱 TabID 집합과 같다',
  W.APP_TAB_IDS.join(',') === APP_TAB_ID_EXPECTED.join(','));
t('APP_TAB_IDS는 전부 NAV_ALL 안에 있다',
  W.APP_TAB_IDS.every(function (k) { return W.NAV_ALL.indexOf(k) >= 0; }));
t('웹 전용 키는 앱에 없다',
  ['friends', 'about'].every(function (k) { return W.APP_TAB_IDS.indexOf(k) < 0; }));

// --- ① 웹 → 앱: 웹 전용 키가 앱 탭바를 갉아먹지 않는다 -----------------------
W.setSettings({ barTabsRaw: 'timeline,todo,matrix,routine,bucket,diary' });
W.saveNav(['timeline', 'friends', 'about', 'todo']);
t('navBar에는 웹 구성이 그대로 남는다',
  W.settings().navBar.join(',') === 'timeline,friends,about,todo');
t('⚠barTabsRaw엔 앱이 아는 id만 실린다',
  W.settings().barTabsRaw === 'timeline,todo');
t('저장하면 push가 한 번 돈다', W.pushes() === 1);

// 하나도 안 겹치면 앱 탭바는 **건드리지 않는다** — 빈 값을 쓰면 앱이 '설정 없음'
// 으로 읽어 기본 6개로 조용히 되돌린다(사용자가 고른 적 없는 상태).
W.setSettings({ barTabsRaw: 'timeline,todo,bucket' });
W.saveNav(['friends', 'about']);
t('⚠앱 전용 id가 하나도 없으면 barTabsRaw는 그대로',
  W.settings().barTabsRaw === 'timeline,todo,bucket');
t('그래도 웹 구성은 저장된다', W.settings().navBar.join(',') === 'friends,about');

// --- ② 앱 → 웹: 앱이 탭바를 고쳐도 웹 구성이 살아남는다 ----------------------
// (앱 SettingsDTO.navBar pass-through가 왕복시켜 준 뒤의 모양)
W.setSettings({ navBar: ['timeline', 'friends', 'about'],
                barTabsRaw: 'timeline,todo,matrix,routine,bucket,diary' });
t('⚠navBar가 있으면 앱 탭바가 웹 네비를 덮지 않는다',
  W.navBarKeys().join(',') === 'timeline,friends,about');

// --- 예전 데이터: navBar가 없으면 앱 탭바를 따라간다 -------------------------
W.setSettings({ barTabsRaw: 'timeline,todo,bucket' });
t('navBar 없으면 barTabsRaw로 폴백',
  W.navBarKeys().join(',') === 'timeline,todo,bucket');
W.setSettings({});
t('아무것도 없으면 기본 6개',
  W.navBarKeys().join(',') === 'timeline,todo,matrix,routine,bucket,diary');

// --- 기존 규칙이 안 깨졌는지 ------------------------------------------------
W.setSettings({ navBar: ['timeline', 'todo', 'matrix', 'routine', 'bucket', 'diary', 'lock'] });
t('바는 NAV_MAX(6)개까지만', W.navBarKeys().length === 6);
W.setSettings({ navBar: ['timeline', 'nonsense', 'todo'] });
t('모르는 키는 걸러진다', W.navBarKeys().join(',') === 'timeline,todo');
W.setSettings({ navBar: ['timeline', 'todo'] });
t('나머지는 더보기로', W.navOverflowKeys().indexOf('friends') >= 0 &&
  W.navOverflowKeys().indexOf('timeline') < 0);

console.log(fail ? `\n${fail}/${ran} FAILED` : `\n${ran}/${ran} 통과`);
process.exit(fail ? 1 : 0);
