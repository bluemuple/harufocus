/* 타임라인 블록 = **집중의 기록**, 빗금 폐지 (요청 2026-09-11).
   실행: node tests/block-no-hatch.js

   유저 정리(원문 요지):
   - "블럭을 생성하는 목적은 내가 얼마나 집중했는지 보여주기 위함이야. 기록용이지."
   - "같은 작업이라면 solid, 빗금 상관없이 1개의 블록으로 … 아웃라인 처리."
   - "처음 집중 시간이 … 블럭 안에 텍스트를 넣어도 높이가 충분할 정도라면 그 아래
      빗금 만들지마." / "왠만하면 빗금 만들지말자. 블럭 윗변 바로 위에 작업명 넣어도 되잖아."

   신고였던 것:
   - 첨부1: 멈춘 블록과 그 아래 **계획 잔여 빗금** 사이에 빈틈 · 블록 라벨이 윗변 위로
            나가 **자기 마감선 제목과 포개짐**("둘 중 1개는 우측 블럭 속에 들어가야해")
   - 첨부4: 계획 잔여 빗금 둘이 **포개짐**

   ⚠ 이 파일이 못 박는 것
   ⑴ 계획 잔여 빗금(.plan-hatch)이 **없다** — 되살아나면 첨부1·4가 그대로 돌아온다
   ⑵ 합쳐진 블록의 공백도 빗금이 아니다 — 옅은 몸통 + 집중한 조각(.bseg)만 진하게
   ⑶ 라벨 자리는 **첫 색 조각**의 높이로 정하고, 기준은 **한 줄**(18)이다
   ⑷ 짧은 블록의 윗변 위 라벨이 **자기** 마감선 제목과 겹치면 뺀다(남의 것은 안 뺀다)
   ⑸ 앱 TaskBlockView.labelMinH와 같은 값                                            */
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const flat = s => s.replace(/\s/g, '');
// 코드만 — 주석 속 설명 문장에 속지 않게 (이 저장소에서 두 번 겪었다).
const codeOnly = flat(SRC.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'));

let fail = 0, ran = 0;
const t = (name, ok) => { ran++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) fail++; };

// ── ⑴ 계획 잔여 빗금 폐지 ──────────────────────────────────────────────
t('⚠ .plan-hatch 블록을 만들지 않는다', !/plan-hatch/.test(codeOnly));
t('계획 잔여 계산(planRemainMs)이 남아 있지 않다', !/planRemainMs/.test(codeOnly));
t('다음 블록에서 빗금을 자르던 헬퍼도 없다', !/nextStartAfter/.test(codeOnly));
t('빗금에 붙던 블록 모서리 규칙(.has-plan)도 없다', !/has-plan/.test(codeOnly));

// ── ⑵ 공백 = 옅은 몸통, 집중한 조각만 진하게 ─────────────────────────────
t('⚠ 회색 빗금(.bhatch)이 코드에 없다', !/bhatch/.test(codeOnly));
t('집중한 조각은 .bseg', /class="bseg"/.test(codeOnly));
t('공백이 있는 블록의 몸통은 옅다(0.22)',
  /if\(rest\.length\)\{el\.style\.background=hexA\(col,0\.22\);/.test(codeOnly));
t('공백이 없으면 예전처럼 통째로 진한 색', /\}elseel\.style\.background=hexA\(col,0\.9\);/.test(codeOnly));
t('한 블록 = 한 아웃라인(테두리는 공백 여부와 무관하게 진한 색)',
  /el\.style\.border='1\.7pxsolid'\+hexA\(col,0\.9\);/.test(codeOnly));
