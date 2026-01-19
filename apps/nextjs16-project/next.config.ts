import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => {
    return process.env.CI_BUILD_ID || null;
  },
  experimental: {
    cssChunking: false,
    optimizeCss: false,
  },
  turbopack: {
    debugIds: true
  }
};

export default nextConfig;
