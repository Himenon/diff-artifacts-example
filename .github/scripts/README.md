# Compare Artifacts Script

## 概要

このスクリプトは、ビルドアーティファクトの差分を比較し、別リポジトリに完全な差分をプッシュします。

## セットアップ

### diff-viewer リポジトリの準備

`Himenon/compare-action-diff-viewer` リポジトリで以下の設定を行います：

1. リポジトリの Settings → Actions → General
2. "Workflow permissions" セクションで "Read and write permissions" を選択
3. "Access" セクションで "Accessible from repositories owned by the user 'Himenon'" をチェック

これにより、同じオーナーの他のリポジトリから `GITHUB_TOKEN` を使ってプッシュできるようになります。

## 環境変数

### 必須

- `COMMENT_MARKER` - PRコメントの識別マーカー
- `BASE_SHA_SHORT` - ベースブランチのコミットハッシュ (短縮版)
- `PR_SHA` - PRのコミットハッシュ (短縮版)
- `GH_TOKEN` - GitHubトークン (PAT推奨)
- `GITHUB_REPOSITORY` - リポジトリ名 (例: `owner/repo`)
- `PR_NUMBER` - PR番号
- `GITHUB_OUTPUT` - GitHub Actionsの出力ファイルパス

### オプション (デフォルト値あり)

- `DIFF_VIEWER_REPO` - 差分表示用リポジトリ (デフォルト: `Himenon/compare-action-diff-viewer`)
- `BASE_DIR` - ベースディレクトリ (デフォルト: `.next-base`)
- `PR_DIR` - PRディレクトリ (デフォルト: `.next-pr`)
- `MAX_MODIFIED_FILES` - 表示する変更ファイル数の上限 (デフォルト: `10`)
- `MAX_ADDED_FILES` - 表示する追加ファイル数の上限 (デフォルト: `20`)
- `MAX_REMOVED_FILES` - 表示する削除ファイル数の上限 (デフォルト: `20`)

## ローカルでのテスト

```bash
export COMMENT_MARKER="<!-- test -->"
export BASE_SHA_SHORT="abc1234"
export PR_SHA="def5678"
export GH_TOKEN="your-pat-token"
export GITHUB_REPOSITORY="owner/repo"
export PR_NUMBER="123"
export GITHUB_OUTPUT="/tmp/github_output.txt"

./.github/scripts/compare-artifacts.sh
```

## トラブルシューティング

### `Permission denied` エラー

diff-viewerリポジトリの設定を確認してください：
- Settings → Actions → General → "Accessible from repositories owned by the user 'Himenon'" がチェックされているか
- Workflow permissions が "Read and write permissions" になっているか

### `Artifact not found` エラー

- ベースブランチでビルドが実行されているか確認
- アーティファクトが有効期限内か確認
- アーティファクト名が正しいか確認

### `Argument list too long` エラー

- `MAX_MODIFIED_FILES`, `MAX_ADDED_FILES`, `MAX_REMOVED_FILES` の値を減らしてください
