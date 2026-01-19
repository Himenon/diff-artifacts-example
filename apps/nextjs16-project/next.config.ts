import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => {
    return process.env.CI_BUILD_ID || "fixed-build-id";
  },
  turbopack: {},
  webpack: (config, { dev }) => {
    if (process.env.CI_BUILD_ID) {
      config.optimization.chunkIds = 'deterministic';
      config.optimization.moduleIds = 'deterministic';

      // ハッシュ関数とハッシュの長さを固定化
      config.output.hashFunction = 'xxhash64';
      config.output.hashDigest = 'hex';
      config.output.hashDigestLength = 8;
    }
    return config;
  },
};

export default nextConfig;
