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

# 完全な差分を生成（diff-viewer用）
cat > full_diff.md <<EOF
# Build Artifacts Diff

**Repository**: $GITHUB_REPOSITORY
**PR**: #$PR_NUMBER
**Base**: \`main\` ($BASE_SHA_SHORT)
**Head**: \`PR\` ($PR_SHA)

## Summary
- Added: $ADDED files
- Removed: $REMOVED files
- Modified: $MODIFIED files

EOF

# Modified Filesの完全な差分
if [ "$MODIFIED" -gt 0 ]; then
  echo "## Modified Files" >> full_diff.md
  grep "Files .* differ" diff_result.txt | while IFS= read -r line; do
    FILE1=$(echo "$line" | sed 's/Files \(.*\) and .* differ/\1/')
    FILE2=$(echo "$line" | sed 's/Files .* and \(.*\) differ/\1/')
    FILENAME=$(echo "$FILE2" | sed "s|$PR_DIR/||")

    echo "" >> full_diff.md
    echo "### $FILENAME" >> full_diff.md
    echo "\`\`\`diff" >> full_diff.md
    diff -u "$FILE1" "$FILE2" 2>/dev/null | sed "s|$BASE_DIR/||g; s|$PR_DIR/||g" >> full_diff.md || echo "Binary file or diff failed" >> full_diff.md
    echo "\`\`\`" >> full_diff.md
  done
fi

# Added Filesの情報
if [ "$ADDED" -gt 0 ]; then
  echo "" >> full_diff.md
  echo "## Added Files" >> full_diff.md
  grep "Only in $PR_DIR" diff_result.txt | while IFS= read -r line; do
    DIR=$(echo "$line" | sed "s/Only in \(.*\): .*/\1/" | sed "s|$PR_DIR||")
    FILE=$(echo "$line" | sed 's/Only in .*: //')
    FULLPATH="$PR_DIR${DIR}/${FILE}"
    FILEPATH="${DIR}/${FILE}"

    if [ -f "$FULLPATH" ]; then
      SIZE=$(stat -f%z "$FULLPATH" 2>/dev/null || stat -c%s "$FULLPATH" 2>/dev/null || echo "unknown")
      echo "- \`$FILEPATH\` (${SIZE} bytes)" >> full_diff.md
    fi
  done
fi

# Removed Filesの情報
if [ "$REMOVED" -gt 0 ]; then
  echo "" >> full_diff.md
  echo "## Removed Files" >> full_diff.md
  grep "Only in $BASE_DIR" diff_result.txt | while IFS= read -r line; do
    DIR=$(echo "$line" | sed "s/Only in \(.*\): .*/\1/" | sed "s|$BASE_DIR||")
    FILE=$(echo "$line" | sed 's/Only in .*: //')
    FULLPATH="$BASE_DIR${DIR}/${FILE}"
    FILEPATH="${DIR}/${FILE}"

    if [ -f "$FULLPATH" ]; then
      SIZE=$(stat -f%z "$FULLPATH" 2>/dev/null || stat -c%s "$FULLPATH" 2>/dev/null || echo "unknown")
      echo "- \`$FILEPATH\` (${SIZE} bytes)" >> full_diff.md
    fi
  done
fi

# diff-viewerリポジトリにプッシュ
echo "Pushing full diff to $DIFF_VIEWER_REPO..."
BRANCH_NAME="pr-${PR_NUMBER}-${PR_SHA}"

if git clone "https://x-access-token:${GH_TOKEN}@github.com/${DIFF_VIEWER_REPO}.git" diff-viewer 2>&1; then
  cd diff-viewer
  git fetch origin
  git checkout -B "$BRANCH_NAME"

  mkdir -p diffs
  cp ../full_diff.md "diffs/pr-${PR_NUMBER}-${PR_SHA}.md"

  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  git add .
  git commit -m "Add diff for PR #${PR_NUMBER} (${PR_SHA})" || true
  git push -f origin "$BRANCH_NAME"

  cd ..

  # GitHubのファイルURLを生成
  DIFF_URL="https://github.com/${DIFF_VIEWER_REPO}/blob/${BRANCH_NAME}/diffs/pr-${PR_NUMBER}-${PR_SHA}.md"
  echo "DIFF_URL=$DIFF_URL" >> "$GITHUB_OUTPUT"
  echo "Full diff URL: $DIFF_URL"
else
  echo "Warning: Could not clone diff-viewer repository. Skipping full diff upload."
  echo "This may happen if:"
  echo "  1. The repository does not exist: https://github.com/${DIFF_VIEWER_REPO}"
  echo "  2. The token does not have access to the repository"
  echo "  3. The repository settings do not allow access from this workflow"
  DIFF_URL=""
fi

# サマリーを出力
cat >> report.md <<EOF
#### Summary
- 🟢 Added: $ADDED files
- 🔴 Removed: $REMOVED files
- 🟡 Modified: $MODIFIED files

EOF

if [ -n "$DIFF_URL" ]; then
  echo "📊 [View Full Diff]($DIFF_URL)" >> report.md
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
