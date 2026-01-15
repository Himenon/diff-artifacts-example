#!/bin/bash
set -e

# 引数でディレクトリを指定（デフォルトは.next）
DIR="${1:-.next}"

echo "Formatting build directory: $DIR"

# BUILD_IDファイルの存在確認
if [ ! -f "$DIR/BUILD_ID" ]; then
  echo "Error: BUILD_ID file not found at $DIR/BUILD_ID"
  exit 1
fi

# oxfmtで整形
echo "Running oxfmt..."
pnpm exec oxfmt --write "$DIR"

echo "[DEBUG] BEFORE"
cat "$DIR/server/pages/404.html" | head -n 3
echo "[DEBUG] BEFORE"

# 全ファイルのBUILD_IDをマスキング（RSC、HTML、その他すべて）
echo "Starting mask-build-id.ts..."
node scripts/mask-build-id.ts "$DIR" --build-id "$DIR/BUILD_ID"
EXIT_CODE=$?
echo "mask-build-id.ts exited with code: $EXIT_CODE"
if [ $EXIT_CODE -ne 0 ]; then
  echo "Error: mask-build-id.ts failed"
  exit $EXIT_CODE
fi

echo "[DEBUG] AFTER"
cat "$DIR/server/pages/404.html" | head -n 3
echo "[DEBUG] AFTER"

echo "✨️ Formatting completed: $DIR"
echo ""
echo "---------------------------------------------------------------------------------"
echo ""