t('.bseg는 글자(z 1) 아래', /\.block\.rec\.bseg\{position:absolute;left:0;right:0;z-index:0;/.test(codeOnly));

// ── ⑶ 라벨 자리 = 첫 색 조각, 기준 = 한 줄 ─────────────────────────────
const LMH = +/varLABEL_MIN_H=(\d+),LABEL_H=(\d+);/.exec(codeOnly)[1];
const LH = +/varLABEL_MIN_H=(\d+),LABEL_H=(\d+);/.exec(codeOnly)[2];
t('⚠ 안에 넣는 기준 = 한 줄 높이 (LABEL_MIN_H === LABEL_H)', LMH === LH);
t('그 값은 18 — 앱 TaskBlockView.labelMinH와 한 쌍', LMH === 18);
t('첫 색 조각 = 첫 공백의 윗변까지',
  /varfirstSolidPx=rest\.length\?Math\.min\(hpx,Math\.max\(0,\(rest\[0\]\.s-b\.start\)\/span\*hpx\)\):hpx;/.test(codeOnly));
t('공백은 시각순으로 정렬해서 본다(첫 공백을 잘못 고르지 않게)',
  /varrest=\(b\.rest\|\|\[\]\)\.slice\(\)\.sort\(function\(a,z\)\{returna\.s-z\.s;\}\);/.test(codeOnly));
t('⚠ 안/밖 판정은 블록 전체가 아니라 첫 색 조각', /if\(firstSolidPx>=LABEL_MIN_H\)\{/.test(codeOnly)
  && !/if\(hpx>=LABEL_MIN_H\)/.test(codeOnly));
t('한 줄만 들어가는 얇은 조각(<30)은 .slim', /if\(firstSolidPx<30\)\{el\.classList\.add\('slim'\);/.test(codeOnly));
t('.slim은 여백 없이 조각 높이(--seg)에 글자를 앉힌다',
  /\.block\.rec\.slim\{padding:08px;/.test(codeOnly)
  && /\.block\.rec\.slim>\.bic,\.block\.rec\.slim>\.btitle\{height:var\(--seg,18px\);line-height:var\(--seg,18px\)\}/.test(codeOnly));
t('큰 글씨(.big)도 첫 조각 기준 — 합친 블록 전체 높이로 키우면 글자가 공백에 앉는다',
  /\(firstSolidPx>=44\?'big':''\)/.test(codeOnly));

// 성질: 첫 조각 식을 그대로 옮겨 경계를 본다
const firstSolid = (hpx, start, span, rest) =>
  rest.length ? Math.min(hpx, Math.max(0, (rest[0].s - start) / span * hpx)) : hpx;
t('공백 없는 20px 블록 → 20 (첨부1의 10분 블록: 한 줄이 들어가 안에 둔다)',
  firstSolid(20, 0, 600, []) === 20 && 20 >= LMH);
t('20분 블록, 5분 뒤 공백 → 첫 조각 10px (한 줄 미만 → 윗변 위)',
  firstSolid(40, 0, 1200e3, [{ s: 300e3, e: 600e3 }]) === 10);
t('첫 조각이 한 줄 이상이면 합쳐진 블록이라도 안에',
  firstSolid(60, 0, 1800e3, [{ s: 900e3, e: 1000e3 }]) >= LMH);

// ── ⑷ 자기 마감선 제목과 겹치는 윗변 위 라벨은 뺀다 ────────────────────
t('자기 마감선과의 겹침만 골라 뺀다',
  /varclash=dueTops\.some\(function\(d\)\{returnd\.id===tid&&l\.top<d\.y&&l\.bottom>d\.y-DUE_BAND_H;\}\);if\(clash\)l\.el\.remove\(\);return!clash;/.test(codeOnly));
t('그 판정은 computeNarrow **전**에 — 뺀 라벨이 블록을 밀지 않게',
  codeOnly.indexOf('varclash=dueTops.some') < codeOnly.indexOf('varres=computeNarrow(dueTops,blkRects,labRects);')
  && codeOnly.indexOf('varclash=dueTops.some') > 0);

// 성질: 같은 규칙을 옮겨 본다 (DUE_BAND_H는 본체에서)
const DUE_BAND_H = +/varDUE_BAND_H=(\d+)/.exec(codeOnly)[1];
const clash = (l, dues) => dues.some(d => d.id === String(l.key).split('@')[0]
  && l.top < d.y && l.bottom > d.y - DUE_BAND_H);
const lab = { key: 'T1@1000', top: 80, bottom: 80 + LH };
t('자기 마감선(y=100) 제목 띠에 걸리면 뺀다', clash(lab, [{ id: 'T1', y: 100 }]) === true);
t('⚠ 남의 마감선이면 안 뺀다 — 그건 블록이 물러나 자리를 나눈다',
  clash(lab, [{ id: 'T2', y: 100 }]) === false);
t('자기 마감선이라도 멀면 안 뺀다', clash(lab, [{ id: 'T1', y: 300 }]) === false);

console.log((fail ? 'FAIL ' : 'OK ') + (ran - fail) + '/' + ran);
process.exit(fail ? 1 : 0);
