#!/bin/bash
set -e

# 引数でディレクトリを指定（デフォルトは.next）
DIR="${1:-.next}"

echo "Formatting build directory: $DIR"

# staticディレクトリとbuild-manifest.jsonをフォーマット（BUILD_IDをマスキング）
node scripts/format-static-dir.ts "$DIR"

# 全ファイルのBUILD_IDをマスキング（RSC、HTML、その他すべて）
node scripts/mask-build-id.ts "$DIR" --build-id "$DIR/BUILD_ID"

# oxfmtで整形
pnpm exec oxfmt --write "$DIR"

echo "Formatting completed: $DIR"
