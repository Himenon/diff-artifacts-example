#!/bin/bash
set -e

# 必須環境変数のチェック
: "${COMMENT_MARKER:?COMMENT_MARKER is required}"
: "${BASE_SHA_SHORT:?BASE_SHA_SHORT is required}"
: "${PR_SHA:?PR_SHA is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${PR_NUMBER:?PR_NUMBER is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

# オプション環境変数（デフォルト値あり）
DIFF_VIEWER_REPO="${DIFF_VIEWER_REPO:-Himenon/compare-action-diff-viewer}"
BASE_DIR="${BASE_DIR:-.next-base}"
PR_DIR="${PR_DIR:-.next-pr}"
GITIGNORE_PATTERNS="${GITIGNORE_PATTERNS:-node_modules/}"

echo "Starting artifact comparison..."
echo "Base: $BASE_SHA_SHORT, PR: $PR_SHA"

# レポートファイルの初期化
# コミットURLとcompare URLを生成
BASE_COMMIT_URL="https://github.com/${GITHUB_REPOSITORY}/commit/${BASE_SHA_SHORT}"
HEAD_COMMIT_URL="https://github.com/${GITHUB_REPOSITORY}/commit/${PR_SHA}"
COMPARE_URL="https://github.com/${GITHUB_REPOSITORY}/compare/${BASE_SHA_SHORT}...${PR_SHA}"

cat > report.md <<EOF
$COMMENT_MARKER
### 🛠 Build Artifacts Diff

{{DIFF_URL}}

