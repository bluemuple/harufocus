#!/bin/bash
# ────────────────────────────────────────────────────────────────
#  harufocus 웹 업로드  —  더블클릭하면 이 폴더를 GitHub에 올립니다.
#  (GitHub Pages로 자동 공개. 처음 한 번은 저장소를 새로 만들어요.)
# ────────────────────────────────────────────────────────────────

# 원하면 저장소 이름만 바꾸면 됩니다.
REPO="harufocus"

cd "$(dirname "$0")" || exit 1

echo ""
echo "🌇  harufocus 웹 업로드"
echo "────────────────────────────────"

# 1) gh(GitHub CLI) 확인
if ! command -v gh >/dev/null 2>&1; then
  echo "❌  GitHub CLI(gh)가 없어요."
  echo "    설치:  brew install gh   그 뒤  gh auth login"
  echo ""; read -n 1 -s -r -p "아무 키나 누르면 닫혀요…"; echo; exit 1
fi

# 2) 로그인 확인
if ! gh auth status >/dev/null 2>&1; then
  echo "🔑  GitHub 로그인이 필요해요. 브라우저가 열립니다…"
  gh auth login || { echo "❌ 로그인 실패"; read -n 1 -s -r -p "아무 키나…"; exit 1; }
fi

OWNER=$(gh api user --jq .login 2>/dev/null)
[ -z "$OWNER" ] && { echo "❌ GitHub 사용자 확인 실패"; read -n 1 -s -r -p "아무 키나…"; exit 1; }
echo "👤  $OWNER"

STAMP=$(date '+%Y-%m-%d %H:%M')

# 3) git 준비 (이 폴더를 독립 저장소로)
if [ ! -d .git ]; then
  echo "📦  새 저장소 준비 중…"
  git init -q
  git add -A
  git commit -q -m "harufocus web ($STAMP)"
  git branch -M main
  # 새 저장소를 만들어 올립니다. (안전: 절대 --force로 덮어쓰지 않아요.
  #  이미 다른 내용이 있는 저장소면 밀지 않고 안내만 합니다 — 실수로 다른
  #  프로젝트를 덮어쓰는 사고를 막기 위함.)
  if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
    git remote add origin "https://github.com/$OWNER/$REPO.git" 2>/dev/null
    if ! git push -q -u origin main 2>/dev/null; then
      echo "⚠️  '$REPO' 저장소에 이미 다른 내용이 있어요."
      echo "    안전을 위해 강제로 덮어쓰지 않았어요. 이 파일 위쪽의"
      echo "    REPO=\"...\" 를 새 이름으로 바꾼 뒤 다시 실행하세요."
      read -n 1 -s -r -p "아무 키나 누르면 닫혀요…"; echo; exit 1
    fi
  else
    echo "🆕  GitHub에 '$REPO' 저장소를 만들고 올립니다…"
    gh repo create "$REPO" --public --source=. --remote=origin --push || {
      echo "❌ 저장소 생성/푸시 실패"; read -n 1 -s -r -p "아무 키나…"; exit 1; }
  fi
else
  # 이후 실행: 변경분만 커밋·푸시
  if [ -z "$(git status --porcelain)" ]; then
    echo "✅  바뀐 내용이 없어요. (이미 최신)"
  else
    git add -A
    git commit -q -m "Update ($STAMP)"
    git push -q origin main
    echo "⬆️   업로드 완료."
  fi
fi

# 4) GitHub Pages 켜기 (최초 1회, 실패해도 무시)
gh api -X POST "repos/$OWNER/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1

PAGES="https://$OWNER.github.io/$REPO/"
echo "────────────────────────────────"
echo "🌐  주소:  $PAGES"
echo "    (처음 공개는 1~2분 뒤에 열려요.)"
echo ""
read -n 1 -s -r -p "완료! 아무 키나 누르면 닫혀요…"; echo
