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

# 全ファイルのBUILD_IDをマスキング（RSC、HTML、その他すべて）
echo "Running mask-build-id.ts..."
node scripts/mask-build-id.ts "$DIR" --build-id "$DIR/BUILD_ID"

# oxfmtで整形
echo "Running oxfmt..."
pnpm exec oxfmt --write "$DIR"

echo "Formatting completed: $DIR"
