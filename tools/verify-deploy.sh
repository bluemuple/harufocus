#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  올린 게 **정말 라이브에 올라갔는지** 확인한다.
#
#  왜 필요했나 (2026-08-07):
#    push는 다 성공했는데 GitHub Pages 빌드가 **닷새 치 네 커밋을 조용히 흘렸다**.
#    빌드 목록엔 `errored / duration 0ms`가 다섯 번 찍혔고 마지막 건은 8시간째
#    "building"에 멈춰 있었다. 그동안 "라이브입니다"라고 말해 왔지만 유저 화면은
#    옛 파일이었고, 그래서 이미 고친 것을 **버그로 두 번 신고**받았다.
#    → push했다는 사실은 배포됐다는 뜻이 아니다. **바이트를 직접 대조한다.**
#
#  하는 일
#    1) Pages 빌드가 끝날 때까지 기다린다 (built / errored)
#    2) errored면 재빌드를 요청한다 (최대 $MAX_RETRY 회) — legacy 빌더가
#       0ms로 죽는 건 재요청 한 번에 대개 통과한다(실측: 30초 만에 built)
#    3) 마지막에 **라이브 index.html과 로컬 index.html의 크기·해시를 견준다**
#       ⚠ 이 3번이 진짜 관문이다. 1·2는 GitHub이 하는 말이고, 3은 유저가 보는 것이다.
#
#  쓰는 법:  bash tools/verify-deploy.sh
#  나가는 값: 같으면 0, 다르거나 실패면 1 (자동화에서 그대로 쓰라고)
# ─────────────────────────────────────────────────────────────────────────────
set -o pipefail
cd "$(dirname "$0")/.." || exit 1

REPO="bluemuple/harufocus"
SITE="https://ellyday.com/index.html"
MAX_WAIT=300        # 빌드 하나를 기다리는 최대 초
MAX_RETRY=3         # errored일 때 재빌드 요청 횟수

command -v gh >/dev/null 2>&1 || { echo "❌ gh(GitHub CLI)가 없어요."; exit 1; }

build_status() { gh api "repos/$REPO/pages/builds/latest" --jq '.status' 2>/dev/null; }
build_commit() { gh api "repos/$REPO/pages/builds/latest" --jq '.commit[0:7]' 2>/dev/null; }

wait_for_build() {
  local waited=0
  while [ $waited -lt $MAX_WAIT ]; do
    local st; st=$(build_status)
    case "$st" in
      built)   echo "   ✅ 빌드 완료 ($(build_commit))"; return 0 ;;
      errored) echo "   ⚠️  빌드 실패 ($(build_commit))";  return 1 ;;
      *)       printf "   ⏳ %s… %ds\r" "${st:-unknown}" "$waited" ;;
    esac
    sleep 10; waited=$((waited + 10))
  done
  echo "   ⚠️  ${MAX_WAIT}초가 지나도 안 끝났어요 (멈춘 빌드일 수 있어요)"
  return 1
}

echo "🌐 배포 확인 — $REPO"
echo "────────────────────────────────"

for try in $(seq 0 $MAX_RETRY); do
  if wait_for_build; then break; fi
  if [ "$try" -eq "$MAX_RETRY" ]; then
    echo "   ❌ 재빌드를 $MAX_RETRY번 했는데도 안 됐어요."
    echo "      → GitHub Pages 설정을 확인해 주세요 (지금은 build_type: legacy)."
    exit 1
  fi
  echo "   🔁 재빌드 요청… ($((try + 1))/$MAX_RETRY)"
  gh api -X POST "repos/$REPO/pages/builds" >/dev/null 2>&1
  sleep 8
done

# ── 진짜 관문: 유저가 받는 파일과 내 파일이 같은가 ──────────────────────────
echo "🔎 라이브 파일 대조…"
TMP=$(mktemp -t ellyday-live)
# 캐시를 확실히 피한다 — 이게 없으면 옛 파일을 받고 '같다'고 착각할 수 있다.
curl -s --max-time 45 -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' \
     "$SITE?cb=$(date +%s%N)" -o "$TMP" || { echo "   ❌ 라이브를 못 받았어요"; rm -f "$TMP"; exit 1; }

LIVE_N=$(wc -c < "$TMP" | tr -d ' ')
LOC_N=$(wc -c < index.html | tr -d ' ')
LIVE_H=$(shasum -a 256 "$TMP" | cut -c1-12)
LOC_H=$(shasum -a 256 index.html | cut -c1-12)
rm -f "$TMP"

echo "   라이브: ${LIVE_N}B  $LIVE_H"
echo "   로컬  : ${LOC_N}B  $LOC_H"
if [ "$LIVE_H" = "$LOC_H" ]; then
  echo "✅ 같습니다 — 진짜로 배포됐어요."
  exit 0
fi
echo "❌ **다릅니다** — push는 됐지만 유저 화면은 아직 옛 파일이에요."
echo "   (CDN 반영이 늦을 수 있으니 1~2분 뒤 한 번 더 돌려 보세요.)"
exit 1
