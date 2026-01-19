import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => {
    return process.env.CI_BUILD_ID || null;
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer && process.env.CI_BUILD_ID) {
      config.optimization.chunkIds = 'deterministic';
    }
    return config;
  },
};

export default nextConfig;
