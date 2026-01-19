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

## 入力パラメータ一覧（Composite Action用）

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `github-token` | No | `${{ github.token }}` | GitHub token for API access |
| `app-id` | Yes | - | GitHub App ID |
| `app-private-key` | Yes | - | GitHub App Private Key |
| `pr-sha` | Yes | - | PRのコミットSHA（短縮形推奨） |
| `base-ref` | Yes | - | ベースブランチ名（例: `main`） |
| `diff-viewer-repo` | Yes | - | 差分表示用リポジトリ（例: `owner/repo`） |
| `diff-viewer-owner` | Yes | - | 差分表示用リポジトリのオーナー |
| `diff-viewer-repo-name` | Yes | - | 差分表示用リポジトリ名（オーナーなし） |
| `base-artifact-name` | Yes | - | ベースのアーティファクト名 |
| `pr-artifact-name` | Yes | - | PRのアーティファクト名 |
| `base-artifact-path` | No | `.next-base` | ベースアーティファクトのダウンロード先 |
| `pr-artifact-path` | No | `.next-pr` | PRアーティファクトのダウンロード先 |
| `gitignore-patterns` | No | `node_modules/` | 除外パターン（改行区切り） |
| `format-command` | No | `""` | フォーマットコマンド（例: `pnpm exec oxfmt`） |
| `enable-comment` | No | `true` | PRコメント投稿を有効化 |
| `base-workflow-name` | No | `on-push-main.yml` | ベースブランチのワークフロー名 |
| `node-version-file` | No | `package.json` | Node.jsバージョンファイル |
| `pnpm-version` | No | `latest` | PNPMバージョン |
| `install-dependencies` | No | `false` | 依存関係をインストールするか |

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
    on-close.yml               # 自動クローズ用（要カスタマイズ）
  scripts/
    compare-artifacts.sh       # 差分比較スクリプト
```

**重要**: `on-close.yml`をコピーした後、以下の箇所を編集してください：

- `owner`: GitHub organizationまたはユーザー名
- `repositories`: Diff Viewerリポジトリ名（リポジトリ名のみ、owner不要）
- `DIFF_VIEWER_REPO`: 完全なリポジトリ名（例: `your-org/your-project-diff-viewer`）

詳細は`on-close.yml`内のTODOコメントを参照してください。

## 使い方

このアクションは2つの方法で使用できます：

1. **Composite Action**: 別のリポジトリから直接呼び出す（推奨）
2. **Reusable Workflow**: 同じリポジトリ内で再利用可能なワークフローとして呼び出す

### 方法1: Composite Actionとして使用（別リポジトリから呼び出す）

他のリポジトリから直接このアクションを呼び出すことができます。

```yaml
name: Build and Compare

on:
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      sha_short: ${{ steps.vars.outputs.sha_short }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # ビルドステップ
      - name: Setup and Build
        run: |
          npm install
          npm run build

      - name: Set short SHA
        id: vars
        run: echo "sha_short=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      # PRのアーティファクトをアップロード
      - name: Upload PR Artifact
        uses: actions/upload-artifact@v4
        with:
          name: build-pr-${{ steps.vars.outputs.sha_short }}
          path: dist

  compare:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 必須: ベースブランチとの比較に必要

      # ベースブランチのSHAを取得
      - name: Get base SHA
        id: base-sha
        run: |
          git fetch origin main
          SHA=$(git rev-parse origin/main)
          echo "short=$(echo $SHA | cut -c1-7)" >> $GITHUB_OUTPUT

      - name: Compare Artifacts
        uses: your-org/compare-action@v1  # このリポジトリを指定
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          app-id: ${{ secrets.DIFF_VIEWER_APP_ID }}
          app-private-key: ${{ secrets.DIFF_VIEWER_APP_PRIVATE_KEY }}
          pr-sha: ${{ needs.build.outputs.sha_short }}
          base-ref: main
          diff-viewer-repo: your-org/your-project-diff-viewer
          diff-viewer-owner: your-org
          diff-viewer-repo-name: your-project-diff-viewer
          base-artifact-name: build-main-${{ steps.base-sha.outputs.short }}
          pr-artifact-name: build-pr-${{ needs.build.outputs.sha_short }}
          base-artifact-path: dist
          pr-artifact-path: dist
          format-command: "npx prettier --write"
          gitignore-patterns: "node_modules/ .cache/"
          enable-comment: "true"
          install-dependencies: "false"  # フォーマットコマンドに依存関係が必要な場合はtrue
```

### 方法2: Reusable Workflowとして使用（同じリポジトリ内）

#### ステップ1: ビルドジョブの作成

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
