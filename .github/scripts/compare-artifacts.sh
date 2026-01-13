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
MAX_MODIFIED_FILES="${MAX_MODIFIED_FILES:-10}"
MAX_ADDED_FILES="${MAX_ADDED_FILES:-20}"
MAX_REMOVED_FILES="${MAX_REMOVED_FILES:-20}"

echo "Starting artifact comparison..."
echo "Base: $BASE_SHA_SHORT, PR: $PR_SHA"

# レポートファイルの初期化
cat > report.md <<EOF
$COMMENT_MARKER
### 🛠 Build Artifacts Diff
Comparing \`main\` ($BASE_SHA_SHORT) vs \`PR\` ($PR_SHA)

EOF

# ファイルレベルの差分を取得
diff -rq "$BASE_DIR" "$PR_DIR" > diff_result.txt || true

if [ ! -s diff_result.txt ]; then
  echo "HAS_DIFF=false" >> "$GITHUB_OUTPUT"
  echo "✅ No changes detected." >> report.md
  echo "No changes detected."
  exit 0
fi

echo "HAS_DIFF=true" >> "$GITHUB_OUTPUT"

# 統計情報を収集
ADDED=$(grep -c "Only in $PR_DIR" diff_result.txt || echo 0)
REMOVED=$(grep -c "Only in $BASE_DIR" diff_result.txt || echo 0)
MODIFIED=$(grep -c "Files .* differ" diff_result.txt || echo 0)

echo "Statistics: Added=$ADDED, Removed=$REMOVED, Modified=$MODIFIED"

# diff-viewerリポジトリにプッシュ
echo "Pushing artifacts to $DIFF_VIEWER_REPO..."
MAIN_BRANCH="build-main-${BASE_SHA_SHORT}"
PR_BRANCH="build-pr-${PR_NUMBER}"

if git clone "https://x-access-token:${GH_TOKEN}@github.com/${DIFF_VIEWER_REPO}.git" diff-viewer 2>&1; then
  cd diff-viewer
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"

  # 1. build-main ブランチの作成・更新
  echo "Creating/updating branch: $MAIN_BRANCH"
  git fetch origin "$MAIN_BRANCH" 2>/dev/null || true
  git checkout -B "$MAIN_BRANCH"

  # mainのアーティファクトをコピー
  rm -rf ./* .next 2>/dev/null || true
  cp -r "../${BASE_DIR}/." .

  git add -A
  if git diff --staged --quiet; then
    echo "No changes in main branch artifacts"
  else
    git commit -m "build: ${GITHUB_REPOSITORY}#${BASE_SHA_SHORT}"
    git push -f origin "$MAIN_BRANCH"
  fi

  # 2. build-pr ブランチの作成・更新
  echo "Creating/updating branch: $PR_BRANCH from $MAIN_BRANCH"
  git fetch origin "$PR_BRANCH" 2>/dev/null || true
  git checkout -B "$PR_BRANCH" "$MAIN_BRANCH"

  # PRのアーティファクトをコピー
  rm -rf ./* .next 2>/dev/null || true
  cp -r "../${PR_DIR}/." .

  git add -A
  if git diff --staged --quiet; then
    echo "No changes in PR branch artifacts"
    HAS_CHANGES=false
  else
    git commit -m "build: ${GITHUB_REPOSITORY}#${PR_SHA}"
    git push -f origin "$PR_BRANCH"
    HAS_CHANGES=true
  fi

  cd ..

  # 3. Pull Requestの作成または更新
  if [ "$HAS_CHANGES" = "true" ]; then
    echo "Creating or updating Pull Request..."

    # PR本文の作成
    PR_BODY="# Build Artifacts Diff

**Repository**: ${GITHUB_REPOSITORY}
**PR**: #${PR_NUMBER}
**Base**: \`main\` (${BASE_SHA_SHORT})
**Head**: \`PR\` (${PR_SHA})

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
  echo "📊 [View Diff in GitHub PR]($DIFF_URL)" >> report.md
  echo "" >> report.md
fi

# Modified Filesの詳細（最大N件）
if [ "$MODIFIED" -gt 0 ]; then
  echo "#### 🟡 Modified Files" >> report.md
  COUNT=0
  grep "Files .* differ" diff_result.txt | head -n "$MAX_MODIFIED_FILES" | while IFS= read -r line; do
    FILE1=$(echo "$line" | sed 's/Files \(.*\) and .* differ/\1/')
    FILE2=$(echo "$line" | sed 's/Files .* and \(.*\) differ/\1/')
    FILENAME=$(echo "$FILE2" | sed "s|$PR_DIR/||")

    echo "<details><summary><code>$FILENAME</code></summary>" >> report.md
    echo "" >> report.md
    echo "\`\`\`diff" >> report.md
    diff -u "$FILE1" "$FILE2" 2>/dev/null | sed "s|$BASE_DIR/||g; s|$PR_DIR/||g" | head -n 100 >> report.md || echo "Binary files differ or file too large" >> report.md
    echo "\`\`\`" >> report.md
    echo "</details>" >> report.md
    echo "" >> report.md
    COUNT=$((COUNT + 1))
  done
  if [ "$MODIFIED" -gt "$MAX_MODIFIED_FILES" ]; then
    echo "_... and $((MODIFIED - MAX_MODIFIED_FILES)) more modified files_" >> report.md
    echo "" >> report.md
  fi
fi

# Added Filesの詳細（最大N件）
if [ "$ADDED" -gt 0 ]; then
  echo "#### 🟢 Added Files" >> report.md
  COUNT=0
  grep "Only in $PR_DIR" diff_result.txt | head -n "$MAX_ADDED_FILES" | while IFS= read -r line; do
    DIR=$(echo "$line" | sed "s/Only in \(.*\): .*/\1/" | sed "s|$PR_DIR||")
    FILE=$(echo "$line" | sed 's/Only in .*: //')
    FULLPATH="$PR_DIR${DIR}/${FILE}"
    FILEPATH="${DIR}/${FILE}"

    if [ -f "$FULLPATH" ]; then
      SIZE=$(stat -f%z "$FULLPATH" 2>/dev/null || stat -c%s "$FULLPATH" 2>/dev/null || echo "unknown")
      echo "- \`$FILEPATH\` (${SIZE} bytes)" >> report.md
    fi
    COUNT=$((COUNT + 1))
  done
  if [ "$ADDED" -gt "$MAX_ADDED_FILES" ]; then
    echo "_... and $((ADDED - MAX_ADDED_FILES)) more added files_" >> report.md
  fi
  echo "" >> report.md
fi

# Removed Filesの詳細（最大N件）
if [ "$REMOVED" -gt 0 ]; then
  echo "#### 🔴 Removed Files" >> report.md
  COUNT=0
  grep "Only in $BASE_DIR" diff_result.txt | head -n "$MAX_REMOVED_FILES" | while IFS= read -r line; do
    DIR=$(echo "$line" | sed "s/Only in \(.*\): .*/\1/" | sed "s|$BASE_DIR||")
    FILE=$(echo "$line" | sed 's/Only in .*: //')
    FULLPATH="$BASE_DIR${DIR}/${FILE}"
    FILEPATH="${DIR}/${FILE}"

    if [ -f "$FULLPATH" ]; then
      SIZE=$(stat -f%z "$FULLPATH" 2>/dev/null || stat -c%s "$FULLPATH" 2>/dev/null || echo "unknown")
      echo "- \`$FILEPATH\` (${SIZE} bytes)" >> report.md
    fi
    COUNT=$((COUNT + 1))
  done
  if [ "$REMOVED" -gt "$MAX_REMOVED_FILES" ]; then
    echo "_... and $((REMOVED - MAX_REMOVED_FILES)) more removed files_" >> report.md
  fi
  echo "" >> report.md
fi

echo "Comparison complete. Report generated in report.md"
