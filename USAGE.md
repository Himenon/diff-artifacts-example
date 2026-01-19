# 使用例

## 別のリポジトリから呼び出す（Composite Action）

### 例1: シンプルなNext.jsプロジェクト

```yaml
name: Build and Compare

on:
  pull_request:
    types: [opened, synchronize]
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      sha_short: ${{ steps.vars.outputs.sha_short }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: Set short SHA
        id: vars
        run: echo "sha_short=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      # mainブランチの場合
      - name: Upload Main Artifact
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: build-main-${{ steps.vars.outputs.sha_short }}
          path: .next

      # PRの場合
      - name: Upload PR Artifact
        if: github.event_name == 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: build-pr-${{ steps.vars.outputs.sha_short }}
          path: .next

  compare:
    if: github.event_name == 'pull_request'
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
      actions: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get base SHA
        id: base-sha
        run: |
          git fetch origin ${{ github.base_ref }}
          SHA=$(git rev-parse origin/${{ github.base_ref }})
          echo "short=$(echo $SHA | cut -c1-7)" >> $GITHUB_OUTPUT

      - name: Compare Artifacts
        uses: your-org/compare-action@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          app-id: ${{ secrets.DIFF_VIEWER_APP_ID }}
          app-private-key: ${{ secrets.DIFF_VIEWER_APP_PRIVATE_KEY }}
          pr-sha: ${{ needs.build.outputs.sha_short }}
          base-ref: ${{ github.base_ref }}
          diff-viewer-repo: your-org/your-project-diff-viewer
          diff-viewer-owner: your-org
          diff-viewer-repo-name: your-project-diff-viewer
          base-artifact-name: build-main-${{ steps.base-sha.outputs.short }}
          pr-artifact-name: build-pr-${{ needs.build.outputs.sha_short }}
          base-artifact-path: .next
          pr-artifact-path: .next
```

### 例2: フォーマットコマンドを使用する場合

```yaml
compare:
  if: github.event_name == 'pull_request'
  needs: build
  runs-on: ubuntu-latest
  permissions:
    pull-requests: write
    contents: read
    actions: read
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Get base SHA
      id: base-sha
      run: |
        git fetch origin ${{ github.base_ref }}
        SHA=$(git rev-parse origin/${{ github.base_ref }})
        echo "short=$(echo $SHA | cut -c1-7)" >> $GITHUB_OUTPUT

    # フォーマットコマンドに必要な依存関係をセットアップ
    - uses: pnpm/action-setup@v4
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm

    - name: Compare Artifacts
      uses: your-org/compare-action@main
      with:
        github-token: ${{ secrets.GITHUB_TOKEN }}
        app-id: ${{ secrets.DIFF_VIEWER_APP_ID }}
        app-private-key: ${{ secrets.DIFF_VIEWER_APP_PRIVATE_KEY }}
        pr-sha: ${{ needs.build.outputs.sha_short }}
        base-ref: ${{ github.base_ref }}
        diff-viewer-repo: your-org/your-project-diff-viewer
        diff-viewer-owner: your-org
        diff-viewer-repo-name: your-project-diff-viewer
        base-artifact-name: build-main-${{ steps.base-sha.outputs.short }}
        pr-artifact-name: build-pr-${{ needs.build.outputs.sha_short }}
        base-artifact-path: .next
        pr-artifact-path: .next
        format-command: "pnpm exec oxfmt" # カスタムフォーマットツール
        install-dependencies: "true" # pnpm installを実行
        gitignore-patterns: |
          node_modules
          cache
          trace
```

### 例3: 複数のディレクトリを比較する場合

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      sha_short: ${{ steps.vars.outputs.sha_short }}
    steps:
      - uses: actions/checkout@v4

      - run: npm ci
      - run: npm run build

      - name: Set short SHA
        id: vars
        run: echo "sha_short=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      - name: Upload Artifact
        uses: actions/upload-artifact@v4
        with:
          name: build-${{ github.event_name == 'pull_request' && 'pr' || 'main' }}-${{ steps.vars.outputs.sha_short }}
          path: |
            dist/
            public/
            .next/

  compare:
    if: github.event_name == 'pull_request'
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
      actions: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get base SHA
        id: base-sha
        run: |
          git fetch origin ${{ github.base_ref }}
          SHA=$(git rev-parse origin/${{ github.base_ref }})
          echo "short=$(echo $SHA | cut -c1-7)" >> $GITHUB_OUTPUT

      - name: Compare Artifacts
        uses: your-org/compare-action@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          app-id: ${{ secrets.DIFF_VIEWER_APP_ID }}
          app-private-key: ${{ secrets.DIFF_VIEWER_APP_PRIVATE_KEY }}
          pr-sha: ${{ needs.build.outputs.sha_short }}
          base-ref: ${{ github.base_ref }}
          diff-viewer-repo: your-org/your-project-diff-viewer
          diff-viewer-owner: your-org
          diff-viewer-repo-name: your-project-diff-viewer
          base-artifact-name: build-main-${{ steps.base-sha.outputs.short }}
          pr-artifact-name: build-pr-${{ needs.build.outputs.sha_short }}
          base-artifact-path: build-base
          pr-artifact-path: build-pr
          gitignore-patterns: |
            node_modules
            *.map
            *.log
