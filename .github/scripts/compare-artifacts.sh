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

**Base**: [\`main@${BASE_SHA_SHORT}\`](${BASE_COMMIT_URL})
**Head**: [\`PR@${PR_SHA}\`](${HEAD_COMMIT_URL})
**Compare**: [${BASE_SHA_SHORT}...${PR_SHA}](${COMPARE_URL})

EOF

# ファイルレベルの差分を取得（フォーマット前の生データで）
diff -rq "$BASE_DIR" "$PR_DIR" > diff_result.txt || true

if [ ! -s diff_result.txt ]; then
  echo "HAS_DIFF=false" >> "$GITHUB_OUTPUT"
  echo "✅ No changes detected." >> report.md
  echo "No changes detected."
  exit 0
fi

echo "HAS_DIFF=true" >> "$GITHUB_OUTPUT"

# 統計情報を収集
ADDED=$(grep "Only in $PR_DIR" diff_result.txt | wc -l | tr -d ' ')
REMOVED=$(grep "Only in $BASE_DIR" diff_result.txt | wc -l | tr -d ' ')
MODIFIED=$(grep "Files .* differ" diff_result.txt | wc -l | tr -d ' ')

echo "Statistics: Added=$ADDED, Removed=$REMOVED, Modified=$MODIFIED"

# アーティファクトをフォーマット（コピー前に実行）
echo "Formatting base artifacts..."
./scripts/format-build-dir.sh "$BASE_DIR"

echo "Formatting PR artifacts..."
./scripts/format-build-dir.sh "$PR_DIR"

# diff-viewerリポジトリにプッシュ
echo "Pushing artifacts to $DIFF_VIEWER_REPO..."
MAIN_BRANCH="build-main-${BASE_SHA_SHORT}"
PR_BRANCH="build-pr-${PR_NUMBER}"

if git clone "https://x-access-token:${GH_TOKEN}@github.com/${DIFF_VIEWER_REPO}.git" diff-viewer 2>&1; then
  cd diff-viewer
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"

  echo "Using gitignore patterns: $GITIGNORE_PATTERNS"

  # 1. build-main ブランチの作成・更新
  echo "Creating/updating branch: $MAIN_BRANCH"
  git fetch origin

  # リモートブランチが存在するか確認
  if git rev-parse "origin/$MAIN_BRANCH" >/dev/null 2>&1; then
    echo "Remote branch exists, checking out from origin"
    git checkout -B "$MAIN_BRANCH" "origin/$MAIN_BRANCH"
  else
    echo "Remote branch does not exist, creating new branch"
    git checkout -b "$MAIN_BRANCH"
  fi

  # mainのアーティファクトをコピー（フォーマット済み）
  rm -rf ./* .next 2>/dev/null || true
  cp -r "../${BASE_DIR}/." .

  # .gitignoreを追加
  > .gitignore
  for pattern in $GITIGNORE_PATTERNS; do
    echo "$pattern" >> .gitignore
  done

  git add -A
  if git diff --staged --quiet; then
    echo "No changes in main branch artifacts"
  else
    git commit -m "build: ${GITHUB_REPOSITORY}#${BASE_SHA_SHORT}"
    git push origin "$MAIN_BRANCH"
  fi

  # 2. build-pr ブランチの作成・更新
  echo "Creating/updating branch: $PR_BRANCH from $MAIN_BRANCH"

  # 常に最新のmainブランチから作成（古いbaseとの比較を避けるため）
  git checkout -B "$PR_BRANCH" "$MAIN_BRANCH"

  # リモートブランチが存在する場合はpull（履歴をマージ）
  if git rev-parse "origin/$PR_BRANCH" >/dev/null 2>&1; then
    echo "Remote PR branch exists, pulling changes"
    git pull origin "$PR_BRANCH" --no-rebase --allow-unrelated-histories || true
  fi

  # PRのアーティファクトをコピー（フォーマット済み）
  rm -rf ./* .next 2>/dev/null || true
  cp -r "../${PR_DIR}/." .

  # .gitignoreを追加
  > .gitignore
  for pattern in $GITIGNORE_PATTERNS; do
    echo "$pattern" >> .gitignore
  done

  git add -A
  if git diff --staged --quiet; then
    echo "No changes in PR branch artifacts"
    HAS_CHANGES=false
  else
    git commit -m "build: ${GITHUB_REPOSITORY}#${PR_SHA}"
    git push origin "$PR_BRANCH"
    HAS_CHANGES=true
  fi

  cd ..

  # 3. Pull Requestの作成または更新
  if [ "$HAS_CHANGES" = "true" ]; then
    echo "Creating or updating Pull Request..."

    # PR本文の作成
    SOURCE_PR_URL="https://github.com/${GITHUB_REPOSITORY}/pull/${PR_NUMBER}"
    PR_BODY="# Build Artifacts Diff

**Repository**: [${GITHUB_REPOSITORY}](https://github.com/${GITHUB_REPOSITORY})
**PR**: [#${PR_NUMBER}](${SOURCE_PR_URL})
**Base**: [\`main@${BASE_SHA_SHORT}\`](${BASE_COMMIT_URL})
**Head**: [\`PR@${PR_SHA}\`](${HEAD_COMMIT_URL})
**Source Compare**: [${BASE_SHA_SHORT}...${PR_SHA}](${COMPARE_URL})

## Summary
- 🟢 Added: $ADDED files
- 🔴 Removed: $REMOVED files
- 🟡 Modified: $MODIFIED files
"

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
    echo "No changes detected, skipping PR creation"
    DIFF_URL="https://github.com/${DIFF_VIEWER_REPO}/compare/${MAIN_BRANCH}...${PR_BRANCH}"
    echo "DIFF_URL=$DIFF_URL" >> "$GITHUB_OUTPUT"
  fi
else
  echo "Error: Could not clone diff-viewer repository."
  echo "This may happen if:"
  echo "  1. The repository does not exist: https://github.com/${DIFF_VIEWER_REPO}"
  echo "  2. The token does not have access to the repository"
  echo "  3. The repository settings do not allow access from this workflow"
  exit 1
fi

# サマリーを出力
cat >> report.md <<EOF
#### Summary
- 🟢 Added: $ADDED files
- 🔴 Removed: $REMOVED files
- 🟡 Modified: $MODIFIED files

EOF

if [ -n "$DIFF_URL" ]; then
  echo "" >> report.md
  echo "📊 **[View Full Diff]($DIFF_URL)**" >> report.md
fi

echo "Comparison complete. Report generated in report.md"
