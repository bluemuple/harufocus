/* 웹 index.html에서 **실제 함수 소스**를 뽑아 node에서 돌린다 (포모도로
   파리티 테스트와 같은 방식) — 앱 ActiveFocusSyncTests와 같은 시나리오를
   같은 순서로 통과해야 앱↔웹 종료 신호가 갈라지지 않는다. */
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

// 함수 밖 상수도 실제 소스에서 가져온다 (키 이름이 갈리면 신호가 안 통한다).
const KEY_LINE = SRC.match(/var FEND_KEY=[^\n]*/)[0];

const REAL = KEY_LINE + '\n' +
  ['lastFocusEnd', 'setFocusEnd', 'noteRemoteEnd', 'recordLocalEnd',
   'adoptRemoteFocus'].map(grab).join('\n');

// --- 스텁: DOM·렌더·오디오만 대체하고 판정 로직은 손대지 않는다 -------------
const harness = `
  var store = {};
  var localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  var MY = 'web-me';
  var fTask = null, fSessionID = null, fRemote = false, fRemoteDev = '',
      fStart = 0, fPausedAcc = 0, fPaused = false, fPauseAt = 0,
      fPlanMin = 0, fPomo = null, ftKey = '';
  var scene = null;
  function webDeviceId(){ return MY; }
  function taskByID(id){ return null; }
  function uuid(){ return 'U-' + (uuid.n = (uuid.n || 0) + 1); }
  function document_stub(){ return { innerHTML: '', classList: { toggle(){}, add(){}, remove(){} } }; }
  var document = { getElementById: document_stub };
  var IC = { play: '', pause: '' };
  function paintPomoChip(){}
  function setPomoOn(on){ pomoSetting = !!on; }
  function paintAdjRow(){}
  var pomoSetting = false, fAdjOpen = false, fPlanAdjust = 0;
  function applyRemoteScene(s){ scene = s; }
  function tickFocus(){}
  function fmStop(){}
  function renderAll(){}
  function closeRemoteFocus(){
    fTask = null; fRemote = false; fRemoteDev = ''; fPomo = null; fPlanMin = 0;
    fSessionID = null;
  }
  function startFocus(t, opt){
    fTask = t;
    if (opt && opt.remote) { fRemote = true; fSessionID = opt.sessionID || uuid(); }
    else { fRemote = false; fSessionID = uuid(); }
  }
${REAL}
  module.exports = {
    state: () => ({ fTask: fTask && fTask.id, fSessionID, fRemote }),
    adoptRemoteFocus, lastFocusEnd, recordLocalEnd, closeRemoteFocus, startFocus,
    reset(){ closeRemoteFocus(); store = {}; },
  };
`;

const m = new module.constructor();
m._compile(harness, '/web-focus-harness.js');
const W = m.exports;

// --- 시나리오 (앱 테스트와 1:1) --------------------------------------------
const iso = t => new Date(t).toISOString();
const NOW = Date.parse('2026-07-20T09:00:00.000Z');
const dto = o => Object.assign({
  sessionID: 'S-1', taskID: 'T-1', taskTitle: '수학', categoryID: 'study',
  clockStart: iso(NOW), focusedBaseSec: 120, isPaused: false, pauseBegan: null,
  pauses: [], planMin: 45, pomodoro: false, pomodoroPlanMin: 0,
  sceneRaw: 'rain', deviceID: 'phone-A', updatedAt: iso(NOW),
}, o);
const end = (sid, dev, at) => ({ sessionID: sid, endedAt: iso(at || NOW + 60000),
                                 deviceID: dev || 'phone-A' });

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };

W.reset();
W.adoptRemoteFocus(dto(), null);
t('원격 세션 채택 + sessionID 물려받기',
  W.state().fTask === 'T-1' && W.state().fSessionID === 'S-1' && W.state().fRemote);

W.adoptRemoteFocus(null, null);
t('⚠회귀 방지: 무관한 null push에 세션이 죽지 않는다', W.state().fTask === 'T-1');

W.adoptRemoteFocus(null, end('S-OTHER'));
t('다른 세션의 종료 신호는 무시', W.state().fTask === 'T-1');

W.adoptRemoteFocus(null, end('S-1'));
t('내 세션을 지목한 종료 신호 → 닫힘',
  W.state().fTask === null && W.state().fSessionID === null);

W.reset();
W.adoptRemoteFocus(dto({ sessionID: 'S-2' }), end('S-2'));
t('이미 끝난 세션은 다시 채택하지 않는다', W.state().fTask === null);
t('남의 종료 신호를 물어 나른다', (W.lastFocusEnd() || {}).sessionID === 'S-2');
W.adoptRemoteFocus(null, end('S-OLD', 'x', NOW - 60000));
t('더 오래된 신호로 덮이지 않는다', (W.lastFocusEnd() || {}).sessionID === 'S-2');

W.reset();
W.adoptRemoteFocus(dto({ deviceID: 'web-me' }), null);
t('내 기기 메아리 무시', W.state().fTask === null);

W.reset();
W.startFocus({ id: 'T-9', title: 'local', categoryID: 'focus', durationMin: 25 });
const sid = W.state().fSessionID;
t('웹이 시작한 세션도 sessionID를 갖는다', !!sid && !W.state().fRemote);
W.adoptRemoteFocus(null, null);
t('웹 시작 세션도 null push에 살아남는다', W.state().fTask === 'T-9');
W.adoptRemoteFocus(null, end(sid));
t('앱이 끝내면 웹이 시작한 세션도 닫힌다', W.state().fTask === null);

W.reset();
W.startFocus({ id: 'T-3', title: 'local', categoryID: 'focus', durationMin: 25 });
const mine = W.state().fSessionID;
W.recordLocalEnd();
const fe = W.lastFocusEnd();
t('웹이 끄면 내 sessionID로 종료 신호를 남긴다',
  fe && fe.sessionID === mine && fe.deviceID === 'web-me');

console.log(fail ? `\n${fail}/${ran} FAILED` : `\n${ran}/${ran} 통과`);
process.exit(fail ? 1 : 0);