**Base**: [\`main@${BASE_SHA_SHORT}\`](${BASE_COMMIT_URL})
**Head**: [\`PR@${PR_SHA}\`](${HEAD_COMMIT_URL})
**Compare**: [${BASE_SHA_SHORT}...${PR_SHA}](${COMPARE_URL})

EOF

# 統計情報は後でGit差分から計算するため、ここでは初期化のみ
ADDED=0
REMOVED=0
MODIFIED=0

# アーティファクトをフォーマット（コピー前に実行）
# echo "--------- [$BASE_DIR] Formatting base artifacts... ---------"
# ./scripts/format-build-dir.sh "$BASE_DIR"

# echo "--------- [$PR_DIR] Formatting PR artifacts... ---------"
# ./scripts/format-build-dir.sh "$PR_DIR"

# diff-viewerリポジトリにプッシュ
echo "Pushing artifacts to $DIFF_VIEWER_REPO..."
MAIN_BRANCH="build-main-${BASE_SHA_SHORT}"
PR_BRANCH="build-pr-${PR_NUMBER}"

if git clone "https://x-access-token:${GH_TOKEN}@github.com/${DIFF_VIEWER_REPO}.git" diff-viewer 2>&1; then
  cd diff-viewer
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"

  echo "Using gitignore patterns:"
  echo "$GITIGNORE_PATTERNS"

  # 1. build-main ブランチの作成・更新
  echo "[BASE] Creating/updating branch: $MAIN_BRANCH"
  git fetch origin

  # リモートブランチが存在するか確認せずがんがんいう
  git checkout -b "$MAIN_BRANCH"
  # if git rev-parse "origin/$MAIN_BRANCH" >/dev/null 2>&1; then
  #   echo "[BASE] Remote branch exists, checking out from origin"
  #   git checkout -B "$MAIN_BRANCH" "origin/$MAIN_BRANCH"
  # else
  #   echo "[BASE] Remote branch does not exist, creating new branch"
  #   git checkout -b "$MAIN_BRANCH"
  # fi

  # mainのアーティファクトをコピー（フォーマット済み）
  # .gitディレクトリ以外を全て削除
  echo "[BASE] Working Directory: $(pwd)"
  echo "[BASE] Remove existing files except .git"
  find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

  echo "[BASE] Current git status before copy:"
  git status

  # .gitignoreを先に作成（コピー前に作成することで除外が効く）
  > .gitignore
  for pattern in $GITIGNORE_PATTERNS; do
    echo "$pattern" >> .gitignore
  done

  echo "[BASE] Verify directory is empty (except .git and .gitignore)"
  NON_GIT_FILES=$(find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.gitignore' | wc -l)
  if [ "$NON_GIT_FILES" -ne 0 ]; then
    echo "[BASE] ERROR: Directory is not empty before copy"
    find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.gitignore'
    exit 1
  fi

  echo "[BASE] Copying artifacts from ../$BASE_DIR"
  if [ ! -d "../${BASE_DIR}" ]; then
    echo "[BASE] ERROR: Source directory does not exist: ../$BASE_DIR"
    exit 1
  fi

  cp -r "../${BASE_DIR}/." . || {
    echo "[BASE] ERROR: Failed to copy artifacts"
    exit 1
  }

  echo "[BASE] Verify copy completed successfully"
  COPIED_FILES=$(find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.gitignore' | wc -l)
  echo "[BASE] Copied $COPIED_FILES top-level items"
  if [ "$COPIED_FILES" -eq 0 ]; then
    echo "[BASE] WARNING: No files were copied"
  fi

  git add -A
  git status
  if git diff --staged --quiet; then
    echo "[BASE] No changes in main branch artifacts"
  else
    git status
    git commit -m "build: ${GITHUB_REPOSITORY}#${BASE_SHA_SHORT}" --allow-empty
    git push origin "$MAIN_BRANCH" -f
  fi

  # 2. build-pr ブランチの作成・更新
  echo "[PR] Creating/updating branch: $PR_BRANCH from $MAIN_BRANCH"

  # 常に最新のmainブランチから作成（古いbaseとの比較を避けるため）
  git checkout -B "$PR_BRANCH" "$MAIN_BRANCH"

  # # リモートブランチが存在する場合はpull（履歴をマージ）
  # if git rev-parse "origin/$PR_BRANCH" >/dev/null 2>&1; then
  #   echo "Remote PR branch exists, pulling changes"
  #   git pull origin "$PR_BRANCH" --no-rebase --allow-unrelated-histories || true
  # fi

  # PRのアーティファクトをコピー（フォーマット済み）
  # .gitディレクトリ以外を全て削除
  echo "[PR] Working Directory: $(pwd)"
  echo "[PR] Remove existing files except .git"
  find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

  # .gitignoreを先に作成（コピー前に作成することで除外が効く）
  > .gitignore
  for pattern in $GITIGNORE_PATTERNS; do
    echo "$pattern" >> .gitignore
  done

  echo "[PR] Verify directory is empty (except .git and .gitignore)"
  NON_GIT_FILES=$(find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.gitignore' | wc -l)
  if [ "$NON_GIT_FILES" -ne 0 ]; then
    echo "[PR] ERROR: Directory is not empty before copy"
    find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.gitignore'
    exit 1
  fi

  echo "[PR] Copying artifacts from ../$PR_DIR"
  if [ ! -d "../${PR_DIR}" ]; then
    echo "[PR] ERROR: Source directory does not exist: ../$PR_DIR"
    exit 1
  fi

  cp -r "../${PR_DIR}/." . || {
    echo "[PR] ERROR: Failed to copy artifacts"
    exit 1
  }

  echo "[PR] Verify copy completed successfully"
  COPIED_FILES=$(find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.gitignore' | wc -l)
  echo "[PR] Copied $COPIED_FILES top-level items"
  if [ "$COPIED_FILES" -eq 0 ]; then
    echo "[PR] WARNING: No files were copied"
  fi

  git add -A
  if git diff --staged --quiet; then
    git commit -m "No changes in PR branch artifacts" --allow-empty
  else
    git commit -m "build: ${GITHUB_REPOSITORY}#${PR_SHA}" --allow-empty
  fi

  # Git差分から正確な統計を取得
  echo "Calculating Git diff statistics between $MAIN_BRANCH and $PR_BRANCH..."
  ADDED=$(git diff --name-status "$MAIN_BRANCH" "$PR_BRANCH" | grep "^A" | wc -l | tr -d ' \n')
  MODIFIED=$(git diff --name-status "$MAIN_BRANCH" "$PR_BRANCH" | grep "^M" | wc -l | tr -d ' \n')
  REMOVED=$(git diff --name-status "$MAIN_BRANCH" "$PR_BRANCH" | grep "^D" | wc -l | tr -d ' \n')

  # デフォルト値を設定（空の場合）
  ADDED=${ADDED:-0}
  MODIFIED=${MODIFIED:-0}
  REMOVED=${REMOVED:-0}

  echo "Git Statistics: Added=$ADDED, Removed=$REMOVED, Modified=$MODIFIED"

  git push origin -f "$PR_BRANCH"

  cd ..

  # 3. Pull Requestの作成または更新
  echo "Creating or updating Pull Request..."

  # Summaryの内容を構築
  SUMMARY=""
  if [ "${ADDED:-0}" -gt 0 ]; then
    SUMMARY="${SUMMARY}- 🟢 Added: $ADDED files"$'\n'
  fi
  if [ "${REMOVED:-0}" -gt 0 ]; then
    SUMMARY="${SUMMARY}- 🔴 Removed: $REMOVED files"$'\n'
  fi
  if [ "${MODIFIED:-0}" -gt 0 ]; then
    SUMMARY="${SUMMARY}- 🟡 Modified: $MODIFIED files"$'\n'
  fi
  if [ "${ADDED:-0}" -eq 0 ] && [ "${REMOVED:-0}" -eq 0 ] && [ "${MODIFIED:-0}" -eq 0 ]; then
    SUMMARY="- ✅ No changes detected"$'\n'
  fi

  # PR本文の作成
  SOURCE_PR_URL="https://github.com/${GITHUB_REPOSITORY}/pull/${PR_NUMBER}"
  PR_BODY="# Build Artifacts Diff

**Repository**: [${GITHUB_REPOSITORY}](https://github.com/${GITHUB_REPOSITORY})
**PR**: [#${PR_NUMBER}](${SOURCE_PR_URL})
**Base**: [\`main@${BASE_SHA_SHORT}\`](${BASE_COMMIT_URL})
**Head**: [\`PR@${PR_SHA}\`](${HEAD_COMMIT_URL})
**Source Compare**: [${BASE_SHA_SHORT}...${PR_SHA}](${COMPARE_URL})

## Summary
${SUMMARY}"

  # 既存のPRを検索
  EXISTING_PR=$(gh pr list --repo "$DIFF_VIEWER_REPO" --head "$PR_BRANCH" --base "$MAIN_BRANCH" --json number --jq '.[0].number' 2>/dev/null || echo "")

  if [ -n "$EXISTING_PR" ]; then
    echo "Updating existing PR #$EXISTING_PR"
    gh pr edit "$EXISTING_PR" --repo "$DIFF_VIEWER_REPO" --body "$PR_BODY"
    DIFF_URL="https://github.com/${DIFF_VIEWER_REPO}/pull/${EXISTING_PR}"
  else
    echo "Creating new Pull Request"
    PR_TITLE="Build diff for ${GITHUB_REPOSITORY}#${PR_NUMBER}"
    CREATED_PR=$(gh pr create --repo "$DIFF_VIEWER_REPO" --base "$MAIN_BRANCH" --head "$PR_BRANCH" --title "$PR_TITLE" --body "$PR_BODY" 2>&1)

    if echo "$CREATED_PR" | grep -q "https://github.com"; then
      DIFF_URL=$(echo "$CREATED_PR" | grep -o 'https://github.com[^ ]*')
    else
      echo "Warning: Could not extract PR URL from: $CREATED_PR"
      DIFF_URL="https://github.com/${DIFF_VIEWER_REPO}/compare/${MAIN_BRANCH}...${PR_BRANCH}"
    fi
  fi

  echo "DIFF_URL=$DIFF_URL" >> "$GITHUB_OUTPUT"
  echo "Diff PR URL: $DIFF_URL"
else
  echo "Error: Could not clone diff-viewer repository."
  echo "This may happen if:"
  echo "  1. The repository does not exist: https://github.com/${DIFF_VIEWER_REPO}"
  echo "  2. The token does not have access to the repository"
  echo "  3. The repository settings do not allow access from this workflow"
  exit 1
fi

# サマリーを出力
echo "" >> report.md
echo "#### Summary" >> report.md
if [ "${ADDED:-0}" -gt 0 ]; then
  echo "- 🟢 Added: $ADDED files" >> report.md
fi
if [ "${REMOVED:-0}" -gt 0 ]; then
  echo "- 🔴 Removed: $REMOVED files" >> report.md
fi
if [ "${MODIFIED:-0}" -gt 0 ]; then
  echo "- 🟡 Modified: $MODIFIED files" >> report.md
fi

# すべて0の場合のメッセージ
if [ "${ADDED:-0}" -eq 0 ] && [ "${REMOVED:-0}" -eq 0 ] && [ "${MODIFIED:-0}" -eq 0 ]; then
  echo "- ✅ No changes detected" >> report.md
fi

echo "Comparison complete. Report generated in report.md"
