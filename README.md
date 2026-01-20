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
