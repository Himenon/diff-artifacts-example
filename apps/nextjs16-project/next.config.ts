import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => {
    return process.env.CI_BUILD_ID || null;
  },
};

export default nextConfig;
