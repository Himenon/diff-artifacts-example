#!/bin/bash
set -e

# 引数でディレクトリを指定（デフォルトは.next）
DIR="${1:-.next}"

echo "Formatting build directory: $DIR"

# RSCファイルをJSON形式にフォーマット
pnpm exec node ./scripts/format-rsc.ts "$DIR/**/*.rsc"

# oxfmtで整形
pnpm exec oxfmt --write "$DIR"

echo "Formatting completed: $DIR"