```

## 同じリポジトリ内で使用する（Reusable Workflow）

### ワークフローファイルの配置

1. `.github/workflows/_compare-artifact.yml`を配置
2. `.github/scripts/compare-artifacts.sh`を配置（または`scripts/compare-artifacts.sh`）

### 使用例

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
      - run: npm ci
      - run: npm run build

      - name: Set short SHA
        id: vars
        run: echo "sha_short=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      - name: Upload PR Artifact
        uses: actions/upload-artifact@v4
        with:
          name: build-pr-${{ steps.vars.outputs.sha_short }}
          path: dist

  compare:
    needs: build
    uses: ./.github/workflows/_compare-artifact.yml
    permissions:
      pull-requests: write
      contents: read
      actions: read
    secrets:
      app_id: ${{ secrets.DIFF_VIEWER_APP_ID }}
      app_private_key: ${{ secrets.DIFF_VIEWER_APP_PRIVATE_KEY }}
    with:
      pr_sha: ${{ needs.build.outputs.sha_short }}
      base_ref: main
      diff_viewer_repo: your-org/your-project-diff-viewer
      gitignore_patterns: "node_modules/ .cache/"
      format_command: "pnpm exec oxfmt"
      enable_comment: true
```

## トラブルシューティング

### エラー: "Artifact not found"

**原因**: ベースブランチのアーティファクトが見つからない

**解決方法**:

1. mainブランチで最近ビルドが実行されたか確認
2. アーティファクト名が正しいか確認
3. `base-workflow-name`パラメータを確認

```yaml
- name: Check if base artifact exists
  run: |
    gh run list --branch main --workflow build.yml --limit 5
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### エラー: "Permission denied"

**原因**: GitHub Appの権限が不足している

**解決方法**:

1. GitHub Appの設定を確認
2. 必要な権限: `contents: write`, `pull_requests: write`
3. GitHub AppがDiff Viewerリポジトリにインストールされているか確認

### フォーマットコマンドが失敗する

**原因**: コマンドが見つからないか、依存関係が不足

**解決方法**:

1. `install-dependencies: "true"`を設定
2. または、compareジョブで事前に依存関係をインストール:

```yaml
steps:
  - uses: pnpm/action-setup@v4
  - uses: actions/setup-node@v4
    with:
      cache: pnpm
  - run: pnpm install --frozen-lockfile

  - name: Compare Artifacts
    uses: your-org/compare-action@main
    with:
      format-command: "pnpm exec oxfmt"
      install-dependencies: "false" # 既にインストール済み
      # ... その他のパラメータ
```

### 差分が大きすぎる

**原因**: 不要なファイルが含まれている

**解決方法**:

1. `gitignore-patterns`を追加:

```yaml
with:
  gitignore-patterns: |
    node_modules
    cache
    *.map
    *.log
    .DS_Store
    trace
```

## ベストプラクティス

### 1. アーティファクト名の命名規則

- mainブランチ: `build-main-{short_sha}`
- PRブランチ: `build-pr-{short_sha}`

これにより、同じSHAのアーティファクトを一意に識別できます。

### 2. アーティファクトの保持期間

```yaml
- name: Upload Artifact
  uses: actions/upload-artifact@v4
  with:
    name: build-pr-${{ steps.vars.outputs.sha_short }}
    path: .next
    retention-days: 7 # 7日間保持
```

### 3. 大きなアーティファクトの扱い

不要なファイルを除外:

```yaml
- name: Upload Artifact
  uses: actions/upload-artifact@v4
  with:
    name: build-pr-${{ steps.vars.outputs.sha_short }}
    path: .next
    # 不要なファイルを除外
    exclude: |
      **/*.map
      **/cache/**
      **/node_modules/**
```

### 4. セキュリティ

- GitHub App Tokenは必ずSecretsに保存
- 最小権限の原則に従う
- Diff Viewerリポジトリは適切なアクセス制御を設定

### 5. パフォーマンス最適化

```yaml
# キャッシュを活用
- uses: actions/cache@v4
  with:
    path: .next/cache
    key: ${{ runner.os }}-nextjs-${{ hashFiles('package-lock.json') }}

# 並列実行
jobs:
  build-main:
    if: github.ref == 'refs/heads/main'
    # ...

  build-pr:
    if: github.event_name == 'pull_request'
    # ...

  compare:
    needs: [build-pr]
    # ...
```
