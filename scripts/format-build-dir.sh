#!/bin/bash
set -e

# 引数でディレクトリを指定（デフォルトは.next）
DIR="${1:-.next}"

echo "Formatting build directory: $DIR"

# staticディレクトリとbuild-manifest.jsonをフォーマット（BUILD_IDをマスキング）
node scripts/format-static-dir.ts "$DIR"

# RSCファイルをフォーマット（buildIdをマスキング）し、JSON形式も生成
node scripts/cli.ts --json "$DIR/**/*.rsc"

# HTMLファイルをフォーマット（BUILD_IDをマスキング）
node scripts/cli.ts --html "$DIR"

# oxfmtで整形
pnpm exec oxfmt --write "$DIR"

echo "Formatting completed: $DIR"
