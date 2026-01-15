#!/bin/bash
set -e

# 引数でディレクトリを指定（デフォルトは.next）
DIR="${1:-.next}"

echo "Formatting build directory: $DIR"

# RSCファイルをフォーマット（buildIdをマスキング）し、JSON形式も生成
node scripts/cli.ts --json "$DIR/**/*.rsc"

# oxfmtで整形
pnpm exec oxfmt --write "$DIR"

echo "Formatting completed: $DIR"
