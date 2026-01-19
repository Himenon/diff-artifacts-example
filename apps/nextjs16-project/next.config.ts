import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => {
    return process.env.CI_BUILD_ID || "fixed-build-id";
  },
  turbopack: {},
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.chunkIds = 'deterministic';
      config.optimization.moduleIds = 'deterministic';
    }
    return config;
  },
};

export default nextConfig;
