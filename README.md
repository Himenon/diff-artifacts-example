# @Himenon/diff-artifacts-example

## Example: Next.js

This repository demonstrates how to fix BUILD_ID in Next.js applications (v14, v15, v16) to enable consistent artifact comparison across builds. By setting a custom `generateBuildId` function, you can control the build ID using environment variables.

### Next.js v15, v16

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => {
    return process.env.CI_BUILD_ID || null;
  },
};

export default nextConfig;
```

### Next.js v14

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: async () => {
    return process.env.CI_BUILD_ID || null;
  },
};

export default nextConfig;
```

## GitHub Actions

Diff Viewer Repo: <https://github.com/Himenon/diff-artifacts-example-diff-viewer>

### For Pull Requests:

```yaml
name: Build and Compare Artifacts on Pull Request

on:
  pull_request:

jobs:
  build:
    # ...
    steps:
      # some build steps
      - uses: Himenon/upload-diff-artifact@v1.0.0
        with:
          path: |
            apps/nextjs14-project/.next  
            apps/nextjs15-project/.next
            apps/nextjs16-project/.next

  diff-artifacts:
    needs: build
    # ...
    permissions:
      pull-requests: write
      contents: read
      actions: read
    steps:
      # Setup for pre-push-shell command
      - name: Diff Artifacts
        uses: Himenon/diff-artifact@v1.0.0
        with:
          app-id: ${{ secrets.APP_ID }}
          app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
          diff-viewer-owner: "Himenon"
          diff-viewer-repo-name: "diff-artifacts-example-diff-viewer"
          gitignore-patterns: |
            node_modules
            cache
            trace
            trace-build

          # Needs Setup clone git repository, pnpm and install oxfmt
          pre-push-shell: "pnpm exec oxfmt"
```

### After Close PR Events

```yaml
name: "Close DIFF_VIEWER_REPO PRs on PR close"

on:
  pull_request:
    types:
      - closed

jobs:
  close-diff-viewer-pr:
    name: Close diff viewer PR
    runs-on: ubuntu-slim
    timeout-minutes: 3
    steps:
      - uses: Himenon/close-diff-artifact-pr@v1.0.0
        with:
          app-id: ${{ secrets.APP_ID }}
          app-private-key: ${{ secrets.APP_PRIVATE_KEY }}
          diff-viewer-owner: Himenon
          diff-viewer-repo-name: diff-artifacts-example-diff-viewer
```

### For Push `main(default)` Branch

```yaml
name: Build & Push Diff Artifact

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      # some build steps ...
      - uses: Himenon/upload-diff-artifact@v1.0.0
        with:
          path: |
            apps/nextjs14-project/.next
            apps/nextjs15-project/.next
            apps/nextjs16-project/.next
```
