# Compare Action

GitHub ActionsでPRのビルド成果物の差分を視覚的に確認できるようにするワークフローです。

## 概要

このアクションは以下を実現します：

1. **PRのビルド成果物とベースブランチのビルド成果物を比較**
2. **差分を別リポジトリ（DIFF_VIEWER_REPO）にプッシュしてPRを作成**
3. **GitHubのPR画面で視覚的に差分を確認可能**
4. **PR本体にコメントで差分サマリーとリンクを投稿**
5. **元のPRがクローズされたら、diff viewer側のPRも自動クローズ**

## 機能

- ✅ コミットベースの差分検出
- ✅ カスタムフォーマットコマンドのサポート
- ✅ .gitignoreパターンでファイル除外
- ✅ 差分統計の自動計算（Added/Modified/Removed）
- ✅ PR本体へのコメント投稿
- ✅ 元PRクローズ時の自動クリーンアップ
- ✅ 再利用可能なワークフロー設計

## セットアップ

### 1. Diff Viewerリポジトリの準備

差分を表示するための専用リポジトリを作成します（例: `your-org/your-project-diff-viewer`）。

このリポジトリは空でOKです。GitHub Actionsが自動的にブランチとPRを作成します。

### 2. GitHub Appの作成（推奨）

Diff Viewerリポジトリへのアクセス権限を持つGitHub Appを作成します。

**必要な権限:**

- Repository permissions:
  - Contents: Read and write
  - Pull requests: Read and write

**アクセス可能なリポジトリ:**

- Diff Viewerリポジトリを選択

**Secrets設定:**

```yaml
APP_ID: <GitHub App ID>
APP_PRIVATE_KEY: <GitHub App Private Key>
```

### 3. ワークフローファイルの配置

以下のファイルをあなたのリポジトリにコピー:

```
.github/
  workflows/
    _compare-artifact.yml       # 再利用可能なワークフロー（コア）
    on-close.yml               # 自動クローズ用
  scripts/
    compare-artifacts.sh       # 差分比較スクリプト
```

## 基本的な使い方

### ステップ1: ビルドジョブの作成

PRのビルド成果物をアーティファクトとしてアップロードします。

```yaml
name: Build and Compare on Pull Request

on:
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      sha_short: ${{ steps.vars.outputs.sha_short }}
    steps:
      - uses: actions/checkout@v4
      - name: Setup and Build
        run: |
          npm install
          npm run build

      - name: Set short SHA
        id: vars
        run: echo "sha_short=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-pr-${{ steps.vars.outputs.sha_short }}
          path: dist # ビルド成果物のパス
```

### ステップ2: 差分比較ワークフローの呼び出し

```yaml
compare:
  needs: build
  uses: ./.github/workflows/_compare-artifact.yml
  permissions:
    pull-requests: write
    contents: read
    actions: read
  secrets:
    app_id: ${{ secrets.APP_ID }}
    app_private_key: ${{ secrets.APP_PRIVATE_KEY }}
  with:
    pr_sha: ${{ needs.build.outputs.sha_short }}
    base_ref: ${{ github.base_ref }}
    diff_viewer_repo: "your-org/your-project-diff-viewer"
    base_dir: "dist"
    pr_dir: "dist"
```

### ステップ3: mainブランチのビルド

mainブランチでも同様のビルドを実行し、アーティファクトをアップロードします。

```yaml
name: Build on Push to Main

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup and Build
        run: |
          npm install
          npm run build

      - name: Set short SHA
        id: vars
        run: echo "sha_short=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-main-${{ steps.vars.outputs.sha_short }}
          path: dist
```

## 設定オプション

### 必須パラメータ

| パラメータ         | 説明                      | 例                       |
| ------------------ | ------------------------- | ------------------------ |
| `pr_sha`           | PRのコミットSHA（短縮形） | `abc1234`                |
| `base_ref`         | ベースブランチ名          | `main`                   |
| `diff_viewer_repo` | 差分表示用リポジトリ      | `owner/repo-diff-viewer` |

### オプションパラメータ

| パラメータ           | デフォルト      | 説明                                       |
| -------------------- | --------------- | ------------------------------------------ |
| `gitignore_patterns` | `node_modules/` | 除外するファイルパターン（スペース区切り） |
| `format_command`     | `""`            | 差分表示前に実行するフォーマットコマンド   |
| `base_dir`           | `.next-base`    | ベースブランチのビルド成果物パス           |
| `pr_dir`             | `.next-pr`      | PRブランチのビルド成果物パス               |
| `enable_comment`     | `true`          | PR本体へのコメント投稿を有効化             |

## 高度な使い方

### カスタムフォーマットコマンド

ビルド成果物を人間が読みやすい形式に整形してから差分を取ることができます。

```yaml
with:
  format_command: "pnpm exec prettier --write"
```

または独自のスクリプト:

```yaml
with:
  format_command: "./scripts/format-artifacts.sh"
```

### 複数のファイルパターンを除外

```yaml
with:
  gitignore_patterns: |
    node_modules
    cache
    *.log
    .DS_Store
```

### コメント投稿を無効化

```yaml
with:
  enable_comment: false
```

## 出力される情報

### PRコメント

```markdown
### 🛠 Build Artifacts Diff

🔗 **View full diff: https://github.com/owner/repo-diff-viewer/pull/123**

**Base**: [`main@abc1234`](https://github.com/owner/repo/commit/abc1234)
**Head**: [`PR@def5678`](https://github.com/owner/repo/commit/def5678)
**Compare**: [abc1234...def5678](https://github.com/owner/repo/compare/abc1234...def5678)

#### Summary

- 🟢 Added: 3 files
- 🔴 Removed: 1 files
- 🟡 Modified: 5 files
```

### Diff Viewer PR

Diff Viewerリポジトリに自動的にPRが作成され、以下の情報が含まれます：

- ファイルごとの差分（GitHubのUI上で確認可能）
- 元のPRへのリンク
- 差分統計

## 動作の仕組み

1. **ビルド**: PRとベースブランチでそれぞれビルドを実行
2. **アーティファクト保存**: ビルド成果物をGitHub Actionsのアーティファクトとして保存
3. **差分計算**: 両方のアーティファクトをダウンロードして比較
4. **フォーマット**: 指定されたコマンドで成果物を整形（オプション）
5. **プッシュ**: Diff Viewerリポジトリに2つのブランチを作成
   - `build-main-{sha}`: ベースブランチのビルド成果物
   - `build-pr-{pr_number}`: PRのビルド成果物
6. **PR作成**: Diff Viewerリポジトリで上記ブランチ間のPRを作成
7. **コメント投稿**: 元のPRに差分情報とリンクをコメント
8. **自動クローズ**: 元のPRがクローズされたら、Diff Viewer側のPRも自動クローズ

## トラブルシューティング

### 差分が表示されない

- mainブランチのビルドアーティファクトが存在するか確認
- ワークフロー名が一致しているか確認（`on-push-main.yml`など）
- アーティファクト名の命名規則が一致しているか確認

### GitHub Appの権限エラー

- GitHub AppがDiff Viewerリポジトリへのアクセス権を持っているか確認
- Contents: Read and write権限があるか確認
- Pull requests: Read and write権限があるか確認

### フォーマットコマンドが失敗する

- フォーマットコマンドが実行環境にインストールされているか確認
- ビルドジョブで依存関係をインストールしているか確認

## ライセンス

MIT

## 貢献

Pull Requestを歓迎します！
